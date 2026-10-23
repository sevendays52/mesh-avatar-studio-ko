import { expect, test, vi } from 'vitest';
import fixture from '../samples/miko-qipao/rig.json';
import { parseRig } from 'mesh-avatar';
import { createRig } from '../packages/runtime/src/engine/rig.js';
import { createRenderer } from '../packages/runtime/src/engine/renderer.js';
import { Renderer as ReferenceRenderer } from '../reference/engine/renderer.js';
import { defaultViewport, frameViewport, viewportMessage } from '../src/live/viewport';

const rig = parseRig(fixture), { Renderer } = createRenderer(createRig(rig), rig);
function projection(width: number, height: number, viewport = defaultViewport) {
  const value = Object.assign(Object.create(Renderer.prototype), { canvas: { clientWidth: width, clientHeight: height, width, height }, pad: { top: rig.view.padTop, side: rig.view.padSide }, fit: 'contain', viewport });
  value.resize(); return value;
}
test('default viewport preserves reference projection exactly; zoom scales distances without a larger framebuffer', () => {
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  try {
    for (const [width, height] of [[1440, 900], [600, 1100], [512, 512]]) {
      const current = projection(width, height);
      const original = Object.assign(Object.create(ReferenceRenderer.prototype), { canvas: { clientWidth: width, clientHeight: height, width, height }, pad: current.pad });
      original.resize();
      expect(current.scale).toEqual(original.scale); expect(current.offset).toEqual(original.offset);
      const zoomed = projection(width, height, { zoom: 3, x: 0.2, y: -0.3 });
      expect(zoomed.canvas.width).toBe(width); expect(zoomed.canvas.height).toBe(height);
      expect(zoomed.pxScale).toBe(current.pxScale * 3);
      expect(zoomed.pxOff[0]).toBeCloseTo(width / 2 + (current.pxOff[0] - width / 2) * 3 + 0.2 * width);
      expect(zoomed.pxOff[1]).toBeCloseTo(height / 2 + (current.pxOff[1] - height / 2) * 3 - 0.3 * height);
    }
  } finally { vi.unstubAllGlobals(); }
});
test('face and upper-body crops centre rig anatomy, including a tall full-body illustration', () => {
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  try {
    const tall = structuredClone(rig); tall.image.height *= 3;
    for (const target of [rig, tall]) for (const preset of ['face', 'upper'] as const) {
      const view = frameViewport(target, 900, 800, preset);
      const { Renderer: R } = createRenderer(createRig(target), target);
      const renderer = Object.assign(Object.create(R.prototype), { canvas: { clientWidth: 900, clientHeight: 800, width: 900, height: 800 }, pad: { top: target.view.padTop, side: target.view.padSide }, fit: 'contain', viewport: view });
      renderer.resize();
      expect(target.head.cx * renderer.pxScale + renderer.pxOff[0]).toBeCloseTo(450);
      const top = (target.head.cy - target.head.ry) * renderer.pxScale + renderer.pxOff[1];
      const chin = (target.head.cy + target.head.ry) * renderer.pxScale + renderer.pxOff[1];
      expect(top).toBeGreaterThan(0); expect(chin).toBeLessThan(800);
    }
  } finally { vi.unstubAllGlobals(); }
});
test('viewport relay permits only bounded numeric framing values and a project name', () => {
  const good = { project: 'dogcake-test', viewport: { zoom: 3, x: 0, y: 1 } };
  expect(viewportMessage(good)).toEqual(good);
  expect(viewportMessage({ ...good, viewport: { zoom: 50, x: -8, y: 9 } })?.viewport).toEqual({ zoom: 8, x: -4, y: 4 });
  for (const value of [null, [], { ...good, project: '../secret' }, { ...good, video: 'data:' }, { ...good, viewport: { zoom: NaN, x: 0, y: 0 } }, { ...good, viewport: { zoom: '3', x: 0, y: 0 } }, { ...good, viewport: { zoom: 3 } }]) expect(viewportMessage(value)).toBeNull();
});
