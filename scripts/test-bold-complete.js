/**
 * Complete bold detection test - both bold AND non-bold samples
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/verify-gemini';

const TEST_IMAGES = [
  {
    path: 'automated/basic/label-perfect.png',
    expectedBold: true,
    description: 'Label with BOLD header (standard)'
  },
  {
    path: 'test-bold/label-NOT-bold.png',
    expectedBold: false,
    description: 'Label with NON-BOLD header (test case)'
  }
];

async function testBoldDetection() {
  console.log('='.repeat(60));
  console.log('EMPIRICAL TEST: Bold vs Non-Bold Detection');
  console.log('='.repeat(60));
  console.log('\nCan Gemini distinguish bold from non-bold text?\n');

  const { FormData, fetch } = await import('undici');
  const results = [];

  for (const test of TEST_IMAGES) {
    const imagePath = path.join(__dirname, '../src/test-data/sample-labels', test.path);

    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️  Skipping ${test.path} - file not found`);
      continue;
    }

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Testing: ${test.description}`);
    console.log(`File: ${test.path}`);
    console.log(`Expected: ${test.expectedBold ? 'BOLD' : 'NOT BOLD'}`);

    const imageBuffer = fs.readFileSync(imagePath);
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.set('labelImage', blob, path.basename(imagePath));
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
        console.log(`Error: HTTP ${response.status}`);
        results.push({ ...test, detected: 'ERROR', correct: false });
        continue;
      }

      const data = await response.json();
      const emphasis = data.extractedFields?.governmentWarningHeaderEmphasis;

      console.log(`\nGemini returned: ${emphasis}`);

      let detectedBold;
      if (emphasis === 'APPEARS_BOLD_OR_HEAVY') {
        detectedBold = true;
      } else if (emphasis === 'APPEARS_NORMAL_WEIGHT') {
        detectedBold = false;
      } else {
        detectedBold = null; // Uncertain
      }

      const correct = detectedBold === test.expectedBold;

      if (detectedBold === null) {
        console.log(`Result: ⚠️ UNCERTAIN`);
      } else if (correct) {
        console.log(`Result: ✅ CORRECT (detected ${detectedBold ? 'bold' : 'non-bold'})`);
      } else {
        console.log(`Result: ❌ WRONG (detected ${detectedBold ? 'bold' : 'non-bold'}, expected ${test.expectedBold ? 'bold' : 'non-bold'})`);
      }

      results.push({
        file: test.path,
        expected: test.expectedBold ? 'BOLD' : 'NOT_BOLD',
        detected: detectedBold === null ? 'UNCERTAIN' : (detectedBold ? 'BOLD' : 'NOT_BOLD'),
        correct: detectedBold === null ? 'UNCERTAIN' : correct,
        raw: emphasis
      });

    } catch (err) {
      console.error(`Error: ${err.message}`);
      results.push({ file: test.path, detected: 'ERROR', correct: false });
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));

  console.log('\n| File | Expected | Detected | Correct |');
  console.log('|------|----------|----------|---------|');
  for (const r of results) {
    console.log(`| ${path.basename(r.file)} | ${r.expected} | ${r.detected} | ${r.correct} |`);
  }

  const correct = results.filter(r => r.correct === true).length;
  const incorrect = results.filter(r => r.correct === false).length;
  const uncertain = results.filter(r => r.correct === 'UNCERTAIN').length;

  console.log(`\nCorrect: ${correct}/${results.length}`);
  console.log(`Incorrect: ${incorrect}/${results.length}`);
  console.log(`Uncertain: ${uncertain}/${results.length}`);

  console.log('\n' + '='.repeat(60));
  console.log('CONCLUSION');
  console.log('='.repeat(60));

  if (correct === results.length) {
    console.log('\n✅ Gemini correctly distinguished bold from non-bold in ALL cases.');
    console.log('→ Bold detection appears RELIABLE for these test cases.');
    console.log('→ Consider removing human-in-the-loop requirement for bold check.');
  } else if (incorrect > 0) {
    console.log(`\n❌ Gemini made ${incorrect} error(s) in bold detection.`);
    console.log('→ Bold detection is NOT fully reliable.');
    console.log('→ Human-in-the-loop is JUSTIFIED for this check.');
  } else {
    console.log('\n⚠️ Gemini returned UNCERTAIN for some cases.');
    console.log('→ Human review still needed when AI is uncertain.');
  }
}

testBoldDetection().catch(console.error);
