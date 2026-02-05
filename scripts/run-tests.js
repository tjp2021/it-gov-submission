/**
 * Automated Test Runner for TTB Label Verification
 *
 * Runs all test scenarios and compares results to expected outcomes.
 * Saves detailed results with latency metrics for manual review.
 *
 * Requirements:
 * - Dev server running on localhost:3000
 * - formdata-node package: npm install formdata-node
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/verify-gemini';
const TEST_DATA_DIR = path.join(__dirname, '../src/test-data');
const RESULTS_DIR = path.join(__dirname, '../src/test-data/test-results');

// Filter groups via command line: node run-tests.js basic intermediate
// Default: run all except 'advanced' (DALL-E generated)
const ARGS = process.argv.slice(2);
const INCLUDE_GROUPS = ARGS.length > 0 ? ARGS : ['basic', 'intermediate'];
const INCLUDE_ALL = ARGS.includes('--all');

// Performance thresholds (from PRD: Sarah's 5-second requirement)
const LATENCY_THRESHOLDS = {
  target: 5000,    // 5 seconds - must meet
  good: 3000,      // 3 seconds - good performance
  excellent: 2000  // 2 seconds - excellent performance
};

// Retry configuration for rate limiting
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 2000,  // Start with 2 second delay
  maxDelayMs: 10000   // Cap at 10 seconds
};

async function runTests() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = `test-run-${timestamp}`;

  console.log('🐸 TTB Label Verification - Automated Test Runner\n');
  console.log('='.repeat(60));
  console.log(`Run ID: ${runId}`);
  console.log(`Target Latency: <${LATENCY_THRESHOLDS.target}ms (per PRD requirement)`);
  console.log('='.repeat(60) + '\n');

  // Ensure results directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Load test scenarios
  const scenariosPath = path.join(TEST_DATA_DIR, 'sample-applications.json');
  const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf-8'));

  const results = {
    runId,
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      passRate: 0
    },
    latency: {
      target: LATENCY_THRESHOLDS.target,
      min: Infinity,
      max: 0,
      avg: 0,
      p95: 0,
      exceedsTarget: 0,
      all: []
    },
    tests: []
  };

  // Group scenarios (filter by command line args)
  const groups = {};
  for (const scenario of scenarios.labels) {
    const group = scenario.group || 'unknown';
    // Skip groups not in filter unless --all
    if (!INCLUDE_ALL && !INCLUDE_GROUPS.includes(group)) {
      continue;
    }
    if (!groups[group]) groups[group] = [];
    groups[group].push(scenario);
  }

  if (Object.keys(groups).length === 0) {
    console.error('No test scenarios found for groups:', INCLUDE_GROUPS.join(', '));
    console.log('Available groups:', Object.keys(scenarios.groups || {}).join(', '));
    console.log('Use --all to run all groups including DALL-E generated');
    process.exit(1);
  }

  // Run tests by group
  for (const [groupName, groupScenarios] of Object.entries(groups)) {
    const groupInfo = scenarios.groups?.[groupName] || { name: groupName };
    console.log(`\n📁 ${groupInfo.name || groupName}`);
    console.log('-'.repeat(40));

    for (const scenario of groupScenarios) {
      const testResult = await runSingleTest(scenario);
      results.tests.push(testResult);
      results.summary.total++;

      // Track latency
      if (testResult.latencyMs) {
        results.latency.all.push(testResult.latencyMs);
        results.latency.min = Math.min(results.latency.min, testResult.latencyMs);
        results.latency.max = Math.max(results.latency.max, testResult.latencyMs);
        if (testResult.latencyMs > LATENCY_THRESHOLDS.target) {
          results.latency.exceedsTarget++;
        }
      }

      // Print result
      const latencyStr = testResult.latencyMs
        ? `${(testResult.latencyMs / 1000).toFixed(2)}s`
        : 'N/A';
      const latencyIcon = getLatencyIcon(testResult.latencyMs);

      if (testResult.error) {
        results.summary.errors++;
        console.log(`  ❌ ${scenario.id}: ERROR - ${testResult.error}`);
      } else if (testResult.passed) {
        results.summary.passed++;
        console.log(`  ✅ ${scenario.id}: PASSED [${latencyIcon} ${latencyStr}]`);
      } else {
        results.summary.failed++;
        console.log(`  ❌ ${scenario.id}: FAILED [${latencyIcon} ${latencyStr}]`);
        console.log(`     Expected: ${testResult.expectedResult}`);
        console.log(`     Actual:   ${testResult.actualResult}`);
      }
    }
  }

  // Calculate latency stats
  if (results.latency.all.length > 0) {
    const sorted = [...results.latency.all].sort((a, b) => a - b);
    results.latency.avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    results.latency.p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  }
  if (results.latency.min === Infinity) results.latency.min = 0;

  // Calculate pass rate
  results.summary.passRate = results.summary.total > 0
    ? (results.summary.passed / results.summary.total) * 100
    : 0;

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST RESULTS SUMMARY\n');
  console.log(`  Total:  ${results.summary.total}`);
  console.log(`  Passed: ${results.summary.passed} ✅`);
  console.log(`  Failed: ${results.summary.failed} ❌`);
  console.log(`  Errors: ${results.summary.errors} ⚠️`);
  console.log(`  Pass Rate: ${results.summary.passRate.toFixed(1)}%`);

  console.log('\n⏱️  LATENCY METRICS\n');
  console.log(`  Target:  <${LATENCY_THRESHOLDS.target}ms (per PRD)`);
  console.log(`  Min:     ${results.latency.min.toFixed(0)}ms`);
  console.log(`  Max:     ${results.latency.max.toFixed(0)}ms`);
  console.log(`  Avg:     ${results.latency.avg.toFixed(0)}ms`);
  console.log(`  P95:     ${results.latency.p95.toFixed(0)}ms`);
  console.log(`  Exceeds Target: ${results.latency.exceedsTarget}/${results.latency.all.length}`);

  // Save results to file
  const resultsFile = path.join(RESULTS_DIR, `${runId}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Full results saved to: ${resultsFile}`);

  // Generate HTML report for manual review
  const htmlReport = generateHtmlReport(results);
  const htmlFile = path.join(RESULTS_DIR, `${runId}.html`);
  fs.writeFileSync(htmlFile, htmlReport);
  console.log(`📄 HTML report saved to: ${htmlFile}`);

  // Exit with appropriate code
  if (results.summary.failed > 0 || results.summary.errors > 0) {
    console.log('\n🐸 Some tests failed.\n');
    process.exit(1);
  } else {
    console.log('\n🐸 All tests passed!\n');
    process.exit(0);
  }
}

function getLatencyIcon(ms) {
  if (!ms) return '⚪';
  if (ms <= LATENCY_THRESHOLDS.excellent) return '🟢';
  if (ms <= LATENCY_THRESHOLDS.good) return '🟡';
  if (ms <= LATENCY_THRESHOLDS.target) return '🟠';
  return '🔴';
}

// Retry helper with exponential backoff for rate limits
async function fetchWithRetry(url, options, retryCount = 0) {
  const { fetch: undiciFetch } = await import('undici');

  try {
    const response = await undiciFetch(url, options);

    // Check for rate limit (429)
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
    // Retry on network errors too
    if (retryCount < RETRY_CONFIG.maxRetries && err.code === 'ECONNRESET') {
      const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, retryCount);
      process.stdout.write(`\n     ⏳ Connection reset, retrying in ${delay/1000}s...`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retryCount + 1);
    }
    throw err;
  }
}

async function runSingleTest(scenario) {
  // htmlFile now contains the full path like "automated/basic/label-perfect.png"
  const imagePath = scenario.htmlFile;
  const pngPath = path.join(TEST_DATA_DIR, 'sample-labels', imagePath);
  const pngFileName = path.basename(imagePath);

  const result = {
    id: scenario.id,
    group: scenario.group,
    description: scenario.description,
    expectedResult: scenario.expectedResult,
    expectedReason: scenario.expectedReason,
    actualResult: null,
    passed: false,
    error: null,
    latencyMs: null,
    imagePath: `sample-labels/${imagePath}`,
    imageExists: fs.existsSync(pngPath),
    applicationData: scenario.applicationData,
    fieldResults: null,
    rawResponse: null
  };

  if (!result.imageExists) {
    result.error = `PNG not found: ${pngFileName}`;
    return result;
  }

  try {
    const imageBuffer = fs.readFileSync(pngPath);

    // Create form data using undici
    const { FormData } = await import('undici');

    const formData = new FormData();
    // Use Blob with filename in the set call
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.set('labelImage', blob, pngFileName);
    formData.set('applicationData', JSON.stringify(scenario.applicationData));

    // Make request with timing and retry logic for rate limits
    const startTime = Date.now();
    const response = await fetchWithRetry(API_URL, {
      method: 'POST',
      body: formData
    });
    result.latencyMs = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 429) {
        result.error = `Rate limited after ${RETRY_CONFIG.maxRetries} retries`;
      } else {
        const error = await response.json().catch(() => ({}));
        result.error = error.error || `HTTP ${response.status}`;
      }
      return result;
    }

    const data = await response.json();
    result.actualResult = data.overallStatus;
    result.fieldResults = data.fieldResults;
    result.rawResponse = data;

    // Compare result
    // With the new architecture, bold check is "confirmation" category and doesn't block PASS
    // So PASS now means PASS - no workaround needed
    const expected = scenario.expectedResult.toUpperCase();
    const actual = result.actualResult.toUpperCase();

    if (expected === actual) {
      result.passed = true;
    }
    // Note: pendingConfirmations contains the bold check for agent to confirm
    // but it no longer affects the overall status

    return result;

  } catch (err) {
    result.error = err.message;
    return result;
  }
}

function generateHtmlReport(results) {
  const testRows = results.tests.map(t => {
    const statusIcon = t.error ? '❌' : t.passed ? '✅' : '❌';
    const statusClass = t.error ? 'error' : t.passed ? 'passed' : 'failed';
    const latencyClass = getLatencyClass(t.latencyMs);

    return `
      <tr class="${statusClass}">
        <td>${statusIcon} ${t.id}</td>
        <td>${t.description}</td>
        <td>${t.expectedResult}</td>
        <td>${t.actualResult || t.error || 'N/A'}</td>
        <td class="${latencyClass}">${t.latencyMs ? t.latencyMs + 'ms' : 'N/A'}</td>
        <td><img src="${t.imagePath}" alt="${t.id}" style="max-width:150px;max-height:100px;"></td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Test Results - ${results.runId}</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 20px; max-width: 1400px; margin: 0 auto; }
    h1 { color: #333; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .stat { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
    .stat .value { font-size: 2em; font-weight: bold; }
    .stat .label { color: #666; }
    .stat.passed .value { color: #22c55e; }
    .stat.failed .value { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f9fafb; font-weight: 600; }
    tr.passed { background: #f0fdf4; }
    tr.failed { background: #fef2f2; }
    tr.error { background: #fefce8; }
    .latency-excellent { color: #22c55e; font-weight: bold; }
    .latency-good { color: #84cc16; }
    .latency-ok { color: #f59e0b; }
    .latency-slow { color: #ef4444; font-weight: bold; }
    .latency-section { margin: 20px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
    img { border: 1px solid #ddd; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>🐸 TTB Label Verification - Test Results</h1>
  <p><strong>Run ID:</strong> ${results.runId}</p>
  <p><strong>Timestamp:</strong> ${results.timestamp}</p>

  <div class="summary">
    <div class="stat"><div class="value">${results.summary.total}</div><div class="label">Total Tests</div></div>
    <div class="stat passed"><div class="value">${results.summary.passed}</div><div class="label">Passed</div></div>
    <div class="stat failed"><div class="value">${results.summary.failed}</div><div class="label">Failed</div></div>
    <div class="stat"><div class="value">${results.summary.passRate.toFixed(1)}%</div><div class="label">Pass Rate</div></div>
  </div>

  <div class="latency-section">
    <h2>⏱️ Latency Metrics</h2>
    <p><strong>Target:</strong> &lt;${results.latency.target}ms (per PRD - Sarah's 5-second requirement)</p>
    <p><strong>Min:</strong> ${results.latency.min.toFixed(0)}ms |
       <strong>Max:</strong> ${results.latency.max.toFixed(0)}ms |
       <strong>Avg:</strong> ${results.latency.avg.toFixed(0)}ms |
       <strong>P95:</strong> ${results.latency.p95.toFixed(0)}ms</p>
    <p><strong>Exceeds Target:</strong> ${results.latency.exceedsTarget}/${results.latency.all.length} tests</p>
  </div>

  <h2>Test Details</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Description</th>
        <th>Expected</th>
        <th>Actual</th>
        <th>Latency</th>
        <th>Image</th>
      </tr>
    </thead>
    <tbody>
      ${testRows}
    </tbody>
  </table>
</body>
</html>`;
}

function getLatencyClass(ms) {
  if (!ms) return '';
  if (ms <= LATENCY_THRESHOLDS.excellent) return 'latency-excellent';
  if (ms <= LATENCY_THRESHOLDS.good) return 'latency-good';
  if (ms <= LATENCY_THRESHOLDS.target) return 'latency-ok';
  return 'latency-slow';
}

// Check if server is running
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
