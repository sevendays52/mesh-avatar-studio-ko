import { expect, test } from 'vitest';
import fixture from '../samples/miko-qipao/rig.json';
import { PARAMS, parseRig, validateRig } from 'mesh-avatar';
import { createRig } from '../packages/runtime/src/engine/rig.js';
import { createSpriteModule } from '../packages/runtime/src/engine/sprites.js';

const defaults = Object.fromEntries(PARAMS.map(p => [p.id, p.def]));
const physics = { gain: 0, bunL: [0, 0], bunR: [0, 0] };
function pitchedRig() {
  const rig = parseRig(fixture);
  rig.head.pitch = { maxAngle: 0.5, depth: rig.head.ry * 0.2 };
  return rig;
}

test('optional pitch data validates in complete and draft rigs and rejects invalid projections', () => {
  expect(validateRig(pitchedRig())).toEqual([]);
  expect(validateRig(pitchedRig(), { draft: true })).toEqual([]);
  for (const pitch of [null, {}, { maxAngle: 0.5 }, { depth: 45 },
    { maxAngle: -0.1, depth: 45 }, { maxAngle: Math.PI / 2, depth: 45 },
    { maxAngle: NaN, depth: 45 }, { maxAngle: 0.5, depth: -1 }, { maxAngle: 0.5, depth: Infinity }]) {
    expect(validateRig({ ...fixture, head: { ...fixture.head, pitch } }).join()).toContain('rig.head.pitch');
  }
  for (const facePreservation of [0, 0.5, 1]) {
    const rig = pitchedRig(); rig.head.pitch!.facePreservation = facePreservation;
    expect(validateRig(rig)).toEqual([]);
  }
  for (const facePreservation of [-1, 1.1, NaN, Infinity, '1']) {
    const rig = pitchedRig();
    expect(validateRig({ ...rig, head: { ...rig.head, pitch: { ...rig.head.pitch, facePreservation } } }).join())
      .toContain('rig.head.pitch.facePreservation');
  }
});

test('existing pitch projection stays exact when face preservation is omitted or zero', () => {
  const rig = pitchedRig(), engine = createRig(rig);
  const disabledRig = pitchedRig(); disabledRig.head.pitch!.facePreservation = 0;
  const disabled = createRig(disabledRig);
  // Captured before adding the optional preservation field.
  const expected = [
    [[517.4594929815729, 591.9430255970369], [647.4969780871845, 610.997015003778], [662.3199216950817, 677.6137300241963]],
    [[505.3209028150656, 437.4209939649779], [635.6228950111212, 460.12248438496977], [655.8246760225069, 586.495293126934]],
  ];
  for (const [i, angleY] of [-30, 30].entries()) {
    const p = { ...defaults, angleY, angleX: 20, angleZ: 15 };
    for (const [j, { cx: x, cy: y }] of [rig.face.eyeA, rig.face.nose, rig.face.jaw].entries()) {
      expect(engine.deformBase(x, y, engine.baseWeights(x, y), p, physics, [0, 0])).toEqual(expected[i][j]);
      expect(disabled.deformBase(x, y, disabled.baseWeights(x, y), p, physics, [0, 0])).toEqual(expected[i][j]);
    }
  }
});

test('deep downward nods preserve face height, eye shape and feature spacing while still moving', () => {
  const rig = pitchedRig(); rig.head.pitch!.facePreservation = 1;
  const engine = createRig(rig);
  const features = [rig.face.eyeA, rig.face.eyeB, rig.face.nose, rig.face.mouth, rig.face.jaw];
  const points = features.map(f => [f.cx, f.cy]);
  points.push([rig.face.eyeA.cx, rig.face.eyeA.cy - 20], [rig.face.eyeA.cx, rig.face.eyeA.cy + 20]);
  const deform = (angleY: number) => points.map(([x, y]) =>
    engine.deformBase(x, y, engine.baseWeights(x, y), { ...defaults, angleY }, physics, [0, 0]));
  const rest = deform(0);
  for (const angleY of [-15, -20, -25, -30]) {
    const nod = deform(angleY);
    expect(nod[0][1]).toBeGreaterThan(rest[0][1] + 5);
    for (let i = 1; i < points.length; i++) {
      expect(nod[i][1] - nod[0][1]).toBeCloseTo(rest[i][1] - rest[0][1], 10);
      expect(nod[i][0] - nod[0][0]).toBeCloseTo(rest[i][0] - rest[0][0], 10);
    }
  }
});

test('face preservation blends continuously, leaves upward poses exact and keeps the torso fixed', () => {
  const rig = pitchedRig(), original = createRig(rig);
  const partialRig = pitchedRig(); partialRig.head.pitch!.facePreservation = 0.5;
  const fullRig = pitchedRig(); fullRig.head.pitch!.facePreservation = 1;
  const partial = createRig(partialRig), full = createRig(fullRig);
  const { cx: x, cy: y } = rig.face.eyeA;
  const at = (e: ReturnType<typeof createRig>, angleY: number, px = x, py = y) =>
    e.deformBase(px, py, e.baseWeights(px, py), { ...defaults, angleY }, physics, [0, 0]);
  for (const angleY of [0, 15, 30]) expect(at(full, angleY)).toEqual(at(original, angleY));
  expect(at(partial, -30)[1]).toBeGreaterThan(at(full, -30)[1]);
  expect(at(partial, -30)[1]).toBeLessThan(at(original, -30)[1]);
  expect(at(full, -0.001)[1] - at(full, 0)[1]).toBeLessThan(0.01);
  for (const angleY of [-30, -15]) {
    const by = Math.max(rig.head.weightBand[1], rig.head.turnBand[1]) + 20;
    expect(at(full, angleY, rig.head.cx, by)).toEqual([rig.head.cx, by]);
  }
});

test('pitch leaves legacy deformation exact when disabled, and changes no yaw-only or neutral poses', () => {
  const legacy = createRig(parseRig(fixture));
  const rig = pitchedRig(), enabled = createRig(rig);
  const disabledRig = pitchedRig(); disabledRig.head.pitch!.maxAngle = 0;
  const disabled = createRig(disabledRig);
  for (const angleY of [-30, 0, 30]) for (const angleX of [-30, 0, 30]) {
    const p = { ...defaults, angleX, angleY, angleZ: 15, breath: 0.5 };
    for (let y = 0; y <= rig.image.height; y += 29) for (let x = 0; x <= rig.image.width; x += 31) {
      const expected = legacy.deformBase(x, y, legacy.baseWeights(x, y), p, physics, [0, 0]);
      expect(disabled.deformBase(x, y, disabled.baseWeights(x, y), p, physics, [0, 0])).toEqual(expected);
      if (!angleY) expect(enabled.deformBase(x, y, enabled.baseWeights(x, y), p, physics, [0, 0])).toEqual(expected);
    }
  }
});

test('nodding changes head silhouette as well as face position, anchors the neck and leaves the body fixed', () => {
  const rig = pitchedRig(); rig.head.shiftY = 0;
  const engine = createRig(rig), h = rig.head;
  const point = (x: number, y: number, angleY: number) => {
    const out = [x, y]; engine.applyHead(out, engine.headWeight(x, y), { ...defaults, angleY }); return out;
  };
  expect(point(h.cx, h.cy, 30)[1]).toBeLessThan(h.cy);
  expect(point(h.cx, h.cy, -30)[1]).toBeGreaterThan(h.cy);
  // The crown has no face depth, but foreshortens toward the neck for both directions.
  for (const angleY of [-30, 30]) {
    expect(point(h.cx, h.cy - h.ry, angleY)[1]).toBeGreaterThan(h.cy - h.ry + 10);
    expect(point(h.pivotX, h.pivotY, angleY)).toEqual([h.pivotX, h.pivotY]);
    expect(point(h.cx, h.weightBand[1] + 10, angleY)).toEqual([h.cx, h.weightBand[1] + 10]);
    expect(point(h.cx, h.cy, angleY)[0]).toBe(h.cx);
  }
});

test('drawn closed-eye and expression mouth sprites stay attached to the pitched base', () => {
  const rig = pitchedRig(); rig.head.pitch!.facePreservation = 1;
  const engine = createRig(rig);
  type Mesh = { rest: number[]; pos: number[] };
  type Layer = { mesh: Mesh; visible: boolean; alpha: number };
  type SpriteCreator = (renderer: { addLayer(name: string, image: unknown, mesh: Mesh): Layer },
    sheet: { layers: Record<string, number[]> }, images: Record<string, { width: number }>,
    grid: (rect: number[]) => Mesh, alpha: () => Uint8Array) => {
      update(p: Record<string, number>, phys: typeof physics, dt: number, mood: string): unknown;
    };
  // JS reference JSDoc infers image arguments as void and the optional mood as null.
  const makeSprites = createSpriteModule(engine, rig).createSprites as unknown as SpriteCreator;
  const items = new Map<string, Layer>();
  const layers = { eyes_closed_0: [rig.face.eyeA.cx, rig.face.eyeA.cy, 4, 4],
    mouth_sad: [rig.mouth.cx, rig.mouth.cy, 4, 4] };
  const sprites = makeSprites({
    addLayer(name: string, _image: unknown, mesh: Mesh) {
      const item = { mesh, visible: true, alpha: 1 }; items.set(name, item); return item;
    },
  }, { layers }, Object.fromEntries(Object.keys(layers).map(name => [name, { width: 4 }])),
  (rect: number[]) => ({ rest: rect.slice(0, 2), pos: [0, 0] }), () => new Uint8Array());
  for (const angleY of [-30, -15, 15, 30]) {
    const p = { ...defaults, angleY, eyeROpen: 0 };
    sprites.update(p, physics, 0, 'sad');
    for (const { mesh, visible } of items.values()) {
      expect(visible).toBe(true);
      const [x, y] = mesh.rest;
      expect(mesh.pos).toEqual(engine.deformBase(x, y, engine.baseWeights(x, y, 0), p, physics, [0, 0]));
    }
  }
});
