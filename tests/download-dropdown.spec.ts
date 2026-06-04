import { test, expect } from '@playwright/test';

test.describe('Download dropdown', () => {
  test('Download button is visible in the workspace toolbar when logged in', async ({ page }) => {
    await page.goto('/dashboard');
    if (page.url().includes('sign-in')) {
      test.skip();
      return;
    }
    const downloadBtn = page.getByRole('button', { name: /download/i }).first();
    await expect(downloadBtn).toBeVisible();
  });

  test('Download dropdown opens and shows three options', async ({ page }) => {
    await page.goto('/dashboard');
    if (page.url().includes('sign-in')) { test.skip(); return; }
    const downloadBtn = page.getByRole('button', { name: /download/i }).first();
    await downloadBtn.click();
    await expect(page.getByText('Download as PDF')).toBeVisible();
    await expect(page.getByText('Download as Word')).toBeVisible();
    await expect(page.getByText('Print')).toBeVisible();
  });
});
