#!/usr/bin/env node
/**
 * Batch Verification Tests for TTB Label Verification
 *
 * Tests the batch-verify endpoint with:
 * - Per-label application data (new CSV-style flow)
 * - Shared application data (backward compat)
 * - Mixed PASS/FAIL expected outcomes
 * - Error handling: no images, no app data, too many images
 *
 * Requirements:
 * - Dev server running on localhost:3000
 */

const fs = require('fs');
const path = require('path');

const BATCH_API_URL = 'http://localhost:3000/api/batch-verify';
const TEST_DATA_DIR = path.join(__dirname, '../src/test-data');
const DEMO_DIR = path.join(__dirname, '../public/demos');

const STANDARD_WARNING_TEXT = 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

// ===== FUNCTIONAL TESTS =====
// These hit the real API and verify actual verification results

const FUNCTIONAL_TESTS = [
  {
    id: 'BATCH-F1',
    description: 'Per-label app data: 2 labels with different expected outcomes (PASS + FAIL)',
    setup: async (formData) => {
      // Label 1: Perfect match → PASS
      const img1 = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-perfect.png'));
      const blob1 = new Blob([img1], { type: 'image/png' });
      formData.set('image_test1', blob1, 'label-perfect.png');
      formData.set('appData_test1', JSON.stringify({
        brandName: 'Old Tom Distillery',
        classType: 'Kentucky Straight Bourbon Whiskey',
        alcoholContent: '45% Alc./Vol. (90 Proof)',
        netContents: '750 mL',
        nameAddress: 'Old Tom Distillery, Louisville, Kentucky',
        countryOfOrigin: '',
        governmentWarning: STANDARD_WARNING_TEXT,
      }));

      // Label 2: Wrong ABV → FAIL
      const img2 = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-wrong-abv.png'));
      const blob2 = new Blob([img2], { type: 'image/png' });
      formData.set('image_test2', blob2, 'label-wrong-abv.png');
      formData.set('appData_test2', JSON.stringify({
        brandName: 'Chateau Margaux',
        classType: 'Cabernet Sauvignon',
        alcoholContent: '13.5% Alc./Vol.',
        netContents: '750 mL',
        nameAddress: 'Chateau Margaux Winery, Napa, California',
        countryOfOrigin: '',
        governmentWarning: STANDARD_WARNING_TEXT,
      }));
    },
    expectSSE: true,
    validate: (results) => {
      if (results.length !== 2) return `Expected 2 results, got ${results.length}`;
      const r1 = results.find(r => r.id === 'test1');
      const r2 = results.find(r => r.id === 'test2');
      if (!r1) return 'Missing result for test1';
      if (!r2) return 'Missing result for test2';
      if (r1.error) return `test1 error: ${r1.error}`;
      if (r2.error) return `test2 error: ${r2.error}`;
      if (r1.result?.overallStatus !== 'PASS') return `test1: expected PASS, got ${r1.result?.overallStatus}`;
      if (r2.result?.overallStatus !== 'FAIL') return `test2: expected FAIL, got ${r2.result?.overallStatus}`;
      if (!r1.brandName) return 'test1: missing brandName in SSE event';
      if (!r2.brandName) return 'test2: missing brandName in SSE event';
      return null; // pass
    }
  },
  {
    id: 'BATCH-F2',
    description: 'Per-label app data: 3 labels including imported (PASS + FAIL + PASS)',
    setup: async (formData) => {
      // Label 1: Perfect match → PASS
      const img1 = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-perfect.png'));
      formData.set('image_a', new Blob([img1], { type: 'image/png' }), 'label-perfect.png');
      formData.set('appData_a', JSON.stringify({
        brandName: 'Old Tom Distillery',
        classType: 'Kentucky Straight Bourbon Whiskey',
        alcoholContent: '45% Alc./Vol. (90 Proof)',
        netContents: '750 mL',
        nameAddress: 'Old Tom Distillery, Louisville, Kentucky',
        countryOfOrigin: '',
        governmentWarning: STANDARD_WARNING_TEXT,
      }));

      // Label 2: Wrong ABV → FAIL
      const img2 = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-wrong-abv.png'));
      formData.set('image_b', new Blob([img2], { type: 'image/png' }), 'label-wrong-abv.png');
      formData.set('appData_b', JSON.stringify({
        brandName: 'Chateau Margaux',
        classType: 'Cabernet Sauvignon',
        alcoholContent: '13.5% Alc./Vol.',
        netContents: '750 mL',
        nameAddress: 'Chateau Margaux Winery, Napa, California',
        countryOfOrigin: '',
        governmentWarning: STANDARD_WARNING_TEXT,
      }));

      // Label 3: Imported → PASS
      const img3 = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-imported.png'));
      formData.set('image_c', new Blob([img3], { type: 'image/png' }), 'label-imported.png');
      formData.set('appData_c', JSON.stringify({
        brandName: 'Glenfiddich',
        classType: 'Single Malt Scotch Whisky',
        alcoholContent: '40% Alc./Vol. (80 Proof)',
        netContents: '750 mL',
        nameAddress: 'William Grant & Sons, Dufftown, Banffshire, Scotland',
        countryOfOrigin: 'Scotland',
        governmentWarning: STANDARD_WARNING_TEXT,
      }));
    },
    expectSSE: true,
    validate: (results) => {
      if (results.length !== 3) return `Expected 3 results, got ${results.length}`;
      const ra = results.find(r => r.id === 'a');
      const rb = results.find(r => r.id === 'b');
      const rc = results.find(r => r.id === 'c');
      if (!ra || !rb || !rc) return 'Missing result(s)';
      if (ra.error) return `a error: ${ra.error}`;
      if (rb.error) return `b error: ${rb.error}`;
      if (rc.error) return `c error: ${rc.error}`;
      if (ra.result?.overallStatus !== 'PASS') return `a: expected PASS, got ${ra.result?.overallStatus}`;
      if (rb.result?.overallStatus !== 'FAIL') return `b: expected FAIL, got ${rb.result?.overallStatus}`;
      if (rc.result?.overallStatus !== 'PASS') return `c: expected PASS, got ${rc.result?.overallStatus}`;
      // Verify brandName comes through
      if (ra.brandName !== 'Old Tom Distillery') return `a: brandName mismatch: ${ra.brandName}`;
      if (rb.brandName !== 'Chateau Margaux') return `b: brandName mismatch: ${rb.brandName}`;
      if (rc.brandName !== 'Glenfiddich') return `c: brandName mismatch: ${rc.brandName}`;
      return null;
    }
  },
  {
    id: 'BATCH-F3',
    description: 'Shared app data (backward compat): 2 identical labels, same app data',
    setup: async (formData) => {
      const img = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-perfect.png'));
      formData.set('image_x', new Blob([img], { type: 'image/png' }), 'label-perfect.png');
      formData.set('image_y', new Blob([img], { type: 'image/png' }), 'label-perfect-2.png');
      // Shared applicationData (old format)
      formData.set('applicationData', JSON.stringify({
        brandName: 'Old Tom Distillery',
        classType: 'Kentucky Straight Bourbon Whiskey',
        alcoholContent: '45% Alc./Vol. (90 Proof)',
        netContents: '750 mL',
        nameAddress: 'Old Tom Distillery, Louisville, Kentucky',
        countryOfOrigin: '',
        governmentWarning: STANDARD_WARNING_TEXT,
      }));
    },
    expectSSE: true,
    validate: (results) => {
      if (results.length !== 2) return `Expected 2 results, got ${results.length}`;
      for (const r of results) {
        if (r.error) return `${r.id} error: ${r.error}`;
        if (r.result?.overallStatus !== 'PASS') return `${r.id}: expected PASS, got ${r.result?.overallStatus}`;
      }
      return null;
    }
  },
];

// ===== VALIDATION (ERROR) TESTS =====
// These test error paths — no API calls to Gemini needed

const VALIDATION_TESTS = [
  {
    id: 'BATCH-V1',
    description: 'No images provided → 400',
    setup: (formData) => {
      formData.set('applicationData', JSON.stringify({
        brandName: 'Test', classType: 'Test', alcoholContent: '40%',
        netContents: '750 mL', nameAddress: 'Test', governmentWarning: STANDARD_WARNING_TEXT,
      }));
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /no valid image/i
  },
  {
    id: 'BATCH-V2',
    description: 'Image with no app data (no shared, no per-label) → 400',
    setup: (formData) => {
      const img = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-perfect.png'));
      formData.set('image_z', new Blob([img], { type: 'image/png' }), 'test.png');
      // No applicationData, no appData_z
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /no valid image|application data/i
  },
  {
    id: 'BATCH-V3',
    description: 'Malformed shared JSON → 400',
    setup: (formData) => {
      const img = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-perfect.png'));
      formData.set('image_z', new Blob([img], { type: 'image/png' }), 'test.png');
      formData.set('applicationData', 'not json {{{');
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /invalid|json/i
  },
  {
    id: 'BATCH-V4',
    description: '11 images exceeds max batch size of 10 → 400',
    setup: (formData) => {
      const img = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-perfect.png'));
      for (let i = 0; i < 11; i++) {
        formData.set(`image_n${i}`, new Blob([img], { type: 'image/png' }), `label${i}.png`);
        formData.set(`appData_n${i}`, JSON.stringify({
          brandName: 'Test', classType: 'Test', alcoholContent: '40%',
          netContents: '750 mL', nameAddress: 'Test', governmentWarning: STANDARD_WARNING_TEXT,
        }));
      }
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /max|10|limit/i
  },
  {
    id: 'BATCH-V5',
    description: 'Malformed per-label JSON is skipped, remaining processed',
    setup: (formData) => {
      const img = fs.readFileSync(path.join(TEST_DATA_DIR, 'labels/label-perfect.png'));
      // Good label
      formData.set('image_good', new Blob([img], { type: 'image/png' }), 'good.png');
      formData.set('appData_good', JSON.stringify({
        brandName: 'Old Tom Distillery',
        classType: 'Kentucky Straight Bourbon Whiskey',
        alcoholContent: '45% Alc./Vol. (90 Proof)',
        netContents: '750 mL',
        nameAddress: 'Old Tom Distillery, Louisville, Kentucky',
        countryOfOrigin: '',
        governmentWarning: STANDARD_WARNING_TEXT,
      }));
      // Bad label (invalid JSON)
      formData.set('image_bad', new Blob([img], { type: 'image/png' }), 'bad.png');
      formData.set('appData_bad', 'not-json');
    },
    expectSSE: true,
    validate: (results) => {
      // The bad label should have been skipped; only the good one processed
      if (results.length !== 1) return `Expected 1 result (bad skipped), got ${results.length}`;
      if (results[0].id !== 'good') return `Expected result for 'good', got ${results[0].id}`;
      if (results[0].error) return `good errored: ${results[0].error}`;
      if (results[0].result?.overallStatus !== 'PASS') return `good: expected PASS, got ${results[0].result?.overallStatus}`;
      return null;
    }
  },
];

// ===== SSE PARSING =====

async function parseSSEResponse(response) {
  const text = await response.text();
  const results = [];
  let completed = false;

  const events = text.split('\n\n');
  for (const event of events) {
    const lines = event.trim().split('\n');
    let eventType = '';
    let eventData = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) eventType = line.slice(7);
      else if (line.startsWith('data: ')) eventData = line.slice(6);
    }

    if (!eventType || !eventData) continue;

    const parsed = JSON.parse(eventData);
    if (parsed.type === 'result') {
      results.push(parsed);
    } else if (parsed.type === 'complete') {
      completed = true;
    } else if (parsed.type === 'error') {
      throw new Error(parsed.error);
    }
  }

  return { results, completed };
}

// ===== TEST RUNNER =====

async function runFunctionalTest(test) {
  const { FormData, fetch: undiciFetch } = await import('undici');
  const formData = new FormData();
  await test.setup(formData);

  const start = Date.now();
  const response = await undiciFetch(BATCH_API_URL, { method: 'POST', body: formData });
  const elapsed = Date.now() - start;

  if (!response.ok) {
    const body = await response.text();
    return { passed: false, error: `HTTP ${response.status}: ${body}`, elapsed };
  }

  const { results, completed } = await parseSSEResponse(response);

  if (!completed) {
    return { passed: false, error: 'SSE stream did not send complete event', elapsed };
  }

  const validationError = test.validate(results);
  if (validationError) {
    return { passed: false, error: validationError, elapsed };
  }

  return { passed: true, elapsed, resultCount: results.length };
}

async function runValidationTest(test) {
  const { FormData, fetch: undiciFetch } = await import('undici');
  const formData = new FormData();
  await test.setup(formData);

  const response = await undiciFetch(BATCH_API_URL, { method: 'POST', body: formData });

  if (test.expectSSE) {
    // This is a validation test that expects SSE (e.g., partial skip)
    if (!response.ok) {
      return { passed: false, error: `Expected SSE response, got HTTP ${response.status}` };
    }
    const { results } = await parseSSEResponse(response);
    const validationError = test.validate(results);
    if (validationError) {
      return { passed: false, error: validationError };
    }
    return { passed: true };
  }

  // Standard error test
  if (test.expectedStatus && response.status !== test.expectedStatus) {
    const body = await response.text();
    return { passed: false, error: `Expected status ${test.expectedStatus}, got ${response.status}: ${body}` };
  }

  if (test.expectedMessage) {
    const body = await response.json();
    const msg = body.error || body.message || '';
    if (!test.expectedMessage.test(msg)) {
      return { passed: false, error: `Message "${msg}" didn't match ${test.expectedMessage}` };
    }
  }

  return { passed: true, note: `Got expected ${response.status}` };
}

async function main() {
  // Check server
  try {
    await fetch('http://localhost:3000', { method: 'HEAD' });
  } catch {
    console.error('❌ Dev server not running. Start it with: npm run dev\n');
    process.exit(1);
  }

  console.log('📦 TTB Batch Verification - Test Runner\n');
  console.log('='.repeat(60));
  console.log('');

  let totalPass = 0;
  let totalFail = 0;

  // Run functional tests
  console.log('📁 Functional Tests (hit Gemini API)');
  console.log('-'.repeat(40));

  for (const test of FUNCTIONAL_TESTS) {
    process.stdout.write(`  ${test.id}: ${test.description}... `);
    try {
      const result = await runFunctionalTest(test);
      if (result.passed) {
        totalPass++;
        const timeStr = result.elapsed ? ` [${(result.elapsed / 1000).toFixed(1)}s]` : '';
        console.log(`✅ PASSED${timeStr}`);
      } else {
        totalFail++;
        console.log(`❌ FAILED`);
        console.log(`     ${result.error}`);
      }
    } catch (err) {
      totalFail++;
      console.log(`❌ ERROR`);
      console.log(`     ${err.message}`);
    }
  }

  console.log('');

  // Run validation tests
  console.log('📁 Validation Tests (error handling)');
  console.log('-'.repeat(40));

  for (const test of VALIDATION_TESTS) {
    process.stdout.write(`  ${test.id}: ${test.description}... `);
    try {
      const result = await runValidationTest(test);
      if (result.passed) {
        totalPass++;
        console.log(`✅ PASSED`);
        if (result.note) console.log(`     ${result.note}`);
      } else {
        totalFail++;
        console.log(`❌ FAILED`);
        console.log(`     ${result.error}`);
      }
    } catch (err) {
      totalFail++;
      console.log(`❌ ERROR`);
      console.log(`     ${err.message}`);
    }
  }

  // Summary
  const total = totalPass + totalFail;
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 BATCH TEST RESULTS\n');
  console.log(`  Total:  ${total}`);
  console.log(`  Passed: ${totalPass} ✅`);
  console.log(`  Failed: ${totalFail} ❌`);
  console.log(`  Pass Rate: ${((totalPass / total) * 100).toFixed(1)}%`);

  if (totalFail > 0) {
    console.log('\n❌ Some batch tests failed.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All batch tests passed!\n');
    process.exit(0);
  }
}

main();
