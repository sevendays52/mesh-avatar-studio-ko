// Camera frames stay in this worker. Only the face pose and timing return to the page.
// Asset paths are relative to this worker, so the files can be served under any folder.
const base = new URL('.', self.location.href).href.replace(/\/$/, '');
self.exports = {};
self.importScripts(`${base}/vision_bundle.js`);
const { FaceLandmarker, FilesetResolver } = self.exports;
let tracker, lastFrame = -Infinity, delegate = 'GPU', frames = 0, gpuSamples = 0, gpuMs = 0;
function faceBounds(points) {
  const valid = (points ?? []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (valid.length < 3) return undefined;
  const xs = valid.map(p => p.x), ys = valid.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
  return { x, y, width: right - x, height: bottom - y };
}
function eyeAspectRatios(points, frame) {
  const width = frame.displayWidth ?? frame.width, height = frame.displayHeight ?? frame.height;
  if (!(width > 0 && height > 0)) return undefined;
  const ratios = {};
  // Anatomical sides, matching eyeBlinkLeft/Right. Measure the lid gap normal to
  // the eye corners in pixels: normalized x/y alone distorts widescreen cameras.
  for (const [side, indices] of [['Left', [362, 263, 385, 380, 386, 374]], ['Right', [33, 133, 160, 144, 158, 153]]]) {
    const p = indices.map(i => points?.[i]);
    if (!p.every(v => v && Number.isFinite(v.x) && Number.isFinite(v.y))) continue;
    const dx = (p[1].x - p[0].x) * width, dy = (p[1].y - p[0].y) * height;
    const span2 = dx * dx + dy * dy;
    if (span2 < 16) continue;
    const gap = (a, b) => Math.abs((a.x - b.x) * width * dy - (a.y - b.y) * height * dx);
    const ratio = (gap(p[2], p[3]) + gap(p[4], p[5])) / (2 * span2);
    if (Number.isFinite(ratio) && ratio <= 1) ratios[side] = ratio;
  }
  return Object.keys(ratios).length ? ratios : undefined;
}
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks(base);
      const threshold = data.detectionProfile === 'sensitive' ? .35 : .5;
      const options = { runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: threshold, minFacePresenceConfidence: threshold, minTrackingConfidence: .5 };
      try { tracker = await FaceLandmarker.createFromOptions(files, { ...options, baseOptions: { modelAssetPath: `${base}/face_landmarker.task`, delegate } }); }
      catch {
        delegate = 'CPU';
        tracker = await FaceLandmarker.createFromOptions(files, { ...options, baseOptions: { modelAssetPath: `${base}/face_landmarker.task`, delegate } });
      }
      self.postMessage({ type: 'ready', delegate });
      // Also wakes the ImageBitmap fallback when video frame callbacks stop in a hidden tab.
      self.setInterval(() => self.postMessage({ type: 'tick' }), 1000 / 30);
    } catch { self.postMessage({ type: 'error' }); }
  } else if (data.type === 'frame') {
    try {
      const now = performance.now();
      if (tracker && data.timestamp - lastFrame >= 1000 / 30 - 2) {
        lastFrame = data.timestamp;
        const start = performance.now(), result = tracker.detectForVideo(data.frame, now), elapsed = performance.now() - start;
        const bounds = faceBounds(result.faceLandmarks[0]);
        const eyes = eyeAspectRatios(result.faceLandmarks[0], data.frame);
        self.postMessage({ type: 'result', elapsed, result: {
          faceLandmarks: result.faceLandmarks.length ? [[]] : [],
          ...(bounds && { faceBounds: bounds }),
          ...(eyes && { eyeAspectRatios: eyes }),
          faceBlendshapes: result.faceBlendshapes,
          facialTransformationMatrixes: result.facialTransformationMatrixes,
        } });
        // Some worker GPU backends initialize but run too slowly. Ignore warm-up, then
        // try CPU if sustained inference alone cannot meet the 15 fps target.
        if (delegate === 'GPU' && ++frames > 5) {
          gpuMs += elapsed;
          if (++gpuSamples === 8) {
            if (gpuMs / gpuSamples > 1000 / 15) {
              await tracker.setOptions({ baseOptions: { delegate: 'CPU' } });
              delegate = 'CPU'; self.postMessage({ type: 'delegate', delegate });
            }
            gpuMs = 0; gpuSamples = 0;
          }
        }
      }
    } catch { self.postMessage({ type: 'error' }); }
    finally { data.frame.close(); self.postMessage({ type: 'consumed' }); }
  }
};
