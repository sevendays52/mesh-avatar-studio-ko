import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import type { MeshAvatar, Rig } from 'mesh-avatar';
import { samplePresent, sampleSkipReason } from './sample';

const fixture = JSON.parse(readFileSync(new URL('../samples/miko-qipao/rig.json', import.meta.url), 'utf8')) as Rig;
const layers = JSON.parse(readFileSync(new URL('../samples/miko-qipao/built/layers.json', import.meta.url), 'utf8')) as { layers: Record<string, number[]> };
const sprites = JSON.parse(readFileSync(new URL('../samples/miko-qipao/built/sprites/sprites.json', import.meta.url), 'utf8')) as { build: string; layers: Record<string, number[]> };

for (const continuous of [false, true]) test(`${continuous ? 'morphed' : 'switched'} pitch views work under self-only CSP, animate expressions, preserve alpha/body and release private canvases`, async ({ page }) => {
  test.skip(!samplePresent, sampleSkipReason); test.setTimeout(90000);
  const rig = structuredClone(fixture) as Rig;
  rig.head.pitch = { maxAngle: 0, depth: 0, views: [{ id: 'test', angleY: -30 }] };
  const names = { base: [0, 0, rig.image.width, rig.image.height], hairmask: [0, 0, rig.image.width, rig.image.height], ...layers.layers };
  const aliases = Object.fromEntries(Object.keys(names).map(name => [name, `pitch_view_test_${name}`]));
  const spriteAliases = Object.fromEntries(Object.keys(sprites.layers).map(name => [name, `pitch_view_test_${name}`]));
  const sheet = { ...sprites, ...(continuous && { pitchMorphs: [{ from: 'neutral', to: 'test',
    grid: { x: 0, y: 0, cell: 100, cols: 3, rows: 3 }, forward: Array(18).fill(0), backward: Array(18).fill(0) }] }), layers: { ...sprites.layers,
    ...Object.fromEntries(Object.entries(names).map(([name, rect]) => [aliases[name], rect])),
    ...Object.fromEntries(Object.entries(sprites.layers).map(([name, rect]) => [spriteAliases[name], rect])) },
  pitchViews: { test: { rig: fixture, layers: aliases, sprites: spriteAliases } } };
  const moodName = 'pitch_view_test_eyes_sad_0';
  sheet.layers[moodName] = sprites.layers.eyes_closed_0;
  sheet.pitchViews.test.sprites.eyes_sad_0 = moodName;
  const assets: Record<string, string> = { 'layers.json': '/miko-qipao/built/layers.json', 'sprites/sprites.json': '/__pitch_sheet__.json' };
  for (const name of Object.keys(names)) {
    assets[`${name}.png`] = `/miko-qipao/built/${name}.png`;
    assets[`sprites/${aliases[name]}.png`] = name === 'base' ? '/__pitch_base__.png' : assets[`${name}.png`];
  }
  for (const name of Object.keys(sprites.layers)) {
    assets[`sprites/${name}.png`] = `/miko-qipao/built/sprites/${name}.png`;
    assets[`sprites/${spriteAliases[name]}.png`] = assets[`sprites/${name}.png`];
  }
  assets[`sprites/${moodName}.png`] = '/miko-qipao/built/sprites/eyes_closed_0.png';
  const picture = PNG.sync.read(await readFile(new URL('../samples/miko-qipao/built/base.png', import.meta.url)));
  for (let y = 185; y < 230; y++) for (let x = 595; x < 640; x++) {
    const i = (y * picture.width + x) * 4;
    picture.data[i] = 255; picture.data[i + 1] = 20; picture.data[i + 2] = 170; picture.data[i + 3] = 255;
  }
  await page.route('**/__pitch_base__.png', route => route.fulfill({ contentType: 'image/png', body: PNG.sync.write(picture) }));
  await page.route('**/__pitch_sheet__.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(sheet) }));
  await page.route('**/__drawn_pitch__', route => route.fulfill({ contentType: 'text/html',
    headers: { 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'" },
    body: '<!doctype html><canvas id="avatar" style="width:720px;height:720px"></canvas>' }));
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/__drawn_pitch__');
  const result = await page.evaluate(async ({ rig, assets, continuous }) => {
    const path = '/packages/runtime/src/index.ts';
    const { createMeshAvatar, PARAMS } = await import(/* @vite-ignore */ path);
    const canvas = document.querySelector<HTMLCanvasElement>('#avatar')!;
    const defaults = Object.fromEntries(PARAMS.map((p: { id: string; def: number }) => [p.id, p.def]));
    const avatar: MeshAvatar = await createMeshAvatar(canvas, { rig, assets, manual: true, padTop: 0.1, padSide: 0.1 });
    avatar.setAutoIdle(false); avatar.setAutoMotion(false); avatar.setSwayGain(0);
    const capture = (values: Record<string, number>, seconds = 0) => {
      avatar.setParameters({ ...defaults, ...values }); avatar.advance(seconds, 100); return canvas.toDataURL();
    };
    const neutral = capture({}), full = capture({ angleY: -30 }), middle = capture({ angleY: continuous ? -15 : 0 }, 0.04);
    const blink = capture({ angleY: -30, eyeLOpen: 0, eyeROpen: 0 });
    const talk = capture({ angleY: -30, mouthOpen: 0.9, mouthForm: -1 });
    const params = avatar.getParameters();
    avatar.setParameters({ ...defaults, angleY: -30 }); avatar.setExpression('sad'); avatar.advance(0.4);
    const sad = canvas.toDataURL(), sadParams = avatar.getParameters();
    avatar.setExpression('neutral'); avatar.setParameters(sadParams); avatar.advance(0.4);
    const samePoseWithoutMood = canvas.toDataURL();
    avatar.setViewport({ zoom: 1.5 }); avatar.advance(0);
    avatar.destroy(); avatar.destroy();
    const remaining = document.querySelectorAll('div[aria-hidden="true"] canvas').length;
    const plainRig = structuredClone(rig); delete plainRig.head.pitch!.views;
    const plain: MeshAvatar = await createMeshAvatar(canvas, { rig: plainRig, assets, manual: true, padTop: 0.1, padSide: 0.1 });
    plain.setAutoIdle(false); plain.setAutoMotion(false); plain.setSwayGain(0); plain.setParameters(defaults); plain.advance(0);
    const recovered = canvas.toDataURL(), lost = canvas.getContext('webgl2')!.isContextLost(); plain.destroy();
    return { neutral, full, middle, blink, talk, sad, samePoseWithoutMood, params, remaining, recovered, lost };
  }, { rig, assets, continuous });
  const png = (url: string) => PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
  const neutral = png(result.neutral), full = png(result.full), middle = png(result.middle);
  const scale = 720 / (1254 * 1.2), ox = (720 - 1254 * scale) / 2, oy = 720 - 1254 * scale;
  const pixel = (image: PNG, x: number, y: number) => [...image.data.slice((Math.round(y) * image.width + Math.round(x)) * 4, (Math.round(y) * image.width + Math.round(x)) * 4 + 4)];
  const [r0] = pixel(neutral, ox + 615 * scale, oy + 205 * scale);
  const [r1] = pixel(full, ox + 615 * scale, oy + 205 * scale);
  const [rm] = pixel(middle, ox + 615 * scale, oy + 205 * scale);
  expect(r1).toBeGreaterThan(240); expect(rm).toBeGreaterThan(r0 + 30); expect(rm).toBeLessThan(r1 - 30);
  for (const image of [neutral, full, middle]) expect(pixel(image, 5, 5)[3]).toBe(0);
  for (let y = 950; y <= 1100; y += 10) for (let x = 450; x <= 750; x += 10)
    expect(pixel(full, ox + x * scale, oy + y * scale)).toEqual(pixel(neutral, ox + x * scale, oy + y * scale));
  expect(result.blink).not.toBe(result.full); expect(result.talk).not.toBe(result.full);
  expect(result.sad).not.toBe(result.samePoseWithoutMood);
  expect(result.params.angleY).toBe(-30); expect(result.remaining).toBe(0); expect(result.lost).toBe(false);
  const recovered = png(result.recovered);
  let maximum = 0;
  for (let i = 0; i < recovered.data.length; i++) maximum = Math.max(maximum, Math.abs(recovered.data[i] - neutral.data[i]));
  expect(maximum).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
