// Monotone landmark interpolation aligns adjacent drawn views before their pixels
// are blended. In particular, eyes and lips must not cross-fade at two positions.
import { sampleMorph } from './head-morph.js';
const bandWeight = (y, band) => {
  if (!band) return 1;
  const t = Math.max(0, Math.min(1, (y - band[0]) / (band[1] - band[0])));
  return 1 - t * t * (3 - 2 * t);
};
function weightedPoint(x, y, warp, band) {
  const q = warpHeadPoint(x, y, warp), w = bandWeight(y, band);
  return [x + (q[0] - x) * w, y + (q[1] - y) * w];
}
export function mapHeadY(value, from, to) {
  const n = from.length;
  const slope = i => (to[i + 1] - to[i]) / (from[i + 1] - from[i]);
  const tangent = i => {
    if (i === 0) return slope(0);
    if (i === n - 1) return slope(n - 2);
    const a = slope(i - 1), b = slope(i);
    return a * b <= 0 ? 0 : 2 * a * b / (a + b);
  };
  if (value <= from[0]) return to[0] + (value - from[0]) * slope(0);
  if (value >= from[n - 1]) return to[n - 1] + (value - from[n - 1]) * slope(n - 2);
  let i = 0;
  while (value > from[i + 1]) i++;
  const span = from[i + 1] - from[i], t = (value - from[i]) / span, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * to[i] + (t3 - 2 * t2 + t) * span * tangent(i)
    + (-2 * t3 + 3 * t2) * to[i + 1] + (t3 - t2) * span * tangent(i + 1);
}

export function cacheHeadMorph(x, y, source) {
  const head = bandWeight(y, source.sourceBand);
  if (head <= .001) return false;
  const c = weightedPoint(x, y, source.toCanonical, source.sourceBand);
  const d = sampleMorph(source.grid, source.field, c[0], c[1]);
  return d[0] === 0 && d[1] === 0 ? false : [c[0], c[1], d[0], d[1], head, bandWeight(c[1], source.neutralBand)];
}

export function prepareHeadMorph(m) {
  const start = Math.max(0, m.grid.y - 65), end = m.grid.y + (m.grid.rows - 1) * m.grid.cell + 65;
  const lookup = new Float64Array(end - start + 1);
  for (let y = start; y <= end; y++) lookup[y - start] = weightedPoint(0, y, m.fromCanonical, m.neutralBand)[1];
  const w = m.fromCanonical;
  const scale = (w.xTo[1] - w.xTo[0]) / (w.xFrom[1] - w.xFrom[0]);
  return { ...m, lookup, lookupStart: start, xScale: scale - 1, xOffset: w.xTo[0] - w.xFrom[0] * scale };
}

function lookupY(m, y) {
  const u = Math.max(0, Math.min(m.lookup.length - 1, y - m.lookupStart)), i = Math.min(m.lookup.length - 2, Math.floor(u));
  return m.lookup[i] + (m.lookup[i + 1] - m.lookup[i]) * (u - i);
}

/** @param {number} x @param {number} y @param {object} warp
 * @param {false | number[]} [cached] */
export function warpHeadPoint(x, y, warp, cached = undefined) {
  const q = [warp.xTo[0] + (x - warp.xFrom[0]) * (warp.xTo[1] - warp.xTo[0]) / (warp.xFrom[1] - warp.xFrom[0]),
    mapHeadY(y, warp.yFrom, warp.yTo)];
  const m = warp.morph;
  if (m && cached !== undefined && m.lookup) {
    if (cached !== false) {
      const [cx, cy, dx, dy, head, beforeWeight] = cached;
      const nx = cx + dx * m.weight, ny = cy + dy * m.weight;
      const afterWeight = bandWeight(ny, m.neutralBand);
      q[0] += (nx + (nx * m.xScale + m.xOffset) * afterWeight - cx - (cx * m.xScale + m.xOffset) * beforeWeight) / head;
      q[1] += (lookupY(m, ny) - lookupY(m, cy)) / head;
    }
    return q;
  }
  const head = m ? bandWeight(y, m.sourceBand) : 1;
  if (m && m.weight > 0 && head > 0.001 && y <= m.sourceBottom) {
    const canonical = weightedPoint(x, y, m.toCanonical, m.sourceBand);
    const offset = sampleMorph(m.grid, m.field, canonical[0], canonical[1]);
    if (offset[0] !== 0 || offset[1] !== 0) {
      const a = weightedPoint(...canonical, m.fromCanonical, m.neutralBand);
      const b = weightedPoint(canonical[0] + offset[0] * m.weight, canonical[1] + offset[1] * m.weight, m.fromCanonical, m.neutralBand);
      q[0] += (b[0] - a[0]) / head; q[1] += (b[1] - a[1]) / head;
    }
  }
  return q;
}

export function headLandmarks(rig) {
  const eyes = (rig.face.eyeA.cy + rig.face.eyeB.cy) / 2;
  // Keep landmarks ordered even in rigs with tiny or overlapping regions.
  const y = [Math.min(rig.head.cy - rig.head.ry, eyes - 1), eyes];
  y.push(Math.max(y[1] + 1, rig.mouth.cy));
  y.push(Math.max(y[2] + 1, rig.face.jaw.cy));
  y.push(Math.max(y[3] + 1, rig.head.weightBand[1]));
  return { x: [Math.min(rig.face.eyeA.cx, rig.face.eyeB.cx), Math.max(rig.face.eyeA.cx + 1, rig.face.eyeB.cx)], y };
}

/** @param {import('../rig/types').Rig} rig
 * @param {{x: number[], y: number[]}} target
 * @param {object} [morph] */
export function headViewWarp(rig, target, morph = undefined) {
  const from = headLandmarks(rig);
  return { xFrom: from.x, yFrom: from.y, xTo: target.x, yTo: target.y, ...(morph && { morph }) };
}

export function pitchViewWeights(angles, angle) {
  const sorted = angles.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  if (angle <= sorted[0].value) return [{ index: sorted[0].index, weight: 1 }];
  if (angle >= sorted.at(-1).value) return [{ index: sorted.at(-1).index, weight: 1 }];
  for (let i = 1; i < sorted.length; i++) {
    if (angle === sorted[i].value) return [{ index: sorted[i].index, weight: 1 }];
    if (angle < sorted[i].value) {
      const t = (angle - sorted[i - 1].value) / (sorted[i].value - sorted[i - 1].value);
      const w = t * t * (3 - 2 * t);
      return [{ index: sorted[i - 1].index, weight: 1 - w }, { index: sorted[i].index, weight: w }];
    }
  }
}
