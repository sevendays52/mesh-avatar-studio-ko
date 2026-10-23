import type { AvatarViewport, Rig } from 'mesh-avatar';
import { parseViewport } from '../../packages/runtime/src/engine/viewport.js';
export { parseViewport };
export const VIEWPORT_EVENT = 'studio:viewport';
export const defaultViewport: AvatarViewport = { zoom: 1, x: 0, y: 0 };
export interface ViewportMessage { project: string; viewport: AvatarViewport }
export function viewportMessage(input: unknown): ViewportMessage | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>, value = data.viewport as Record<string, unknown> | null;
  if (Object.keys(data).length !== 2 || typeof data.project !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(data.project) || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).length !== 3 || !['zoom', 'x', 'y'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))) return null;
  return { project: data.project, viewport: parseViewport(value) };
}
export function loadViewport(project: string): AvatarViewport {
  try { return parseViewport(JSON.parse(localStorage.getItem(`mesh-avatar:viewport:${project}`) ?? '{}') ?? {}); }
  catch { return { ...defaultViewport }; }
}
export function saveViewport(project: string, value: AvatarViewport) {
  try { localStorage.setItem(`mesh-avatar:viewport:${project}`, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}
/** Centre a rig-derived crop using the renderer's selected base projection. */
export function frameViewport(rig: Rig, width: number, height: number, preset: 'face' | 'upper', fit: 'contain' | 'cover' = 'contain'): AvatarViewport {
  const head = rig.head, body = rig.body;
  const top = Math.max(0, head.cy - head.ry * 1.15);
  const bottom = preset === 'face' ? Math.min(rig.image.height, head.cy + head.ry * 1.25) : Math.min(rig.image.height, Math.max(head.cy + head.ry * 1.5, body.chest.cy + body.chest.ry * 1.7));
  const cropWidth = preset === 'face' ? head.rx * 2.8 : Math.max(head.rx * 3, ...body.shoulders.map(s => Math.abs(s.cx - head.cx) * 2 + s.rx * 3));
  const scale = (fit === 'cover' ? Math.max : Math.min)(width / (rig.image.width * (1 + 2 * rig.view.padSide)), height / (rig.image.height * (1 + rig.view.padTop)));
  const ox = (width - rig.image.width * scale) / 2, oy = (height - rig.image.height * scale) / (fit === 'cover' ? 2 : 1);
  const zoom = Math.max(0.25, Math.min(8, Math.min(width * 0.88 / cropWidth, height * 0.88 / (bottom - top)) / scale));
  return parseViewport({ zoom, x: (0.5 - (ox + head.cx * scale) / width) * zoom, y: (0.5 - (oy + (top + bottom) / 2 * scale) / height) * zoom });
}
