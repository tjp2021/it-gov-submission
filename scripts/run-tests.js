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

const API_URL = 'http://localhost:3000/api/verify';
const TEST_DATA_DIR = path.join(__dirname, '../src/test-data');
const RESULTS_DIR = path.join(__dirname, '../src/test-data/test-results');

// Performance thresholds (from PRD: Sarah's 5-second requirement)
const LATENCY_THRESHOLDS = {
  target: 5000,    // 5 seconds - must meet
  good: 3000,      // 3 seconds - good performance
  excellent: 2000  // 2 seconds - excellent performance
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

  // Group scenarios
  const groups = {};
  for (const scenario of scenarios.labels) {
    const group = scenario.group || 'unknown';
    if (!groups[group]) groups[group] = [];
    groups[group].push(scenario);
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

async function runSingleTest(scenario) {
  const pngFileName = scenario.htmlFile.replace('labels/', '').replace('.html', '.png');
  const pngPath = path.join(TEST_DATA_DIR, 'sample-labels', pngFileName);

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
    imagePath: `sample-labels/${pngFileName}`,
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
    const { FormData, fetch: undiciFetch } = await import('undici');

    const formData = new FormData();
    // Use Blob with filename in the set call
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.set('labelImage', blob, pngFileName);
    formData.set('applicationData', JSON.stringify(scenario.applicationData));

    // Make request with timing using undici fetch
    const startTime = Date.now();
    const response = await undiciFetch(API_URL, {
      method: 'POST',
      body: formData
    });
    result.latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      result.error = error.error || `HTTP ${response.status}`;
      return result;
    }

    const data = await response.json();
    result.actualResult = data.overallStatus;
    result.fieldResults = data.fieldResults;
    result.rawResponse = data;

    // Compare result
    const expected = scenario.expectedResult.toUpperCase();
    const actual = result.actualResult.toUpperCase();

    if (expected === actual) {
      result.passed = true;
    } else if (expected === 'PASS' && actual === 'REVIEW') {
      // REVIEW is acceptable for PASS if only warning is the bold detection
      const nonBoldWarnings = data.fieldResults.filter(
        f => (f.status === 'WARNING' || f.status === 'FAIL') &&
             f.fieldName !== 'Gov Warning — Header Bold'
      );
      if (nonBoldWarnings.length === 0) {
        result.passed = true;
        result.note = 'REVIEW acceptable - only bold warning';
      }
    }

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
