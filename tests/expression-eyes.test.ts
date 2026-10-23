import { expect, test } from 'vitest';
import fixture from '../samples/miko-qipao/rig.json';
import { parseRig, PARAMS } from 'mesh-avatar';
import { createRig } from '../packages/runtime/src/engine/rig.js';
import { createSpriteModule, eyeMood } from '../packages/runtime/src/engine/sprites.js';
import { Motion } from '../packages/runtime/src/engine/motion.js';

const rig = parseRig(fixture);
const engine = createRig(rig);
const defaults = Object.fromEntries(PARAMS.map(p => [p.id, p.def]));
const physics = { strands: [], bunL: [0, 0], bunR: [0, 0] };

// Minimal renderer: records each sprite layer so the visible drawings can be read back.
function sprites(names: string[]) {
  const layers = new Map<string, { visible: boolean; alpha: number }>();
  const renderer = { addLayer(name: string) { const layer = { visible: false, alpha: 1 }; layers.set(name, layer); return layer; } };
  const sheet = { build: 'test', layers: Object.fromEntries(names.map(name => [name, [500, 400, 10, 10]])) };
  const images = Object.fromEntries(names.map(name => [name, { width: 10 }]));
  const grid = (rect: number[]) => ({ rest: [rect[0], rect[1]], pos: [0, 0] });
  type Create = (...args: unknown[]) => { update(P: Record<string, number>, phys: unknown, dt: number, mood?: string | null): { eyes: boolean[] } };
  const update = (createSpriteModule(engine, rig).createSprites as unknown as Create)(renderer, sheet, images, grid, () => new Uint8Array(1));
  return Object.assign((open: number, mood: string | null = null, dt = 1, mouthOpen = 0) => {
    const result = update.update({ ...defaults, eyeROpen: open, eyeLOpen: open, eyeSmile: 0, eyeSmileL: 0, mouthOpen }, physics, dt, mood);
    return { covered: result.eyes, shown: [...layers].filter(([, layer]) => layer.visible && layer.alpha > 0).map(([name]) => name).sort() };
  }, { layers });
}

const eyes = (...kinds: string[]) => kinds.flatMap(kind => [`eyes_${kind}_0`, `eyes_${kind}_1`]);

test('expression names map to drawn-eye moods, and the live expression wins over the motion one', () => {
  expect(eyeMood('angry', null)).toBe('angry');
  expect(eyeMood('neutral', 'sadTalk')).toBe('sad');
  expect(eyeMood('neutral', 'surprisedTalk')).toBe('surprise');
  expect(eyeMood('neutral', 'surprise')).toBe('surprise');
  expect(eyeMood('smile', 'angryTalk')).toBeNull();
  expect(eyeMood('neutral', 'happyTalk')).toBeNull();
  expect(eyeMood('neutral', null)).toBeNull();
});

test('drawn expression eyes replace open and half eyes, and blinks still close them', () => {
  const frame = sprites(eyes('closed', 'half', 'smile', 'angry', 'sad', 'surprise'));
  expect(frame(0.72, 'sad')).toEqual({ covered: [true, true], shown: eyes('sad') });
  // the angry face keeps the half-closed eye, even if angry eyes were drawn
  expect(frame(0.72, 'angry').shown).toEqual(eyes('half'));
  expect(frame(1.22, 'surprise')).toEqual({ covered: [true, true], shown: eyes('surprise') });
  expect(frame(0.1, 'surprise')).toEqual({ covered: [true, true], shown: eyes('closed') });
  expect(frame(0.78, 'sad').shown).toEqual(eyes('sad'));
  // Back to neutral: the plain open eye returns (no sprite drawn).
  expect(frame(1, null)).toEqual({ covered: [false, false], shown: [] });
});

test('the entire blink switches opaque drawings without double eyelids or a delayed reopening', () => {
  const frame = sprites(eyes('closed', 'half', 'sad'));
  for (const [open, kind] of [[1, null], [.7, 'half'], [.35, 'half'], [.15, 'closed'], [.05, 'closed'], [.15, 'closed'], [.35, 'half'], [.7, 'half'], [1, null]] as const) {
    const result = frame(open, null, 1 / 60);
    expect(result).toEqual({ covered: [!!kind, !!kind], shown: kind ? eyes(kind) : [] });
    for (const name of result.shown) expect(frame.layers.get(name)?.alpha).toBe(1);
  }
  expect(frame(.78, 'sad', 1 / 60)).toEqual({ covered: [true, true], shown: eyes('sad') });
  expect(frame(.1, 'sad', 1 / 60)).toEqual({ covered: [true, true], shown: eyes('closed') });
  expect(frame(.78, 'sad', 1 / 60)).toEqual({ covered: [true, true], shown: eyes('sad') });
});

test('a missing eye drawing never hides the original eye', () => {
  const frame = sprites(eyes('closed'));
  expect(frame(.5, null, 1 / 60)).toEqual({ covered: [false, false], shown: [] });
  expect(frame(.1, null, 1 / 60)).toEqual({ covered: [true, true], shown: eyes('closed') });
  expect(frame(1, null, 1 / 60)).toEqual({ covered: [false, false], shown: [] });
});

test.each([30, 60, 120])('a short automatic blink fully hides the iris at %i fps', fps => {
  const frame = sprites(eyes('closed', 'half'));
  const motion = new Motion(rig.view.gazeCenter ?? [rig.head.cx, rig.head.cy]);
  motion.mode = 'mouse'; motion.autoIdle = false; motion.autoMotion = false;
  motion.blink.start = .02;
  let closedFrames = 0;
  for (let i = 0; i < Math.ceil(fps * .3); i++) {
    const parameters = motion.update(1 / fps);
    const result = frame(parameters.eyeROpen, null, 1 / fps);
    if (parameters.eyeROpen < .3) {
      closedFrames++;
      expect(result.covered).toEqual([true, true]);
      expect(result.shown).toEqual(eyes('closed'));
      for (const name of eyes('closed')) expect(frame.layers.get(name)?.alpha).toBe(1);
    }
  }
  expect(closedFrames).toBeGreaterThan(0);
});

test('avatars without drawn expression eyes keep the previous drawings', () => {
  const frame = sprites(eyes('closed', 'half', 'smile'));
  expect(frame(0.72, 'angry').shown).toEqual(eyes('half'));
  expect(frame(1.22, 'surprise')).toEqual({ covered: [false, false], shown: [] });
  expect(frame(0.1, 'sad').shown).toEqual(eyes('closed'));
});

test('drawn expression mouths replace the closed mouth until an open mouth drawing has faded in', () => {
  const frame = sprites(['mouth_a', 'mouth_a_half', 'mouth_angry', 'mouth_sad']);
  expect(frame(1, 'angry').shown).toEqual(['mouth_angry']);
  expect(frame(1, 'sad').shown).toEqual(['mouth_sad']);
  expect(frame(1, 'surprise').shown).toEqual([]);
  // fading in, the open mouth is drawn over the solid closed one; then it is shown alone
  expect(frame(1, 'angry', 1, 0.18).shown).toEqual(['mouth_a_half', 'mouth_angry']);
  expect(frame(1, 'angry', 1, 0.5).shown).toEqual(['mouth_a_half']);
  expect(frame(1, null).shown).toEqual([]);
});

test('without open mouth drawings the expression mouth stays while speaking', () => {
  const frame = sprites(['mouth_sad']);
  expect(frame(1, 'sad', 1, 0.5).shown).toEqual(['mouth_sad']);
  expect(frame(1, 'angry', 1, 0).shown).toEqual([]);
});
