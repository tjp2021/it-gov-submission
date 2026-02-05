/**
 * Multi-Image Test Runner for TTB Label Verification
 *
 * Tests the multi-image upload flow with merged extraction.
 * Each test has 2-3 images + application data.
 *
 * Requirements:
 * - Dev server running on localhost:3000
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/verify-stream';
const TEST_DATA_DIR = path.join(__dirname, '../src/test-data');
const RESULTS_DIR = path.join(__dirname, '../src/test-data/test-results');

// Retry configuration for rate limiting
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 10000
};

// Retry helper with exponential backoff for rate limits
async function fetchWithRetry(url, options, retryCount = 0) {
  const { fetch: undiciFetch } = await import('undici');

  try {
    const response = await undiciFetch(url, options);

    if (response.status === 429 && retryCount < RETRY_CONFIG.maxRetries) {
      const delay = Math.min(
        RETRY_CONFIG.baseDelayMs * Math.pow(2, retryCount),
        RETRY_CONFIG.maxDelayMs
      );
      process.stdout.write(`\n     ⏳ Rate limited, retrying in ${delay/1000}s (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})...`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retryCount + 1);
    }

    return response;
  } catch (err) {
    if (retryCount < RETRY_CONFIG.maxRetries && err.code === 'ECONNRESET') {
      const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, retryCount);
      process.stdout.write(`\n     ⏳ Connection reset, retrying in ${delay/1000}s...`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retryCount + 1);
    }
    throw err;
  }
}

// Multi-image test scenarios
const MULTI_IMAGE_TESTS = [
  {
    id: 'M1-two-images',
    description: 'Two images - tests merge logic handles multiple images',
    images: [
      { file: 'labels/label-perfect.html', label: 'front' },
      { file: 'labels/label-perfect.html', label: 'back' },
    ],
    // PASS or REVIEW acceptable - AI extraction has variance
    expectedResult: 'PASS_OR_REVIEW',
    expectedImageCount: 2,
    applicationData: {
      brandName: 'Old Tom Distillery',
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol. (90 Proof)',
      netContents: '750 mL',
      nameAddress: 'Old Tom Distillery, Louisville, Kentucky',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    },
  },
  {
    id: 'M2-three-images',
    description: 'Three images - tests merge logic with more images',
    images: [
      { file: 'labels/label-perfect.html', label: 'front' },
      { file: 'labels/label-perfect.html', label: 'back' },
      { file: 'labels/label-perfect.html', label: 'neck' },
    ],
    // PASS or REVIEW acceptable - AI extraction has variance
    expectedResult: 'PASS_OR_REVIEW',
    expectedImageCount: 3,
    applicationData: {
      brandName: 'Old Tom Distillery',
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol. (90 Proof)',
      netContents: '750 mL',
      nameAddress: 'Old Tom Distillery, Louisville, Kentucky',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    },
  },
  {
    id: 'M3-conflict-abv',
    description: 'Two images with ABV conflict (45% vs 46%) - should detect conflict',
    images: [
      { file: 'labels/label-conflict-front.html', label: 'front' },
      { file: 'labels/label-conflict-neck.html', label: 'neck' },
    ],
    expectedResult: 'CONFLICT', // Special case - we expect conflicts to be detected
    expectedConflictCount: 1,
    expectedImageCount: 2,
    applicationData: {
      brandName: 'Green Valley Spirits',
      classType: 'Premium Vodka',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL',
      nameAddress: 'Green Valley Spirits, Portland, Oregon',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    },
  },
  {
    id: 'M4-wrong-brand-fail',
    description: 'Two images - brand mismatch with application data, should FAIL/REVIEW',
    images: [
      { file: 'labels/label-oldtom-front.html', label: 'front' },
      { file: 'labels/label-oldtom-back.html', label: 'back' },
    ],
    expectedResult: 'REVIEW', // Brand mismatch triggers review
    expectedImageCount: 2,
    applicationData: {
      brandName: 'Jack Daniels', // Wrong brand!
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL',
      nameAddress: 'Old Tom Distillery, 123 Bourbon Lane, Louisville, Kentucky 40202',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    },
  },
  {
    id: 'M5-single-image-compat',
    description: 'Single image through multi-image endpoint - backward compatibility',
    images: [
      { file: 'labels/label-perfect.html', label: 'front' },
    ],
    // PASS or REVIEW acceptable - AI variance affects even single images
    expectedResult: 'PASS_OR_REVIEW',
    expectedImageCount: 1,
    applicationData: {
      brandName: 'Old Tom Distillery',
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol. (90 Proof)',
      netContents: '750 mL',
      nameAddress: 'Old Tom Distillery, Louisville, Kentucky',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    },
  },
];

async function runTests() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = `multi-image-test-${timestamp}`;

  console.log('🖼️  TTB Multi-Image Verification - Test Runner\n');
  console.log('='.repeat(60));
  console.log(`Run ID: ${runId}`);
  console.log('='.repeat(60) + '\n');

  // Ensure results directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const results = {
    runId,
    timestamp: new Date().toISOString(),
    summary: {
      total: MULTI_IMAGE_TESTS.length,
      passed: 0,
      failed: 0,
      errors: 0,
    },
    tests: [],
  };

  for (const test of MULTI_IMAGE_TESTS) {
    console.log(`\nRunning: ${test.id}`);
    console.log(`  ${test.description}`);
    console.log(`  Images: ${test.images.length}`);

    const testResult = await runSingleTest(test);
    results.tests.push(testResult);

    if (testResult.error) {
      results.summary.errors++;
      console.log(`  ❌ ERROR: ${testResult.error}`);
    } else if (testResult.passed) {
      results.summary.passed++;
      console.log(`  ✅ PASSED (${testResult.latencyMs}ms)`);
      if (testResult.notes) {
        console.log(`     ${testResult.notes}`);
      }
    } else {
      results.summary.failed++;
      console.log(`  ❌ FAILED`);
      console.log(`     Expected: ${testResult.expectedResult}`);
      console.log(`     Actual:   ${testResult.actualResult}`);
      if (testResult.reason) {
        console.log(`     Reason:   ${testResult.reason}`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 MULTI-IMAGE TEST RESULTS\n');
  console.log(`  Total:  ${results.summary.total}`);
  console.log(`  Passed: ${results.summary.passed} ✅`);
  console.log(`  Failed: ${results.summary.failed} ❌`);
  console.log(`  Errors: ${results.summary.errors} ⚠️`);

  // Save results
  const resultsFile = path.join(RESULTS_DIR, `${runId}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${resultsFile}`);

  // Exit code
  if (results.summary.failed > 0 || results.summary.errors > 0) {
    console.log('\n❌ Some multi-image tests failed.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All multi-image tests passed!\n');
    process.exit(0);
  }
}

async function runSingleTest(test) {
  const result = {
    id: test.id,
    description: test.description,
    expectedResult: test.expectedResult,
    expectedImageCount: test.expectedImageCount,
    actualResult: null,
    actualImageCount: null,
    passed: false,
    error: null,
    latencyMs: null,
    notes: null,
    reason: null,
    conflictCount: 0,
  };

  try {
    // Load all images
    const imageBuffers = [];
    for (const img of test.images) {
      // Try PNG first (generated), then HTML
      const pngPath = path.join(TEST_DATA_DIR, img.file.replace('.html', '.png'));
      const htmlPath = path.join(TEST_DATA_DIR, img.file);

      let imagePath;
      if (fs.existsSync(pngPath)) {
        imagePath = pngPath;
      } else if (fs.existsSync(htmlPath)) {
        // For HTML files, we need to screenshot them - skip for now
        result.error = `Need PNG version of ${img.file}. Run: node scripts/html-to-png.js`;
        return result;
      } else {
        result.error = `Image not found: ${img.file}`;
        return result;
      }

      imageBuffers.push({
        buffer: fs.readFileSync(imagePath),
        label: img.label,
        filename: path.basename(imagePath),
      });
    }

    // Create form data
    const { FormData } = await import('undici');
    const formData = new FormData();

    // Add images
    const imageLabels = {};
    imageBuffers.forEach((img, idx) => {
      const blob = new Blob([img.buffer], { type: 'image/png' });
      formData.set(`labelImage_${idx}`, blob, img.filename);
      imageLabels[String(idx)] = img.label;
    });
    formData.set('imageLabels', JSON.stringify(imageLabels));
    formData.set('applicationData', JSON.stringify(test.applicationData));

    // Make request with retry logic for rate limits
    const startTime = Date.now();
    const response = await fetchWithRetry(API_URL, {
      method: 'POST',
      body: formData,
    });
    // Note: SSE returns immediately, full processing time is until stream ends

    if (!response.ok) {
      if (response.status === 429) {
        result.error = `Rate limited after ${RETRY_CONFIG.maxRetries} retries`;
      } else {
        result.error = `HTTP ${response.status}`;
      }
      return result;
    }

    // Parse SSE stream (this includes full processing time)
    const text = await response.text();
    result.latencyMs = Date.now() - startTime;
    const events = parseSSE(text);

    // Debug: show all events
    if (process.env.DEBUG) {
      console.log('    Events:', events.map(e => e.event).join(', '));
      // Show conflicts
      const conflictEvent = events.find(e => e.event === 'conflict_detected');
      if (conflictEvent && conflictEvent.data.conflicts) {
        console.log('    Conflicts:');
        for (const c of conflictEvent.data.conflicts) {
          const values = c.candidates.map(v => `"${v.value}"`).join(' vs ');
          console.log(`      - ${c.fieldDisplayName}: ${values}`);
        }
      }
      // Show field results
      const fieldEvents = events.filter(e => e.event === 'field');
      for (const fe of fieldEvents) {
        const status = fe.data.status;
        const name = fe.data.fieldName;
        if (status !== 'PASS') {
          console.log(`    ${status}: ${name} - ${fe.data.details?.slice(0, 80)}`);
        }
      }
    }

    // Find the complete event
    const completeEvent = events.find(e => e.event === 'complete');
    if (!completeEvent) {
      result.error = `No complete event in response. Got events: ${events.map(e => e.event).join(', ')}`;
      return result;
    }

    const data = completeEvent.data;
    result.actualResult = data.overallStatus;
    result.actualImageCount = data.imageCount || 1;

    // Check for conflicts
    if (data.unresolvedConflicts) {
      result.conflictCount = data.unresolvedConflicts.length;
    }

    // Evaluate result
    if (test.expectedResult === 'CONFLICT') {
      // Special case: we expect conflicts to be detected
      if (result.conflictCount > 0) {
        result.passed = true;
        result.notes = `Detected ${result.conflictCount} conflict(s) as expected`;
        if (test.expectedConflictCount && result.conflictCount !== test.expectedConflictCount) {
          result.notes += ` (expected ${test.expectedConflictCount})`;
        }
      } else {
        result.passed = false;
        result.reason = 'Expected conflicts but none detected';
      }
    } else if (test.expectedResult === 'PASS_OR_REVIEW') {
      // Multi-image tests: PASS or REVIEW both acceptable due to AI variance
      const actual = result.actualResult.toUpperCase();
      if (actual === 'PASS' || actual === 'REVIEW') {
        result.passed = true;
        result.notes = `Got ${actual} (PASS or REVIEW both acceptable)`;
      } else {
        result.passed = false;
        result.reason = `Expected PASS or REVIEW, got ${actual}`;
      }
    } else {
      // Normal comparison
      const expected = test.expectedResult.toUpperCase();
      const actual = result.actualResult.toUpperCase();

      if (expected === actual) {
        result.passed = true;
      } else if (expected === 'PASS' && actual === 'REVIEW') {
        // REVIEW acceptable if only bold warning
        const nonBoldIssues = (data.fieldResults || []).filter(
          f => (f.status === 'WARNING' || f.status === 'FAIL') &&
               f.fieldName !== 'Gov Warning — Header Bold'
        );
        if (nonBoldIssues.length === 0) {
          result.passed = true;
          result.notes = 'REVIEW acceptable - only bold warning';
        } else {
          result.reason = `Non-bold issues: ${nonBoldIssues.map(f => f.fieldName).join(', ')}`;
        }
      }
    }

    // Verify image count for all tests
    if (result.passed && result.actualImageCount !== test.expectedImageCount) {
      result.passed = false;
      result.reason = `Image count mismatch: expected ${test.expectedImageCount}, got ${result.actualImageCount}`;
    }

    return result;

  } catch (err) {
    result.error = err.message;
    return result;
  }
}

function parseSSE(text) {
  const events = [];
  const lines = text.split('\n');

  let currentEvent = null;
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = { event: line.slice(7), data: null };
    } else if (line.startsWith('data: ') && currentEvent) {
      try {
        currentEvent.data = JSON.parse(line.slice(6));
        events.push(currentEvent);
      } catch {
        // Skip invalid JSON
      }
      currentEvent = null;
    }
  }

  return events;
}

async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000', { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ Dev server not running. Start it with: npm run dev\n');
    process.exit(1);
  }
  await runTests();
}

main();
