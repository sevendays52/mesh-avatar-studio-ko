import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CameraCapture, MicrophoneCapture } from '../src/live/media';

const createWorker = vi.hoisted(() => vi.fn());
vi.mock('../src/live/face-tracker', () => ({ createTrackingWorker: createWorker }));
const empty = { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] };
const media = () => {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream };
};
const video = () => ({ play: vi.fn(async () => undefined), srcObject: null, readyState: 2, currentTime: 0, cancelVideoFrameCallback: vi.fn() }) as unknown as HTMLVideoElement;
const worker = () => ({ postMessage: vi.fn(), terminate: vi.fn(), onmessage: (_event: { data: Record<string, unknown> }) => {}, onerror: () => {} });
beforeEach(() => { createWorker.mockReset(); vi.stubGlobal('MediaStreamTrackProcessor', undefined); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test('stopping while camera permission is pending releases the eventual stream', async () => {
  const { stream, track } = media(); let resolve!: (stream: MediaStream) => void;
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(done => { resolve = done; }) } });
  const capture = new CameraCapture(video(), vi.fn(), vi.fn());
  const pending = capture.start(''); capture.stop(); resolve(stream); await pending;
  expect(track.stop).toHaveBeenCalledOnce(); expect(createWorker).not.toHaveBeenCalled();
});

test('detail capture requests a full frame and passes the optional detection profile to the local worker', async () => {
  const { stream } = media(), thread = worker(), getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } }); createWorker.mockReturnValue(thread);
  const capture = new CameraCapture(video(), vi.fn(), vi.fn());
  await capture.start('camera-2', { detail: true, detectionProfile: 'sensitive' });
  expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: {
    deviceId: { exact: 'camera-2' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 },
  } });
  expect(thread.postMessage).toHaveBeenCalledWith({ type: 'init', detectionProfile: 'sensitive' }); capture.stop();
});
test('stopping during model loading terminates the worker and ignores late results', async () => {
  const { stream, track } = media(), thread = worker(), result = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
  createWorker.mockReturnValue(thread);
  const source = video(), capture = new CameraCapture(source, result, vi.fn());
  await capture.start(''); expect(thread.postMessage).toHaveBeenCalledWith({ type: 'init' });
  capture.stop(); thread.onmessage({ data: { type: 'result', result: empty, elapsed: 1 } });
  expect(track.stop).toHaveBeenCalledOnce(); expect(thread.terminate).toHaveBeenCalledOnce(); expect(result).not.toHaveBeenCalled(); expect(source.srcObject).toBeNull();
});
test('track processing continues without animation frames, keeps only the latest busy frame and cancels its reader', async () => {
  const { stream, track } = media(), thread = worker();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
  let controller!: ReadableStreamDefaultController<VideoFrame>;
  const cancel = vi.fn(), readable = new ReadableStream<VideoFrame>({ start(value) { controller = value; }, cancel });
  vi.stubGlobal('MediaStreamTrackProcessor', class { readable = readable; });
  createWorker.mockReturnValue(thread);
  const capture = new CameraCapture(video(), vi.fn(), vi.fn()); await capture.start('');
  thread.onmessage({ data: { type: 'ready', delegate: 'CPU' } });
  const first = { close: vi.fn() } as unknown as VideoFrame, dropped = { close: vi.fn() } as unknown as VideoFrame;
  controller.enqueue(first); await vi.waitFor(() => expect(thread.postMessage).toHaveBeenCalledWith({ type: 'frame', frame: first, timestamp: 0 }, [first]));
  controller.enqueue(dropped);
  const latest = { close: vi.fn() } as unknown as VideoFrame;
  controller.enqueue(latest); await vi.waitFor(() => expect(dropped.close).toHaveBeenCalledOnce());
  thread.onmessage({ data: { type: 'consumed' } });
  expect(thread.postMessage).toHaveBeenLastCalledWith({ type: 'frame', frame: latest, timestamp: 0 }, [latest]);
  expect(capture.timing.source).toBe('track-processor');
  capture.stop(); expect(cancel).toHaveBeenCalledOnce(); expect(track.stop).toHaveBeenCalledOnce();
});
test('worker timer backs up stalled video callbacks and releases late bitmaps after stop', async () => {
  const { stream } = media(), thread = worker(), source = video();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
  source.requestVideoFrameCallback = vi.fn(() => 7);
  let resolve!: (frame: ImageBitmap) => void;
  vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise<ImageBitmap>(done => { resolve = done; })));
  createWorker.mockReturnValue(thread);
  const capture = new CameraCapture(source, vi.fn(), vi.fn()); await capture.start('');
  thread.onmessage({ data: { type: 'ready', delegate: 'GPU' } });
  thread.onmessage({ data: { type: 'tick' } }); thread.onmessage({ data: { type: 'tick' } });
  expect(createImageBitmap).toHaveBeenCalledOnce();
  capture.stop(); const bitmap = { close: vi.fn() } as unknown as ImageBitmap; resolve(bitmap);
  await vi.waitFor(() => expect(bitmap.close).toHaveBeenCalledOnce());
  expect(source.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
  expect(thread.postMessage).toHaveBeenCalledTimes(1);
});
test('hidden-page warnings depend on actual inference frequency and clear on recovery or stop', async () => {
  const { stream } = media(), thread = worker(), result = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
  createWorker.mockReturnValue(thread); const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
  const capture = new CameraCapture(video(), result, vi.fn()); await capture.start('');
  thread.onmessage({ data: { type: 'ready', delegate: 'CPU' } });
  expect(capture.backgroundStatus(true, 1000)).toBeNull();
  expect(capture.backgroundStatus(true, 2100)).toBe('backgroundStopped');
  clock.mockReturnValue(2200); thread.onmessage({ data: { type: 'result', result: empty, elapsed: 2 } });
  expect(capture.backgroundStatus(true, 2200)).toBe('backgroundSlow');
  expect(capture.backgroundStatus(false, 2200)).toBeNull();
  for (let now = 2233; now <= 4200; now += 33) { clock.mockReturnValue(now); thread.onmessage({ data: { type: 'result', result: empty, elapsed: 2 } }); }
  expect(capture.backgroundStatus(true, 4200)).toBeNull();
  capture.stop(); expect(capture.backgroundStatus(true, 9000)).toBeNull();
});
test('permission denial produces a distinct camera status without starting a worker', async () => {
  const state = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => { throw new DOMException('', 'NotAllowedError'); }) } });
  await new CameraCapture(video(), vi.fn(), state).start('');
  expect(state).toHaveBeenLastCalledWith('cameraBlocked'); expect(createWorker).not.toHaveBeenCalled();
});
test('microphone permission cancellation releases tracks and permission denial is reported', async () => {
  const { stream, track } = media(); let resolve!: (stream: MediaStream) => void;
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(done => { resolve = done; }) } });
  const state = vi.fn(), mic = new MicrophoneCapture(state);
  const pending = mic.start(''); mic.stop(); resolve(stream); await pending;
  expect(track.stop).toHaveBeenCalledOnce(); expect(mic.level(1)).toBe(0);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => { throw new DOMException('', 'NotAllowedError'); }) } });
  await mic.start(''); expect(state).toHaveBeenLastCalledWith('micBlocked');
});
