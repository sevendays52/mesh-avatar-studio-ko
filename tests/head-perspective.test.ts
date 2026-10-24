import { expect, test } from 'vitest';
import fixture from '../samples/miko-qipao/rig.json';
import { PARAMS, parseRig, validateRig } from 'mesh-avatar';
import { createRig } from '../packages/runtime/src/engine/rig.js';
import { createHeadPerspective } from '../packages/runtime/src/engine/head-perspective.js';
import { createSpriteModule } from '../packages/runtime/src/engine/sprites.js';

const defaults = Object.fromEntries(PARAMS.map(p => [p.id, p.def]));
const physics = { gain: 0, bunL: [0, 0], bunR: [0, 0] };
function configured() {
  const rig = parseRig(fixture);
  rig.head.perspective = { yaw: .5, pitch: .45, depth: 65, focalLength: 3000 };
  return rig;
}

test('perspective parameters validate and cannot put the head through the camera or stack two pitch models', () => {
  const rig = configured();
  expect(validateRig(rig)).toEqual([]);
  expect(validateRig(rig, { draft: true })).toEqual([]);
  for (const perspective of [{}, null, { ...rig.head.perspective, yaw: NaN },
    { ...rig.head.perspective, pitch: -1 }, { ...rig.head.perspective, yaw: 2 },
    { ...rig.head.perspective, depth: -1 }, { ...rig.head.perspective, focalLength: 100 },
    { ...rig.head.perspective, focalLength: Infinity }])
    expect(validateRig({ ...rig, head: { ...rig.head, perspective } }).join()).toContain('rig.head.perspective');
  rig.head.pitch = { maxAngle: .4, depth: 40 };
  expect(validateRig(rig).join()).toContain('choose one projection');
});

test('omitted and disabled perspective keep every legacy head deformation exact', () => {
  const original = parseRig(fixture), legacy = createRig(original), disabled = configured();
  disabled.head.perspective!.yaw = disabled.head.perspective!.pitch = 0;
  const engine = createRig(disabled);
  for (const angleX of [-30, 0, 30]) for (const angleY of [-30, 0, 30])
    for (let y = 0; y <= original.image.height; y += 47) for (let x = 0; x <= original.image.width; x += 43) {
      const p = { ...defaults, angleX, angleY, angleZ: 15, mouthOpen: .6, breath: .5 };
      expect(engine.deformBase(x, y, engine.baseWeights(x, y), p, physics, [0, 0]))
        .toEqual(legacy.deformBase(x, y, legacy.baseWeights(x, y), p, physics, [0, 0]));
    }
});

test('projection keeps rest pixels and the neck pivot exact, and creates near/far foreshortening', () => {
  const rig = configured();
  Object.assign(rig.head, { cx: 600, cy: 400, rx: 250, ry: 250, pivotX: 600, pivotY: 700 });
  Object.assign(rig.face.nose, { cx: 600, cy: 500 });
  rig.head.perspective!.depth = 130;
  const project = createHeadPerspective(rig)!;
  for (const [x, y] of [[600, 500], [520, 480], [700, 540]]) expect(project(x, y, 0, 0)).toEqual([x, y]);
  for (const x of [-30, 0, 30]) for (const y of [-30, 0, 30]) expect(project(600, 700, x, y)).toEqual([600, 700]);
  const width = (cx: number, yaw: number) => {
    const a = project(cx - 4, 500, yaw, 0), b = project(cx + 4, 500, yaw, 0);
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  };
  expect(width(530, 30)).toBeGreaterThan(width(670, 30));
  expect(width(670, -30)).toBeGreaterThan(width(530, -30));
  expect(project(600, 500, 0, 30)[1]).toBeLessThan(500);
  expect(project(600, 500, 0, -30)[1]).toBeGreaterThan(500);
});

test('combined yaw/pitch stays continuous while the body below the head band stays unchanged', () => {
  const rig = configured(), engine = createRig(rig), legacy = createRig(parseRig(fixture));
  const at = (x: number, y: number, angleX: number, angleY: number) =>
    engine.deformBase(x, y, engine.baseWeights(x, y), { ...defaults, angleX, angleY }, physics, [0, 0]);
  for (const x of [-30, 0, 30]) for (const y of [-30, 0, 30]) {
    for (const f of [rig.face.nose, rig.face.eyeA, rig.face.eyeB, rig.face.mouth]) {
      const a = at(f.cx, f.cy, x, y), b = at(f.cx, f.cy, x + .001, y + .001);
      expect(a.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThan(.1);
    }
    const px = rig.body.chest.cx, py = Math.max(...rig.head.weightBand, ...rig.head.turnBand) + 20;
    expect(at(px, py, x, y)).toEqual(legacy.deformBase(px, py, legacy.baseWeights(px, py), { ...defaults, angleX: x, angleY: y }, physics, [0, 0]));
  }
});

test('drawn closed eyes and mouth sprites share the projected face transform', () => {
  const rig = configured(), engine = createRig(rig);
  type Mesh = { rest: number[]; pos: number[] };
  type Layer = { mesh: Mesh; visible: boolean; alpha: number };
  type Creator = (renderer: { addLayer(name: string, image: unknown, mesh: Mesh): Layer },
    sheet: { layers: Record<string, number[]> }, images: Record<string, { width: number }>,
    grid: (rect: number[]) => Mesh, alpha: () => Uint8Array) => {
      update(p: Record<string, number>, phys: typeof physics, dt: number, mood: string): unknown;
    };
  const layers = { eyes_closed_0: [rig.face.eyeA.cx, rig.face.eyeA.cy, 4, 4], mouth_sad: [rig.mouth.cx, rig.mouth.cy, 4, 4] };
  const items: Layer[] = [];
  const create = createSpriteModule(engine, rig).createSprites as unknown as Creator;
  const sprites = create({ addLayer(_name, _image, mesh) {
    const layer = { mesh, visible: false, alpha: 1 }; items.push(layer); return layer;
  } }, { layers }, Object.fromEntries(Object.keys(layers).map(name => [name, { width: 4 }])),
  rect => ({ rest: rect.slice(0, 2), pos: [0, 0] }), () => new Uint8Array());
  for (const angleX of [-30, 0, 30]) for (const angleY of [-30, 0, 30]) {
    const p = { ...defaults, angleX, angleY, eyeROpen: 0 };
    sprites.update(p, physics, 0, 'sad');
    for (const item of items) {
      expect(item.visible).toBe(true);
      const [x, y] = item.mesh.rest;
      expect(item.mesh.pos).toEqual(engine.deformBase(x, y, engine.baseWeights(x, y, 0), p, physics, [0, 0]));
    }
  }
});
