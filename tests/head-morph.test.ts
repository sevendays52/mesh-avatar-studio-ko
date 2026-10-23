import { expect, test } from 'vitest';
import fixture from '../samples/miko-qipao/rig.json';
import { parseRig } from 'mesh-avatar';
import { sampleMorph, pitchMorphs } from '../packages/runtime/src/engine/head-morph.js';
import { headLandmarks, headViewWarp, warpHeadPoint, cacheHeadMorph, prepareHeadMorph } from '../packages/runtime/src/engine/head-warp.js';

function setup() {
  const rig = parseRig(fixture); rig.head.pitch = { maxAngle: .5, depth: 45, views: [{ id: 'down', angleY: -30 }] };
  const grid = { x: 400, y: 300, cell: 100, cols: 3, rows: 3 };
  const forward = Array(18).fill(0); forward[8] = 10; forward[9] = 4;
  const backward = forward.map(v => -v);
  return { rig, grid, forward, backward, sheet: { pitchMorphs: [{ from: 'neutral', to: 'down', grid, forward, backward }] } };
}
test('optional correspondence grids validate before playback and reject unsafe or discontinuous data', () => {
  const { rig, sheet } = setup(); expect(pitchMorphs(rig, {})).toEqual([]); expect(pitchMorphs(rig, sheet)).toHaveLength(1);
  const edits: ((s: ReturnType<typeof setup>['sheet']) => void)[] = [s => { s.pitchMorphs[0].from = 'unknown'; }, s => { s.pitchMorphs[0].grid.cols = 99; },
    s => { s.pitchMorphs[0].forward[8] = NaN; }, s => { s.pitchMorphs[0].forward[0] = 1; }, s => { s.pitchMorphs.push(s.pitchMorphs[0]); }];
  for (const edit of edits) {
    const next = structuredClone(sheet); edit(next); expect(() => pitchMorphs(rig, next)).toThrow('Pitch morphs');
  }
});
test('correspondences interpolate inside the head and vanish exactly outside the grid', () => {
  const { grid, forward } = setup();
  expect(sampleMorph(grid, forward, 500, 400)).toEqual([10, 4]);
  expect(sampleMorph(grid, forward, 450, 350)).toEqual([2.5, 1]);
  for (const [x, y] of [[0,0], [400,300], [600,500], [800,800]]) expect(sampleMorph(grid, forward, x, y)).toEqual([0,0]);
});
test('geometry morph follows the blend continuously while retaining exact original anchors', () => {
  const { rig, grid, forward } = setup(); const target = headLandmarks(rig), plain = headViewWarp(rig, target);
  for (const weight of [0, .25, .5, .75, 1]) {
    const morph = { grid, field: forward, weight, sourceBottom: 600, toCanonical: plain, fromCanonical: plain };
    const point = warpHeadPoint(500, 400, headViewWarp(rig, target, morph));
    expect(point[0]).toBeCloseTo(500 + 10 * weight, 10); expect(point[1]).toBeCloseTo(400 + 4 * weight, 10);
    expect(warpHeadPoint(600, 1000, headViewWarp(rig, target, morph))).toEqual(warpHeadPoint(600, 1000, plain));
  }
});

test('cached rest correspondences and the frame lookup retain subpixel placement', () => {
  const { rig, grid, forward } = setup(), rest = headLandmarks(rig), target = structuredClone(rest);
  target.y = target.y.map(y => y + 20);
  const source = { grid, field: forward, sourceBand: [450,550], neutralBand: [450,550], toCanonical: headViewWarp(rig, rest) };
  const frame = prepareHeadMorph({ ...source, sourceBottom: 550, weight: .4, fromCanonical: headViewWarp(rig, target) });
  const warp = headViewWarp(rig, target, frame);
  for (let y = 300; y <= 600; y += 13) for (let x = 390; x <= 610; x += 13) {
    const a = warpHeadPoint(x, y, warp), b = warpHeadPoint(x, y, warp, cacheHeadMorph(x, y, source));
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(.002);
  }
});
