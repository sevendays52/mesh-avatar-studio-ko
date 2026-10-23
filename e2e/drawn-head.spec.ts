import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { Rig } from 'mesh-avatar';
import { samplePresent, sampleSkipReason } from './sample';

for (const sparse of [false, true]) test(`${sparse ? 'sparse' : 'four'} painted head anchors use their own pixels, blink/speak, preserve body/alpha and release contexts`, async ({ page }) => {
  test.skip(!samplePresent, sampleSkipReason); test.setTimeout(90000);
  const fixture = JSON.parse(readFileSync('samples/miko-qipao/rig.json', 'utf8')) as Rig;
  const layers = JSON.parse(readFileSync('samples/miko-qipao/built/layers.json', 'utf8'));
  const sprites = JSON.parse(readFileSync('samples/miko-qipao/built/sprites/sprites.json', 'utf8'));
  const views = [
    { id: 'left', angleX: -30, angleY: 0 }, { id: 'right', angleX: 30, angleY: 0 },
    { id: 'up', angleX: 0, angleY: 30 }, { id: 'down', angleX: 0, angleY: -30 },
  ].filter(view => !sparse || view.id !== 'left');
  const rig = structuredClone(fixture); rig.head.views = views;
  const sheet = { ...sprites, layers: { ...sprites.layers }, headViews: {} as Record<string, unknown> };
  const assets: Record<string, string> = { 'layers.json': '/miko-qipao/built/layers.json', 'sprites/sprites.json': '/__head_sheet__.json' };
  const rects = { base: [0, 0, rig.image.width, rig.image.height], hairmask: [0, 0, rig.image.width, rig.image.height], ...layers.layers };
  for (const name of Object.keys(rects)) assets[`${name}.png`] = `/miko-qipao/built/${name}.png`;
  for (const name of Object.keys(sprites.layers)) assets[`sprites/${name}.png`] = `/miko-qipao/built/sprites/${name}.png`;
  for (const [i, view] of views.entries()) {
    const aliases: Record<string, string> = {}, mood: Record<string, string> = {};
    const picture = PNG.sync.read(await readFile('samples/miko-qipao/built/base.png'));
    // Synthetic marks distinguish actual view selection from mesh movement.
    for (let y = 185; y < 230; y++) for (let x = 595; x < 640; x++) {
      const p = (y * picture.width + x) * 4;
      picture.data[p] = 60 + i * 55; picture.data[p + 1] = 10; picture.data[p + 2] = 180; picture.data[p + 3] = 255;
    }
    await page.route(`**/__head_${view.id}__.png`, route => route.fulfill({ contentType: 'image/png', body: PNG.sync.write(picture) }));
    for (const [name, rect] of Object.entries(rects)) {
      const key = `head_view_${view.id}_${name}`; aliases[name] = key; sheet.layers[key] = rect;
      assets[`sprites/${key}.png`] = name === 'base' ? `/__head_${view.id}__.png` : assets[`${name}.png`];
    }
    for (const [name, rect] of Object.entries(sprites.layers)) {
      const key = `head_view_${view.id}_sprite_${name}`; mood[name] = key; sheet.layers[key] = rect;
      assets[`sprites/${key}.png`] = assets[`sprites/${name}.png`];
    }
    sheet.headViews[view.id] = { rig: fixture, layers: aliases, sprites: mood };
  }
  await page.route('**/__head_sheet__.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sheet) }));
  await page.route('**/__drawn_head__', route => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><canvas id="avatar" style="width:720px;height:720px"></canvas>' }));
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/__drawn_head__');
  const result = await page.evaluate(async ({ rig, assets, views }) => {
    const path = '/packages/runtime/src/index.ts';
    const { createMeshAvatar, PARAMS } = await import(/* @vite-ignore */ path);
    const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
    const avatar = await createMeshAvatar(canvas, { rig, assets, manual: true, padTop: .1, padSide: .1 });
    avatar.setAutoIdle(false); avatar.setAutoMotion(false); avatar.setSwayGain(0);
    const defaults = Object.fromEntries(PARAMS.map((p: { id: string; def: number }) => [p.id, p.def]));
    const capture = (p: Record<string, number>, seconds = 0) => {
      avatar.setParameters({ ...defaults, ...p }); avatar.advance(seconds); return canvas.toDataURL();
    };
    const neutral = capture({});
    const pictures = views.map(v => {
      const pose = { angleX: v.angleX, angleY: v.angleY };
      const anchor = capture(pose), blink = capture({ ...pose, eyeLOpen: 0, eyeROpen: 0 });
      const speaking = capture({ ...pose, mouthOpen: 1 });
      return { id: v.id, anchor, blink, speaking, params: avatar.getParameters() };
    });
    const middle = capture({ angleX: 15.6 }, .04);
    // Exit a genuine nod into a horizontal turn in the missing sector. Tracking
    // can retain some pitch; that must not leave the upward drawing selected.
    capture({ angleY: 30 }, .2);
    const missingYaw = capture({ angleX: -30, angleY: 20 }, .2);
    const trueNod = capture({ angleY: 30 }, .2);
    avatar.destroy(); avatar.destroy();
    const remaining = document.querySelectorAll('div[aria-hidden="true"] canvas').length;
    return { neutral, pictures, middle, missingYaw, trueNod, remaining };
  }, { rig, assets, views });
  const png = (url: string) => PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
  const scale = 720 / (rig.image.width * 1.2), ox = (720 - rig.image.width * scale) / 2, oy = 720 - rig.image.height * scale;
  const pixel = (image: PNG, x: number, y: number) => {
    const i = (Math.round(oy + y * scale) * image.width + Math.round(ox + x * scale)) * 4;
    return [...image.data.slice(i, i + 4)];
  };
  const neutral = png(result.neutral);
  if (sparse) {
    const upRed = 60 + views.findIndex(v => v.id === 'up') * 55;
    const marks = (image: PNG) => {
      let count = 0;
      for (let i = 0; i < image.data.length; i += 4)
        if (image.data[i] === upRed && image.data[i + 1] === 10 && image.data[i + 2] === 180 && image.data[i + 3] === 255) count++;
      return count;
    };
    expect(marks(png(result.missingYaw))).toBe(0);
    expect(marks(png(result.trueNod))).toBeGreaterThan(20);
  }
  await mkdir('projects/.head-view-review', { recursive: true });
  for (const [i, picture] of result.pictures.entries()) {
    const anchor = png(picture.anchor);
    expect(pixel(anchor, 615, 205)[0]).toBeCloseTo(60 + i * 55, 0);
    expect(picture.blink).not.toBe(picture.anchor); expect(picture.speaking).not.toBe(picture.anchor);
    expect(picture.params.angleX).toBe(views[i].angleX); expect(picture.params.angleY).toBe(views[i].angleY);
    expect(anchor.data[3]).toBe(0);
    for (let y = 950; y < 1100; y += 20) for (let x = 450; x < 750; x += 20)
      expect(pixel(anchor, x, y)).toEqual(pixel(neutral, x, y));
    for (const kind of ['anchor', 'blink', 'speaking'] as const)
      await writeFile(`projects/.head-view-review/${picture.id}-${kind}.png`, Buffer.from(picture[kind].split(',')[1], 'base64'));
  }
  expect(result.remaining).toBe(0); expect(errors).toEqual([]);
});
