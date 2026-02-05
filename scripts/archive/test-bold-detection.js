/**
 * Empirical test: Can Gemini detect bold text in images?
 *
 * Creates controlled test cases with known bold vs non-bold text
 * and measures detection accuracy.
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// We'll use our existing test labels which have bold headers
// and create a direct test asking Gemini about bold detection

const TEST_IMAGES = [
  {
    path: 'automated/basic/label-perfect.png',
    hasBoldHeader: true,
    description: 'Standard label with bold GOVERNMENT WARNING header'
  },
  {
    path: 'automated/basic/label-warning-titlecase.png',
    hasBoldHeader: true, // Still bold, just not all caps
    description: 'Label with title case warning (still bold)'
  }
];

const BOLD_DETECTION_PROMPT = `Look at the government warning section on this alcohol label.

Specifically examine the text "GOVERNMENT WARNING" or "Government Warning" header.

Question: Is the warning header text rendered in a BOLD or HEAVY font weight compared to the body text of the warning?

Respond with ONLY one of these options:
- BOLD: The header is clearly bolder/heavier than the body text
- NOT_BOLD: The header has the same weight as the body text
- UNCERTAIN: Cannot determine from this image

Then briefly explain what visual cues you used to make this determination.`;

async function testBoldDetection() {
  console.log('='.repeat(60));
  console.log('EMPIRICAL TEST: Bold Text Detection Accuracy');
  console.log('='.repeat(60));
  console.log('\nQuestion: Can Gemini reliably detect if text is bold?\n');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const results = [];

  for (const test of TEST_IMAGES) {
    const imagePath = path.join(__dirname, '../src/test-data/sample-labels', test.path);

    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️  Skipping ${test.path} - file not found`);
      continue;
    }

    console.log(`\nTesting: ${test.description}`);
    console.log(`File: ${test.path}`);
    console.log(`Expected: ${test.hasBoldHeader ? 'BOLD' : 'NOT_BOLD'}`);

    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const mimeType = 'image/png';

    try {
      const result = await model.generateContent([
        { text: BOLD_DETECTION_PROMPT },
        { inlineData: { mimeType, data: base64 } }
      ]);

      const response = result.response.text();
      console.log(`\nGemini response:\n${response}\n`);

      // Parse result
      const isBold = response.toUpperCase().includes('BOLD:') && !response.toUpperCase().includes('NOT_BOLD');
      const isNotBold = response.toUpperCase().includes('NOT_BOLD');
      const isUncertain = response.toUpperCase().includes('UNCERTAIN');

      let detected;
      if (isUncertain) detected = 'UNCERTAIN';
      else if (isNotBold) detected = 'NOT_BOLD';
      else if (isBold) detected = 'BOLD';
      else detected = 'UNCLEAR_RESPONSE';

      const correct = (test.hasBoldHeader && detected === 'BOLD') ||
                     (!test.hasBoldHeader && detected === 'NOT_BOLD');

      results.push({
        file: test.path,
        expected: test.hasBoldHeader ? 'BOLD' : 'NOT_BOLD',
        detected,
        correct: detected === 'UNCERTAIN' ? 'N/A' : correct
      });

      console.log(`Detected: ${detected}`);
      console.log(`Correct: ${detected === 'UNCERTAIN' ? 'N/A (uncertain)' : (correct ? '✅' : '❌')}`);

    } catch (err) {
      console.error(`Error: ${err.message}`);
      results.push({
        file: test.path,
        expected: test.hasBoldHeader ? 'BOLD' : 'NOT_BOLD',
        detected: 'ERROR',
        correct: false
      });
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const total = results.length;
  const correct = results.filter(r => r.correct === true).length;
  const uncertain = results.filter(r => r.detected === 'UNCERTAIN').length;
  const incorrect = results.filter(r => r.correct === false).length;

  console.log(`Total tests: ${total}`);
  console.log(`Correct: ${correct}`);
  console.log(`Uncertain: ${uncertain}`);
  console.log(`Incorrect: ${incorrect}`);

  if (total - uncertain > 0) {
    const accuracy = (correct / (total - uncertain) * 100).toFixed(1);
    console.log(`\nAccuracy (excluding uncertain): ${accuracy}%`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('CONCLUSION');
  console.log('='.repeat(60));

  if (uncertain === total) {
    console.log('Gemini returned UNCERTAIN for all samples.');
    console.log('→ Bold detection is unreliable - human review required.');
  } else if (correct === total - uncertain) {
    console.log('Gemini correctly identified bold/non-bold in all decisive responses.');
    console.log('→ Bold detection may be viable - more testing recommended.');
  } else {
    console.log(`Gemini had ${incorrect} incorrect detection(s).`);
    console.log('→ Bold detection has measurable error rate - consider implications.');
  }
}

testBoldDetection().catch(console.error);
