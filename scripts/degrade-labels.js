/**
 * Degrade real label images to simulate poor photography conditions
 *
 * Usage:
 *   node scripts/degrade-labels.js <input-image> [output-dir]
 *
 * Creates multiple versions:
 *   - *-blur.jpg      (out of focus)
 *   - *-lowlight.jpg  (dim lighting)
 *   - *-glare.jpg     (flash glare)
 *   - *-angled.jpg    (perspective distortion)
 *   - *-noise.jpg     (compression artifacts)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT_IMAGE = process.argv[2];
const OUTPUT_DIR = process.argv[3] || path.join(__dirname, '../src/test-data/sample-labels/degraded');

if (!INPUT_IMAGE) {
  console.log(`
Usage: node scripts/degrade-labels.js <input-image> [output-dir]

Example:
  node scripts/degrade-labels.js ./real-label.jpg
  node scripts/degrade-labels.js ./bourbon.png ./output/

This will create 5 degraded versions simulating:
  - Blur (out of focus camera)
  - Low light (dim bar/store lighting)
  - Glare (flash reflection)
  - Angle (tilted phone photo)
  - Noise (heavy JPEG compression)
`);
  process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const baseName = path.basename(INPUT_IMAGE, path.extname(INPUT_IMAGE));

async function degradeImage() {
  console.log(`Processing: ${INPUT_IMAGE}`);
  console.log(`Output dir: ${OUTPUT_DIR}\n`);

  const image = sharp(INPUT_IMAGE);
  const metadata = await image.metadata();

  // 1. BLUR - Gaussian blur to simulate out of focus
  console.log('Creating blur version...');
  await sharp(INPUT_IMAGE)
    .blur(3.5)
    .jpeg({ quality: 85 })
    .toFile(path.join(OUTPUT_DIR, `${baseName}-blur.jpg`));

  // 2. LOW LIGHT - Reduce brightness and increase contrast slightly
  console.log('Creating low light version...');
  await sharp(INPUT_IMAGE)
    .modulate({
      brightness: 0.5,  // Darken
      saturation: 0.8,  // Slightly desaturate
    })
    .gamma(1.8)  // Lift shadows slightly (simulates camera trying to compensate)
    .jpeg({ quality: 80 })
    .toFile(path.join(OUTPUT_DIR, `${baseName}-lowlight.jpg`));

  // 3. GLARE - Add a white gradient overlay
  console.log('Creating glare version...');
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // Create a glare overlay (white ellipse with transparency)
  const glareOverlay = Buffer.from(`
    <svg width="${width}" height="${height}">
      <defs>
        <radialGradient id="glare" cx="70%" cy="30%" r="50%">
          <stop offset="0%" style="stop-color:white;stop-opacity:0.7"/>
          <stop offset="100%" style="stop-color:white;stop-opacity:0"/>
        </radialGradient>
      </defs>
      <ellipse cx="${width * 0.7}" cy="${height * 0.3}" rx="${width * 0.4}" ry="${height * 0.3}" fill="url(#glare)"/>
    </svg>
  `);

  await sharp(INPUT_IMAGE)
    .composite([{ input: glareOverlay, blend: 'screen' }])
    .jpeg({ quality: 85 })
    .toFile(path.join(OUTPUT_DIR, `${baseName}-glare.jpg`));

  // 4. ANGLED - Slight rotation and crop (simulates tilted phone)
  console.log('Creating angled version...');
  await sharp(INPUT_IMAGE)
    .rotate(8, { background: { r: 0, g: 0, b: 0 } })
    .resize(Math.round(width * 0.95), Math.round(height * 0.95), { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toFile(path.join(OUTPUT_DIR, `${baseName}-angled.jpg`));

  // 5. NOISE - Heavy JPEG compression to add artifacts
  console.log('Creating noisy/compressed version...');
  await sharp(INPUT_IMAGE)
    .jpeg({ quality: 25 })  // Heavy compression = visible artifacts
    .toFile(path.join(OUTPUT_DIR, `${baseName}-noise.jpg`));

  // 6. COMBINED - Multiple issues at once (realistic bad photo)
  console.log('Creating combined degradation...');
  await sharp(INPUT_IMAGE)
    .blur(1.5)
    .modulate({ brightness: 0.7 })
    .rotate(5, { background: { r: 20, g: 20, b: 20 } })
    .jpeg({ quality: 50 })
    .toFile(path.join(OUTPUT_DIR, `${baseName}-combined.jpg`));

  console.log(`\nDone! Created 6 degraded versions in ${OUTPUT_DIR}`);
  console.log(`
Files created:
  ${baseName}-blur.jpg      - Out of focus
  ${baseName}-lowlight.jpg  - Dim lighting
  ${baseName}-glare.jpg     - Flash glare
  ${baseName}-angled.jpg    - Tilted angle
  ${baseName}-noise.jpg     - Compression artifacts
  ${baseName}-combined.jpg  - Multiple issues
`);
}

degradeImage().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
