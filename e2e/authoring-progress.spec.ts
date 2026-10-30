import { test, expect } from '@playwright/test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadState, recordStep, saveState } from '../tools/authoring-state.mjs';

const created: string[] = [];
test.afterEach(async () => { for (const name of created.splice(0)) await rm(resolve('projects', name), { recursive: true, force: true }); });

test('new project shows the full drawing workflow, copies a continuation and detects changed inputs', async ({ page, context }) => {
  test.setTimeout(60000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?projects=1&lang=ko');
  await page.getByRole('button', { name: '새 프로젝트 만들기', exact: true }).click();
  const name = `authoring-e2e-${Date.now()}`;
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ab7856'; ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const form = page.getByTestId('new-project-form');
  await form.getByLabel('프로젝트 폴더 이름', { exact: true }).fill(name);
  await form.getByLabel('일러스트 선택', { exact: true }).setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const response = page.waitForResponse(response => response.url().endsWith('/__studio/create-project'));
  await form.getByRole('button', { name: '프로젝트 만들기', exact: true }).click();
  const result = await response; expect(result.status()).toBe(201); created.push((await result.json()).name);
  const status = page.getByTestId('authoring-status');
  await expect(status).toContainText('전체 원화 39장');
  await expect(status).toContainText('리그 좌표 작성');
  await expect(status.getByRole('listitem')).toHaveCount(5);
  await status.getByRole('button', { name: '이어서 제작 요청 복사', exact: true }).click();
  const request = await page.evaluate(() => navigator.clipboard.readText());
  expect(request).toContain(`npm run authoring -- status projects/${name}`);
  expect(request).toContain('기본 39장');
  expect(request).toContain('현재 대화');
  const project = resolve('projects', name), source = await readFile(resolve(project, 'source.png'));
  const state = await loadState(project);
  await recordStep(project, state, 'neutral', 'survey'); await saveState(project, state);
  // A newly added draft changes the survey's effective rig input. The original
  // image stays intact, while the next status poll must show stale work.
  await mkdir(resolve(project, '.authoring/geometry'), { recursive: true });
  await writeFile(resolve(project, 'rig.draft.json'), JSON.stringify({ eyes: [], image: { width: 64, height: 64 } }));
  await expect(status).toContainText('변경됨', { timeout: 22000 });
  expect(await readFile(resolve(project, 'source.png'))).toEqual(source);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
