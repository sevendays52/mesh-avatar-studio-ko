import { expect, test } from '@playwright/test';
import { cp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { samplePresent, sampleSkipReason } from './sample';

const created: string[] = [];
test.afterEach(async () => { for (const name of created.splice(0)) await rm(resolve('projects', name), { recursive: true, force: true }); });

test('launcher home creates an image-only project, copies its exact handoff, reopens it and detects completed layers', async ({ page, context }) => {
  test.skip(!samplePresent, sampleSkipReason); test.setTimeout(60000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?projects=1&lang=ko');
  const hub = page.getByTestId('project-hub'); await expect(hub).toBeVisible();
  await hub.getByRole('button', { name: '새 프로젝트 만들기', exact: true }).click();
  const form = page.getByTestId('new-project-form'), name = `onboarding-${Date.now()}`;
  await form.getByLabel('프로젝트 폴더 이름', { exact: true }).fill(name);
  await form.getByLabel('일러스트 선택', { exact: true }).setInputFiles('samples/miko-qipao/source.png');
  const response = page.waitForResponse(response => response.url().endsWith('/__studio/create-project') && response.request().method() === 'POST');
  await form.getByRole('button', { name: '프로젝트 만들기', exact: true }).click();
  const result = await response; expect(result.status()).toBe(201); created.push((await result.json()).name);
  const handoff = page.getByTestId('project-handoff'); await expect(handoff).toBeVisible();
  await expect(handoff.getByRole('button', { name: '완성된 아바타 열기', exact: true })).toBeDisabled();
  await handoff.getByRole('button', { name: 'Codex 요청문 복사', exact: true }).click();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  for (const text of [`projects/${name}/source.png`, '--in-place', '좌표 교정', '확대 격자', '오버레이', '다른 프로젝트를 만들지 마세요',
    'docs/codex-authoring.md', 'imagegen', '상하좌우 고개', 'head-views.py pack', '요청문 복사는 동의가 아닙니다']) expect(prompt).toContain(text);
  expect(await readFile(resolve('projects', name, 'source.png'))).toEqual(await readFile('samples/miko-qipao/source.png'));
  await page.reload(); await expect(hub).toBeVisible();
  await page.getByTestId(`hub-project-${name}`).click(); await expect(handoff).toBeVisible();
  // An agent completes the project independently while the handoff page stays open.
  await cp(resolve('samples/miko-qipao'), resolve('projects', name), { recursive: true, filter: path => !path.includes('review') });
  const open = handoff.getByRole('button', { name: '완성된 아바타 열기', exact: true });
  await expect(open).toBeEnabled({ timeout: 15000 }); await open.click();
  await expect(page.getByTestId('preview-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('project-location')).toContainText(name);
  expect(errors).toEqual([]);
});

test('JPEG selection is converted locally and a failed upload can be retried', async ({ page }) => {
  await page.goto('/?projects=1&lang=en');
  await page.getByTestId('project-hub').getByRole('button', { name: 'New project', exact: true }).click();
  const form = page.getByTestId('new-project-form'), name = `onboarding-jpeg-${Date.now()}`;
  await form.getByLabel('Project folder name', { exact: true }).fill(name);
  const jpeg = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 30; return canvas.toDataURL('image/jpeg').split(',')[1]; });
  await form.getByLabel('Choose illustration', { exact: true }).setInputFiles({ name: 'avatar.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
  await page.route('**/__studio/create-project', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"failed"}' }), { times: 1 });
  await form.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  const response = page.waitForResponse(response => response.url().endsWith('/__studio/create-project'));
  await form.getByRole('button', { name: 'Create project', exact: true }).click();
  const result = await response; expect(result.status()).toBe(201); created.push((await result.json()).name);
  await expect(page.getByTestId('project-handoff')).toBeVisible();
  const png = await readFile(resolve('projects', name, 'source.png'));
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('project home fits a narrow screen and can open the sample', async ({ page }) => {
  test.skip(!samplePresent, sampleSkipReason); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?projects=1&lang=ja');
  await expect(page.getByRole('heading', { name: 'アバターのプロジェクトを選ぶ' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByTestId('hub-project-sample-miko-qipao').click();
  await expect(page.getByTestId('preview-status')).toHaveAttribute('data-state', 'ready');
});
