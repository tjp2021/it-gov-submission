import { test, expect } from '@playwright/test';
import path from 'path';

const DEMO_DIR = path.join(__dirname, '../../public/demos');

test.describe('Single Label Verification — /', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with upload zone and form', async ({ page }) => {
    await expect(page.locator('text=Drop label images here or click to browse')).toBeVisible();
    await expect(page.getByText('Application Data (from COLA)')).toBeVisible();
    await expect(page.locator('text=Try with example data')).toBeVisible();
  });

  test('demo button loads image and fills form', async ({ page }) => {
    await page.click('text=Try with example data');
    await page.click('text=Perfect Label');

    // Image preview appears with alt="Label front"
    await expect(page.locator('img[alt="Label front"]')).toBeVisible({ timeout: 5000 });
  });

  test('demo PASS: Perfect Label → PASSED', async ({ page }) => {
    await page.click('text=Try with example data');
    await page.click('text=Perfect Label');
    await expect(page.locator('img[alt="Label front"]')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Verify Label")');

    await expect(page.getByRole('heading', { name: 'PASSED' })).toBeVisible({ timeout: 15000 });

    // Field results
    await expect(page.getByText('Brand Name', { exact: true })).toBeVisible();
    await expect(page.getByText('Class/Type', { exact: true })).toBeVisible();
    await expect(page.getByText('Alcohol Content', { exact: true })).toBeVisible();

    // Processing time
    await expect(page.locator('text=/Processed in \\d+\\.\\d+s/')).toBeVisible();
  });

  test('demo FAIL: Wrong ABV → FAILED', async ({ page }) => {
    await page.click('text=Try with example data');
    await page.click('text=Wrong ABV');
    await expect(page.locator('img[alt="Label front"]')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Verify Label")');

    await expect(page.getByRole('heading', { name: 'FAILED' })).toBeVisible({ timeout: 15000 });
  });

  test('can upload custom image via file input', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(path.join(DEMO_DIR, 'label-perfect.png'));

    // Uploaded image gets label "front" by default
    await expect(page.locator('img[alt="Label front"]')).toBeVisible({ timeout: 5000 });
  });

  test('verify completes under 10 seconds', async ({ page }) => {
    await page.click('text=Try with example data');
    await page.click('text=Perfect Label');
    await expect(page.locator('img[alt="Label front"]')).toBeVisible({ timeout: 5000 });

    const start = Date.now();
    await page.click('button:has-text("Verify Label")');
    await expect(page.getByText('Brand Name', { exact: true })).toBeVisible({ timeout: 15000 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10000);
    console.log(`Single verification: ${(elapsed / 1000).toFixed(2)}s`);
  });

  test('reset returns to input state', async ({ page }) => {
    await page.click('text=Try with example data');
    await page.click('text=Perfect Label');
    await expect(page.locator('img[alt="Label front"]')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Verify Label")');
    await expect(page.getByText('Brand Name', { exact: true })).toBeVisible({ timeout: 15000 });

    await page.click('text=Verify Another');
    await expect(page.locator('text=Drop label images here or click to browse')).toBeVisible({ timeout: 5000 });
  });

  test('navigates to batch mode', async ({ page }) => {
    await page.click('text=Batch Mode');
    await expect(page).toHaveURL(/\/batch/);
    await expect(page.locator('text=Batch Label Verification')).toBeVisible();
  });
});
