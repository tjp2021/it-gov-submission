/**
 * Comprehensive bold detection test with degraded images
 * Tests: blur, low light, glare, angle, noise, combined
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/verify-gemini';

const TEST_IMAGES = [
  // BOLD images - clean and degraded
  { path: 'automated/basic/label-perfect.png', expectedBold: true, condition: 'clean' },
  { path: 'test-bold/bold-degraded/label-perfect-blur.jpg', expectedBold: true, condition: 'blur' },
  { path: 'test-bold/bold-degraded/label-perfect-lowlight.jpg', expectedBold: true, condition: 'lowlight' },
  { path: 'test-bold/bold-degraded/label-perfect-glare.jpg', expectedBold: true, condition: 'glare' },
  { path: 'test-bold/bold-degraded/label-perfect-angled.jpg', expectedBold: true, condition: 'angled' },
  { path: 'test-bold/bold-degraded/label-perfect-noise.jpg', expectedBold: true, condition: 'noise' },
  { path: 'test-bold/bold-degraded/label-perfect-combined.jpg', expectedBold: true, condition: 'combined' },

  // NON-BOLD images - clean and degraded
  { path: 'test-bold/label-NOT-bold.png', expectedBold: false, condition: 'clean' },
  { path: 'test-bold/nonbold-degraded/label-NOT-bold-blur.jpg', expectedBold: false, condition: 'blur' },
  { path: 'test-bold/nonbold-degraded/label-NOT-bold-lowlight.jpg', expectedBold: false, condition: 'lowlight' },
  { path: 'test-bold/nonbold-degraded/label-NOT-bold-glare.jpg', expectedBold: false, condition: 'glare' },
  { path: 'test-bold/nonbold-degraded/label-NOT-bold-angled.jpg', expectedBold: false, condition: 'angled' },
  { path: 'test-bold/nonbold-degraded/label-NOT-bold-noise.jpg', expectedBold: false, condition: 'noise' },
  { path: 'test-bold/nonbold-degraded/label-NOT-bold-combined.jpg', expectedBold: false, condition: 'combined' },
];

async function testBoldDetection() {
  console.log('='.repeat(70));
  console.log('COMPREHENSIVE BOLD DETECTION TEST');
  console.log('Testing with blur, low light, glare, angle, noise, combined conditions');
  console.log('='.repeat(70));

  const { FormData, fetch } = await import('undici');
  const results = [];

  for (const test of TEST_IMAGES) {
    const imagePath = path.join(__dirname, '../src/test-data/sample-labels', test.path);

    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️  Skipping ${test.path} - file not found`);
      continue;
    }

    const label = test.expectedBold ? 'BOLD' : 'NON-BOLD';
    process.stdout.write(`Testing ${label} + ${test.condition.padEnd(10)} ... `);

    const imageBuffer = fs.readFileSync(imagePath);
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: test.path.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    formData.set('labelImage', blob, path.basename(test.path));
    formData.set('applicationData', JSON.stringify({
      brandName: 'Old Tom Distillery',
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol. (90 Proof)',
      netContents: '750 mL',
      nameAddress: 'Old Tom Distillery, Louisville, Kentucky',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }));

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        console.log(`ERROR (HTTP ${response.status})`);
        results.push({ ...test, detected: 'ERROR', correct: false });
        continue;
      }

      const data = await response.json();
      const emphasis = data.extractedFields?.governmentWarningHeaderEmphasis;

      let detectedBold;
      if (emphasis === 'APPEARS_BOLD_OR_HEAVY') detectedBold = true;
      else if (emphasis === 'APPEARS_NORMAL_WEIGHT') detectedBold = false;
      else detectedBold = null;

      const correct = detectedBold === test.expectedBold;

      if (detectedBold === null) {
        console.log(`UNCERTAIN (${emphasis})`);
      } else if (correct) {
        console.log(`✅ ${emphasis}`);
      } else {
        console.log(`❌ ${emphasis} (expected ${test.expectedBold ? 'BOLD' : 'NOT_BOLD'})`);
      }

      results.push({
        type: test.expectedBold ? 'BOLD' : 'NON-BOLD',
        condition: test.condition,
        expected: test.expectedBold ? 'BOLD' : 'NOT_BOLD',
        detected: detectedBold === null ? 'UNCERTAIN' : (detectedBold ? 'BOLD' : 'NOT_BOLD'),
        raw: emphasis,
        correct: detectedBold === null ? 'UNCERTAIN' : correct
      });

    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({ ...test, detected: 'ERROR', correct: false });
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Summary by condition
  console.log('\n' + '='.repeat(70));
  console.log('RESULTS BY CONDITION');
  console.log('='.repeat(70));

  const conditions = ['clean', 'blur', 'lowlight', 'glare', 'angled', 'noise', 'combined'];

  console.log('\n| Condition  | Bold Test | Non-Bold Test | Both Correct |');
  console.log('|------------|-----------|---------------|--------------|');

  let totalCorrect = 0;
  let totalTests = 0;

  for (const cond of conditions) {
    const boldTest = results.find(r => r.type === 'BOLD' && r.condition === cond);
    const nonBoldTest = results.find(r => r.type === 'NON-BOLD' && r.condition === cond);

    const boldResult = boldTest?.correct === true ? '✅' : (boldTest?.correct === 'UNCERTAIN' ? '⚠️' : '❌');
    const nonBoldResult = nonBoldTest?.correct === true ? '✅' : (nonBoldTest?.correct === 'UNCERTAIN' ? '⚠️' : '❌');
    const bothCorrect = boldTest?.correct === true && nonBoldTest?.correct === true ? '✅' : '❌';

    console.log(`| ${cond.padEnd(10)} | ${boldResult.padEnd(9)} | ${nonBoldResult.padEnd(13)} | ${bothCorrect.padEnd(12)} |`);

    if (boldTest?.correct === true) totalCorrect++;
    if (nonBoldTest?.correct === true) totalCorrect++;
    totalTests += 2;
  }

  const accuracy = ((totalCorrect / totalTests) * 100).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log('OVERALL SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal tests: ${totalTests}`);
  console.log(`Correct: ${totalCorrect}`);
  console.log(`Accuracy: ${accuracy}%`);

  const uncertainCount = results.filter(r => r.correct === 'UNCERTAIN').length;
  const incorrectCount = results.filter(r => r.correct === false).length;

  console.log(`Uncertain: ${uncertainCount}`);
  console.log(`Incorrect: ${incorrectCount}`);

  console.log('\n' + '='.repeat(70));
  console.log('CONCLUSION');
  console.log('='.repeat(70));

  if (accuracy >= 90) {
    console.log(`\n✅ Bold detection is RELIABLE (${accuracy}% accuracy)`);
    console.log('→ Can trust AI detection, human review may not be necessary');
  } else if (accuracy >= 70) {
    console.log(`\n⚠️ Bold detection is PARTIALLY RELIABLE (${accuracy}% accuracy)`);
    console.log('→ Human review recommended for degraded images');
  } else {
    console.log(`\n❌ Bold detection is UNRELIABLE (${accuracy}% accuracy)`);
    console.log('→ Human-in-the-loop is REQUIRED');
  }

  // Show which conditions failed
  const failedConditions = [];
  for (const cond of conditions) {
    const boldTest = results.find(r => r.type === 'BOLD' && r.condition === cond);
    const nonBoldTest = results.find(r => r.type === 'NON-BOLD' && r.condition === cond);
    if (boldTest?.correct !== true || nonBoldTest?.correct !== true) {
      failedConditions.push(cond);
    }
  }

  if (failedConditions.length > 0) {
    console.log(`\nProblematic conditions: ${failedConditions.join(', ')}`);
  }
}

testBoldDetection().catch(console.error);
