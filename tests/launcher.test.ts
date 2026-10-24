import { expect, test } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

// Exercise the actual executable entry point, root selection and server cleanup.
test.skipIf(process.platform !== 'darwin').each(['SIGINT', 'SIGHUP'] as const)(
  'macOS command starts outside the repository and stops its server on %s', async signal => {
    const root = resolve('.');
    await mkdir(resolve('projects'), { recursive: true });
    const cwd = await mkdtemp(resolve('projects/launcher test '));
    const command = resolve('MeshAvatarStudio.command');
    expect((await stat(command)).mode & 0o111).not.toBe(0);
    const child = spawn(command, ['--no-open'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let exited = false;
    const closed = new Promise<number | null>(done => child.once('close', code => { exited = true; done(code); }));
    child.stdout.on('data', bytes => { output += bytes; });
    child.stderr.on('data', bytes => { output += bytes; });
    child.on('error', error => { output += error.message; });
    try {
      await expect.poll(() => output, { timeout: 30000 }).toMatch(/STUDIO_READY http:\/\/127\.0\.0\.1:\d+/);
      const url = output.match(/STUDIO_READY (http:\/\/127\.0\.0\.1:\d+\/\?projects=1&lang=ko)/)![1];
      const response = await fetch(new URL('/__studio/context', url));
      expect(response.status).toBe(200);
      expect((await response.json()).rootPath).toBe(root);
      expect(await (await fetch(url)).text()).toContain('/src/main.tsx');
      child.kill(signal);
      expect(await closed).toBe(0);
      await expect(fetch(url)).rejects.toThrow();
      await expect(readFile(resolve('work/studio-launcher.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      if (!exited) {
        child.kill('SIGKILL');
        await closed;
      }
      await rm(cwd, { recursive: true, force: true });
    }
  }, 40000,
);
