import { spawn, execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeVersionOk } from './doctor.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
// npm lifecycle scripts also need to find the bundled node executable.
process.env.PATH = [dirname(process.execPath), process.env.PATH].filter(Boolean).join(delimiter);
if (!nodeVersionOk(process.version)) throw new Error('Node.js 22.17+ is required. Rebuild the launcher runtime or install a supported Node.js.');

function npmCli() {
  const bundled = resolve(root, 'tools/launcher-runtime/node_modules/npm/bin/npm-cli.js');
  if (existsSync(bundled)) return bundled;
  const besideNode = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (existsSync(besideNode)) return besideNode;
  if (process.platform === 'win32') {
    const commands = execFileSync('where.exe', ['npm.cmd'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/);
    for (const command of commands) {
      const candidate = resolve(dirname(command), 'node_modules/npm/bin/npm-cli.js');
      if (existsSync(candidate)) return candidate;
    }
  } else {
    const command = execFileSync('which', ['npm'], { encoding: 'utf8' }).trim();
    if (existsSync(command)) return realpathSync(command);
  }
  throw new Error('npm was not found. Rebuild with tools/build-launcher.ps1 or install Node.js with npm.');
}

if (!existsSync(resolve(root, 'node_modules/vite/package.json')) || !existsSync(resolve(root, 'node_modules/react/package.json'))) {
  console.log('Installing Studio dependencies. Internet access is needed on the first launch…');
  const status = await new Promise((done, reject) => {
    const child = spawn(process.execPath, [npmCli(), 'ci', '--include=dev', '--no-audit', '--no-fund'], { cwd: root, windowsHide: true, stdio: ['ignore', 'inherit', 'inherit'] });
    child.once('error', reject); child.once('exit', done);
  });
  if (status !== 0) throw new Error('Package installation failed. Check your internet connection and launch again.');
}

console.log('Starting local Studio…');
await mkdir(resolve(root, 'projects'), { recursive: true });
const { createServer } = await import('vite');
const server = await createServer({ root, configFile: resolve(root, 'vite.config.ts'), server: { host: '127.0.0.1', port: 5173, strictPort: false } });
await server.listen();
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}/?projects=1&lang=ko`;
const statusFile = resolve(root, 'work/studio-launcher.json');
await mkdir(dirname(statusFile), { recursive: true });
await writeFile(statusFile, JSON.stringify({ pid: process.pid, url }));
console.log(`STUDIO_READY ${url}`);

if (process.env.STUDIO_LAUNCHER !== '1' && !process.argv.includes('--no-open')) {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const browser = spawn(command, [url], { detached: true, stdio: 'ignore', windowsHide: true });
  browser.on('error', error => console.error(`Open ${url} in your browser. ${error.message}`)); browser.unref();
}
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.close(); await rm(statusFile, { force: true }); process.exit(0);
}
process.on('SIGINT', () => { void stop(); }); process.on('SIGTERM', () => { void stop(); });
if (process.env.STUDIO_LAUNCHER === '1') {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', data => { if (data.includes('stop')) void stop(); });
  process.stdin.on('end', () => { void stop(); }); process.stdin.resume();
}
