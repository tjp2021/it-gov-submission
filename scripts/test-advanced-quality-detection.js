/**
 * Advanced image quality detection tests
 *
 * Test 1: Local contrast analysis on warning region
 * Test 2: Ask Gemini directly about image quality
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const TEST_IMAGES = [
  { path: 'automated/basic/label-perfect.png', condition: 'clean', boldAccurate: true },
  { path: 'test-bold/bold-degraded/label-perfect-blur.jpg', condition: 'blur', boldAccurate: false },
  { path: 'test-bold/bold-degraded/label-perfect-lowlight.jpg', condition: 'lowlight', boldAccurate: false },
  { path: 'test-bold/bold-degraded/label-perfect-glare.jpg', condition: 'glare', boldAccurate: false },
  { path: 'test-bold/bold-degraded/label-perfect-angled.jpg', condition: 'angled', boldAccurate: false },
  { path: 'test-bold/bold-degraded/label-perfect-noise.jpg', condition: 'noise', boldAccurate: true },
  { path: 'test-bold/bold-degraded/label-perfect-combined.jpg', condition: 'combined', boldAccurate: false },
];

// ============================================
// TEST 1: Local contrast on warning region
// ============================================

async function analyzeLocalContrast(imagePath) {
  const image = sharp(imagePath);
  const metadata = await image.metadata();

  // Warning is typically in bottom 30% of label
  const warningRegion = {
    left: 0,
    top: Math.floor(metadata.height * 0.7),
    width: metadata.width,
    height: Math.floor(metadata.height * 0.3)
  };

  const { data } = await image
    .extract(warningRegion)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  const n = pixels.length;

  // Calculate local variance in small blocks
  const blockSize = 10;
  const width = warningRegion.width;
  const height = warningRegion.height;

  let variances = [];

  for (let by = 0; by < height - blockSize; by += blockSize) {
    for (let bx = 0; bx < width - blockSize; bx += blockSize) {
      let blockPixels = [];
      for (let y = by; y < by + blockSize; y++) {
        for (let x = bx; x < bx + blockSize; x++) {
          blockPixels.push(pixels[y * width + x]);
        }
      }

      const mean = blockPixels.reduce((a, b) => a + b, 0) / blockPixels.length;
      const variance = blockPixels.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / blockPixels.length;
      variances.push(variance);
    }
  }

  // Metrics
  const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
  const minVariance = Math.min(...variances);
  const maxVariance = Math.max(...variances);

  // Check for washed out regions (very low variance = glare)
  const lowVarianceBlocks = variances.filter(v => v < 100).length;
  const lowVarianceRatio = lowVarianceBlocks / variances.length;

  // Overall brightness in warning region
  const brightness = pixels.reduce((a, b) => a + b, 0) / n / 255;

  return {
    avgVariance: avgVariance / 1000, // Normalize
    minVariance: minVariance / 1000,
    lowVarianceRatio,
    brightness
  };
}

// ============================================
// TEST 2: Ask Gemini about image quality
// ============================================

async function askGeminiAboutQuality(imagePath) {
  const { FormData, fetch } = await import('undici');

  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  // Direct API call to Gemini
  const API_KEY = process.env.GEMINI_API_KEY;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Analyze this alcohol label image for quality issues.

Rate EACH of the following from 1-10 (10 = no issues, 1 = severe issues):
- BLUR: Is the image in focus? (10 = perfectly sharp, 1 = very blurry)
- LIGHTING: Is the lighting good? (10 = well lit, 1 = too dark or too bright)
- GLARE: Is there glare or reflection? (10 = no glare, 1 = severe glare)
- ANGLE: Is the image straight? (10 = straight on, 1 = extreme angle)

Then give an OVERALL quality score from 1-10.

Respond in EXACTLY this format:
BLUR: [score]
LIGHTING: [score]
GLARE: [score]
ANGLE: [score]
OVERALL: [score]
CONFIDENCE: [HIGH/MEDIUM/LOW]`
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64
              }
            }
          ]
        }]
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse scores
  const scores = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/^(BLUR|LIGHTING|GLARE|ANGLE|OVERALL):\s*(\d+)/i);
    if (match) {
      scores[match[1].toLowerCase()] = parseInt(match[2]);
    }
    const confMatch = line.match(/^CONFIDENCE:\s*(HIGH|MEDIUM|LOW)/i);
    if (confMatch) {
      scores.confidence = confMatch[1].toUpperCase();
    }
  }

  return { scores, rawResponse: text };
}

// ============================================
// MAIN TEST
// ============================================

async function runTests() {
  // Load env manually
  const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }

  console.log('='.repeat(70));
  console.log('ADVANCED IMAGE QUALITY DETECTION TESTS');
  console.log('='.repeat(70));

  // TEST 1: Local contrast
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 1: Local Contrast Analysis (Warning Region)');
  console.log('─'.repeat(70));

  console.log('\n| Condition  | AvgVar | LowVarRatio | Brightness | Bold OK |');
  console.log('|------------|--------|-------------|------------|---------|');

  const localResults = [];

  for (const test of TEST_IMAGES) {
    const imagePath = path.join(__dirname, '../src/test-data/sample-labels', test.path);
    if (!fs.existsSync(imagePath)) continue;

    const metrics = await analyzeLocalContrast(imagePath);
    console.log(`| ${test.condition.padEnd(10)} | ${metrics.avgVariance.toFixed(3).padEnd(6)} | ${metrics.lowVarianceRatio.toFixed(3).padEnd(11)} | ${metrics.brightness.toFixed(3).padEnd(10)} | ${test.boldAccurate ? '✅' : '❌'}`.padEnd(7) + ' |');

    localResults.push({ ...test, ...metrics });
  }

  // Analyze local contrast results
  const goodLocal = localResults.filter(r => r.boldAccurate);
  const badLocal = localResults.filter(r => !r.boldAccurate);

  console.log('\nGood images - lowVarianceRatio:', goodLocal.map(r => r.lowVarianceRatio.toFixed(3)).join(', '));
  console.log('Bad images - lowVarianceRatio:', badLocal.map(r => r.lowVarianceRatio.toFixed(3)).join(', '));

  // Test threshold for local contrast
  const thresholds = [0.3, 0.4, 0.5, 0.6];
  console.log('\n| Threshold (lowVarRatio <) | Accuracy |');
  console.log('|---------------------------|----------|');

  for (const t of thresholds) {
    let correct = 0;
    for (const r of localResults) {
      const predictGood = r.lowVarianceRatio < t;
      if (predictGood === r.boldAccurate) correct++;
    }
    console.log(`| ${t.toFixed(1).padEnd(25)} | ${((correct/localResults.length)*100).toFixed(0)}%`.padEnd(8) + ' |');
  }

  // TEST 2: Gemini self-assessment
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 2: Gemini Self-Assessment of Image Quality');
  console.log('─'.repeat(70));

  console.log('\n| Condition  | Blur | Light | Glare | Angle | Overall | Bold OK |');
  console.log('|------------|------|-------|-------|-------|---------|---------|');

  const geminiResults = [];

  for (const test of TEST_IMAGES) {
    const imagePath = path.join(__dirname, '../src/test-data/sample-labels', test.path);
    if (!fs.existsSync(imagePath)) continue;

    try {
      const { scores } = await askGeminiAboutQuality(imagePath);

      console.log(`| ${test.condition.padEnd(10)} | ${String(scores.blur || '?').padEnd(4)} | ${String(scores.lighting || '?').padEnd(5)} | ${String(scores.glare || '?').padEnd(5)} | ${String(scores.angle || '?').padEnd(5)} | ${String(scores.overall || '?').padEnd(7)} | ${test.boldAccurate ? '✅' : '❌'}`.padEnd(7) + ' |');

      geminiResults.push({ ...test, ...scores });
    } catch (err) {
      console.log(`| ${test.condition.padEnd(10)} | ERROR: ${err.message.slice(0, 40)} |`);
    }

    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }

  // Analyze Gemini results
  if (geminiResults.length > 0) {
    console.log('\n| Threshold (overall >=) | Accuracy |');
    console.log('|------------------------|----------|');

    for (const t of [6, 7, 8, 9]) {
      let correct = 0;
      for (const r of geminiResults) {
        const predictGood = (r.overall || 0) >= t;
        if (predictGood === r.boldAccurate) correct++;
      }
      console.log(`| ${String(t).padEnd(22)} | ${((correct/geminiResults.length)*100).toFixed(0)}%`.padEnd(8) + ' |');
    }

    // Try glare-specific threshold
    console.log('\n| Threshold (glare >=) | Accuracy |');
    console.log('|----------------------|----------|');

    for (const t of [6, 7, 8, 9]) {
      let correct = 0;
      for (const r of geminiResults) {
        const predictGood = (r.glare || 0) >= t;
        if (predictGood === r.boldAccurate) correct++;
      }
      console.log(`| ${String(t).padEnd(20)} | ${((correct/geminiResults.length)*100).toFixed(0)}%`.padEnd(8) + ' |');
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('CONCLUSION');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
