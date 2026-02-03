import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Label Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('completes verification with demo data', async ({ page }) => {
    // Click demo button to load sample data
    await page.click('text=Try with example data');

    // Wait for image to load
    await expect(page.locator('img[alt="Label preview"]')).toBeVisible({ timeout: 5000 });

    // Click verify button
    await page.click('button:has-text("Verify Label")');

    // Wait for results - either loading state or final results
    await expect(page.locator('text=/Processed in|Analyzing|elapsed/')).toBeVisible({ timeout: 15000 });

    // Final results should appear
    await expect(page.locator('text=Brand Name')).toBeVisible({ timeout: 15000 });
  });

  test('displays all field results after verification', async ({ page }) => {
    // Click demo button
    await page.click('text=Try with example data');
    await expect(page.locator('img[alt="Label preview"]')).toBeVisible({ timeout: 5000 });

    // Click verify
    await page.click('button:has-text("Verify Label")');

    // Wait for field results to appear
    await expect(page.locator('text=Brand Name')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Class/Type')).toBeVisible();
    await expect(page.locator('text=Alcohol Content')).toBeVisible();
    await expect(page.locator('text=Net Contents')).toBeVisible();
    await expect(page.locator('text=Name & Address')).toBeVisible();
    await expect(page.locator('text=Gov Warning — Present')).toBeVisible();

    // Should show processing time
    await expect(page.locator('text=/Processed in \\d+\\.\\d+s/')).toBeVisible();
  });

  test('verification completes under 10 seconds', async ({ page }) => {
    // Click demo button
    await page.click('text=Try with example data');
    await expect(page.locator('img[alt="Label preview"]')).toBeVisible({ timeout: 5000 });

    const startTime = Date.now();

    // Click verify
    await page.click('button:has-text("Verify Label")');

    // Wait for results
    await expect(page.locator('text=Brand Name')).toBeVisible({ timeout: 15000 });

    const elapsed = Date.now() - startTime;

    // Should complete in under 10 seconds (generous for CI)
    expect(elapsed).toBeLessThan(10000);

    console.log(`Verification completed in ${(elapsed/1000).toFixed(2)}s`);
  });

  test('shows PASS, FAIL, or REVIEW status', async ({ page }) => {
    await page.click('text=Try with example data');
    await expect(page.locator('img[alt="Label preview"]')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Verify Label")');

    // Should show one of the status indicators
    await expect(page.locator('text=/APPROVED|REJECTED|NEEDS REVIEW/')).toBeVisible({ timeout: 15000 });
  });

  test('can upload custom image', async ({ page }) => {
    // Upload the demo label image directly
    const imagePath = path.join(__dirname, '../../public/demo-label.png');

    // Find the file input and upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(imagePath);

    // Should show preview
    await expect(page.locator('img[alt="Label preview"]')).toBeVisible({ timeout: 5000 });
  });

  test('batch mode loads correctly', async ({ page }) => {
    // Navigate to batch mode
    await page.click('text=Batch Mode');

    // Should show batch upload UI
    await expect(page.locator('text=Batch Label Verification')).toBeVisible();
    await expect(page.locator('text=Drop multiple label images')).toBeVisible();
  });

  test('can reset and verify again', async ({ page }) => {
    // First verification
    await page.click('text=Try with example data');
    await expect(page.locator('img[alt="Label preview"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Verify Label")');
    await expect(page.locator('text=Brand Name')).toBeVisible({ timeout: 15000 });

    // Click reset
    await page.click('text=Verify Another');

    // Should be back to input state
    await expect(page.locator('text=Drop label image here')).toBeVisible({ timeout: 5000 });
  });
});
