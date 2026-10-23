import { expect, test } from 'vitest';
import fixture from '../samples/miko-qipao/rig.json';
import { parseRig, validateRig } from 'mesh-avatar';
import { headViewPackages, nearestHeadView } from '../packages/runtime/src/engine/pitch-views.js';
import { createSpriteModule } from '../packages/runtime/src/engine/sprites.js';
import { createRig } from '../packages/runtime/src/engine/rig.js';

test('head poses select painted yaw/pitch/diagonal views with stable boundaries', () => {
  const nodes = [
    { angleX: 0, angleY: 0 }, { angleX: -30, angleY: 0 },
    { angleX: 30, angleY: 0 }, { angleX: 0, angleY: 30 },
    { angleX: 0, angleY: -30 }, { angleX: 30, angleY: -30 },
  ];
  for (const [i, node] of nodes.entries()) expect(nearestHeadView(nodes, node.angleX, node.angleY)).toBe(i);
  expect(nearestHeadView(nodes, 15.2, 0, 0)).toBe(0);
  expect(nearestHeadView(nodes, 15.6, 0, 0)).toBe(2);
  expect(nearestHeadView(nodes, 14.8, 0, 2)).toBe(2);
  expect(nearestHeadView(nodes, 14.4, 0, 2)).toBe(0);
});

test('a missing yaw drawing does not turn a mostly horizontal pose into a nod', () => {
  const nodes = [{ angleX: 0, angleY: 0 }, { angleX: 30, angleY: 0 },
    { angleX: 0, angleY: 30 }, { angleX: 0, angleY: -30 }];
  for (const pitch of [-24, -16, 0, 16, 24]) {
    expect(nearestHeadView(nodes, -30, pitch)).toBe(0);
    expect(nearestHeadView(nodes, -30, pitch, pitch < 0 ? 3 : 2)).toBe(0);
  }
  expect(nearestHeadView(nodes, -12, 30)).toBe(2);
  expect(nearestHeadView(nodes, -12, -30)).toBe(3);
  expect(nearestHeadView(nodes, 30, 16)).toBe(1);
});

test('pose schema rejects ambiguous, nested, nonfinite and out-of-range anchors', () => {
  const rig = parseRig(fixture);
  const good = [{ id: 'left', angleX: -30, angleY: 0 }, { id: 'up', angleX: 0, angleY: 30 }];
  rig.head.views = good;
  expect(validateRig(rig)).toEqual([]);
  for (const views of [[], [{ id: 'neutral', angleX: -30, angleY: 0 }],
    [{ id: 'none', angleX: 0, angleY: 0 }], [{ id: '../up', angleX: 0, angleY: 30 }],
    [{ id: 'up', angleX: NaN, angleY: 30 }], [{ id: 'up', angleX: 0, angleY: 31 }],
    [...good, good[0]], [...good, { id: 'alias', angleX: 0, angleY: 30 }],
    Array.from({ length: 9 }, (_, i) => ({ id: `v${i}`, angleX: i + 1, angleY: 0 }))]) {
    expect(validateRig({ ...rig, head: { ...rig.head, views } }).join()).toContain('rig.head.views');
  }
  rig.head.pitch = { maxAngle: 0.4, depth: 30, views: [{ id: 'down', angleY: -30 }] };
  expect(validateRig(rig).join()).toContain('cannot combine');
});

test('each drawn pose binds its own rig and expression aliases, rejecting unsafe/incomplete packages', () => {
  const rig = parseRig(fixture), posed = parseRig(fixture);
  rig.head.views = [{ id: 'left', angleX: -30, angleY: 0 }];
  posed.mouth.cx += 10;
  const names = ['base', 'hairmask', 'hand', ...posed.accessories!.map(a => a.name),
    ...[0, 1].flatMap(i => ['ball', 'lash', 'low', 'crease'].map(p => `eye${i}_${p}`))];
  const aliases: Record<string, string> = Object.fromEntries(names.map(n => [n, `head_view_left_${n}`]));
  const sheet = { layers: Object.fromEntries([...Object.values(aliases), 'head_view_left_mouth_a'].map(n => [n, [0, 0, 4, 4]])),
    headViews: { left: { rig: posed, layers: aliases, sprites: { mouth_a: 'head_view_left_mouth_a' } } } };
  sheet.layers[aliases.base] = [0, 0, rig.image.width, rig.image.height];
  sheet.layers[aliases.hairmask] = [0, 0, rig.image.width, rig.image.height];
  const [view] = headViewPackages(rig, sheet, (name: string) => `/built/${name}`);
  expect(view.rig.mouth.cx).toBe(posed.mouth.cx);
  expect(view.angleX).toBe(-30);
  expect(view.spriteMetadata.layers.mouth_a).toEqual([0, 0, 4, 4]);
  expect(view.assets['sprites/mouth_a.png']).toBe('/built/sprites/head_view_left_mouth_a.png');
  for (const edit of [
    () => { delete aliases.base; },
    () => { aliases.base = '../outside'; },
    () => { posed.head.views = rig.head.views; },
  ]) {
    edit(); expect(() => headViewPackages(rig, sheet, () => '')).toThrow();
  }
});

test('view textures are never built as hidden neutral expression meshes', () => {
  const rig = parseRig(fixture);
  const { createSprites } = createSpriteModule(createRig(rig), rig);
  const unexpected = () => { throw new Error('A view texture was treated as an ordinary expression'); };
  const module = createSprites({ addLayer: unexpected }, { layers: { head_view_left_base: [0, 0, 100, 100], pitch_view_down_base: [0, 0, 100, 100] } }, {}, unexpected, unexpected);
  expect(module).toBeDefined();
});
