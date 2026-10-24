// A calibrated 2.5D surface, not recovered 3D geometry. Rest pixels are unprojected
// before rotation, so neutral stays exact instead of acquiring a camera zoom.
export function createHeadPerspective(rig) {
  const h = rig.head, settings = h.perspective;
  if (!settings || (settings.yaw === 0 && settings.pitch === 0)) return null;
  let lastYaw, lastPitch, sx, cx, sy, cy;
  const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const depthAt = (x, y) => {
    const nx = (x - rig.face.nose.cx) / h.rx, ny = (y - rig.face.nose.cy) / h.ry;
    const surface = Math.max(0, 1 - nx * nx - ny * ny) ** 2;
    const start = Math.min(rig.face.nose.cy, h.pivotY - 1);
    return settings.depth * surface * (1 - smooth((y - start) / (h.pivotY - start)));
  };
  return (x, y, angleX, angleY) => {
    const yaw = Math.max(-1, Math.min(1, angleX / 30)) * settings.yaw;
    const pitch = Math.max(-1, Math.min(1, angleY / 30)) * settings.pitch;
    if (yaw === 0 && pitch === 0) return [x, y];
    if (yaw !== lastYaw || pitch !== lastPitch) {
      lastYaw = yaw; lastPitch = pitch;
      sx = Math.sin(yaw); cx = Math.cos(yaw); sy = Math.sin(pitch); cy = Math.cos(pitch);
    }
    const z = depthAt(x, y), f = settings.focalLength;
    const u = (x - h.pivotX) * (1 - z / f), v = (y - h.pivotY) * (1 - z / f);
    const rotatedX = u * cx + z * sx, yawZ = z * cx - u * sx;
    const rotatedY = v * cy - yawZ * sy, rotatedZ = v * sy + yawZ * cy;
    const scale = f / (f - rotatedZ);
    return [h.pivotX + rotatedX * scale, h.pivotY + rotatedY * scale];
  };
}
