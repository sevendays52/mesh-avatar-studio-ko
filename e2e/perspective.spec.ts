import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import type { Rig } from 'mesh-avatar';
import { samplePresent, sampleSkipReason } from './sample';

test('opt-in perspective renders combined angles and drawn expressions while rest and alpha stay exact', async ({ page }) => {
  test.skip(!samplePresent, sampleSkipReason);
  const rig = JSON.parse(readFileSync('samples/miko-qipao/rig.json', 'utf8')) as Rig;
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/__perspective__', route => route.fulfill({ contentType: 'text/html', body: '<canvas width="720" height="720" style="width:720px;height:720px"></canvas>' }));
  await page.goto('/__perspective__');
  const result = await page.evaluate(async rig => {
    const path = '/packages/runtime/src/index.ts'; const { createMeshAvatar, PARAMS } = await import(/* @vite-ignore */ path);
    const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
    const layers = await (await fetch('/miko-qipao/built/layers.json')).json();
    const sprites = await (await fetch('/miko-qipao/built/sprites/sprites.json')).json();
    const assets: Record<string, string> = { 'layers.json': '/miko-qipao/built/layers.json', 'sprites/sprites.json': '/miko-qipao/built/sprites/sprites.json' };
    for (const name of ['base', 'hairmask', ...Object.keys(layers.layers)]) assets[`${name}.png`] = `/miko-qipao/built/${name}.png`;
    for (const name of Object.keys(sprites.layers)) assets[`sprites/${name}.png`] = `/miko-qipao/built/sprites/${name}.png`;
    const defaults = Object.fromEntries(PARAMS.map((p: { id: string; def: number }) => [p.id, p.def]));
    const capture = async (perspective: boolean) => {
      const data = structuredClone(rig);
      if (perspective) data.head.perspective = { yaw: .4, pitch: .35, depth: 65, focalLength: 3000 };
      const avatar = await createMeshAvatar(canvas, { rig: data, assets, manual: true, padTop: .1, padSide: .1 });
      avatar.setAutoIdle(false); avatar.setAutoMotion(false); avatar.setSwayGain(0);
      const image = (parameters: Record<string, number>) => { avatar.setParameters({ ...defaults, ...parameters }); avatar.advance(0); return canvas.toDataURL(); };
      const rest = image({}), angled = image({ angleX: 30, angleY: -20 });
      const blink = image({ angleX: 30, angleY: -20, eyeLOpen: 0, eyeROpen: 0, mouthOpen: 1 });
      avatar.destroy(); return { rest, angled, blink };
    };
    return { legacy: await capture(false), projected: await capture(true) };
  }, rig);
  expect(result.projected.rest).toBe(result.legacy.rest);
  expect(result.projected.angled).not.toBe(result.legacy.angled);
  expect(result.projected.blink).not.toBe(result.projected.angled);
  const png = (url: string) => PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
  const rest = png(result.projected.rest), turned = png(result.projected.angled);
  expect(turned.data[3]).toBe(0);
  const scale = 720 / (rig.image.width * 1.2), ox = (720 - rig.image.width * scale) / 2, oy = 720 - rig.image.height * scale;
  // The arm at x=237..584 follows its head contact by design. Sample the fixed
  // torso to its right; do not confuse intentional forearm motion with body drift.
  for (let y = 950; y < 1100; y += 20) for (let x = 650; x < 750; x += 20) {
    const i = (Math.round(oy + y * scale) * rest.width + Math.round(ox + x * scale)) * 4;
    expect([...turned.data.subarray(i, i + 4)]).toEqual([...rest.data.subarray(i, i + 4)]);
  }
  expect(errors).toEqual([]);
});
