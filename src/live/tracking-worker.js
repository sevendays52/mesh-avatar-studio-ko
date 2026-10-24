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
        self.postMessage({ type: 'result', elapsed, result: {
          faceLandmarks: result.faceLandmarks.length ? [[]] : [],
          ...(bounds && { faceBounds: bounds }),
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
