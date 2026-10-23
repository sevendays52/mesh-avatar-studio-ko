import { expect, test } from 'vitest';
import fixture from '../samples/miko-qipao/rig.json';
import { PARAMS, parseRig, validateRig } from 'mesh-avatar';
import { createRig } from '../packages/runtime/src/engine/rig.js';
import { liveMessage } from '../src/live/protocol';

const defaults = Object.fromEntries(PARAMS.map(p => [p.id, p.def]));
const physics = { gain: 0, bunL: [0, 0], bunR: [0, 0] };
function configured() {
  const rig = parseRig(fixture);
  rig.cheekPuff = { regions: [{ cx: 535, cy: 590, rx: 45, ry: 30 }, { cx: 730, cy: 590, rx: 45, ry: 30 }], displacement: 12 };
  rig.body.motion = { turn: 8, nod: 8, shoulder: 5 };
  return rig;
}
test('optional cheek and torso data validates and rejects unsafe deformation', () => {
  const rig = configured(); expect(validateRig(rig)).toEqual([]);
  for (const displacement of [-1, NaN, 16]) expect(validateRig({ ...rig, cheekPuff: { ...rig.cheekPuff, displacement } }).join()).toContain('cheekPuff');
  expect(validateRig({ ...rig, cheekPuff: { ...rig.cheekPuff, regions: [...rig.cheekPuff!.regions].reverse() } }).join()).toContain('order');
  expect(validateRig({ ...rig, body: { ...rig.body, motion: { turn: 0, nod: -1, shoulder: 0 } } }).join()).toContain('body.motion.nod');
});
test('puff expands both cheeks smoothly while preserving eyes, mouth and the torso', () => {
  const rig = configured(), engine = createRig(rig);
  const point = (x: number, y: number, puff: number) => engine.deformBase(x, y, engine.baseWeights(x, y), { ...defaults, cheekPuff: puff }, physics, [0, 0]);
  expect(point(535, 590, 1)[0]).toBeCloseTo(523); expect(point(730, 590, 1)[0]).toBeCloseTo(742);
  expect(point(535, 590, 1)[1]).toBeCloseTo(592.4);
  expect(point(535, 590, 0.5)[0]).toBe(529);
  for (const [x, y] of [[rig.mouth.cx, rig.mouth.cy], [rig.face.eyeA.cx, rig.face.eyeA.cy], [rig.face.eyeB.cx, rig.face.eyeB.cy], [rig.body.chest.cx, rig.body.chest.cy]])
    expect(point(x, y, 1)).toEqual(point(x, y, 0));
  // A compact smooth field must keep its orientation, even at maximum inflation.
  for (let y = 550; y <= 630; y += 2) for (let x = 480; x <= 780; x += 2) {
    const p = point(x, y, 1), dx = point(x + 0.01, y, 1), dy = point(x, y + 0.01, 1);
    expect((dx[0] - p[0]) * (dy[1] - p[1]) - (dx[1] - p[1]) * (dy[0] - p[0])).toBeGreaterThan(0);
  }
});
test('legacy rigs ignore new controls exactly; configured torso keeps its lower edge pinned', () => {
  const legacy = createRig(parseRig(fixture)), rig = configured(), engine = createRig(rig);
  for (const [x, y] of [[535, 590], [730, 590], [500, 900], [600, 1700]]) {
    const a = legacy.deformBase(x, y, legacy.baseWeights(x, y), defaults, physics, [0, 0]);
    expect(legacy.deformBase(x, y, legacy.baseWeights(x, y), { ...defaults, cheekPuff: 1, bodyAngleY: -10 }, physics, [0, 0])).toEqual(a);
    expect(engine.deformBase(x, y, engine.baseWeights(x, y), defaults, physics, [0, 0])).toEqual(a);
  }
  const shoulder = rig.body.shoulders[0];
  const move = (x: number, y: number) => engine.deformBase(x, y, engine.baseWeights(x, y), { ...defaults, bodyAngleY: -6 }, physics, [0, 0]);
  expect(move(shoulder.cx, shoulder.cy)[1]).toBeGreaterThan(shoulder.cy + 2);
  expect(move(600, rig.body.rollBand[1])).toEqual([600, rig.body.rollBand[1]]);
  expect(liveMessage({ project: 'test', t: 0, params: { cheekPuff: 2, bodyAngleY: -20 } })?.params).toEqual({ cheekPuff: 1, bodyAngleY: -10 });
});
