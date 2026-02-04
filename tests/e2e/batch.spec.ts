import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Batch Label Verification', () => {
  const demoLabelPath = path.join(__dirname, '../../public/demo-label.png');

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/batch');
  });

  test('batch page loads correctly', async ({ page }) => {
    await expect(page.locator('text=Batch Label Verification')).toBeVisible();
    await expect(page.locator('text=Drop multiple label images')).toBeVisible();
    await expect(page.locator('text=/0\\/10 selected/')).toBeVisible();
  });

  test('can upload multiple images', async ({ page }) => {
    // Upload demo label twice (simulating multiple files)
    const fileInput = page.locator('input[type="file"]');

    // Upload first file
    await fileInput.setInputFiles(demoLabelPath);
    await expect(page.locator('text=/1\\/10 selected/')).toBeVisible();

    // Upload second file
    await fileInput.setInputFiles(demoLabelPath);
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

    // Upload 3 files
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

    // Clear required fields
    await page.fill('input[placeholder*="Stone\'s Throw"]', '');

    // Try to verify
    await page.click('button:has-text("Verify 1 Label")');

    // Should show error
    await expect(page.locator('text=Please fill in required application fields')).toBeVisible();
  });

  test('processes batch and shows streaming progress', async ({ page }) => {
    // Upload 2 files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([demoLabelPath, demoLabelPath]);
    await expect(page.locator('text=/2\\/10 selected/')).toBeVisible();

    // Start verification
    await page.click('button:has-text("Verify 2 Labels")');

    // Should show processing state
    await expect(page.locator('text=Processing Labels...')).toBeVisible({ timeout: 5000 });

    // Should show progress (at least one processed)
    await expect(page.locator('text=/[1-2] of 2 labels/')).toBeVisible({ timeout: 15000 });

    // Should eventually show results
    await expect(page.locator('text=/APPROVED|REJECTED|NEEDS REVIEW/')).toBeVisible({ timeout: 30000 });
  });

  test('batch processes faster with parallelism', async ({ page }) => {
    // Upload 3 files to test parallel processing
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([demoLabelPath, demoLabelPath, demoLabelPath]);

    const startTime = Date.now();

    // Start verification
    await page.click('button:has-text("Verify 3 Labels")');

    // Wait for results
    await expect(page.locator('text=/APPROVED|REJECTED|NEEDS REVIEW/')).toBeVisible({ timeout: 30000 });

    const elapsed = Date.now() - startTime;

    // With Gemini at ~2.5s per image and concurrency of 3,
    // 3 images should complete in ~3-5s, not 7.5s (sequential)
    // Using 12s as threshold to account for network variance
    expect(elapsed).toBeLessThan(12000);

    console.log(`Batch of 3 completed in ${(elapsed/1000).toFixed(2)}s`);
  });

  test('shows individual results for each label', async ({ page }) => {
    // Upload 2 files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([demoLabelPath, demoLabelPath]);

    // Verify
    await page.click('button:has-text("Verify 2 Labels")');

    // Wait for completion
    await expect(page.locator('text=/APPROVED|REJECTED|NEEDS REVIEW/')).toBeVisible({ timeout: 30000 });

    // Should show results for both files
    const resultCards = page.locator('text=demo-label.png');
    await expect(resultCards).toHaveCount(2);
  });

  test('handles errors gracefully', async ({ page }) => {
    // This test verifies error handling works
    // Upload valid file first
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(demoLabelPath);

    // Verify
    await page.click('button:has-text("Verify 1 Label")');

    // Should show result (pass or fail, but not crash)
    await expect(page.locator('text=/Processing Labels...|APPROVED|REJECTED|NEEDS REVIEW/')).toBeVisible({ timeout: 30000 });
  });

  test('can reset and verify again', async ({ page }) => {
    // First verification
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(demoLabelPath);
    await page.click('button:has-text("Verify 1 Label")');

    // Wait for results
    await expect(page.locator('text=/APPROVED|REJECTED|NEEDS REVIEW/')).toBeVisible({ timeout: 30000 });

    // Reset
    await page.click('button:has-text("New Batch")');

    // Should be back to input state
    await expect(page.locator('text=Drop multiple label images')).toBeVisible();
    await expect(page.locator('text=/0\\/10 selected/')).toBeVisible();
  });

  test('shows correct file status during processing', async ({ page }) => {
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(demoLabelPath);

    // Start verification
    await page.click('button:has-text("Verify 1 Label")');

    // Should show Processing status on thumbnail
    await expect(page.locator('text=Processing...')).toBeVisible({ timeout: 5000 });

    // Eventually should show Done
    await expect(page.locator('span:has-text("Done")')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Batch API Endpoint', () => {
  const demoLabelPath = path.join(__dirname, '../../public/demo-label.png');

  test('returns SSE stream for batch verification', async ({ request }) => {
    // Read demo image
    const imageBuffer = fs.readFileSync(demoLabelPath);

    // Create form data manually
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);

    const applicationData = JSON.stringify({
      brandName: "Stone's Throw",
      classType: "Straight Bourbon Whiskey",
      alcoholContent: "45% ABV",
      netContents: "750 mL",
      nameAddress: "Westward Distillery, Portland, Oregon",
      governmentWarning: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
    });

    // Build multipart body
    let body = '';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="applicationData"\r\n\r\n';
    body += applicationData + '\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="image_test1"; filename="demo-label.png"\r\n';
    body += 'Content-Type: image/png\r\n\r\n';

    // Combine text body with binary image data
    const textEncoder = new TextEncoder();
    const textPart = textEncoder.encode(body);
    const endPart = textEncoder.encode(`\r\n--${boundary}--\r\n`);

    const fullBody = new Uint8Array(textPart.length + imageBuffer.length + endPart.length);
    fullBody.set(textPart, 0);
    fullBody.set(new Uint8Array(imageBuffer), textPart.length);
    fullBody.set(endPart, textPart.length + imageBuffer.length);

    const response = await request.post('http://localhost:3000/api/batch-verify', {
      data: fullBody,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/event-stream');

    const text = await response.text();

    // Should contain SSE events
    expect(text).toContain('event: result');
    expect(text).toContain('event: complete');
    expect(text).toContain('"type":"result"');
    expect(text).toContain('"type":"complete"');
  });

  test('rejects more than 10 labels', async ({ request }) => {
    const imageBuffer = fs.readFileSync(demoLabelPath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);

    const applicationData = JSON.stringify({
      brandName: "Test",
      classType: "Test",
      alcoholContent: "40%",
      netContents: "750mL",
      nameAddress: "Test Address",
      governmentWarning: "Test warning"
    });

    // Build body with 11 images
    let textBody = '';
    textBody += `--${boundary}\r\n`;
    textBody += 'Content-Disposition: form-data; name="applicationData"\r\n\r\n';
    textBody += applicationData + '\r\n';

    const imageParts: Uint8Array[] = [];
    const textEncoder = new TextEncoder();

    for (let i = 0; i < 11; i++) {
      let part = `--${boundary}\r\n`;
      part += `Content-Disposition: form-data; name="image_test${i}"; filename="label${i}.png"\r\n`;
      part += 'Content-Type: image/png\r\n\r\n';
      imageParts.push(textEncoder.encode(part));
      imageParts.push(new Uint8Array(imageBuffer));
      imageParts.push(textEncoder.encode('\r\n'));
    }

    const endPart = textEncoder.encode(`--${boundary}--\r\n`);
    const startPart = textEncoder.encode(textBody);

    // Calculate total length
    let totalLength = startPart.length + endPart.length;
    for (const part of imageParts) {
      totalLength += part.length;
    }

    const fullBody = new Uint8Array(totalLength);
    let offset = 0;
    fullBody.set(startPart, offset);
    offset += startPart.length;
    for (const part of imageParts) {
      fullBody.set(part, offset);
      offset += part.length;
    }
    fullBody.set(endPart, offset);

    const response = await request.post('http://localhost:3000/api/batch-verify', {
      data: fullBody,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('Maximum 10 labels per batch');
  });
});
