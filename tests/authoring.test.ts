import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import fixture from '../samples/miko-qipao/rig.json';
import { DRAWINGS, exists, fingerprint, loadState, localPath, packSnapshot, projectPath, readAuthoringStatus, recordStep, saveState, stepState } from '../tools/authoring-state.mjs';
import { mergeRigPatch, parseArguments, runAuthoring } from '../tools/authoring.mjs';

let root: string, project: string;
beforeEach(async () => {
  await mkdir(resolve('projects'), { recursive: true });
  root = await mkdtemp(resolve('projects/.authoring-test-'));
  project = join(root, 'projects/nova');
  await mkdir(project, { recursive: true });
  await put('source.png', 'synthetic source');
  await json('rig.draft.json', fixture);
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function put(name: string, data = 'synthetic pixels') {
  const path = join(project, name); await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, data);
}
const json = (name: string, value: unknown) => put(name, JSON.stringify(value));
async function built(prefix = '') {
  await json(`${prefix}rig.json`, fixture);
  await json(`${prefix}built/layers.json`, { layers: {} });
  await put(`${prefix}built/base.png`); await put(`${prefix}built/hairmask.png`);
  await put(`${prefix}.authoring/geometry/overlay.png`);
}
async function requests(prefix = '') {
  for (const drawing of DRAWINGS) { await put(`${prefix}variant-requests/${drawing}/mask.png`); await put(`${prefix}variant-requests/${drawing}/prompt.md`, 'reviewed custom prompt'); }
}
async function record(id: string, steps: string[]) {
  const state = await loadState(project);
  for (const step of steps) await recordStep(project, state, id, step, 'synthetic test review');
  await saveState(project, state);
}

test('status is read-only, requires all 39 drawings and does not adopt existing work as reviewed', async () => {
  await built(); await requests();
  const before = await readdir(project);
  const status = await readAuthoringStatus(root, project);
  expect(status).toMatchObject({ requiredDrawings: 39, complete: false, packed: 'pending', next: { view: 'neutral', action: 'build' } });
  expect(status.views.map(view => view.id)).toEqual(['neutral', 'left', 'right', 'up', 'down']);
  expect(status.views[0].steps.geometry).toBe('pending');
  expect(await readdir(project)).toEqual(before);
  expect(await exists(project, '.authoring/state.json')).toBe(false);
});

test('input and output edits invalidate work; packing metadata leaves the neutral geometry valid', async () => {
  await built(); await record('neutral', ['build', 'survey', 'geometry']);
  let state = await loadState(project);
  expect(await stepState(project, state, 'neutral', 'build')).toBe('current');
  const packedRig = { ...fixture, head: { ...fixture.head, views: [{ id: 'left', angleX: -30, angleY: 0 }] } };
  await json('rig.json', packedRig); await json('rig.draft.json', packedRig);
  expect(await stepState(project, state, 'neutral', 'build')).toBe('current');
  expect(await stepState(project, state, 'neutral', 'geometry')).toBe('current');
  await put('built/base.png', 'changed base');
  expect(await stepState(project, state, 'neutral', 'build')).toBe('stale');
  expect(await stepState(project, state, 'neutral', 'geometry')).toBe('stale');
  await record('neutral', ['build', 'survey', 'geometry']); state = await loadState(project);
  await put('source.png', 'new source');
  for (const step of ['build', 'survey', 'geometry']) expect(await stepState(project, state, 'neutral', step)).toBe('stale');
});

test('custom masks, optional drawings and deleted sprite files invalidate the import', async () => {
  await built(); await requests();
  await json('built/sprites/sprites.json', { layers: { mouth_a: [0, 0, 2, 2] } }); await put('built/sprites/mouth_a.png');
  await record('neutral', ['requests', 'sprites']);
  let state = await loadState(project);
  await put('variant-requests/mouth_a/mask.png', 'corrected mask');
  expect(await stepState(project, state, 'neutral', 'requests')).toBe('stale');
  expect(await stepState(project, state, 'neutral', 'sprites')).toBe('stale');
  await record('neutral', ['requests', 'sprites']); state = await loadState(project);
  await put('variants/eyes_sad.png', 'optional art');
  expect(await stepState(project, state, 'neutral', 'sprites')).toBe('stale');
  await record('neutral', ['sprites']); state = await loadState(project);
  await put('variant-requests/eyes_sad/mask.png', 'optional corrected mask');
  expect(await stepState(project, state, 'neutral', 'requests')).toBe('stale');
  expect(await stepState(project, state, 'neutral', 'sprites')).toBe('stale');
  await record('neutral', ['sprites']); state = await loadState(project);
  await rm(join(project, 'built/sprites/mouth_a.png'));
  expect(await stepState(project, state, 'neutral', 'sprites')).toBe('stale');
});

test('replacing one head or its root mask invalidates its approval without resetting other work', async () => {
  await put('head-views/left/source.png', 'left art'); await json('head-views/left/rig.draft.json', fixture);
  await built('head-views/left/'); await put('head-views/requests/left/mask.png', 'mask');
  await record('left', ['build', 'survey', 'geometry']);
  const state = await loadState(project);
  await put('head-views/requests/left/mask.png', 'new boundary');
  expect(await stepState(project, state, 'left', 'geometry')).toBe('stale');
  expect(await stepState(project, state, 'left', 'survey')).toBe('stale');
  expect(await stepState(project, state, 'left', 'build')).toBe('current');
  await expect(runAuthoring(root, project, 'requests', { view: 'left', force: true }, vi.fn())).rejects.toThrow('geometry');
  expect(await exists(project, '.authoring/lock')).toBe(false);
});

test('unchanged builds skip all subprocesses and existing requests need explicit adoption', async () => {
  await built(); await record('neutral', ['build', 'survey', 'geometry']);
  const runner = vi.fn(async () => undefined);
  const result = await runAuthoring(root, project, 'build', {}, runner);
  expect('skipped' in result && result.skipped).toBe(true);
  expect(runner).not.toHaveBeenCalled();
  await requests(); const before = await readFile(join(project, 'variant-requests/mouth_a/prompt.md'));
  await expect(runAuthoring(root, project, 'requests', {}, runner)).rejects.toThrow('preserved');
  await runAuthoring(root, project, 'requests', { adopt: true }, runner);
  expect(await readFile(join(project, 'variant-requests/mouth_a/prompt.md'))).toEqual(before);
  expect(runner).not.toHaveBeenCalled();
  await expect(runAuthoring(root, project, 'sprites', {}, runner)).rejects.toThrow('Drawn assets pending');
});

test('rendering alone cannot approve a head or complete the avatar', async () => {
  await built(); await record('neutral', ['build', 'survey', 'render']);
  const runner = vi.fn(async () => undefined);
  await expect(runAuthoring(root, project, 'reviewed', { scope: 'geometry' }, runner)).rejects.toThrow('--note');
  await runAuthoring(root, project, 'reviewed', { scope: 'geometry', note: 'Inspected overlays and mesh poses; small seam remains.' }, runner);
  const state = await loadState(project);
  expect(state.views.neutral.geometry.note).toContain('small seam remains');
  expect((await readAuthoringStatus(root, project)).complete).toBe(false);
  await expect(runAuthoring(root, project, 'pack', {}, runner)).rejects.toThrow('requests');
  expect(runner).not.toHaveBeenCalled();
  await put('review/rest.png', 'changed review pixels');
  expect(await stepState(project, state, 'neutral', 'render')).toBe('stale');
});

test('pack freshness includes registered angles and embedded head art', async () => {
  await built(); await json('built/sprites/sprites.json', { layers: {}, headViews: { left: {} } });
  const before = await packSnapshot(project);
  await json('rig.json', { ...fixture, head: { ...fixture.head, views: [{ id: 'left', angleX: -20, angleY: 0 }] } });
  const after = await packSnapshot(project);
  expect(before.inputs).toBe(after.inputs); expect(before.outputs).not.toBe(after.outputs);
});

test('complete status requires all view reviews and becomes incomplete when one drawing changes', async () => {
  for (const id of ['neutral', 'left', 'right', 'up', 'down']) {
    const prefix = id === 'neutral' ? '' : `head-views/${id}/`;
    await put(`${prefix}source.png`, `synthetic ${id}`); await json(`${prefix}rig.draft.json`, fixture);
    await built(prefix); await requests(prefix);
    for (const name of DRAWINGS) await put(`${prefix}variants/${name}.png`);
    await json(`${prefix}built/sprites/sprites.json`, { layers: { mouth_a: [0, 0, 2, 2] } });
    await put(`${prefix}built/sprites/mouth_a.png`);
    await record(id, ['build', 'survey', 'geometry', 'requests', 'sprites', 'render', 'review']);
  }
  const state = await loadState(project); state.pack = await packSnapshot(project); await saveState(project, state);
  expect((await readAuthoringStatus(root, project)).complete).toBe(true);
  await put('head-views/left/variants/mouth_a.png', 'corrected left mouth');
  const changed = await readAuthoringStatus(root, project);
  expect(changed.complete).toBe(false);
  expect(changed.next).toMatchObject({ action: 'sprites', view: 'left' });
  expect(changed.views.find(view => view.id === 'right')?.steps.sprites).toBe('current');
});

test('a failed tool run cannot mark a build current and always releases its lock', async () => {
  const runner = vi.fn(async () => { throw new Error('synthetic tool failure'); });
  await expect(runAuthoring(root, project, 'build', {}, runner)).rejects.toThrow('synthetic tool failure');
  expect((await readAuthoringStatus(root, project)).views[0].steps.build).toBe('pending');
  expect(await exists(project, '.authoring/state.json')).toBe(false);
  expect(await exists(project, '.authoring/lock')).toBe(false);
});

test('an input edited while a subprocess runs cannot be recorded as a current build', async () => {
  await built();
  const runner = async (_root: string, _project: string, _command: string, args: string[]) => {
    if (args.some(arg => arg.endsWith('build-layers.py'))) await json('rig.draft.json', { ...fixture, mouth: { ...fixture.mouth, cx: fixture.mouth.cx + 2 } });
  };
  await expect(runAuthoring(root, project, 'build', {}, runner)).rejects.toThrow('Inputs changed during build');
  expect((await readAuthoringStatus(root, project)).views[0].steps.build).toBe('pending');
});

test('rejects escaped/symlinked inputs and a lock prevents concurrent writes', async () => {
  await mkdir(join(root, 'outside')); await symlink(join(root, 'outside'), join(project, 'variants'), 'junction');
  await expect(fingerprint(project, ['variants'])).rejects.toThrow('redirected');
  await expect(localPath(project, '../outside')).rejects.toThrow('inside');
  await expect(projectPath(root, join(root, 'outside'))).rejects.toThrow('projects/');
  await expect(runAuthoring(root, project, 'prepare', {}, vi.fn())).rejects.toThrow('redirected');
  await rm(join(project, 'variants'));
  await mkdir(join(project, '.authoring/lock'), { recursive: true });
  await expect(runAuthoring(root, project, 'prepare', {}, vi.fn())).rejects.toThrow('running');
  expect(await readdir(join(root, 'outside'))).toEqual([]);
});

test('CLI accepts explicit view/review arguments and rejects incomplete options', () => {
  expect(parseArguments(['reviewed', 'projects/nova', '--view', 'left', '--scope', 'geometry', '--note', 'boundary clean'])).toMatchObject({ action: 'reviewed', options: { view: 'left', scope: 'geometry', note: 'boundary clean' } });
  expect(() => parseArguments(['build', 'projects/nova', '--view'])).toThrow('incomplete');
  expect(() => parseArguments(['build', 'projects/nova', '--unknown'])).toThrow('Unknown');
});

test('compact coordinate patches preserve unrelated rig data and failed validation leaves the original intact', async () => {
  const before = await readFile(join(project, 'rig.draft.json'));
  const candidate = mergeRigPatch(fixture, { mouth: { cx: fixture.mouth.cx + 2 } });
  expect(candidate.mouth.cx).toBe(fixture.mouth.cx + 2);
  expect(candidate.mouth.area).toEqual(fixture.mouth.area);
  expect(candidate.body).toEqual(fixture.body);
  expect(() => mergeRigPatch(fixture, { image: { width: 1 } })).toThrow('dimensions');
  expect(() => mergeRigPatch(fixture, JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow('Invalid');
  await json('work/patch.json', { mouth: { cx: -99999 } });
  await expect(runAuthoring(root, project, 'rig', { patch: 'work/patch.json' }, async () => { throw new Error('invalid rig'); })).rejects.toThrow('invalid rig');
  expect(await readFile(join(project, 'rig.draft.json'))).toEqual(before);
  await json('work/patch.json', { mouth: { cx: fixture.mouth.cx + 2 } });
  await runAuthoring(root, project, 'rig', { patch: 'work/patch.json' }, async () => undefined);
  expect(JSON.parse(await readFile(join(project, 'rig.draft.json'), 'utf8')).mouth.cx).toBe(fixture.mouth.cx + 2);
  expect(await readdir(join(project, '.authoring/rig-backups'))).toHaveLength(1);
});
