/**
 * Label Compositing Script
 *
 * Composites our clean label images onto a blank bottle template.
 * This preserves EXACT text (unlike AI generation) while creating
 * realistic bottle photos.
 *
 * Usage:
 *   node scripts/composite-labels.js                    # All labels
 *   node scripts/composite-labels.js <label-path>       # Specific label
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BOTTLE_TEMPLATE = path.join(__dirname, '../src/test-data/sample-labels/bottle-template.png');
const LABELS_DIR = path.join(__dirname, '../src/test-data/sample-labels/automated');
const OUTPUT_DIR = path.join(__dirname, '../src/test-data/sample-labels/real');

// Label placement configuration (adjust based on bottle template)
const LABEL_CONFIG = {
  x: 362,      // Center horizontally on 1024px image
  y: 280,      // Position in middle of bottle
  width: 300,  // Label width on bottle
  height: 380, // Label height on bottle
};

// Different scenarios with post-processing effects
const SCENARIOS = [
  { name: 'clean', description: 'Clean studio shot', effects: null },
  { name: 'bright', description: 'Bright lighting', effects: { brightness: 1.15 } },
  { name: 'dim', description: 'Dim lighting', effects: { brightness: 0.7 } },
  { name: 'warm', description: 'Warm color temperature', effects: { modulate: { saturation: 1.2 } } }
];

async function compositeLabel(labelPath, scenario) {
  const labelName = path.basename(labelPath, path.extname(labelPath));
  const outputPath = path.join(OUTPUT_DIR, `${labelName}-${scenario.name}.png`);

  if (fs.existsSync(outputPath)) {
    console.log(`    ⏭️  Exists: ${path.basename(outputPath)}`);
    return { skipped: true };
  }

  console.log(`    Compositing ${scenario.name}...`);

  try {
    // Load and resize the label to fit bottle
    const labelBuffer = await sharp(labelPath)
      .resize(LABEL_CONFIG.width, LABEL_CONFIG.height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toBuffer();

    // Load bottle template and composite the label
    let pipeline = sharp(BOTTLE_TEMPLATE)
      .composite([{
        input: labelBuffer,
        left: LABEL_CONFIG.x,
        top: LABEL_CONFIG.y,
        blend: 'over'
      }]);

    // Apply lighting effects
    if (scenario.effects?.brightness) {
      pipeline = pipeline.modulate({ brightness: scenario.effects.brightness });
    }
    if (scenario.effects?.modulate) {
      pipeline = pipeline.modulate(scenario.effects.modulate);
    }

    await pipeline.png().toFile(outputPath);
    console.log(`    ✓ Saved: ${path.basename(outputPath)}`);
    return { success: true };

  } catch (error) {
    console.error(`    ✗ Failed: ${error.message}`);
    return { error: error.message };
  }
}

async function main() {
  if (!fs.existsSync(BOTTLE_TEMPLATE)) {
    console.error('Error: Bottle template not found at', BOTTLE_TEMPLATE);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const args = process.argv.slice(2);
  const specificLabel = args.find(a => fs.existsSync(a));

  let labelFiles = [];
  if (specificLabel) {
    labelFiles = [specificLabel];
  } else {
    for (const folder of ['basic', 'intermediate', 'stress']) {
      const folderPath = path.join(LABELS_DIR, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath)
          .filter(f => f.endsWith('.png'))
          .map(f => path.join(folderPath, f));
        labelFiles.push(...files);
      }
    }
  }

  console.log('='.repeat(60));
  console.log('LABEL COMPOSITING (100% TEXT PRESERVATION)');
  console.log('='.repeat(60));
  console.log(`Labels: ${labelFiles.length}`);
  console.log(`Scenarios: ${SCENARIOS.length}`);
  console.log(`Total images: ${labelFiles.length * SCENARIOS.length}`);
  console.log('='.repeat(60) + '\n');

  let stats = { generated: 0, skipped: 0, failed: 0 };

  for (const labelPath of labelFiles) {
    console.log(`\n📋 ${path.basename(labelPath)}`);
    console.log('-'.repeat(40));

    for (const scenario of SCENARIOS) {
      const result = await compositeLabel(labelPath, scenario);
      if (result.error) stats.failed++;
      else if (result.skipped) stats.skipped++;
      else stats.generated++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE');
  console.log('='.repeat(60));
  console.log(`Generated: ${stats.generated}`);
  console.log(`Skipped:   ${stats.skipped}`);
  console.log(`Failed:    ${stats.failed}`);
  console.log(`\nOutput: ${OUTPUT_DIR}`);
  console.log('\nText from original labels is 100% PRESERVED');
}

main().catch(console.error);
