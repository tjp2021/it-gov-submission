/**
 * Bottle Photo Generator using Ideogram 3.0 Remix
 *
 * Takes clean label images and generates realistic bottle photos
 * while PRESERVING the exact text from the original label.
 *
 * Why Ideogram over DALL-E:
 * - DALL-E garbles text ("KENNTUCKKY", "455%")
 * - Ideogram Remix preserves text from reference image
 * - Strength parameter controls preservation (85 = high)
 * - See docs/TEST_IMAGE_GENERATION.md for full rationale
 *
 * Usage:
 *   node scripts/generate-bottle-photos.js                    # All labels
 *   node scripts/generate-bottle-photos.js --quick            # One scenario each
 *   node scripts/generate-bottle-photos.js <path-to-label>    # Specific label
 */

const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
}

const IDEOGRAM_API_KEY = process.env.IDEOGRAM_API_KEY;
const LABELS_DIR = path.join(__dirname, '../src/test-data/sample-labels/automated');
const OUTPUT_DIR = path.join(__dirname, '../src/test-data/sample-labels/real');

// Scenarios to generate for each label
const SCENARIOS = [
  {
    name: 'shelf',
    prompt: 'A realistic photograph of an alcohol bottle with this exact label, sitting on a wooden bar shelf. Warm ambient lighting, slight depth of field blur in background. Shot with phone camera, casual angle. The label text must be clearly visible and readable.',
    strength: 85
  },
  {
    name: 'store',
    prompt: 'A realistic photograph of an alcohol bottle with this exact label on a retail liquor store shelf. Fluorescent overhead lighting, price tags nearby. Shot with phone camera at eye level. Label facing camera, text clearly legible.',
    strength: 85
  },
  {
    name: 'angled',
    prompt: 'A realistic photograph of an alcohol bottle with this exact label, shot at a 30 degree angle on a counter. Some perspective distortion on the label. Indoor lighting. Phone camera quality. Label text still readable despite angle.',
    strength: 80
  },
  {
    name: 'lowlight',
    prompt: 'A realistic photograph of an alcohol bottle with this exact label in dim bar lighting. Slightly dark and grainy from phone camera in low light. Moody atmosphere. Label visible but challenging lighting conditions.',
    strength: 85
  },
  {
    name: 'glare',
    prompt: 'A realistic photograph of an alcohol bottle with this exact label with some light reflection/glare on the glass. Flash photography or bright light source. Label mostly visible with some glare interference.',
    strength: 80
  }
];

async function generateBottlePhoto(labelPath, scenario) {
  const labelName = path.basename(labelPath, path.extname(labelPath));
  const outputPath = path.join(OUTPUT_DIR, `${labelName}-${scenario.name}.png`);

  // Skip if already exists
  if (fs.existsSync(outputPath)) {
    console.log(`    ⏭️  Exists: ${path.basename(outputPath)}`);
    return { skipped: true, path: outputPath };
  }

  console.log(`    Generating ${scenario.name}...`);

  try {
    // Read the label image
    const imageBuffer = fs.readFileSync(labelPath);

    // Build multipart form data manually
    const boundary = '----IdeogramBoundary' + Date.now();
    const CRLF = '\r\n';

    // Determine mime type
    const ext = path.extname(labelPath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    // Build the multipart body
    let body = '';

    // Add image file
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="image"; filename="${path.basename(labelPath)}"${CRLF}`;
    body += `Content-Type: ${mimeType}${CRLF}${CRLF}`;

    // Add prompt
    const promptPart = `--${boundary}${CRLF}`;
    const promptHeader = `Content-Disposition: form-data; name="prompt"${CRLF}${CRLF}`;
    const promptValue = scenario.prompt + CRLF;

    // Add image_weight (controls preservation, 0-100, higher = more original preserved)
    const weightPart = `--${boundary}${CRLF}`;
    const weightHeader = `Content-Disposition: form-data; name="image_weight"${CRLF}${CRLF}`;
    const weightValue = scenario.strength.toString() + CRLF;

    // Add magic_prompt OFF
    const magicPart = `--${boundary}${CRLF}`;
    const magicHeader = `Content-Disposition: form-data; name="magic_prompt"${CRLF}${CRLF}`;
    const magicValue = 'OFF' + CRLF;

    // Add style_type
    const stylePart = `--${boundary}${CRLF}`;
    const styleHeader = `Content-Disposition: form-data; name="style_type"${CRLF}${CRLF}`;
    const styleValue = 'REALISTIC' + CRLF;

    const endBoundary = `--${boundary}--${CRLF}`;

    // Construct full body with binary image
    const textBefore = Buffer.from(body, 'utf-8');
    const textAfter = Buffer.from(
      CRLF + promptPart + promptHeader + promptValue +
      weightPart + weightHeader + weightValue +
      magicPart + magicHeader + magicValue +
      stylePart + styleHeader + styleValue +
      endBoundary,
      'utf-8'
    );

    const fullBody = Buffer.concat([textBefore, imageBuffer, textAfter]);

    // Call Ideogram Remix API (V3)
    const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/remix', {
      method: 'POST',
      headers: {
        'Api-Key': IDEOGRAM_API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: fullBody
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    const data = await response.json();

    if (!data.data || !data.data[0] || !data.data[0].url) {
      throw new Error('No image URL in response: ' + JSON.stringify(data));
    }

    // Download the generated image
    const imageUrl = data.data[0].url;
    const imageResponse = await fetch(imageUrl);
    const imageArrayBuffer = await imageResponse.arrayBuffer();

    fs.writeFileSync(outputPath, Buffer.from(imageArrayBuffer));
    console.log(`    ✓ Saved: ${path.basename(outputPath)}`);

    return { skipped: false, path: outputPath };

  } catch (error) {
    console.error(`    ✗ Failed: ${error.message}`);
    return { error: error.message };
  }
}

async function main() {
  if (!IDEOGRAM_API_KEY) {
    console.error('Error: IDEOGRAM_API_KEY not found in .env.local');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const args = process.argv.slice(2);
  const quickMode = args.includes('--quick');
  const specificLabel = args.find(a => !a.startsWith('--') && fs.existsSync(a));

  // Collect all label files
  let labelFiles = [];

  if (specificLabel) {
    labelFiles = [specificLabel];
  } else {
    // Get all labels from automated folders
    const folders = ['basic', 'intermediate', 'stress'];
    for (const folder of folders) {
      const folderPath = path.join(LABELS_DIR, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath)
          .filter(f => f.endsWith('.png'))
          .map(f => path.join(folderPath, f));
        labelFiles.push(...files);
      }
    }
  }

  // In quick mode, only use 'shelf' scenario
  const scenariosToUse = quickMode ? [SCENARIOS[0]] : SCENARIOS;

  console.log('='.repeat(60));
  console.log('IDEOGRAM BOTTLE PHOTO GENERATOR');
  console.log('='.repeat(60));
  console.log(`Mode: ${quickMode ? 'Quick (1 scenario)' : 'Full (5 scenarios)'}`);
  console.log(`Labels: ${labelFiles.length}`);
  console.log(`Scenarios: ${scenariosToUse.length}`);
  console.log(`Total images: ${labelFiles.length * scenariosToUse.length}`);
  console.log('');
  console.log('Ideogram Remix preserves text from original label');
  console.log('Strength: 80-85% (high preservation)');
  console.log('='.repeat(60) + '\n');

  let stats = { generated: 0, skipped: 0, failed: 0 };

  for (const labelPath of labelFiles) {
    const labelName = path.basename(labelPath);
    console.log(`\n📋 ${labelName}`);
    console.log('-'.repeat(40));

    for (const scenario of scenariosToUse) {
      const result = await generateBottlePhoto(labelPath, scenario);

      if (result.error) {
        stats.failed++;
      } else if (result.skipped) {
        stats.skipped++;
      } else {
        stats.generated++;
      }

      // Rate limit: wait between requests
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE');
  console.log('='.repeat(60));
  console.log(`Generated: ${stats.generated}`);
  console.log(`Skipped:   ${stats.skipped}`);
  console.log(`Failed:    ${stats.failed}`);
  console.log(`\nOutput: ${OUTPUT_DIR}`);
  console.log('\nText from original labels is preserved (Strength: 80-85%)');
}

main().catch(console.error);
