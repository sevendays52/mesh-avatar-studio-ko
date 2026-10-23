import { expect, test } from 'vitest';
import fixture from '../samples/miko-qipao/rig.json';
import { parseRig, validateRig, type Rig, PARAMS } from 'mesh-avatar';
import { mapHeadY, headLandmarks, headViewWarp, warpHeadPoint, pitchViewWeights } from '../packages/runtime/src/engine/head-warp.js';
import { pitchViewPackages } from '../packages/runtime/src/engine/pitch-views.js';
import { createRig } from '../packages/runtime/src/engine/rig.js';

function setup() {
  const rig = parseRig(fixture);
  rig.head.pitch = { maxAngle: 0.5, depth: 45, views: [{ id: 'down', angleY: -30 }] };
  const posed = parseRig(fixture);
  const names = ['base', 'hairmask', 'hand', ...posed.accessories!.map(a => a.name),
    ...[0, 1].flatMap(i => ['ball', 'lash', 'low', 'crease'].map(p => `eye${i}_${p}`))];
  const aliases = Object.fromEntries(names.map(name => [name, `pitch_view_down_${name}`]));
  const sheet = { build: 'test', layers: Object.fromEntries(Object.values(aliases).map(name => [name, [0, 0, 10, 10]])),
    pitchViews: { down: { rig: posed, layers: aliases, sprites: {} as Record<string, string> } } };
  return { rig, sheet };
}

test('drawn view definitions validate without changing rigs that omit them', () => {
  const { rig } = setup();
  expect(validateRig(rig)).toEqual([]);
  expect(validateRig(fixture)).toEqual([]);
  for (const views of [[], [{ id: '../secret', angleY: -15 }], [{ id: 'down', angleY: 0 }],
    [{ id: 'down', angleY: -31 }], [{ id: 'down', angleY: NaN }],
    [{ id: 'down', angleY: -15 }, { id: 'down', angleY: -30 }],
    [{ id: 'half', angleY: -15 }, { id: 'full', angleY: -15 }]]) {
    expect(validateRig({ ...rig, head: { ...rig.head, pitch: { ...rig.head.pitch, views } } }).join()).toContain('rig.head.pitch.views');
  }
});

test('view weights select real drawings at anchors and blend only adjacent views', () => {
  const angles = [0, -15, -30];
  expect(pitchViewWeights(angles, 30)).toEqual([{ index: 0, weight: 1 }]);
  expect(pitchViewWeights(angles, -50)).toEqual([{ index: 2, weight: 1 }]);
  expect(pitchViewWeights(angles, -15)).toEqual([{ index: 1, weight: 1 }]);
  expect(pitchViewWeights(angles, -7.5)).toEqual([{ index: 1, weight: 0.5 }, { index: 0, weight: 0.5 }]);
  expect(pitchViewWeights(angles, -22.5)).toEqual([{ index: 2, weight: 0.5 }, { index: 1, weight: 0.5 }]);
  for (let a = -30; a <= 0; a += 0.25) {
    const values = pitchViewWeights(angles, a)!;
    expect(values.reduce((sum, v) => sum + v.weight, 0)).toBeCloseTo(1, 14);
    expect(values.every(v => v.weight >= 0 && v.weight <= 1)).toBe(true);
  }
});

test('landmark interpolation stays monotone and maps eyes, mouth, jaw and neck exactly', () => {
  const from = [100, 315, 373, 396, 474], to = [120, 369, 416, 430, 500];
  for (let i = 0; i < from.length; i++) expect(mapHeadY(from[i], from, to)).toBeCloseTo(to[i], 12);
  let previous = -Infinity;
  for (let y = 0; y < 600; y += 0.25) {
    const mapped = mapHeadY(y, from, to);
    expect(mapped).toBeGreaterThan(previous); previous = mapped;
  }
  const rig = parseRig(fixture), target = headLandmarks(rig);
  target.x = target.x.map(v => v + 10); target.y = target.y.map(v => v + 20);
  const warp = headViewWarp(rig, target);
  const point = warpHeadPoint(600, rig.mouth.cy, warp);
  expect(point[0]).toBeCloseTo(610, 10); expect(point[1]).toBeCloseTo(rig.mouth.cy + 20, 10);
});

test('drawn head mapping suppresses synthetic pitch and keeps body vertices fixed', () => {
  const rig = parseRig(fixture), engine = createRig(rig);
  const target = headLandmarks(rig); target.y = target.y.map(v => v + 20);
  engine.setHeadWarp(headViewWarp(rig, target));
  const p = Object.fromEntries(PARAMS.map(v => [v.id, v.def]));
  const at = (angleY: number, x = rig.head.cx, y = rig.mouth.cy, w = 1) => {
    const out = [x, y]; engine.applyHead(out, w, { ...p, angleY }); return out;
  };
  expect(at(-30)).toEqual(at(0)); expect(at(-15)).toEqual(at(0));
  expect(at(-30)[1]).toBeCloseTo(rig.mouth.cy + 20, 10);
  expect(at(-30, 600, 1000, 0)).toEqual([600, 1000]);
  engine.setHeadWarp(null);
  expect(at(-30)).not.toEqual(at(0));
});

test('view packages reuse declared image aliases without generating fetchable JSON URLs', () => {
  const { rig, sheet } = setup();
  const [view] = pitchViewPackages(rig, sheet, (name: string) => `/built/${name}`);
  expect(view.angleY).toBe(-30); expect(view.rig).toEqual(sheet.pitchViews.down.rig);
  expect(view.assets['base.png']).toBe('/built/sprites/pitch_view_down_base.png');
  expect(view.metadata.eyes).toEqual(view.rig.eyes);
  expect(view.assets['layers.json']).toBeUndefined();
  expect(view.spriteMetadata).toBeNull();
});

test('malformed, nested or incomplete view metadata is rejected before renderer construction', () => {
  const check = (edit: (s: ReturnType<typeof setup>['sheet']) => void) => {
    const { rig, sheet } = setup(); edit(sheet);
    expect(() => pitchViewPackages(rig, sheet, () => '')).toThrow(/Pitch view|Invalid rig/);
  };
  check(s => { delete s.pitchViews.down.layers.base; });
  check(s => { s.pitchViews.down.layers.base = '../outside'; });
  check(s => { s.pitchViews.down.rig.image.width++; });
  check(s => { s.pitchViews.down.rig.head.pitch = { maxAngle: 0.5, depth: 45, views: [{ id: 'nested', angleY: -15 }] }; });
  const invalid = { ...fixture, head: { ...fixture.head, pitch: { maxAngle: 0.5, depth: 45, views: [{ id: 'missing', angleY: -15 }] } } } as Rig;
  expect(() => pitchViewPackages(invalid, { layers: {} }, () => '')).toThrow('missing layer metadata');
});
