import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { dismissGuide, samplePresent, sampleSkipReason } from './sample';

test('pose controls select wide, neutral and round mouths and show held vowel shape', async ({ page }) => {
  test.skip(!samplePresent, sampleSkipReason);
  await page.goto('/'); await dismissGuide(page);
  await expect(page.getByTestId('preview-status')).toHaveAttribute('data-state', 'ready');
  await page.getByTestId('idle-toggle').click();
  const open = page.getByRole('slider', { name: 'Mouth open', exact: true });
  const form = page.getByRole('slider', { name: 'Mouth shape', exact: true });
  const picture = async () => createHash('sha256').update(await page.getByTestId('preview').screenshot()).digest('hex');
  await open.press('End'); const neutral = await picture();
  await form.press('Home'); await expect(form).toHaveValue('-1'); const wide = await picture();
  await form.press('End'); await expect(form).toHaveValue('1'); const round = await picture();
  expect(new Set([neutral, wide, round]).size).toBe(3);
  await page.getByRole('tab', { name: 'Lip sync', exact: true }).click();
  await page.getByRole('button', { name: 'い', exact: true }).click();
  await page.getByRole('tab', { name: 'Pose test', exact: true }).click();
  await expect(form).toBeDisabled();
  await expect.poll(async () => Number(await form.inputValue())).toBeLessThan(-.55);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(form).toBeEnabled(); await expect(form).toHaveValue('0');
});
