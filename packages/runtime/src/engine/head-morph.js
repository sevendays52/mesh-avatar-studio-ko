// Optional correspondence fields align painted contours before adjacent views mix.
// Coordinates are in the neutral illustration, independently of viewport framing.
export function pitchMorphs(rig, sheet) {
  if (sheet.pitchMorphs === undefined) return [];
  if (rig.head.pitch.views.some(v => v.id === 'neutral')) throw new Error('Pitch morphs: neutral is a reserved view identifier');
  const ids = [{ id: 'neutral', angleY: 0 }, ...rig.head.pitch.views].sort((a, b) => a.angleY - b.angleY);
  const pairs = new Set(ids.slice(1).map((v, i) => [ids[i].id, v.id].sort().join(':')));
  if (!Array.isArray(sheet.pitchMorphs) || sheet.pitchMorphs.length !== pairs.size)
    throw new Error('Pitch morphs: supply one correspondence field per adjacent view pair');
  return sheet.pitchMorphs.map(value => {
    const key = [value?.from, value?.to].sort().join(':');
    if (!pairs.delete(key)) throw new Error('Pitch morphs: invalid or duplicate adjacent view pair');
    const g = value.grid;
    if (!g || !['x', 'y', 'cell', 'cols', 'rows'].every(k => Number.isSafeInteger(g[k])) ||
      g.x < 0 || g.y < 0 || g.cell < 2 || g.cols < 2 || g.rows < 2 || g.cols * g.rows > 4096 ||
      g.x + (g.cols - 1) * g.cell > rig.image.width || g.y + (g.rows - 1) * g.cell > rig.image.height)
      throw new Error('Pitch morphs: invalid correspondence grid');
    for (const name of ['forward', 'backward']) {
      const field = value[name];
      if (!Array.isArray(field) || field.length !== g.cols * g.rows * 2 ||
        !field.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 64))
        throw new Error('Pitch morphs: invalid displacement field');
      for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
        if (x !== 0 && y !== 0 && x !== g.cols - 1 && y !== g.rows - 1) continue;
        const i = (y * g.cols + x) * 2;
        if (field[i] !== 0 || field[i + 1] !== 0) throw new Error('Pitch morphs: grid boundary must be zero');
      }
    }
    return value;
  });
}

export function sampleMorph(grid, field, x, y) {
  const u = (x - grid.x) / grid.cell, v = (y - grid.y) / grid.cell;
  if (u < 0 || v < 0 || u >= grid.cols - 1 || v >= grid.rows - 1) return [0, 0];
  const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
  const i = (iy * grid.cols + ix) * 2, stride = grid.cols * 2;
  return [0, 1].map(k => (field[i + k] * (1 - fx) + field[i + 2 + k] * fx) * (1 - fy)
    + (field[i + stride + k] * (1 - fx) + field[i + stride + 2 + k] * fx) * fy);
}
