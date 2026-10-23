import { mkdir, realpath, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

export const MAX_SOURCE_BYTES = 24 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 16_777_216;
export class ProjectCreateError extends Error {}

export async function createImageProject(root: string, body: unknown) {
  const input = body as { name?: unknown; image?: unknown } | null;
  if (!input || typeof input.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(input.name)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(input.name) || input.name === 'sample-miko-qipao') throw new ProjectCreateError('invalidName');
  if (typeof input.image !== 'string' || input.image.length > Math.ceil(MAX_SOURCE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.image)) throw new ProjectCreateError('invalidImage');
  const bytes = Buffer.from(input.image, 'base64');
  if (bytes.length > MAX_SOURCE_BYTES || bytes.length < 33 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.subarray(12, 16).toString() !== 'IHDR') throw new ProjectCreateError('invalidImage');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > 8192 || height > 8192 || width * height > MAX_SOURCE_PIXELS) throw new ProjectCreateError('imageTooLarge');
  try { PNG.sync.read(bytes, { checkCRC: true }); } catch { throw new ProjectCreateError('invalidImage'); }
  const base = resolve(root, 'projects');
  await mkdir(base, { recursive: true });
  if (await realpath(base) !== base) throw new ProjectCreateError('unsafeFiles');
  let name = input.name, path = resolve(base, name);
  for (let index = 1; ; index++) {
    try { await mkdir(path); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      name = `${input.name}-${index}`; path = resolve(base, name);
    }
  }
  try {
    const image = { width, height };
    await writeFile(resolve(path, 'source.png'), bytes, { flag: 'wx' });
    await writeFile(resolve(path, 'avatar.json'), JSON.stringify({ format: 'mesh-avatar', version: 1, name }, null, 2) + '\n', { flag: 'wx' });
    // Publish the marker last: partially written uploads cannot appear in the list.
    await writeFile(resolve(path, '.studio-project.json'), JSON.stringify({ version: 1, image }, null, 2) + '\n', { flag: 'wx' });
    return name;
  } catch (error) {
    if (await realpath(path) === path) await rm(path, { recursive: true, force: true });
    throw error;
  }
}
