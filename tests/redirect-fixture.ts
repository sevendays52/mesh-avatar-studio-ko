import { copyFile, symlink } from 'node:fs/promises';

// Windows file symlinks require Developer Mode or elevation. Keep real junction
// coverage for directories, and simulate realpath only for file redirects when
// that privilege is absent. Other errors must still fail the test.
export async function redirectFile(target: string, path: string, redirects: Map<string, string>) {
  try { await symlink(target, path, 'file'); }
  catch (error) {
    if (process.platform !== 'win32' || (error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
    await copyFile(target, path);
    redirects.set(path, target);
  }
}
