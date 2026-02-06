import { test, expect } from '@playwright/test';
import path from 'path';

const DEMO_DIR = path.join(__dirname, '../../public/demos');
const SAMPLE_CSV = path.join(__dirname, '../../public/sample-batch.csv');

test.describe('Batch Label Verification — /batch', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/batch');
  });

  // ===== PAGE LOAD =====

  test('page loads with new per-label UI', async ({ page }) => {
    await expect(page.locator('text=Batch Label Verification')).toBeVisible();
    await expect(page.locator('text=Verify up to 10 labels with individual application data')).toBeVisible();
    await expect(page.locator('text=Drop label images here')).toBeVisible();
    await expect(page.locator('text=/0\/10/')).toBeVisible();
  });

  test('does NOT show old shared ApplicationForm', async ({ page }) => {
    // Old UI had these — make sure they're gone
    await expect(page.locator('text=All uploaded labels will be verified against this application data')).not.toBeVisible();
    await expect(page.locator('text=Government Warning Statement')).not.toBeVisible();
    await expect(page.locator('text=/0\/300/')).not.toBeVisible();
  });

  // ===== IMAGE UPLOAD =====

  test('can upload images and see thumbnails', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles([
      path.join(DEMO_DIR, 'label-perfect.png'),
      path.join(DEMO_DIR, 'label-wrong-abv.png'),
    ]);

    // Should show count updated
    await expect(page.locator('text=/2\/10/')).toBeVisible({ timeout: 5000 });

    // Thumbnails should appear
    await expect(page.locator('img[alt="label-perfect.png"]')).toBeVisible();
    await expect(page.locator('img[alt="label-wrong-abv.png"]')).toBeVisible();
  });

  test('shows data mode toggle after uploading images', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(path.join(DEMO_DIR, 'label-perfect.png'));

    // Data mode toggle should appear
    await expect(page.getByText('Application Data', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Upload CSV")')).toBeVisible();
    await expect(page.locator('button:has-text("Enter Manually")')).toBeVisible();
  });

  test('can remove individual images', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles([
      path.join(DEMO_DIR, 'label-perfect.png'),
      path.join(DEMO_DIR, 'label-wrong-abv.png'),
    ]);
    await expect(page.locator('text=/2\/10/')).toBeVisible({ timeout: 5000 });

    // Hover on first thumbnail to reveal X button and click it
    const firstThumb = page.locator('img[alt="label-perfect.png"]').locator('..');
    await firstThumb.hover();
    await firstThumb.locator('button').click();

    await expect(page.locator('text=/1\/10/')).toBeVisible();
  });

  test('clear all removes everything', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles([
      path.join(DEMO_DIR, 'label-perfect.png'),
      path.join(DEMO_DIR, 'label-wrong-abv.png'),
    ]);
    await expect(page.locator('text=/2\/10/')).toBeVisible({ timeout: 5000 });

    await page.click('text=Clear All');
    await expect(page.locator('text=/0\/10/')).toBeVisible();
  });

  // ===== CSV MODE =====

  test('CSV mode: upload sample CSV and see match preview', async ({ page }) => {
    // Upload 3 demo images
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles([
      path.join(DEMO_DIR, 'label-perfect.png'),
      path.join(DEMO_DIR, 'label-wrong-abv.png'),
      path.join(DEMO_DIR, 'label-imported.png'),
    ]);
    await expect(page.locator('text=/3\/10/')).toBeVisible({ timeout: 5000 });

    // Upload CSV
    const csvInput = page.locator('input[accept*=".csv"]');
    await csvInput.setInputFiles(SAMPLE_CSV);

    // Should show match preview — images get preprocessed to .jpg, so basename fallback kicks in
    await expect(page.locator('text=/3\/3 images matched/')).toBeVisible({ timeout: 5000 });

    // Verify button should be enabled with 3 labels
    await expect(page.locator('button:has-text("Verify 3 Label")')).toBeEnabled();
  });

  test('CSV mode: download template link exists', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(path.join(DEMO_DIR, 'label-perfect.png'));
    await expect(page.locator('text=/1\/10/')).toBeVisible({ timeout: 5000 });

    const downloadLink = page.locator('a:has-text("Download template")');
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute('href', '/sample-batch.csv');
  });

  test('CSV mode: shows errors for bad CSV', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(path.join(DEMO_DIR, 'label-perfect.png'));
    await expect(page.locator('text=/1\/10/')).toBeVisible({ timeout: 5000 });

    // Create a bad CSV (missing required columns) and upload it
    // We'll use the file chooser approach with a temporary file
    const csvInput = page.locator('input[accept*=".csv"]');

    // Use evaluate to create and set a bad CSV file
    await page.evaluate(() => {
      const badCsv = 'wrong_column,also_wrong\nfoo,bar\n';
      const blob = new Blob([badCsv], { type: 'text/csv' });
      const file = new File([blob], 'bad.csv', { type: 'text/csv' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector('input[accept*=".csv"]') as HTMLInputElement;
      if (input) {
        Object.defineProperty(input, 'files', { value: dt.files });
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await expect(page.locator('text=CSV Errors')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=/Missing required columns/')).toBeVisible();
  });

  test('CSV mode: shows unmatched warnings', async ({ page }) => {
    // Upload 1 image but CSV has 3 rows
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(path.join(DEMO_DIR, 'label-perfect.png'));
    await expect(page.locator('text=/1\/10/')).toBeVisible({ timeout: 5000 });

    const csvInput = page.locator('input[accept*=".csv"]');
    await csvInput.setInputFiles(SAMPLE_CSV);

    // Should show partial match — 1 matched, 2 unmatched rows
    await expect(page.locator('text=/1\/1 images matched/')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/Unmatched CSV rows/')).toBeVisible();
  });

  // ===== MANUAL MODE =====

  test('manual mode: shows per-image forms', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles([
      path.join(DEMO_DIR, 'label-perfect.png'),
      path.join(DEMO_DIR, 'label-wrong-abv.png'),
    ]);
    await expect(page.locator('text=/2\/10/')).toBeVisible({ timeout: 5000 });

    // Switch to manual mode
    await page.click('button:has-text("Enter Manually")');

    // Should show 2 separate form sections (one per image)
    await expect(page.locator('text=label-perfect.png').first()).toBeVisible();
    await expect(page.locator('text=label-wrong-abv.png').first()).toBeVisible();

    // Each form should have brand name field
    const brandInputs = page.locator('input[placeholder="Brand Name"]');
    await expect(brandInputs).toHaveCount(2);
  });

  test('manual mode: verify button disabled until forms filled', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(path.join(DEMO_DIR, 'label-perfect.png'));
    await expect(page.locator('text=/1\/10/')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Enter Manually")');

    // Button should show 0 labels (no complete forms yet)
    await expect(page.locator('button:has-text("Verify 0 Label")')).toBeDisabled();

    // Fill in required fields for the one image
    await page.fill('input[placeholder="Brand Name"]', 'Old Tom Distillery');
    await page.fill('input[placeholder="Class/Type"]', 'Kentucky Straight Bourbon Whiskey');
    await page.fill('input[placeholder="Alcohol Content"]', '45% Alc./Vol.');
    await page.fill('input[placeholder="Net Contents"]', '750 mL');
    await page.fill('input[placeholder="Name & Address"]', 'Old Tom Distillery, Louisville, Kentucky');

    // Button should now be enabled
    await expect(page.locator('button:has-text("Verify 1 Label")')).toBeEnabled();
  });

  // ===== FULL E2E: CSV → VERIFY → RESULTS =====

  test('CSV flow end-to-end: upload 3 demos → CSV → verify → results', async ({ page }) => {
    // Upload 3 demo images
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles([
      path.join(DEMO_DIR, 'label-perfect.png'),
      path.join(DEMO_DIR, 'label-wrong-abv.png'),
      path.join(DEMO_DIR, 'label-imported.png'),
    ]);
    await expect(page.locator('text=/3\/10/')).toBeVisible({ timeout: 5000 });

    // Upload CSV
    const csvInput = page.locator('input[accept*=".csv"]');
    await csvInput.setInputFiles(SAMPLE_CSV);
    await expect(page.locator('text=/3\/3 images matched/')).toBeVisible({ timeout: 5000 });

    // Click verify
    await page.click('button:has-text("Verify 3 Label")');

    // Should show processing
    await expect(page.locator('text=Processing Labels...')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/\\d+ of 3 labels/')).toBeVisible({ timeout: 10000 });

    // Wait for results
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 30000 });

    // Summary stats
    await expect(page.locator('text=Total')).toBeVisible();
    await expect(page.locator('text=Passed')).toBeVisible();
    await expect(page.locator('text=Failed')).toBeVisible();

    // Brand names should be visible in results (from SSE brandName field)
    await expect(page.locator('text=Old Tom Distillery')).toBeVisible();
    await expect(page.locator('text=Chateau Margaux')).toBeVisible();
    await expect(page.locator('text=Glenfiddich')).toBeVisible();
  });

  test('manual flow end-to-end: fill form → verify → results', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(path.join(DEMO_DIR, 'label-perfect.png'));
    await expect(page.locator('text=/1\/10/')).toBeVisible({ timeout: 5000 });

    // Switch to manual and fill form
    await page.click('button:has-text("Enter Manually")');
    await page.fill('input[placeholder="Brand Name"]', 'Old Tom Distillery');
    await page.fill('input[placeholder="Class/Type"]', 'Kentucky Straight Bourbon Whiskey');
    await page.fill('input[placeholder="Alcohol Content"]', '45% Alc./Vol. (90 Proof)');
    await page.fill('input[placeholder="Net Contents"]', '750 mL');
    await page.fill('input[placeholder="Name & Address"]', 'Old Tom Distillery, Louisville, Kentucky');

    await page.click('button:has-text("Verify 1 Label")');

    await expect(page.locator('text=Processing Labels...')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 30000 });

    // Should show brand name in results
    await expect(page.locator('text=Old Tom Distillery')).toBeVisible();
  });

  // ===== RESULTS =====

  test('results show export buttons', async ({ page }) => {
    // Quick setup: 1 image + manual data
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(path.join(DEMO_DIR, 'label-perfect.png'));
    await expect(page.locator('text=/1\/10/')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Enter Manually")');
    await page.fill('input[placeholder="Brand Name"]', 'Old Tom Distillery');
    await page.fill('input[placeholder="Class/Type"]', 'Kentucky Straight Bourbon Whiskey');
    await page.fill('input[placeholder="Alcohol Content"]', '45%');
    await page.fill('input[placeholder="Net Contents"]', '750 mL');
    await page.fill('input[placeholder="Name & Address"]', 'Test Address');

    await page.click('button:has-text("Verify 1 Label")');
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 30000 });

    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();
    await expect(page.locator('button:has-text("Export JSON")')).toBeVisible();
    await expect(page.locator('button:has-text("New Batch")')).toBeVisible();
  });

  test('New Batch resets to input state', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await fileInput.setInputFiles(path.join(DEMO_DIR, 'label-perfect.png'));
    await expect(page.locator('text=/1\/10/')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Enter Manually")');
    await page.fill('input[placeholder="Brand Name"]', 'Old Tom Distillery');
    await page.fill('input[placeholder="Class/Type"]', 'Bourbon');
    await page.fill('input[placeholder="Alcohol Content"]', '45%');
    await page.fill('input[placeholder="Net Contents"]', '750 mL');
    await page.fill('input[placeholder="Name & Address"]', 'Address');

    await page.click('button:has-text("Verify 1 Label")');
    await expect(page.locator('text=Batch Results')).toBeVisible({ timeout: 30000 });

    await page.click('button:has-text("New Batch")');
    await expect(page.locator('text=Drop label images here')).toBeVisible();
    await expect(page.locator('text=/0\/10/')).toBeVisible();
  });

  // ===== NAVIGATION =====

  test('can navigate back to single mode', async ({ page }) => {
    await page.click('text=Single Mode');
    await expect(page).toHaveURL('/');
  });
});
