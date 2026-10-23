import { expect, test } from '@playwright/test';
import { dismissGuide, samplePresent, sampleSkipReason } from './sample';

test.beforeEach(() => { test.skip(!samplePresent, sampleSkipReason); });

test('Korean selection translates editing tools, mouth buttons and Live, and survives reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await dismissGuide(page);
  await page.getByRole('button', { name: '한국어', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.getByTestId('part-head').click();
  await expect(page.getByTestId('part-head')).toContainText('머리 회전');
  await expect(page.getByRole('spinbutton', { name: 'head.cx', exact: true }).locator('..').locator('span')).toHaveText('중심 X');
  await expect(page.getByRole('button', { name: '리그 저장', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '입 모양 테스트', exact: true }).click();
  await page.getByRole('button', { name: '아', exact: true }).click();
  await expect(page.getByRole('button', { name: '아', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('일본어 가나 문장', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '해제', exact: true }).click();
  await page.reload(); await expect(page.getByTestId('part-head')).toContainText('머리 회전');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.locator('.archive-menu > summary').click();
  await expect(page.getByRole('checkbox', { name: '원본 이미지 포함', exact: true })).toBeVisible();
  await page.goto('/live.html'); await expect(page.getByTestId('live-avatar')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByRole('button', { name: '한국어', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '카메라 시작', exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: '끄덕임 감도', exact: true })).toHaveValue('2');
  await expect(page.getByRole('slider', { name: '입 모양 감도', exact: true })).toBeAttached();
  await page.getByRole('button', { name: '얼굴', exact: true }).click();
  await expect.poll(async () => Number(await page.getByRole('slider', { name: '확대율', exact: true }).inputValue())).toBeGreaterThan(1);
  await page.getByTestId('lighting-section').locator('summary').click();
  await expect(page.getByRole('checkbox', { name: '조명 사용', exact: true })).toBeVisible();
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start camera', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [width, height] of [[1440, 900], [1280, 800]]) test(`Korean editor layout fits ${width}×${height} in both pose and mouth tabs`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => localStorage.setItem('mesh-avatar-language', 'ko'));
  await page.goto('/'); await dismissGuide(page);
  await page.getByTestId('part-head').click();
  for (const tab of ['포즈 테스트', '입 모양 테스트']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const selector of ['.parts-panel', '.editor-panel', '.preview-panel']) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    expect((await page.getByTestId('preview').boundingBox())!.height).toBeGreaterThanOrEqual(width === 1440 ? 420 : 300);
  }
});
