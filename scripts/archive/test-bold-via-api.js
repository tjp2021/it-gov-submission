/**
 * Test bold detection through the running dev server API
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/verify-gemini';

const TEST_IMAGES = [
  {
    path: 'automated/basic/label-perfect.png',
    hasBoldHeader: true,
    description: 'Standard label with bold GOVERNMENT WARNING header'
  },
  {
    path: 'automated/basic/label-warning-titlecase.png',
    hasBoldHeader: true,
    description: 'Label with title case warning (still bold)'
  }
];

async function testBoldDetection() {
  console.log('='.repeat(60));
  console.log('EMPIRICAL TEST: Bold Text Detection via API');
  console.log('='.repeat(60));
  console.log('\nTesting what Gemini returns for governmentWarningHeaderEmphasis\n');

  const { FormData } = await import('undici');

  for (const test of TEST_IMAGES) {
    const imagePath = path.join(__dirname, '../src/test-data/sample-labels', test.path);

    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️  Skipping ${test.path} - file not found`);
      continue;
    }

    console.log(`\nTesting: ${test.description}`);
    console.log(`File: ${test.path}`);
    console.log(`Ground truth: ${test.hasBoldHeader ? 'BOLD' : 'NOT BOLD'}`);

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
      const { fetch } = await import('undici');
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        console.log(`Error: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Find the bold check result
      const boldResult = data.fieldResults?.find(f => f.fieldName === 'Gov Warning — Header Bold');
      const extractedEmphasis = data.extractedFields?.governmentWarningHeaderEmphasis;

      console.log(`\nExtracted emphasis: ${extractedEmphasis}`);
      console.log(`Bold check status: ${boldResult?.status}`);
      console.log(`Confidence: ${boldResult?.confidence}`);
      console.log(`Details: ${boldResult?.details}`);

      // Assess
      if (extractedEmphasis === 'APPEARS_BOLD_OR_HEAVY') {
        console.log(`\n✅ Gemini detected: BOLD`);
      } else if (extractedEmphasis === 'APPEARS_NORMAL_WEIGHT') {
        console.log(`\n❌ Gemini detected: NOT BOLD`);
      } else {
        console.log(`\n⚠️  Gemini detected: UNCERTAIN`);
      }

    } catch (err) {
      console.error(`Error: ${err.message}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS');
  console.log('='.repeat(60));
  console.log(`
The key question: Can Gemini reliably distinguish bold from non-bold?

To properly test this, we need:
1. Images with KNOWN bold text (our current labels)
2. Images with KNOWN non-bold text (need to create)

If Gemini returns APPEARS_BOLD_OR_HEAVY for bold text
AND APPEARS_NORMAL_WEIGHT for non-bold text consistently,
then bold detection IS reliable.

If it returns UNCERTAIN or wrong answers, then human review is required.
`);
}

testBoldDetection().catch(console.error);
