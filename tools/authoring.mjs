import { execFile } from 'node:child_process';
import { mkdir, writeFile, rm, readdir, rename, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PYTHON_SPEC } from './python-spec.mjs';
import { DRAWINGS, projectPath, localPath, exists, loadState, saveState, viewPrefix, viewIds, rigName, fingerprint, stepSnapshot, stepState, recordStep, packSnapshot, readAuthoringStatus } from './authoring-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const actions = ['status', 'prepare', 'rig', 'build', 'heads', 'requests', 'sprites', 'render', 'reviewed', 'pack'];

export function mergeRigPatch(rig, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('A rig patch must be a JSON object.');
  const merge = (base, change) => {
    const result = structuredClone(base);
    for (const [key, value] of Object.entries(change)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid rig patch key.');
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (result[key] !== undefined && (!result[key] || typeof result[key] !== 'object' || Array.isArray(result[key]))) throw new Error(`Expected a rig object: ${key}`);
        result[key] = merge(result[key] ?? {}, value);
      } else result[key] = value;
    }
    return result;
  };
  const result = merge(rig, patch);
  if (JSON.stringify(result.image) !== JSON.stringify(rig.image) || result.version !== rig.version) throw new Error('A patch cannot change source dimensions or rig version.');
  if (JSON.stringify(result.head?.views) !== JSON.stringify(rig.head?.views) || JSON.stringify(result.head?.pitch?.views) !== JSON.stringify(rig.head?.pitch?.views)) throw new Error('Register head drawings with pack, not a rig patch.');
  return result;
}

export async function runLocal(root, project, command, args) {
  const logName = `.authoring/logs/${Date.now()}-${Math.random().toString(16).slice(2)}.log`;
  const log = await localPath(project, logName);
  await mkdir(dirname(log), { recursive: true });
  await new Promise((done, reject) => execFile(command, args, { cwd: root, timeout: 300_000, maxBuffer: 8 * 1024 * 1024 }, async (error, stdout, stderr) => {
    try {
      await writeFile(log, `${stdout}\n${stderr}${error ? `\n${error.message}\n` : ''}`);
      if (error) reject(new Error(`Local step failed. Inspect ${relative(root, log)} (${error.code ?? 'tool error'}).`));
      else done();
    } catch (failure) { reject(failure); }
  }));
}

export async function runAuthoring(root, input, action, options = {}, runner = runLocal) {
  if (!actions.includes(action)) throw new Error(`Use one of: ${actions.join(', ')}.`);
  const project = await projectPath(root, input);
  if (action === 'status') return readAuthoringStatus(root, project);
  const id = options.view ?? 'neutral';
  if (!(await viewIds(project)).includes(id)) throw new Error('Unknown authoring view.');
  const prefix = viewPrefix(id), workspace = await localPath(project, prefix || '.');
  if (!await exists(project, `${prefix}source.png`)) throw new Error('Source missing. Prepare/accept the head drawing first; never initialize a sibling project.');
  // Existing tools intentionally support legacy invocation. This orchestrator adds
  // freshness/review gates without changing their contracts or runtime formats.
  for (const name of [`${prefix}built`, `${prefix}variants`, `${prefix}variant-requests`, `${prefix}variant-masks`, `${prefix}.authoring`, `${prefix}review`, 'head-views/requests']) await fingerprint(project, [name]);
  await localPath(project, `${prefix}rig.json`); await localPath(project, await rigName(project, prefix));
  const lock = await localPath(project, '.authoring/lock');
  await mkdir(dirname(lock), { recursive: true });
  try { await mkdir(lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error('An authoring command is running. If its process ended, remove .authoring/lock and retry.');
    throw error;
  }
  try {
    const state = await loadState(project), rig = await rigName(project, prefix);
    const node = (tool, args = []) => runner(root, project, process.execPath, ['--experimental-strip-types', resolve(root, `tools/${tool}.mjs`), ...args]);
    const python = (tool, args = []) => runner(root, project, 'uv', ['run', '--no-project', '--no-python-downloads', '--python', PYTHON_SPEC, '--with', 'numpy', '--with', 'pillow', '--with', 'opencv-python-headless', resolve(root, `tools/${tool}.py`), ...args]);
    const requireStep = async (step, target = id) => {
      if (await stepState(project, state, target, step) !== 'current') throw new Error(`${target}: ${step} is pending or stale. Run status and finish that step first.`);
    };
    const current = step => stepState(project, state, id, step);
    const skip = async step => !options.force && await current(step) === 'current';
    const runStep = async (step, operation) => {
      const before = await stepSnapshot(project, id, step);
      await operation();
      const after = await stepSnapshot(project, id, step);
      if (before.inputs !== after.inputs) throw new Error(`Inputs changed during ${step}. No success receipt was saved; finish editing and rerun the step.`);
      await recordStep(project, state, id, step);
    };
    let skipped = false;
    if (action === 'rig') {
      if (!options.patch) throw new Error('rig requires --patch <project-relative JSON file>.');
      const patchPath = await localPath(project, options.patch);
      const candidate = mergeRigPatch(JSON.parse(await readFile(await localPath(project, rig), 'utf8')), JSON.parse(await readFile(patchPath, 'utf8')));
      const temporary = await localPath(project, `${prefix}.authoring/rig-${randomUUID()}.draft.json`);
      await mkdir(dirname(temporary), { recursive: true });
      try {
        await writeFile(temporary, JSON.stringify(candidate, null, 2) + '\n', { flag: 'wx' });
        await node('validate-rig', [temporary]);
        const backup = await localPath(project, `${prefix}.authoring/rig-backups/${randomUUID()}.json`);
        await mkdir(dirname(backup), { recursive: true });
        await writeFile(backup, await readFile(await localPath(project, rig)), { flag: 'wx' });
        await rename(temporary, await localPath(project, `${prefix}rig.draft.json`));
      } finally { await rm(temporary, { force: true }); }
    } else if (action === 'prepare') {
      if (await skip('survey')) skipped = true;
      else {
        await runStep('survey', () => python('authoring-review', ['geometry', project, '--view', id]));
      }
    } else if (action === 'build') {
      if (await skip('build') && await skip('survey')) skipped = true;
      else {
        await node('validate-rig', [await localPath(project, rig)]);
        if (!await skip('build')) {
          await runStep('build', async () => {
            await python('build-layers', [workspace, '--rig', rig.slice(prefix.length)]);
            await node('validate-avatar', [workspace]);
          });
        }
        await runStep('survey', () => python('authoring-review', ['geometry', project, '--view', id]));
      }
    } else if (action === 'reviewed') {
      if (!['geometry', 'final'].includes(options.scope) || !options.note?.trim()) throw new Error('reviewed requires --scope geometry|final and --note describing actual visual findings (including defects).');
      await requireStep('build'); await requireStep('survey'); await requireStep('render');
      if (options.scope === 'final') {
        await requireStep('geometry'); await requireStep('requests'); await requireStep('sprites');
        if (id === 'neutral') {
          const packed = await packSnapshot(project);
          if (!state.pack || packed.inputs !== state.pack.inputs || packed.outputs !== state.pack.outputs) throw new Error('Pack all head views before the final root review.');
        }
      }
      await recordStep(project, state, id, options.scope === 'geometry' ? 'geometry' : 'review', options.note.trim());
    } else if (action === 'heads') {
      if (id !== 'neutral') throw new Error('Prepare head requests from the neutral root.');
      await requireStep('geometry');
      await python('head-views', ['prepare', project]);
    } else if (action === 'requests') {
      await requireStep('geometry');
      if (await skip('requests') && !options.refresh && !options.adopt) skipped = true;
      else {
        if (options.refresh && options.adopt) throw new Error('Choose --refresh or --adopt, not both.');
        const hasRequests = (await readdir(await localPath(project, `${prefix}variant-requests`)).catch(error => { if (error.code === 'ENOENT') return []; throw error; })).length > 0;
        if (hasRequests && !options.refresh && !options.adopt) throw new Error('Existing masks/prompts preserved. Review them, then use requests --adopt; use --refresh only to explicitly regenerate them.');
        await runStep('requests', async () => {
          if (!options.adopt) await python('variant-requests', [workspace]);
          for (const name of DRAWINGS) for (const file of ['mask.png', 'prompt.md']) {
            if (!await exists(project, `${prefix}variant-requests/${name}/${file}`)) throw new Error(`${name}/${file} missing.`);
          }
        });
      }
    } else if (action === 'sprites') {
      await requireStep('build'); await requireStep('geometry'); await requireStep('requests');
      const missing = [];
      for (const name of DRAWINGS) if (!await exists(project, `${prefix}variants/${name}.png`)) missing.push(name);
      if (missing.length) throw new Error(`Drawn assets pending: ${missing.join(', ')}. Confirm current-conversation consent and use imagegen; no procedural substitute.`);
      if (await skip('sprites')) skipped = true;
      else {
        await runStep('sprites', async () => {
          await python('build-sprites', [workspace]);
          await node('validate-avatar', [workspace]);
        });
      }
    } else if (action === 'render') {
      await requireStep('build'); await requireStep('survey');
      if (await skip('render')) skipped = true;
      else {
        await runStep('render', async () => {
          await node('render-poses', [workspace]);
          await node('render-poses', [workspace, '--blink-only']);
          await node('render-poses', [workspace, '--head-axis-only']);
          await python('authoring-review', ['sheets', project, '--view', id]);
        });
      }
    } else if (action === 'pack') {
      if (id !== 'neutral') throw new Error('Pack the root project with --view neutral.');
      for (const target of await viewIds(project)) {
        for (const step of ['build', 'survey', 'geometry', 'requests', 'sprites']) await requireStep(step, target);
        if (target !== 'neutral') await requireStep('review', target);
      }
      const snapshot = await packSnapshot(project);
      if (!options.force && state.pack?.inputs === snapshot.inputs && state.pack?.outputs === snapshot.outputs) skipped = true;
      else {
        await python('head-views', ['pack', project]);
        const after = await packSnapshot(project);
        if (snapshot.inputs !== after.inputs) throw new Error('Inputs changed during pack. No pack receipt saved; finish editing and rerun.');
        state.pack = { ...after, at: new Date().toISOString() };
      }
    }
    await saveState(project, state);
    return { action, view: id, skipped, status: await readAuthoringStatus(root, project) };
  } finally { await rm(lock, { recursive: true, force: true }); }
}

export function parseArguments(args) {
  const [action, project, ...rest] = args, options = {};
  if (!action || !project) throw new Error('Usage: npm run authoring -- status|prepare|rig|build|heads|requests|sprites|render|reviewed|pack projects/<name> [--view neutral|left|right|up|down] [--patch project/path.json] [--scope geometry|final --note "findings"] [--refresh|--adopt] [--force]');
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (['--force', '--refresh', '--adopt'].includes(key)) options[key.slice(2)] = true;
    else if (['--view', '--scope', '--note', '--patch'].includes(key) && rest[i + 1] && !rest[i + 1].startsWith('--')) options[key.slice(2)] = rest[++i];
    else throw new Error(`Unknown or incomplete option: ${key}`);
  }
  return { action, project, options };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { action, project, options } = parseArguments(process.argv.slice(2));
    console.log(JSON.stringify(await runAuthoring(ROOT, resolve(ROOT, project), action, options), null, 2));
  } catch (error) { console.error(`authoring: ${error.message}`); process.exitCode = 1; }
}
