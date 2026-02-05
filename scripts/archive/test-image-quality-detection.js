/**
 * Test: Can we programmatically detect image quality?
 *
 * Measures blur, brightness, contrast on our test images
 * and sees if it correlates with bold detection accuracy.
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

async function analyzeImage(imagePath) {
  const image = sharp(imagePath);
  const { data, info } = await image
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  const n = pixels.length;

  // 1. BRIGHTNESS - average pixel value (0-255, normalized to 0-1)
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += pixels[i];
  }
  const brightness = (sum / n) / 255;

  // 2. CONTRAST - standard deviation of pixel values (normalized)
  const mean = sum / n;
  let varianceSum = 0;
  for (let i = 0; i < n; i++) {
    varianceSum += Math.pow(pixels[i] - mean, 2);
  }
  const stdDev = Math.sqrt(varianceSum / n);
  const contrast = stdDev / 128; // Normalize to ~0-1 range

  // 3. BLUR - Laplacian variance (higher = sharper, lower = blurrier)
  // Simplified: measure local variance in a grid
  const width = info.width;
  const height = info.height;
  let laplacianSum = 0;
  let laplacianCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Laplacian kernel: center*4 - top - bottom - left - right
      const laplacian = 4 * pixels[idx]
        - pixels[idx - width]
        - pixels[idx + width]
        - pixels[idx - 1]
        - pixels[idx + 1];
      laplacianSum += laplacian * laplacian;
      laplacianCount++;
    }
  }
  const sharpness = Math.sqrt(laplacianSum / laplacianCount) / 255; // Normalize

  return { brightness, contrast, sharpness };
}

async function runTest() {
  console.log('='.repeat(70));
  console.log('IMAGE QUALITY DETECTION TEST');
  console.log('Can we programmatically identify bad quality images?');
  console.log('='.repeat(70));

  const results = [];

  console.log('\n| Condition  | Brightness | Contrast | Sharpness | Bold Accurate |');
  console.log('|------------|------------|----------|-----------|---------------|');

  for (const test of TEST_IMAGES) {
    const imagePath = path.join(__dirname, '../src/test-data/sample-labels', test.path);

    if (!fs.existsSync(imagePath)) {
      console.log(`Skipping ${test.condition} - file not found`);
      continue;
    }

    const metrics = await analyzeImage(imagePath);

    console.log(`| ${test.condition.padEnd(10)} | ${metrics.brightness.toFixed(3).padEnd(10)} | ${metrics.contrast.toFixed(3).padEnd(8)} | ${metrics.sharpness.toFixed(3).padEnd(9)} | ${test.boldAccurate ? '✅ Yes' : '❌ No'}`.padEnd(13) + ' |');

    results.push({
      condition: test.condition,
      ...metrics,
      boldAccurate: test.boldAccurate
    });
  }

  // Find thresholds that separate good from bad
  console.log('\n' + '='.repeat(70));
  console.log('ANALYSIS');
  console.log('='.repeat(70));

  const good = results.filter(r => r.boldAccurate);
  const bad = results.filter(r => !r.boldAccurate);

  console.log('\nGood quality images (bold detection worked):');
  console.log(`  Brightness: ${good.map(r => r.brightness.toFixed(3)).join(', ')}`);
  console.log(`  Contrast:   ${good.map(r => r.contrast.toFixed(3)).join(', ')}`);
  console.log(`  Sharpness:  ${good.map(r => r.sharpness.toFixed(3)).join(', ')}`);

  console.log('\nBad quality images (bold detection failed):');
  console.log(`  Brightness: ${bad.map(r => r.brightness.toFixed(3)).join(', ')}`);
  console.log(`  Contrast:   ${bad.map(r => r.contrast.toFixed(3)).join(', ')}`);
  console.log(`  Sharpness:  ${bad.map(r => r.sharpness.toFixed(3)).join(', ')}`);

  // Calculate ranges
  const goodSharpnessMin = Math.min(...good.map(r => r.sharpness));
  const badSharpnessMax = Math.max(...bad.map(r => r.sharpness));

  const goodBrightnessRange = [Math.min(...good.map(r => r.brightness)), Math.max(...good.map(r => r.brightness))];
  const badBrightnessRange = [Math.min(...bad.map(r => r.brightness)), Math.max(...bad.map(r => r.brightness))];

  console.log('\n' + '='.repeat(70));
  console.log('THRESHOLD ANALYSIS');
  console.log('='.repeat(70));

  console.log(`\nSharpness:`);
  console.log(`  Good images min: ${goodSharpnessMin.toFixed(3)}`);
  console.log(`  Bad images max:  ${badSharpnessMax.toFixed(3)}`);
  if (goodSharpnessMin > badSharpnessMax) {
    console.log(`  ✅ SEPARABLE! Threshold: ${((goodSharpnessMin + badSharpnessMax) / 2).toFixed(3)}`);
  } else {
    console.log(`  ❌ NOT cleanly separable by sharpness alone`);
  }

  console.log(`\nBrightness:`);
  console.log(`  Good images: ${goodBrightnessRange[0].toFixed(3)} - ${goodBrightnessRange[1].toFixed(3)}`);
  console.log(`  Bad images:  ${badBrightnessRange[0].toFixed(3)} - ${badBrightnessRange[1].toFixed(3)}`);

  // Test if we can create a classifier
  console.log('\n' + '='.repeat(70));
  console.log('CLASSIFIER TEST');
  console.log('='.repeat(70));

  // Try different threshold combinations
  const thresholds = [
    { name: 'sharpness > 0.15', fn: (r) => r.sharpness > 0.15 },
    { name: 'sharpness > 0.10', fn: (r) => r.sharpness > 0.10 },
    { name: 'brightness 0.3-0.8', fn: (r) => r.brightness > 0.3 && r.brightness < 0.8 },
    { name: 'contrast > 0.3', fn: (r) => r.contrast > 0.3 },
    { name: 'sharpness > 0.10 AND brightness 0.3-0.8', fn: (r) => r.sharpness > 0.10 && r.brightness > 0.3 && r.brightness < 0.8 },
  ];

  console.log('\n| Rule | Accuracy | Details |');
  console.log('|------|----------|---------|');

  for (const t of thresholds) {
    let correct = 0;
    let details = [];
    for (const r of results) {
      const predictGood = t.fn(r);
      const actualGood = r.boldAccurate;
      if (predictGood === actualGood) {
        correct++;
      } else {
        details.push(`${r.condition}:${predictGood ? 'FP' : 'FN'}`);
      }
    }
    const accuracy = ((correct / results.length) * 100).toFixed(0);
    console.log(`| ${t.name.padEnd(40)} | ${accuracy.padEnd(8)}% | ${details.join(', ') || 'Perfect'} |`);
  }
}

runTest().catch(console.error);
