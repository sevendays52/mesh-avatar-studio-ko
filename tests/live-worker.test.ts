import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test, vi } from 'vitest';
import { FacePose, type FaceResult } from '../src/live/tracking';

const source = readFileSync(new URL('../src/live/tracking-worker.js', import.meta.url), 'utf8');

function eyePoints(width: number, height: number, roll: number, left: number, right: number) {
  const points = Array.from({ length: 468 }, () => ({ x: .5, y: .5 }));
  for (const [cx, ratio, indices] of [[.65, left, [362, 263, 385, 380, 386, 374]], [.35, right, [33, 133, 160, 144, 158, 153]]] as const) {
    const positions = [[-20, 0], [20, 0], [-7, -20 * ratio], [-7, 20 * ratio], [7, -20 * ratio], [7, 20 * ratio]];
    indices.forEach((id, i) => {
      const [x, y] = positions[i];
      points[id] = { x: cx + (x * Math.cos(roll) - y * Math.sin(roll)) / width,
        y: .5 + (x * Math.sin(roll) + y * Math.cos(roll)) / height };
    });
  }
  return points;
}

test.each([[640, 480, 0], [1280, 720, .6], [480, 640, Math.PI / 2]])('worker lid measurements reach full closure at %i×%i with roll %f', async (width, height, roll) => {
  const raw = { faceLandmarks: [eyePoints(width, height, roll, .16, .3)],
    faceBlendshapes: [{ categories: [{ categoryName: 'eyeBlinkLeft', score: .1 }, { categoryName: 'eyeBlinkRight', score: .1 }] }],
    facialTransformationMatrixes: [{ data: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] }] };
  const postMessage = vi.fn();
  const scope = { exports: {}, postMessage, setInterval: vi.fn(), location: { href: 'http://127.0.0.1/mediapipe/tracking-worker.js' },
    importScripts: () => { scope.exports = { FaceLandmarker: { createFromOptions: async () => ({ detectForVideo: () => raw }) }, FilesetResolver: { forVisionTasks: async () => ({}) } }; },
    onmessage: async (_event: { data: Record<string, unknown> }) => {},
  };
  runInNewContext(source, { self: scope, performance: { now: () => 0 }, URL });
  await scope.onmessage({ data: { type: 'init' } });
  const pose = new FacePose(), options = { mirror: false, sensitivity: 1, smoothing: 1 };
  const capture = async (timestamp: number, bitmap = false) => {
    const frame = { ...(bitmap ? { width, height } : { displayWidth: width, displayHeight: height }), close: vi.fn() };
    await scope.onmessage({ data: { type: 'frame', frame, timestamp } });
    expect(frame.close).toHaveBeenCalledOnce();
    const message = postMessage.mock.calls.filter(([m]) => m.type === 'result').at(-1)![0];
    expect(message.result.faceLandmarks).toEqual([[]]);
    return message.result as FaceResult;
  };
  const neutral = await capture(0);
  expect(neutral.eyeAspectRatios?.Left).toBeCloseTo(.16);
  expect(neutral.eyeAspectRatios?.Right).toBeCloseTo(.3);
  pose.update(neutral, 0); expect(pose.calibrate(0)).toBe(true);
  raw.faceLandmarks = [eyePoints(width, height, roll, .04, .3)]; raw.faceBlendshapes[0].categories[0].score = .4;
  pose.update(await capture(33, true), 33);
  expect(pose.sample(33, 1 / 60, options).params).toMatchObject({ eyeLOpen: 0, eyeROpen: 1 });
  // A malformed eye must not become a zero-gap blink; the other eye remains usable.
  raw.faceLandmarks[0][385].x = NaN;
  expect((await capture(66)).eyeAspectRatios).toEqual({ Right: expect.closeTo(.3) });
});

test.each(['balanced', 'sensitive'])('worker %s profile returns compact full-frame bounds without raw landmarks', async profile => {
  const raw = { faceLandmarks: [[{ x: .1, y: .2 }, { x: .5, y: .7 }, { x: .3, y: .4 }]], faceBlendshapes: [], facialTransformationMatrixes: [] };
  const create = vi.fn(async () => ({ detectForVideo: () => raw })), postMessage = vi.fn();
  const scope = { exports: {}, postMessage, setInterval: vi.fn(), location: { href: 'http://127.0.0.1/mediapipe/tracking-worker.js' },
    importScripts: () => { scope.exports = { FaceLandmarker: { createFromOptions: create }, FilesetResolver: { forVisionTasks: async () => ({}) } }; },
    onmessage: async (_event: { data: Record<string, unknown> }) => {},
  };
  runInNewContext(source, { self: scope, performance: { now: () => 0 }, URL });
  await scope.onmessage({ data: { type: 'init', detectionProfile: profile } });
  const settings = create.mock.calls[0] as unknown as [unknown, Record<string, unknown>];
  expect(settings[1]).toMatchObject({ minFaceDetectionConfidence: profile === 'sensitive' ? .35 : .5,
    minFacePresenceConfidence: profile === 'sensitive' ? .35 : .5, minTrackingConfidence: .5, numFaces: 1 });
  await scope.onmessage({ data: { type: 'frame', frame: { close() {} }, timestamp: 0 } });
  const message = postMessage.mock.calls.find(([m]) => m.type === 'result')![0];
  expect(message.result.faceLandmarks).toEqual([[]]);
  expect(message.result.faceBounds).toMatchObject({ x: .1, y: .2, width: .4 });
  expect(message.result.faceBounds.height).toBeCloseTo(.5);
});
test('worker falls back from GPU to CPU, keeps frames local and closes both accepted and skipped frames', async () => {
  const result = { faceLandmarks: [[{ x: 0.5, y: 0.5 }]], faceBlendshapes: [], facialTransformationMatrixes: [] };
  const detectForVideo = vi.fn(() => result), create = vi.fn().mockRejectedValueOnce(new Error('GPU unavailable')).mockResolvedValue({ detectForVideo });
  const postMessage = vi.fn(), now = vi.fn(() => 0), tick = vi.fn();
  const scope = {
    exports: {}, postMessage, setInterval: tick, location: { href: 'http://127.0.0.1:5173/mediapipe/tracking-worker.js' },
    importScripts: vi.fn((url: string) => {
      expect(url).toBe('http://127.0.0.1:5173/mediapipe/vision_bundle.js');
      scope.exports = { FaceLandmarker: { createFromOptions: create }, FilesetResolver: { forVisionTasks: async (path: string) => { expect(path).toBe('http://127.0.0.1:5173/mediapipe'); return {}; } } };
    }),
    onmessage: async (_event: { data: Record<string, unknown> }) => {},
  };
  runInNewContext(source, { self: scope, performance: { now }, URL });
  await scope.onmessage({ data: { type: 'init' } });
  expect(create.mock.calls.map(call => call[1].baseOptions.delegate)).toEqual(['GPU', 'CPU']);
  expect(create.mock.calls[1][1].baseOptions.modelAssetPath).toBe('http://127.0.0.1:5173/mediapipe/face_landmarker.task');
  expect(postMessage).toHaveBeenCalledWith({ type: 'ready', delegate: 'CPU' });
  const frame = { close: vi.fn() };
  await scope.onmessage({ data: { type: 'frame', frame, timestamp: 0 } });
  await scope.onmessage({ data: { type: 'frame', frame, timestamp: 0 } });
  expect(detectForVideo).toHaveBeenCalledTimes(1); expect(frame.close).toHaveBeenCalledTimes(2);
  expect(postMessage).toHaveBeenCalledWith({ type: 'result', elapsed: 0, result: { ...result, faceLandmarks: [[]] } });
  detectForVideo.mockImplementation(() => { throw new Error('Bad frame'); }); now.mockReturnValue(40);
  await scope.onmessage({ data: { type: 'frame', frame, timestamp: 40 } });
  expect(frame.close).toHaveBeenCalledTimes(3); expect(postMessage).toHaveBeenCalledWith({ type: 'error' });
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'consumed' });
  tick.mock.calls[0][0](); expect(postMessage).toHaveBeenLastCalledWith({ type: 'tick' });
});

test('worker changes an initialized but persistently slow GPU to CPU once after warm-up', async () => {
  let now = 0;
  const setOptions = vi.fn(async () => undefined), postMessage = vi.fn();
  const tracker = { setOptions, detectForVideo: () => { now += 100; return { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] }; } };
  const scope = { exports: {}, postMessage, setInterval: vi.fn(), location: { href: 'http://127.0.0.1:5173/mediapipe/tracking-worker.js' },
    importScripts: () => { scope.exports = { FaceLandmarker: { createFromOptions: async () => tracker }, FilesetResolver: { forVisionTasks: async () => ({}) } }; },
    onmessage: async (_event: { data: Record<string, unknown> }) => {},
  };
  runInNewContext(source, { self: scope, performance: { now: () => now }, URL });
  await scope.onmessage({ data: { type: 'init' } });
  for (let i = 0; i < 12; i++) await scope.onmessage({ data: { type: 'frame', frame: { close() {} }, timestamp: i * 100 } });
  expect(setOptions).not.toHaveBeenCalled();
  for (let i = 12; i < 30; i++) await scope.onmessage({ data: { type: 'frame', frame: { close() {} }, timestamp: i * 100 } });
  expect(setOptions).toHaveBeenCalledExactlyOnceWith({ baseOptions: { delegate: 'CPU' } });
  expect(postMessage).toHaveBeenCalledWith({ type: 'delegate', delegate: 'CPU' });
});

test('worker loads its files from the folder it is served from', async () => {
  const create = vi.fn().mockResolvedValue({ detectForVideo: vi.fn() }), imported: string[] = [], resolved: string[] = [];
  const scope = { exports: {}, postMessage: vi.fn(), setInterval: vi.fn(), location: { href: 'https://example.github.io/mesh-avatar-studio/mediapipe/tracking-worker.js' },
    importScripts: (url: string) => {
      imported.push(url);
      scope.exports = { FaceLandmarker: { createFromOptions: create }, FilesetResolver: { forVisionTasks: async (path: string) => { resolved.push(path); return {}; } } };
    },
    onmessage: async (_event: { data: Record<string, unknown> }) => {},
  };
  runInNewContext(source, { self: scope, performance: { now: () => 0 }, URL });
  await scope.onmessage({ data: { type: 'init' } });
  expect(imported).toEqual(['https://example.github.io/mesh-avatar-studio/mediapipe/vision_bundle.js']);
  expect(resolved).toEqual(['https://example.github.io/mesh-avatar-studio/mediapipe']);
  expect(create.mock.calls[0][1].baseOptions.modelAssetPath).toBe('https://example.github.io/mesh-avatar-studio/mediapipe/face_landmarker.task');
});
