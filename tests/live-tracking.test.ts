import { expect, test } from 'vitest';
import { FacePose, mapFace, readFace, smoothParameters, rmsLevel, faceNeutral, intentionalPitch, relativeFaceAngles, type FaceResult } from '../src/live/tracking';
import fixture from '../samples/miko-qipao/rig.json';
import { parseRig } from 'mesh-avatar';
import { createRig } from '../packages/runtime/src/engine/rig.js';
import { createSpriteModule } from '../packages/runtime/src/engine/sprites.js';
import { nearestHeadView } from '../packages/runtime/src/engine/pitch-views.js';
const options = { mirror: false, sensitivity: 1, smoothing: 0 };

test('eye and eyebrow gains strengthen weak expressions independently and keep calibrated rest neutral', () => {
  const neutral = readFace(result(0, { eyeBlinkLeft: .2, browInnerUp: .1 }))!;
  const face = readFace(result(12, { eyeBlinkLeft: .4, browInnerUp: .3, jawOpen: .25 }))!;
  const normal = mapFace(face, neutral, options);
  const strong = mapFace(face, neutral, { ...options, eyeSensitivity: 2, browSensitivity: 2 });
  expect(normal.eyeLOpen).toBeCloseTo(.75); expect(strong.eyeLOpen).toBeCloseTo(.5);
  expect(strong.browY).toBeCloseTo(normal.browY * 2);
  expect(strong.angleX).toBe(normal.angleX); expect(strong.mouthOpen).toBe(normal.mouthOpen);
  expect(strong.eyeROpen).toBe(1);
  expect(mapFace(neutral, neutral, { ...options, eyeSensitivity: 4, browSensitivity: 4 })).toMatchObject({ eyeLOpen: 1, browY: 0 });
});

test('reacquisition eases a changed head pose while retaining decisive blinks and reset clears stale pose', () => {
  const pose = new FacePose(); pose.update(result(30), 0); pose.sample(1, .016, options);
  pose.update(result(-30, { eyeBlinkLeft: 1 }), 800);
  const resumed = pose.sample(801, .016, options);
  expect(resumed.tracking).toBe(true); expect(resumed.params.angleX).toBeGreaterThan(-20);
  expect(resumed.params.eyeLOpen).toBe(0);
  expect(pose.sample(1100, .016, options).params.angleX).toBe(-30);
  pose.reset(); expect(pose.sample(1101, .016, options)).toMatchObject({ tracking: false, weight: 0, params: faceNeutral });
});
const multiply = (a: number[], b: number[]) => Array.from({ length: 9 }, (_, i) => {
  const row = i % 3, col = Math.floor(i / 3);
  return a[row] * b[col * 3] + a[row + 3] * b[col * 3 + 1] + a[row + 6] * b[col * 3 + 2];
});
function rotationInput(yaw: number, pitch: number, roll: number) {
  const [y, p, r] = [yaw, pitch, roll].map(v => v * Math.PI / 180);
  const a = multiply([Math.cos(y),0,-Math.sin(y),0,1,0,Math.sin(y),0,Math.cos(y)],
    multiply([1,0,0,0,Math.cos(p),Math.sin(p),0,-Math.sin(p),Math.cos(p)],
      [Math.cos(r),Math.sin(r),0,-Math.sin(r),Math.cos(r),0,0,0,1]));
  const input = result(); input.facialTransformationMatrixes[0].data = [a[0],a[1],a[2],0,a[3],a[4],a[5],0,a[6],a[7],a[8],0,0,0,0,1];
  return input;
}
function result(yaw = 0, shapes: Record<string, number> = {}): FaceResult {
  const a = yaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { faceLandmarks: [[]], facialTransformationMatrixes: [{ data: [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1] }], faceBlendshapes: [{ categories: Object.entries(shapes).map(([categoryName, score]) => ({ categoryName, score })) }] };
}
test('matrix rotation maps to degrees, neutral calibration and clamped engine limits', () => {
  const face = readFace(result(25))!;
  expect(face.yaw).toBeCloseTo(25);
  expect(mapFace(face, null, options).angleX).toBeCloseTo(25);
  expect(mapFace(face, readFace(result(10)), options).angleX).toBeCloseTo(15);
  expect(mapFace(face, null, { ...options, sensitivity: 2 }).angleX).toBe(30);
  const matrix = result().facialTransformationMatrixes[0].data;
  // 30 degrees around X, then independently around Z.
  const a = Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
  matrix.splice(0, 16, 1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1);
  const input = result(); input.facialTransformationMatrixes[0].data = matrix;
  expect(readFace(input)!.pitch).toBeCloseTo(30);
  input.facialTransformationMatrixes[0].data = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  expect(readFace(input)!.roll).toBeCloseTo(30);
  input.facialTransformationMatrixes[0].data[0] = NaN; expect(readFace(input)).toBeNull();
});
test('mirror flips horizontal pose and gaze, swaps eyes, and blink closes fully', () => {
  const face = readFace(result(20, { eyeBlinkLeft: 0.9, eyeLookOutRight: 0.8 }))!;
  const normal = mapFace(face, null, options), mirror = mapFace(face, null, { ...options, mirror: true });
  expect(normal.eyeLOpen).toBe(0); expect(normal.eyeROpen).toBe(1);
  expect(mirror.eyeROpen).toBe(0); expect(mirror.eyeLOpen).toBe(1);
  expect(mirror.angleX).toBe(-normal.angleX); expect(mirror.gazeX).toBe(-normal.gazeX);
  const pose = new FacePose(); pose.update(result(0, { eyeBlinkLeft: 0.95 }), 0);
  expect(pose.sample(1, 1 / 60, { ...options, smoothing: 1 }).params.eyeLOpen).toBe(0);
});
test('calibration normalizes relaxed eyes, mouth shapes, eyebrows and smile', () => {
  const neutral = readFace(result(0, { eyeBlinkLeft: 0.2, jawOpen: 0.1 }))!;
  const calm = mapFace(neutral, neutral, options);
  expect(calm.eyeLOpen).toBe(1); expect(calm.mouthOpen).toBe(0);
  const face = readFace(result(0, { jawOpen: 0.7, mouthPucker: 0.8, browInnerUp: 0.9, mouthSmileLeft: 0.3, cheekSquintRight: 0.4 }))!;
  const mapped = mapFace(face, neutral, options);
  expect(mapped.mouthOpen).toBeGreaterThan(0.6); expect(mapped.mouthForm).toBeGreaterThan(0);
  expect(mapped.browY).toBeGreaterThan(0); expect(mapped.eyeSmile).toBeGreaterThan(0);
  expect(mapFace(readFace(result(0, { mouthStretchLeft: 1, mouthStretchRight: 1 }))!, null, options).mouthForm).toBe(-1);
  expect(mapFace(readFace(result(0, { jawOpen: 0.5, mouthClose: 1 }))!, null, options).mouthOpen).toBe(0);
});
test('smoothing is time-based and face loss waits 500 ms before easing back to idle', () => {
  const full = smoothParameters({ angleX: 0 }, { angleX: 30 }, 0.1, 0.5);
  const half = smoothParameters(smoothParameters({ angleX: 0 }, { angleX: 30 }, 0.05, 0.5), { angleX: 30 }, 0.05, 0.5);
  expect(full.angleX).toBeCloseTo(half.angleX); expect(full.angleX).toBeGreaterThan(0); expect(full.angleX).toBeLessThan(30);
  const pose = new FacePose(); pose.update(result(30), 0);
  expect(pose.sample(499, 0.016, options)).toMatchObject({ tracking: true, weight: 1 });
  const lost = pose.sample(501, 0.016, options);
  expect(lost.tracking).toBe(false); expect(lost.weight).toBeLessThan(1); expect(lost.params.angleX).toBeGreaterThan(0);
  let last = lost;
  for (let i = 0; i < 200; i++) last = pose.sample(600 + i * 16, 0.016, options);
  expect(last.weight).toBe(0); expect(last.params.angleX).toBeCloseTo(faceNeutral.angleX);
  expect(pose.calibrate(5000)).toBe(false);
  pose.update(result(15), 5001); expect(pose.calibrate(5001)).toBe(true);
  expect(pose.sample(5001, 0.016, options).params.angleX).toBe(0);
});
test('microphone RMS has a noise floor, gain and a finite 0–1 output', () => {
  expect(rmsLevel(new Float32Array(128), 1)).toBe(0);
  const samples = new Float32Array([0.1, -0.1]);
  expect(rmsLevel(samples, 2)).toBeCloseTo(rmsLevel(samples, 1) * 2);
  expect(rmsLevel(new Float32Array([1, -1]), 5)).toBe(1);
  expect(rmsLevel(new Float32Array([NaN]), 1)).toBe(0);
});

test('mouth sensitivities reach distinct drawn shapes without amplifying eyes or head pose', () => {
  const rig = parseRig(fixture);
  const { mouthShape } = createSpriteModule(createRig(rig), rig);
  const mouthOptions = { ...options, mouthSensitivity: 2, mouthShapeSensitivity: 2 };
  const mapped = (shapes: Record<string, number>) => mapFace(readFace(result(12, shapes))!, null, mouthOptions);
  const shape = (shapes: Record<string, number>) => {
    const p = mapped(shapes); return mouthShape(p.mouthOpen, p.mouthForm);
  };
  expect(shape({})).toBeNull();
  expect(shape({ jawOpen: .18, mouthClose: .02 })).toBe('aHalf');
  expect(shape({ jawOpen: .35, mouthClose: .02 })).toBe('a');
  expect(shape({ jawOpen: .25, mouthStretchLeft: .4, mouthStretchRight: .4 })).toBe('i');
  expect(shape({ jawOpen: .25, mouthFunnel: .3 })).toBe('o');
  expect(shape({ jawOpen: .25, mouthPucker: .6 })).toBe('u');
  const face = readFace(result(12, { jawOpen: .35, eyeBlinkLeft: .9 }))!;
  const original = mapFace(face, null, options), adjusted = mapFace(face, null, mouthOptions);
  expect(adjusted.angleX).toBe(original.angleX);
  expect(adjusted.eyeLOpen).toBe(original.eyeLOpen);
  expect(adjusted.mouthOpen).toBeCloseTo(original.mouthOpen * 2);
  expect(mapped({ jawOpen: .2, mouthClose: .8 }).mouthOpen).toBe(0);
});

test('mouth sensitivity keeps calibrated closed lips neutral and clamps extremes', () => {
  const neutral = readFace(result(0, { jawOpen: .12, mouthPucker: .15 }))!;
  const mouthOptions = { ...options, mouthSensitivity: 4, mouthShapeSensitivity: 4 };
  expect(mapFace(neutral, neutral, mouthOptions)).toMatchObject({ mouthOpen: 0, mouthForm: 0 });
  const wide = readFace(result(0, { jawOpen: 1, mouthStretchLeft: 1, mouthStretchRight: 1 }))!;
  expect(mapFace(wide, neutral, mouthOptions)).toMatchObject({ mouthOpen: 1, mouthForm: -1 });
  const round = readFace(result(0, { jawOpen: .3, mouthPucker: 1 }))!;
  expect(mapFace(round, neutral, mouthOptions).mouthForm).toBe(1);
});

test('head nod follows matrix pitch around the calibrated pose with independent gain and direction', () => {
  const nod = (pitch: number) => {
    const input = result(), a = pitch * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    input.facialTransformationMatrixes[0].data = [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];
    return input;
  };
  const pose = new FacePose(); pose.update(nod(5), 0); expect(pose.calibrate(0)).toBe(true);
  const settings = { ...options, pitchSensitivity: 2 };
  pose.update(nod(15), 100);
  expect(pose.sample(100, 1 / 60, settings).params.angleY).toBeCloseTo(-20);
  expect(pose.sample(100, 1 / 60, { ...settings, mirror: true }).params.angleY).toBeCloseTo(-20);
  expect(pose.sample(100, 1 / 60, { ...settings, invertPitch: true }).params.angleY).toBeCloseTo(20);
  pose.update(nod(-5), 200); expect(pose.sample(200, 1 / 60, settings).params.angleY).toBeCloseTo(20);
  pose.update(nod(50), 300); expect(pose.sample(300, 1 / 60, settings).params.angleY).toBe(-30);
  expect(pose.sample(1000, 0.1, settings).params.angleY).toBeGreaterThan(-30);
});

test('cheek puff is calibrated, independent of smiling and decays after face loss', () => {
  const pose = new FacePose(); pose.update(result(0, { cheekPuff: 0.1 }), 0); pose.calibrate(0);
  expect(pose.sample(0, 0.1, options).params.cheekPuff).toBe(0);
  pose.update(result(0, { cheekPuff: 0.7, mouthClose: 0.9 }), 10);
  expect(pose.sample(10, 0.1, options).params).toMatchObject({ cheekPuff: 1, mouthOpen: 0 });
  expect(mapFace(readFace(result(0, { cheekSquintLeft: 1, mouthSmileLeft: 1 }))!, null, options).cheekPuff).toBe(0);
  expect(pose.sample(1000, 0.2, options).params.cheekPuff).toBeLessThan(0.4);
});

test('torso follows the head gradually and remains independent of cheek puff', () => {
  const pose = new FacePose(); pose.update(result(30, { cheekPuff: 0.8 }), 0);
  const first = pose.sample(0, 1 / 60, options).params;
  expect(first.angleX).toBeCloseTo(30); expect(first.cheekPuff).toBe(1);
  expect(first.bodyAngleX).toBeGreaterThan(0); expect(first.bodyAngleX).toBeLessThan(1);
  const later = pose.sample(100, 0.4, options).params;
  expect(later.bodyAngleX).toBeGreaterThan(5); expect(later.bodyAngleX).toBeLessThanOrEqual(6);
});

test('calibrated rotation separates a horizontal turn from an inclined neutral head', () => {
  const neutral = readFace(rotationInput(0, 12, 8))!;
  for (const yaw of [-50, -30, 0, 30, 50]) {
    const face = readFace(rotationInput(yaw, 12, 8))!;
    const angles = relativeFaceAngles(face, neutral);
    expect(angles.yaw).toBeCloseTo(yaw, 10); expect(angles.pitch).toBeCloseTo(0, 10); expect(angles.roll).toBeCloseTo(0, 10);
    expect(mapFace(face, neutral, { ...options, pitchSensitivity: 2 }).angleY).toBeCloseTo(0, 10);
  }
});

test('small pitch drift while turning does not select a bowed drawing, but true nods still work', () => {
  for (const yaw of [-50, -30, 30, 50]) {
    expect(intentionalPitch(3, yaw)).toBe(0); expect(intentionalPitch(-3, yaw)).toBe(0);
    expect(mapFace(readFace(rotationInput(yaw, 3, 0))!, null, { ...options, pitchSensitivity: 2 }).angleY).toBeCloseTo(0);
    expect(mapFace(readFace(rotationInput(yaw, 12, 0))!, null, { ...options, pitchSensitivity: 2 }).angleY).toBeCloseTo(-24);
  }
  let previous = 0;
  for (let pitch = 0; pitch <= 15; pitch += .05) {
    const value = intentionalPitch(pitch, 30); expect(value).toBeGreaterThanOrEqual(previous); previous = value;
  }
});

test('mirrored camera yaw with amplified pitch drift cannot select a missing side as an upward head', () => {
  const nodes = [{ angleX: 0, angleY: 0 }, { angleX: 30, angleY: 0 },
    { angleX: 0, angleY: 30 }, { angleX: 0, angleY: -30 }];
  for (const mirror of [false, true]) {
    const face = readFace(rotationInput(mirror ? 30 : -30, -9, 0))!;
    const pose = mapFace(face, null, { ...options, mirror, pitchSensitivity: 2 });
    expect(pose.angleX).toBeCloseTo(-30);
    expect(pose.angleY).toBeCloseTo(18);
    expect(nearestHeadView(nodes, pose.angleX, pose.angleY)).toBe(0);
  }
  const nod = mapFace(readFace(rotationInput(0, -15, 0))!, null, { ...options, pitchSensitivity: 2 });
  expect(nearestHeadView(nodes, nod.angleX, nod.angleY)).toBe(2);
});
