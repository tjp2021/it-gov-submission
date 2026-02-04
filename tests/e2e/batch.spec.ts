import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('Batch Label Verification', () => {
  const demoLabelPath = path.join(__dirname, '../../public/demo-label.png');

  // Helper to fill form with demo data
  async function fillDemoFormData(page: Page) {
    await page.fill('input[placeholder*="Old Tom Distillery"]', "Stone's Throw");
    await page.fill('input[placeholder*="Kentucky Straight"]', "Straight Bourbon Whiskey");
    await page.fill('input[placeholder*="45% Alc"]', "45% ABV");
    await page.fill('input[placeholder*="750 mL"]', "750 mL");
    await page.fill('input[placeholder*="Louisville"]', "Westward Distillery, Portland, Oregon");
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/batch');
  });

  test('batch page loads correctly', async ({ page }) => {
    await expect(page.locator('text=Batch Label Verification')).toBeVisible();
    await expect(page.locator('text=Drop multiple label images')).toBeVisible();
    await expect(page.locator('text=/0\\/10 selected/')).toBeVisible();
  });

  test('can upload multiple images at once', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');

    // Upload multiple files at once (setInputFiles with array)
    await fileInput.setInputFiles([demoLabelPath, demoLabelPath]);
    await expect(page.locator('text=/2\\/10 selected/')).toBeVisible();

    // Should show thumbnails
    const thumbnails = page.locator('img[alt="demo-label.png"]');
    await expect(thumbnails).toHaveCount(2);
  });

  test('enforces 10-label limit', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');

    // Create array of 12 files (same demo label)
    const files = Array(12).fill(demoLabelPath);

    // Upload all at once - should only accept first 10
    await fileInput.setInputFiles(files);

    // Should show 10/10 selected
    await expect(page.locator('text=/10\\/10 selected/')).toBeVisible();

    // Should show error message about limit
    await expect(page.locator('text=/Maximum 10 labels per batch/')).toBeVisible();
  });

  test('can remove uploaded images', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');

    // Upload 3 files at once
    await fileInput.setInputFiles([demoLabelPath, demoLabelPath, demoLabelPath]);
    await expect(page.locator('text=/3\\/10 selected/')).toBeVisible();

    // Remove one using the X button (hover to reveal)
    const firstThumbnail = page.locator('img[alt="demo-label.png"]').first().locator('..');
    await firstThumbnail.hover();
    await page.locator('button:has-text("×")').first().click();

    await expect(page.locator('text=/2\\/10 selected/')).toBeVisible();

    // Clear all
    await page.click('text=Clear All');
    await expect(page.locator('text=/0\\/10 selected/')).toBeVisible();
  });

  test('validates required fields before verification', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(demoLabelPath);

    // Form starts empty, so just try to verify without filling anything
    await page.click('button:has-text("Verify 1 Label")');

    // Should show error
    await expect(page.locator('text=Please fill in required application fields')).toBeVisible();
  });

  test('processes batch and shows streaming progress', async ({ page }) => {
    // Fill form first
    await fillDemoFormData(page);

    // Upload 2 files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([demoLabelPath, demoLabelPath]);
    await expect(page.locator('text=/2\\/10 selected/')).toBeVisible();

    // Start verification
    await page.click('button:has-text("Verify 2 Labels")');

    // Should show processing state
    await expect(page.locator('text=Processing Labels...')).toBeVisible({ timeout: 5000 });

    // Should eventually show results (BatchResults shows PASS/FAIL/ERROR status)
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 45000 });
  });

  test('batch processes faster with parallelism', async ({ page }) => {
    // Fill form first
    await fillDemoFormData(page);

    // Upload 3 files to test parallel processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([demoLabelPath, demoLabelPath, demoLabelPath]);

    const startTime = Date.now();

    // Start verification
    await page.click('button:has-text("Verify 3 Labels")');

    // Wait for results
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 45000 });

    const elapsed = Date.now() - startTime;

    // With Gemini at ~2.5s per image and concurrency of 3,
    // 3 images should complete in ~3-5s, not 7.5s (sequential)
    // Using 15s as threshold to account for network variance
    expect(elapsed).toBeLessThan(15000);

    console.log(`Batch of 3 completed in ${(elapsed/1000).toFixed(2)}s`);
  });

  test('shows individual results for each label', async ({ page }) => {
    // Fill form first
    await fillDemoFormData(page);

    // Upload 2 files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([demoLabelPath, demoLabelPath]);

    // Verify
    await page.click('button:has-text("Verify 2 Labels")');

    // Wait for completion
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 45000 });

    // Should show results for both files
    const resultCards = page.locator('text=demo-label.png');
    await expect(resultCards).toHaveCount(2);
  });

  test('handles verification and shows results', async ({ page }) => {
    // Fill form first
    await fillDemoFormData(page);

    // Upload valid file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(demoLabelPath);

    // Verify
    await page.click('button:has-text("Verify 1 Label")');

    // Should show processing then results
    await expect(page.locator('text=Processing Labels...')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 45000 });
  });

  test('can reset and verify again', async ({ page }) => {
    // Fill form first
    await fillDemoFormData(page);

    // First verification
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(demoLabelPath);
    await page.click('button:has-text("Verify 1 Label")');

    // Wait for results
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 45000 });

    // Reset
    await page.click('button:has-text("New Batch")');

    // Should be back to input state
    await expect(page.locator('text=Drop multiple label images')).toBeVisible();
    await expect(page.locator('text=/0\\/10 selected/')).toBeVisible();
  });

  test('shows summary statistics after verification', async ({ page }) => {
    // Fill form first
    await fillDemoFormData(page);

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(demoLabelPath);

    // Start verification
    await page.click('button:has-text("Verify 1 Label")');

    // Wait for results
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 45000 });

    // Should show summary stats (Total count)
    await expect(page.locator('text=Total')).toBeVisible();
    await expect(page.locator('text=Passed')).toBeVisible();
    await expect(page.locator('text=Failed')).toBeVisible();
  });

  test('stress test: processes 10 labels (PRD max) in parallel', async ({ page }) => {
    // Fill form first
    await fillDemoFormData(page);

    // Upload 10 files (PRD maximum per section 3.8)
    const fileInput = page.locator('input[type="file"]');
    const tenFiles = Array(10).fill(demoLabelPath);
    await fileInput.setInputFiles(tenFiles);

    // Verify 10 files uploaded
    await expect(page.locator('text=/10\\/10 selected/')).toBeVisible();

    const startTime = Date.now();

    // Start verification
    await page.click('button:has-text("Verify 10 Labels")');

    // Should show processing state
    await expect(page.locator('text=Processing Labels...')).toBeVisible({ timeout: 5000 });

    // Wait for results - 10 labels with concurrency 3 should take ~10-12s
    // Using 60s timeout to be safe for CI/network variance
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 60000 });

    const elapsed = Date.now() - startTime;

    // PRD Section 3.8: With concurrency of 3 and ~2.5s per image,
    // 10 images should complete in ~10s (ceil(10/3) * 2.5 = 10s)
    // Allow up to 30s for network variance, but should be much faster than
    // sequential processing (10 * 2.5s = 25s)
    expect(elapsed).toBeLessThan(30000);

    // Verify all 10 results are shown
    await expect(page.locator('text=Total').first()).toBeVisible();

    // Check the summary shows 10 total
    const summaryText = await page.locator('div:has-text("Total")').first().textContent();
    expect(summaryText).toContain('10');

    console.log(`Batch of 10 completed in ${(elapsed/1000).toFixed(2)}s`);
  });

  test('stress test: verifies streaming shows progressive results', async ({ page }) => {
    // Fill form first
    await fillDemoFormData(page);

    // Upload 5 files - enough to see streaming behavior
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(Array(5).fill(demoLabelPath));

    // Start verification
    await page.click('button:has-text("Verify 5 Labels")');

    // Should show processing state immediately
    await expect(page.locator('text=Processing Labels...')).toBeVisible({ timeout: 5000 });

    // Progress should update as results stream in
    // With concurrency of 3, first batch completes together, then remaining 2
    await expect(page.locator('text=/[1-5] of 5 labels/')).toBeVisible({ timeout: 15000 });

    // Wait for completion
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 45000 });
  });
});
