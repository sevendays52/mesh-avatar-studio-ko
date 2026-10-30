/** Local authoring receipts. No image data, consent or runtime fields leave the project. */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, realpath, lstat, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, relative, dirname, basename, isAbsolute, sep } from 'node:path';

export const STANDARD_VIEWS = ['left', 'right', 'up', 'down'];
export const DRAWINGS = ['eyes_closed', 'eyes_half', 'eyes_smile', 'mouth_a', 'mouth_a_half', 'mouth_i', 'mouth_o'];
const stateFile = '.authoring/state.json';
const inside = (parent, file) => { const rel = relative(parent, file); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)); };
const slash = path => path.split(sep).join('/');

export async function projectPath(root, project) {
  root = await realpath(root);
  const base = resolve(root, 'projects'), path = resolve(project);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(basename(path))) throw new Error('Use a safe project folder name (letters, digits, dots, hyphens, underscores).');
  if (await realpath(base) !== base || dirname(path) !== base || await realpath(path) !== path) throw new Error('Use a regular project folder directly inside projects/.');
  return path;
}

// Check every existing ancestor before reading OR creating anything. In particular,
// a missing child behind a directory symlink must never escape the project.
export async function localPath(project, name) {
  const path = resolve(project, name);
  if (!inside(project, path)) throw new Error('Authoring files must stay inside this project.');
  let current = project;
  for (const part of relative(project, path).split(sep).filter(Boolean)) {
    current = resolve(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error('Authoring files cannot use redirected paths.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return path;
}

export async function readJSON(project, name, fallback = null) {
  try { return JSON.parse(await readFile(await localPath(project, name), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function exists(project, name) {
  try { return (await lstat(await localPath(project, name))).isFile(); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function files(project, name) {
  const path = await localPath(project, name);
  let stat;
  try { stat = await lstat(path); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  if (stat.isFile()) return [name];
  if (!stat.isDirectory()) throw new Error('Authoring inputs must be regular files.');
  const result = [];
  for (const entry of (await readdir(path)).sort()) result.push(...await files(project, `${name}/${entry}`));
  return result;
}

function rigGeometry(value) {
  const rig = structuredClone(value);
  // pack registers views in both rigs; that does not change the neutral geometry.
  if (rig.head) { delete rig.head.views; if (rig.head.pitch) delete rig.head.pitch.views; }
  return rig;
}

export async function fingerprint(project, names, normalizeRig = true, memo = new Map()) {
  const digest = createHash('sha256');
  for (const name of [...new Set(names)].sort()) {
    const entries = await files(project, name);
    if (!entries.length) digest.update(JSON.stringify([name, 'missing']));
    for (const file of entries) {
      const key = `${file}:${normalizeRig}`;
      if (!memo.has(key)) memo.set(key, (async () => {
        let data = await readFile(await localPath(project, file));
        if (normalizeRig && /(^|\/)rig(?:\.draft)?\.json$/.test(file)) data = Buffer.from(JSON.stringify(rigGeometry(JSON.parse(data))));
        return [data.length, createHash('sha256').update(data).digest('hex')];
      })());
      digest.update(JSON.stringify([slash(file), ...await memo.get(key)]));
    }
  }
  return digest.digest('hex');
}

export async function loadState(project) {
  const state = await readJSON(project, stateFile, { version: 1, views: {} });
  if (state.version !== 1 || !state.views || typeof state.views !== 'object' || Array.isArray(state.views)) throw new Error('Unsupported authoring state. Preserve it and inspect .authoring/state.json.');
  return state;
}

export async function saveState(project, state) {
  const path = await localPath(project, stateFile);
  await mkdir(dirname(path), { recursive: true });
  const temporary = await localPath(project, `.authoring/state-${randomUUID()}.tmp`);
  try { await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, path); }
  finally { await unlink(temporary).catch(() => undefined); }
}

export function viewPrefix(id) {
  if (id === 'neutral') return '';
  if (!/^[A-Za-z0-9_-]+$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('Invalid authoring view.');
  return `head-views/${id}/`;
}

export async function viewIds(project) {
  const plan = await readJSON(project, 'head-views/plan.json');
  const ids = [...STANDARD_VIEWS];
  if (plan) {
    if (!Array.isArray(plan.views) || plan.views.length > 8) throw new Error('Invalid head-view plan.');
    for (const view of plan.views) {
      if (!view || view.id === 'neutral') throw new Error('Invalid head-view plan.');
      viewPrefix(view.id);
      if (!ids.includes(view.id)) ids.push(view.id);
    }
  }
  return ['neutral', ...ids];
}

export async function rigName(project, prefix) {
  return `${prefix}${await exists(project, `${prefix}rig.draft.json`) ? 'rig.draft.json' : 'rig.json'}`;
}

async function layerFiles(project, prefix) {
  const metadata = await readJSON(project, `${prefix}built/layers.json`, {});
  return [`${prefix}rig.json`, `${prefix}built/layers.json`, ...['base', 'hairmask', ...Object.keys(metadata.layers ?? {})].map(name => `${prefix}built/${name}.png`)];
}

async function spriteHash(project, prefix, memo) {
  const metadata = await readJSON(project, `${prefix}built/sprites/sprites.json`, {});
  const layers = Object.fromEntries(Object.entries(metadata.layers ?? {}).filter(([name]) => !name.startsWith('head_view_') && !name.startsWith('pitch_view_')));
  return createHash('sha256').update(JSON.stringify(layers)).update(await fingerprint(project, Object.keys(layers).map(name => `${prefix}built/sprites/${name}.png`), true, memo)).digest('hex');
}

// Each receipt tracks inputs AND actual output bytes. File presence alone never
// promotes old work to completed, and edited/deleted outputs invalidate the step.
export async function stepSnapshot(project, id, step, memo = new Map()) {
  const hash = (names, normalized = true) => fingerprint(project, names, normalized, memo);
  const prefix = viewPrefix(id), rig = await rigName(project, prefix);
  const geometry = [`${prefix}source.png`, rig];
  const build = await layerFiles(project, prefix);
  const requests = [`${prefix}variant-requests`];
  const variants = await files(project, `${prefix}variants`);
  const masks = await files(project, `${prefix}variant-masks`);
  const survey = `${prefix}.authoring/geometry`;
  const headInputs = id === 'neutral' ? [] : ['source.png', 'head-views/plan.json', `head-views/requests/${id}/mask.png`];
  let inputs, outputs;
  if (step === 'survey') { inputs = [...geometry, ...headInputs]; outputs = [survey]; }
  else if (step === 'build') { inputs = geometry; outputs = build; }
  else if (step === 'geometry') {
    inputs = [...geometry, ...build, survey, ...headInputs]; outputs = [];
  } else if (step === 'requests') { inputs = geometry; outputs = requests; }
  else if (step === 'sprites') {
    return { inputs: await hash([...geometry, ...build, ...requests, ...variants, ...masks]), outputs: await spriteHash(project, prefix, memo) };
  } else if (step === 'render' || step === 'review') {
    inputs = [...geometry, `${prefix}rig.json`, `${prefix}built`]; outputs = [`${prefix}review/poses.json`, `${prefix}review/blinks/poses.json`, `${prefix}review/head-axes/poses.json`, `${prefix}.authoring/review`];
    // Include all rendered frames, not only the index/contact sheets.
    outputs.push(...await files(project, `${prefix}review`).then(paths => paths.filter(path => /\.png$/.test(path))));
  } else throw new Error('Unknown authoring step.');
  return { inputs: await hash(inputs, step !== 'render' && step !== 'review'), outputs: await hash(outputs) };
}

export async function stepState(project, state, id, step, memo = new Map()) {
  const receipt = state.views[id]?.[step];
  if (!receipt) return 'pending';
  const snapshot = await stepSnapshot(project, id, step, memo);
  return receipt.inputs === snapshot.inputs && receipt.outputs === snapshot.outputs ? 'current' : 'stale';
}

export async function recordStep(project, state, id, step, note) {
  state.views[id] ??= {};
  state.views[id][step] = { ...await stepSnapshot(project, id, step), at: new Date().toISOString(), ...(note && { note }) };
}

export async function packSnapshot(project, memo = new Map()) {
  const ids = await viewIds(project), inputs = [];
  for (const id of ids) {
    const prefix = viewPrefix(id);
    inputs.push([id, await fingerprint(project, [`${prefix}source.png`, await rigName(project, prefix), ...await layerFiles(project, prefix)], true, memo), await spriteHash(project, prefix, memo)]);
  }
  return { inputs: createHash('sha256').update(JSON.stringify(inputs)).update(await fingerprint(project, ['head-views/plan.json', 'head-views/requests'], true, memo)).digest('hex'),
    outputs: await fingerprint(project, ['rig.json', 'rig.draft.json', 'built/sprites'], false, memo) };
}

export async function readAuthoringStatus(root, input) {
  const project = await projectPath(root, input), state = await loadState(project), ids = await viewIds(project);
  // Request-local only: never reuse hashes across polls or after a mutation.
  const memo = new Map();
  const views = [];
  for (const id of ids) {
    const prefix = viewPrefix(id), source = await exists(project, `${prefix}source.png`);
    const rig = await readJSON(project, await rigName(project, prefix), {});
    const traced = rig.eyes?.length === 2 && rig.eyes.every(eye => eye.opening?.length >= 3 && eye.roi?.length >= 3);
    /** @type {Record<string, 'pending' | 'stale' | 'current'>} */
    const steps = {};
    for (const step of ['survey', 'build', 'geometry', 'requests', 'sprites', 'render', 'review']) steps[step] = await stepState(project, state, id, step, memo);
    const missing = [];
    for (const name of DRAWINGS) if (!await exists(project, `${prefix}variants/${name}.png`)) missing.push(name);
    views.push({ id, source, traced: !!traced, steps, missingDrawings: missing });
  }
  let packed = 'pending';
  if (state.pack) {
    const snapshot = await packSnapshot(project, memo);
    packed = snapshot.inputs === state.pack.inputs && snapshot.outputs === state.pack.outputs ? 'current' : 'stale';
  }
  const rel = slash(relative(root, project));
  let next = null;
  for (const view of views) {
    let action;
    if (!view.source) action = 'draw-head';
    else if (!view.traced) action = 'trace-rig';
    else if (view.steps.build !== 'current' || view.steps.survey !== 'current') action = 'build';
    else if (view.steps.geometry !== 'current') action = view.steps.render !== 'current' ? 'render' : 'review-geometry';
    else if (view.steps.requests !== 'current') action = 'requests';
    else if (view.missingDrawings.length) action = 'draw-variants';
    else if (view.steps.sprites !== 'current') action = 'sprites';
    else if (view.id !== 'neutral' && view.steps.render !== 'current') action = 'render';
    else if (view.id !== 'neutral' && view.steps.review !== 'current') action = 'review-final';
    if (action) { next = { action, view: view.id }; break; }
  }
  if (!next && packed !== 'current') next = { action: 'pack', view: 'neutral' };
  if (!next && views[0].steps.render !== 'current') next = { action: 'render', view: 'neutral' };
  if (!next && views[0].steps.review !== 'current') next = { action: 'review-final', view: 'neutral' };
  const commandAction = { 'review-geometry': 'reviewed', 'review-final': 'reviewed', 'draw-head': 'status', 'draw-variants': 'status', 'trace-rig': 'prepare' };
  if (next) {
    next.command = `npm run authoring -- ${commandAction[next.action] ?? next.action} ${rel} --view ${next.view}${next.action === 'review-geometry' ? ' --scope geometry --note "visual findings"' : next.action === 'review-final' ? ' --scope final --note "visual findings"' : ''}`;
    next.guide = next.action.startsWith('draw-') ? 'docs/codex-authoring.md' : 'docs/authoring-workflow.md';
    const workspace = `${rel}/${viewPrefix(next.view)}`;
    next.artifacts = [`${workspace}.authoring/geometry/index.json`, `${workspace}.authoring/review/index.json`];
  }
  return { version: 1, project: rel, requiredDrawings: 7 + (ids.length - 1) * 8, complete: next === null, packed, views, next,
    consent: 'Confirm image-transfer permission in the current conversation. This status is not consent.' };
}
