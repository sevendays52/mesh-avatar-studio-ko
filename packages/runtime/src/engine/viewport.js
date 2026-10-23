const bounded = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

export function parseViewport(value = {}) {
  return { zoom: bounded(value.zoom, 0.25, 8, 1), x: bounded(value.x, -4, 4, 0), y: bounded(value.y, -4, 4, 0) };
}
