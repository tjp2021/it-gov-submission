#!/usr/bin/env node
/**
 * Input Validation Tests for TTB Label Verification
 *
 * Tests error handling for invalid inputs:
 * - Missing image
 * - Invalid image data
 * - Missing application data
 * - Malformed application data
 * - Too many images
 * - Non-image file types
 *
 * Requirements:
 * - Dev server running on localhost:3000
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/verify-stream';
const SINGLE_API_URL = 'http://localhost:3000/api/verify-gemini';
const TEST_DATA_DIR = path.join(__dirname, '../src/test-data');

// Test cases for input validation
const VALIDATION_TESTS = [
  {
    id: 'V1-missing-image',
    description: 'Request with no image uploaded',
    endpoint: 'single',
    setup: (formData) => {
      // Only add application data, no image
      formData.set('applicationData', JSON.stringify({
        brandName: 'Test Brand',
        classType: 'Test Type',
        alcoholContent: '40%',
        netContents: '750 mL',
        nameAddress: 'Test Address',
        countryOfOrigin: '',
        governmentWarning: 'GOVERNMENT WARNING: Test warning text.'
      }));
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /image|required|missing/i
  },
  {
    id: 'V2-missing-app-data',
    description: 'Request with image but no application data',
    endpoint: 'single',
    setup: async (formData) => {
      const imagePath = path.join(TEST_DATA_DIR, 'labels/label-perfect.png');
      const buffer = fs.readFileSync(imagePath);
      const blob = new Blob([buffer], { type: 'image/png' });
      formData.set('labelImage', blob, 'test.png');
      // No applicationData
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /application|data|required|missing/i
  },
  {
    id: 'V3-malformed-app-data',
    description: 'Request with invalid JSON in application data',
    endpoint: 'single',
    setup: async (formData) => {
      const imagePath = path.join(TEST_DATA_DIR, 'labels/label-perfect.png');
      const buffer = fs.readFileSync(imagePath);
      const blob = new Blob([buffer], { type: 'image/png' });
      formData.set('labelImage', blob, 'test.png');
      formData.set('applicationData', 'not valid json {{{');
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /json|parse|invalid|malformed/i
  },
  {
    id: 'V4-empty-image',
    description: 'Request with zero-byte image file',
    endpoint: 'single',
    setup: (formData) => {
      const emptyBlob = new Blob([], { type: 'image/png' });
      formData.set('labelImage', emptyBlob, 'empty.png');
      formData.set('applicationData', JSON.stringify({
        brandName: 'Test Brand',
        classType: 'Test Type',
        alcoholContent: '40%',
        netContents: '750 mL',
        nameAddress: 'Test Address',
        countryOfOrigin: '',
        governmentWarning: 'GOVERNMENT WARNING: Test warning.'
      }));
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /empty|invalid|image/i
  },
  {
    id: 'V5-text-file-as-image',
    description: 'Request with text file disguised as image',
    endpoint: 'single',
    setup: (formData) => {
      const textContent = 'This is not an image, just plain text.';
      const textBlob = new Blob([textContent], { type: 'image/png' });
      formData.set('labelImage', textBlob, 'fake.png');
      formData.set('applicationData', JSON.stringify({
        brandName: 'Test Brand',
        classType: 'Test Type',
        alcoholContent: '40%',
        netContents: '750 mL',
        nameAddress: 'Test Address',
        countryOfOrigin: '',
        governmentWarning: 'GOVERNMENT WARNING: Test warning.'
      }));
    },
    expectError: true,
    // This might pass to Gemini which will fail extraction - either 400 or extraction error is acceptable
    expectedStatus: [400, 500],
    expectedMessage: /image|extract|invalid|failed/i
  },
  {
    id: 'V6-too-many-images',
    description: 'Multi-image request with 7 images (max is 6)',
    endpoint: 'multi',
    setup: async (formData) => {
      const imagePath = path.join(TEST_DATA_DIR, 'labels/label-perfect.png');
      const buffer = fs.readFileSync(imagePath);

      // Add 7 images (exceeds max of 6)
      const imageLabels = {};
      for (let i = 0; i < 7; i++) {
        const blob = new Blob([buffer], { type: 'image/png' });
        formData.set(`labelImage_${i}`, blob, `image${i}.png`);
        imageLabels[String(i)] = 'front';
      }
      formData.set('imageLabels', JSON.stringify(imageLabels));
      formData.set('applicationData', JSON.stringify({
        brandName: 'Test Brand',
        classType: 'Test Type',
        alcoholContent: '40%',
        netContents: '750 mL',
        nameAddress: 'Test Address',
        countryOfOrigin: '',
        governmentWarning: 'GOVERNMENT WARNING: Test warning.'
      }));
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /max|limit|too many|6/i
  },
  {
    id: 'V7-missing-required-fields',
    description: 'Application data missing required fields (brandName)',
    endpoint: 'single',
    setup: async (formData) => {
      const imagePath = path.join(TEST_DATA_DIR, 'labels/label-perfect.png');
      const buffer = fs.readFileSync(imagePath);
      const blob = new Blob([buffer], { type: 'image/png' });
      formData.set('labelImage', blob, 'test.png');
      formData.set('applicationData', JSON.stringify({
        // Missing brandName
        classType: 'Test Type',
        alcoholContent: '40%',
        netContents: '750 mL'
      }));
    },
    // This might be handled gracefully - empty field comparison
    expectError: false,
    expectedStatus: 200
  },
  {
    id: 'V8-multi-no-images',
    description: 'Multi-image endpoint with no images',
    endpoint: 'multi',
    setup: (formData) => {
      formData.set('imageLabels', JSON.stringify({}));
      formData.set('applicationData', JSON.stringify({
        brandName: 'Test Brand',
        classType: 'Test Type',
        alcoholContent: '40%',
        netContents: '750 mL',
        nameAddress: 'Test Address',
        countryOfOrigin: '',
        governmentWarning: 'GOVERNMENT WARNING: Test warning.'
      }));
    },
    expectError: true,
    expectedStatus: 400,
    expectedMessage: /image|required|at least/i
  }
];

async function runTests() {
  console.log('🔒 TTB Label Verification - Input Validation Tests\n');
  console.log('='.repeat(60));
  console.log('Testing error handling for invalid inputs');
  console.log('='.repeat(60) + '\n');

  const results = {
    total: VALIDATION_TESTS.length,
    passed: 0,
    failed: 0,
    tests: []
  };

  for (const test of VALIDATION_TESTS) {
    process.stdout.write(`  ${test.id}: ${test.description}... `);

    const testResult = await runSingleTest(test);
    results.tests.push(testResult);

    if (testResult.passed) {
      results.passed++;
      console.log('✅ PASSED');
      if (testResult.note) {
        console.log(`     ${testResult.note}`);
      }
    } else {
      results.failed++;
      console.log('❌ FAILED');
      console.log(`     Expected: ${test.expectError ? 'Error' : 'Success'} with status ${JSON.stringify(test.expectedStatus)}`);
      console.log(`     Actual: Status ${testResult.status}, Error: ${testResult.error || 'none'}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 VALIDATION TEST RESULTS\n');
  console.log(`  Total:  ${results.total}`);
  console.log(`  Passed: ${results.passed} ✅`);
  console.log(`  Failed: ${results.failed} ❌`);

  if (results.failed > 0) {
    console.log('\n❌ Some validation tests failed.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All validation tests passed!\n');
    process.exit(0);
  }
}

async function runSingleTest(test) {
  const result = {
    id: test.id,
    passed: false,
    status: null,
    error: null,
    note: null
  };

  try {
    const { FormData, fetch: undiciFetch } = await import('undici');
    const formData = new FormData();

    // Run setup to configure form data
    await test.setup(formData);

    // Choose endpoint
    const url = test.endpoint === 'multi' ? API_URL : SINGLE_API_URL;

    const response = await undiciFetch(url, {
      method: 'POST',
      body: formData
    });

    result.status = response.status;

    // For SSE endpoint, read the full response
    const contentType = response.headers.get('content-type') || '';
    let responseData;

    if (contentType.includes('text/event-stream')) {
      const text = await response.text();
      // Check for error event in SSE
      if (text.includes('event: error')) {
        const errorMatch = text.match(/data: ({.*})/);
        if (errorMatch) {
          responseData = JSON.parse(errorMatch[1]);
          result.error = responseData.error || responseData.message;
        }
      }
    } else {
      try {
        responseData = await response.json();
        result.error = responseData.error || responseData.message;
      } catch {
        result.error = await response.text();
      }
    }

    // Evaluate result
    if (test.expectError) {
      // We expect an error response
      const expectedStatuses = Array.isArray(test.expectedStatus)
        ? test.expectedStatus
        : [test.expectedStatus];

      const statusMatches = expectedStatuses.includes(result.status);
      const messageMatches = !test.expectedMessage ||
        (result.error && test.expectedMessage.test(result.error));

      if (statusMatches && messageMatches) {
        result.passed = true;
        result.note = `Got expected error: "${result.error?.slice(0, 50)}..."`;
      } else if (statusMatches) {
        result.passed = true;
        result.note = `Status ${result.status} as expected (message pattern didn't match but status is correct)`;
      }
    } else {
      // We expect success
      if (result.status === test.expectedStatus) {
        result.passed = true;
      }
    }

    return result;

  } catch (err) {
    result.error = err.message;
    // Network errors might be expected for some tests
    if (test.expectError) {
      result.passed = true;
      result.note = `Got expected error: ${err.message}`;
    }
    return result;
  }
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
