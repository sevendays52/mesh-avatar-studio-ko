// Vite bundles its config before applying aliases, so use the public source entry here.
import { PARAMS } from '../../packages/runtime/src/index';

export interface FaceResult {
  faceLandmarks: unknown[][];
  /** Compact normalized image bounds; raw camera frames/landmarks stay in the worker. */
  faceBounds?: { x: number; y: number; width: number; height: number };
  faceBlendshapes: { categories: { categoryName: string; score: number }[] }[];
  facialTransformationMatrixes: { data: number[] }[];
}
export interface RawFace { yaw: number; pitch: number; roll: number; shapes: Record<string, number>; rotation?: number[] }
export interface TrackingOptions {
  mirror: boolean; sensitivity: number; smoothing: number;
  mouthSensitivity?: number;
  mouthShapeSensitivity?: number;
  pitchSensitivity?: number;
  invertPitch?: boolean;
  eyeSensitivity?: number;
  browSensitivity?: number;
}
export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
export const faceNeutral: Record<string, number> = {
  angleX: 0, angleY: 0, angleZ: 0, bodyAngleX: 0, bodyAngleY: 0, bodyAngleZ: 0,
  eyeLOpen: 1, eyeROpen: 1, gazeX: 0, gazeY: 0, mouthOpen: 0, mouthForm: 0, cheekPuff: 0, browY: 0, eyeSmile: 0, eyeSmileL: 0,
};
export function readFace(result: FaceResult): RawFace | null {
  const matrix = result.facialTransformationMatrixes[0]?.data;
  if (!result.faceLandmarks.length || !matrix || matrix.length !== 16 || !matrix.every(Number.isFinite)) return null;
  // MediaPipe matrices are column-major. Remove scale before extracting Y-X-Z rotation.
  const m = [...matrix];
  for (const offset of [0, 4, 8]) {
    const length = Math.hypot(m[offset], m[offset + 1], m[offset + 2]);
    if (length < 1e-6) return null;
    for (let i = 0; i < 3; i++) m[offset + i] /= length;
  }
  const degrees = 180 / Math.PI;
  return { yaw: Math.atan2(m[8], m[10]) * degrees, pitch: Math.asin(clamp(-m[9], -1, 1)) * degrees,
    roll: Math.atan2(m[1], m[5]) * degrees,
    shapes: Object.fromEntries((result.faceBlendshapes[0]?.categories ?? []).map(shape => [shape.categoryName, clamp(shape.score)])),
    rotation: [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]] };
}
const angleDelta = (value: number, neutral: number) => ((value - neutral + 540) % 360) - 180;
export function relativeFaceAngles(face: RawFace, neutral: RawFace | null) {
  if (!face.rotation || !neutral?.rotation) return {
    yaw: angleDelta(face.yaw, neutral?.yaw ?? 0), pitch: angleDelta(face.pitch, neutral?.pitch ?? 0),
    roll: angleDelta(face.roll, neutral?.roll ?? 0),
  };
  // Remove the calibrated camera orientation before decomposing it. Subtracting
  // Euler angles mixes axes when the neutral head is already tilted or pitched.
  const a = face.rotation, b = neutral.rotation;
  const r = Array.from({ length: 9 }, (_, i) => {
    const row = i % 3, col = Math.floor(i / 3);
    return a[row] * b[col] + a[row + 3] * b[col + 3] + a[row + 6] * b[col + 6];
  });
  const degrees = 180 / Math.PI;
  return { yaw: Math.atan2(r[6], r[8]) * degrees, pitch: Math.asin(clamp(-r[7], -1, 1)) * degrees,
    roll: Math.atan2(r[1], r[4]) * degrees };
}
export function intentionalPitch(pitch: number, yaw: number) {
  // Camera fits drift a few degrees as the nose turns away. Keep that noise out
  // of the drawn-view selector; full nods retain their original amplitude.
  const start = 2 + Math.min(60, Math.abs(yaw)) * 0.05;
  const t = clamp((Math.abs(pitch) - start) / 3);
  if (t === 0) return 0;
  return pitch * t * t * (3 - 2 * t);
}
export function mapFace(face: RawFace, neutral: RawFace | null, options: TrackingOptions): Record<string, number> {
  const s = (key: string) => face.shapes[key] ?? 0;
  const n = (key: string) => neutral?.shapes[key] ?? 0;
  const d = (key: string) => s(key) - n(key);
  const mean = (a: string, b: string) => (d(a) + d(b)) / 2;
  const mirror = options.mirror ? -1 : 1, gain = clamp(options.sensitivity, 0.25, 2);
  const mouthGain = gain * clamp(options.mouthSensitivity ?? 1, 0.5, 4);
  const mouthShapeGain = gain * clamp(options.mouthShapeSensitivity ?? 1, 0.5, 4);
  const rotation = relativeFaceAngles(face, neutral);
  const x = clamp(rotation.yaw * gain * mirror, -30, 30);
  // Camera X rotation is positive for a downward nod; the avatar looks down at negative angleY.
  const y = clamp(intentionalPitch(rotation.pitch, rotation.yaw) * gain * clamp(options.pitchSensitivity ?? 1, 0.5, 4) * (options.invertPitch ? 1 : -1), -30, 30);
  const z = clamp(rotation.roll * gain * mirror, -30, 30);
  const open = (side: string) => {
    const blink = s(`eyeBlink${side}`);
    if (blink >= 0.85) return 0;
    const original = (1 - blink) / Math.max(0.2, 1 - n(`eyeBlink${side}`));
    const eyeGain = clamp(options.eyeSensitivity ?? 1, .5, 4);
    return clamp(eyeGain === 1 ? original : 1 - (1 - original) * eyeGain, 0, 1.25);
  };
  const smile = clamp((mean('mouthSmileLeft', 'mouthSmileRight') + mean('cheekSquintLeft', 'cheekSquintRight')) * 0.3);
  return { angleX: x, angleY: y, angleZ: z, bodyAngleX: x * 0.2, bodyAngleY: y * 0.2, bodyAngleZ: z * 0.2,
    eyeLOpen: open(options.mirror ? 'Right' : 'Left'), eyeROpen: open(options.mirror ? 'Left' : 'Right'),
    gazeX: clamp((d('eyeLookOutRight') - d('eyeLookInRight') + d('eyeLookInLeft') - d('eyeLookOutLeft')) * mirror, -1, 1),
    gazeY: clamp(mean('eyeLookUpLeft', 'eyeLookUpRight') - mean('eyeLookDownLeft', 'eyeLookDownRight'), -1, 1),
    mouthOpen: clamp((d('jawOpen') - Math.max(0, d('mouthClose'))) * mouthGain / Math.max(0.2, 1 - n('jawOpen'))),
    mouthForm: clamp((d('mouthPucker') + d('mouthFunnel') - mean('mouthSmileLeft', 'mouthSmileRight') - mean('mouthStretchLeft', 'mouthStretchRight')) * mouthShapeGain, -1, 1),
    cheekPuff: clamp(Math.max(0, d('cheekPuff') - 0.03) * gain * 1.8 / Math.max(0.2, 1 - n('cheekPuff'))),
    browY: clamp((d('browInnerUp') + mean('browOuterUpLeft', 'browOuterUpRight') - mean('browDownLeft', 'browDownRight')) * gain * clamp(options.browSensitivity ?? 1, .5, 4), -1, 1),
    eyeSmile: smile, eyeSmileL: smile };
}
export function smoothParameters(current: Record<string, number>, target: Record<string, number>, dt: number, smoothing: number) {
  const tau = clamp(smoothing) * 0.25;
  const alpha = tau === 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / tau);
  return Object.fromEntries(Object.entries(target).map(([key, value]) => [key, (current[key] ?? value) + (value - (current[key] ?? value)) * alpha]));
}
export class FacePose {
  private face: RawFace | null = null;
  private neutral: RawFace | null = null;
  private seen = -Infinity;
  private params = { ...faceNeutral };
  private weight = 0;
  private reacquiringUntil = -Infinity;
  update(result: FaceResult, now: number) {
    const face = readFace(result);
    if (face) {
      if (this.face && now - this.seen > 500) this.reacquiringUntil = now + 200;
      this.face = face; this.seen = now;
    }
  }
  calibrate(now: number) {
    if (!this.face || now - this.seen > 500) return false;
    this.neutral = structuredClone(this.face); this.params = { ...faceNeutral }; return true;
  }
  reset() { this.face = null; this.neutral = null; this.seen = -Infinity; this.reacquiringUntil = -Infinity; this.params = { ...faceNeutral }; this.weight = 0; }
  sample(now: number, dt: number, options: TrackingOptions) {
    const tracking = !!this.face && now - this.seen <= 500;
    const target = tracking ? mapFace(this.face!, this.neutral, options) : faceNeutral;
    const previous = this.params;
    this.params = smoothParameters(previous, target, dt, tracking ? Math.max(options.smoothing, now < this.reacquiringUntil ? .6 : 0) : 0.7);
    // The torso follows rather than snapping to the face's current orientation.
    const body = smoothParameters(previous, target, dt, tracking ? Math.max(0.6, options.smoothing) : 0.7);
    for (const key of ['bodyAngleX', 'bodyAngleY', 'bodyAngleZ']) this.params[key] = body[key];
    if (tracking) for (const eye of ['eyeLOpen', 'eyeROpen']) if (target[eye] === 0) this.params[eye] = 0;
    this.weight = tracking ? 1 : this.weight * Math.exp(-dt / 0.2);
    if (this.weight < 0.005) this.weight = 0;
    return { tracking, params: { ...this.params }, weight: this.weight };
  }
}
export function rmsLevel(samples: Float32Array, gain: number): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return clamp((Math.sqrt(sum / samples.length) - 0.008) * clamp(gain, 0, 10) * 5);
}
export const parameterRanges = new Map(PARAMS.map(param => [param.id, [param.min, param.max] as const]));
parameterRanges.set('eyeSmileL', [0, 1]);
