/**
 * Gemini Flash Evaluation - Compare against Claude Vision
 */

const fs = require('fs');
const path = require('path');

const VISION_API_URL = 'http://localhost:3000/api/verify';
const GEMINI_API_URL = 'http://localhost:3000/api/verify-gemini';
const TEST_DATA_DIR = path.join(__dirname, '../src/test-data');

const INCLUDE_GROUPS = ['basic', 'intermediate', 'stress'];

async function main() {
  console.log('='.repeat(60));
  console.log('GEMINI FLASH vs CLAUDE VISION COMPARISON');
  console.log('='.repeat(60) + '\n');

  const scenariosPath = path.join(TEST_DATA_DIR, 'sample-applications.json');
  const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf-8'));
  const testCases = scenarios.labels.filter(s => INCLUDE_GROUPS.includes(s.group));

  console.log(`Running ${testCases.length} test cases\n`);

  const results = {
    vision: { times: [], statuses: [] },
    gemini: { times: [], statuses: [] },
    matches: 0,
    total: 0
  };

  console.log('Test Case                | Vision     | Gemini     | Match?');
  console.log('-------------------------|------------|------------|--------');

  for (const scenario of testCases) {
    // Run serially to avoid Gemini rate limiting
    const geminiResult = await makeRequest(GEMINI_API_URL, scenario);
    const visionResult = await makeRequest(VISION_API_URL, scenario);

    const visionStatus = visionResult.error ? 'ERROR' : visionResult.overallStatus;
    const geminiStatus = geminiResult.error ? 'ERROR' : geminiResult.overallStatus;
    const visionTime = visionResult.latencyMs || 0;
    const geminiTime = geminiResult.latencyMs || 0;

    // Check match - allow REVIEW to match PASS (bold warning difference)
    let matches = visionStatus === geminiStatus;
    if (!matches) {
      // REVIEW is acceptable for PASS cases
      if ((visionStatus === 'PASS' && geminiStatus === 'REVIEW') ||
          (visionStatus === 'REVIEW' && geminiStatus === 'PASS')) {
        matches = true;
      }
    }

    const matchIcon = matches ? '✅' : '❌';
    console.log(`${scenario.id.padEnd(24)} | ${visionStatus.padEnd(4)} ${String(visionTime).padStart(5)}ms | ${geminiStatus.padEnd(4)} ${String(geminiTime).padStart(5)}ms | ${matchIcon}`);

    results.vision.times.push(visionTime);
    results.vision.statuses.push(visionStatus);
    results.gemini.times.push(geminiTime);
    results.gemini.statuses.push(geminiStatus);
    results.total++;
    if (matches) results.matches++;
  }

  // Calculate stats
  const visionAvg = results.vision.times.reduce((a, b) => a + b, 0) / results.vision.times.length;
  const geminiAvg = results.gemini.times.reduce((a, b) => a + b, 0) / results.gemini.times.length;
  const speedup = (visionAvg / geminiAvg).toFixed(1);

  const visionSorted = [...results.vision.times].sort((a, b) => a - b);
  const geminiSorted = [...results.gemini.times].sort((a, b) => a - b);
  const visionP95 = visionSorted[Math.floor(visionSorted.length * 0.95)];
  const geminiP95 = geminiSorted[Math.floor(geminiSorted.length * 0.95)];

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  console.log('\n📊 ACCURACY');
  console.log(`   Status Match: ${results.matches}/${results.total} (${(results.matches/results.total*100).toFixed(0)}%)`);

  console.log('\n⏱️  LATENCY');
  console.log(`   Claude Vision Avg: ${visionAvg.toFixed(0)}ms`);
  console.log(`   Gemini Flash Avg:  ${geminiAvg.toFixed(0)}ms`);
  console.log(`   Speedup:           ${speedup}x`);
  console.log(`   Claude Vision P95: ${visionP95}ms`);
  console.log(`   Gemini Flash P95:  ${geminiP95}ms`);

  const geminiUnder2s = results.gemini.times.filter(t => t < 2000).length;
  const geminiUnder3s = results.gemini.times.filter(t => t < 3000).length;
  console.log(`\n   Gemini < 2s: ${geminiUnder2s}/${results.total}`);
  console.log(`   Gemini < 3s: ${geminiUnder3s}/${results.total}`);

  console.log('\n' + '='.repeat(60));
  console.log('VERDICT');
  console.log('='.repeat(60));

  const accuracyOk = results.matches === results.total;
  const latencyOk = geminiAvg < 2000;
  const latencyAcceptable = geminiAvg < 3000;

  console.log(`\n| Metric           | Target  | Actual    | Status |`);
  console.log(`|------------------|---------|-----------|--------|`);
  console.log(`| Accuracy Match   | 100%    | ${(results.matches/results.total*100).toFixed(0)}%       | ${accuracyOk ? '✅' : '❌'}      |`);
  console.log(`| Latency Avg      | <2000ms | ${geminiAvg.toFixed(0)}ms     | ${latencyOk ? '✅' : latencyAcceptable ? '⚠️' : '❌'}      |`);
  console.log(`| Latency P95      | <3000ms | ${geminiP95}ms     | ${geminiP95 < 3000 ? '✅' : '❌'}      |`);
  console.log(`| Speedup vs Vision| >2x     | ${speedup}x       | ${parseFloat(speedup) >= 2 ? '✅' : '⚠️'}      |`);

  if (accuracyOk && latencyAcceptable) {
    console.log('\n🚀 GEMINI FLASH IS READY TO SHIP!');
  } else {
    console.log('\n⚠️  Some metrics need improvement.');
  }

  console.log('');
}

async function makeRequest(url, scenario) {
  // htmlFile now contains the full path like "automated/basic/label-perfect.png"
  const imagePath = scenario.htmlFile;
  const pngPath = path.join(TEST_DATA_DIR, 'sample-labels', imagePath);
  const pngFileName = require('path').basename(imagePath);

  if (!fs.existsSync(pngPath)) {
    return { error: `PNG not found: ${imagePath}` };
  }

  const imageBuffer = fs.readFileSync(pngPath);
  const { FormData, fetch } = await import('undici');

  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  formData.set('labelImage', blob, pngFileName);
  formData.set('applicationData', JSON.stringify(scenario.applicationData));

  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || `HTTP ${response.status}`, latencyMs };
    }

    const data = await response.json();
    return { ...data, latencyMs };
  } catch (err) {
    return { error: err.message, latencyMs: Date.now() - startTime };
  }
}

main().catch(console.error);
