import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PNG } from 'pngjs';
import { localProjectMiddleware } from '../src/server/local-projects';
import { createImageProject } from '../src/server/create-project';

let root: string;
const png = PNG.sync.write(new PNG({ width: 4, height: 3 }));
const data = { name: 'new-avatar', image: png.toString('base64') };
beforeEach(async () => { await mkdir(resolve('projects'), { recursive: true }); root = await mkdtemp(resolve('projects/.create-test-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
async function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as IncomingMessage;
  req.url = `/__studio/${path}`; req.method = body === undefined ? 'GET' : 'POST';
  req.headers = { host: '127.0.0.1:5173', 'content-type': 'application/json', ...headers };
  const result = { status: 0, body: '' };
  const res = { writeHead(status: number) { result.status = status; }, end(body: string) { result.body = String(body); } } as unknown as ServerResponse;
  await localProjectMiddleware(root)(req, res, () => { result.status = 404; }); return result;
}
test('image-only projects keep source bytes, appear in the list and become ready after an agent builds them', async () => {
  const result = await request('create-project', data); expect(result.status).toBe(201);
  const project = JSON.parse(result.body);
  expect(project).toMatchObject({ name: 'new-avatar', stage: 'setup', image: { width: 4, height: 3 }, hasSource: true });
  const folder = join(root, 'projects/new-avatar');
  expect(await readFile(join(folder, 'source.png'))).toEqual(png);
  expect((await readdir(folder)).sort()).toEqual(['.studio-project.json', 'avatar.json', 'source.png']);
  expect(JSON.parse((await request('projects')).body)).toHaveLength(1);
  await writeFile(join(folder, 'rig.json'), '{}');
  expect(JSON.parse((await request('projects')).body)[0].stage).toBe('setup');
  await mkdir(join(folder, 'built')); await writeFile(join(folder, 'built/layers.json'), '{}');
  expect(JSON.parse((await request('projects')).body)[0].stage).toBeUndefined();
});
test('duplicate and concurrent names reserve separate folders without replacing files', async () => {
  const names = await Promise.all([createImageProject(root, data), createImageProject(root, data), createImageProject(root, data)]);
  expect(new Set(names).size).toBe(3);
  expect(names.sort()).toEqual(['new-avatar', 'new-avatar-1', 'new-avatar-2']);
  for (const name of names) expect(await readFile(join(root, 'projects', name, 'source.png'))).toEqual(png);
});
test('rejects unsafe names, invalid or oversized PNGs before creating a project', async () => {
  for (const name of ['../escape', '/absolute', 'a/b', 'a\\b', '.hidden', 'NUL', 'com1', 'sample-miko-qipao', '', 'a'.repeat(81)]) {
    await expect(createImageProject(root, { ...data, name })).rejects.toThrow('invalidName');
  }
  for (const image of ['invalid base64', Buffer.from('not a png').toString('base64'), png.subarray(0, 35).toString('base64')]) {
    await expect(createImageProject(root, { ...data, image })).rejects.toThrow('invalidImage');
  }
  const huge = Buffer.from(png); huge.writeUInt32BE(100_000, 16);
  await expect(createImageProject(root, { ...data, image: huge.toString('base64') })).rejects.toThrow('imageTooLarge');
  expect(await readdir(root)).toEqual([]);
});
test('upload endpoint enforces local origins, request size and physical project root', async () => {
  expect((await request('create-project', data, { origin: 'https://example.com' })).status).toBe(403);
  expect((await request('create-project', data, { 'content-length': String(34 * 1024 * 1024) })).status).toBe(413);
  await mkdir(join(root, 'outside')); await symlink(join(root, 'outside'), join(root, 'projects'), 'junction');
  expect((await request('create-project', data)).status).toBe(400);
  expect(await readdir(join(root, 'outside'))).toEqual([]);
});
