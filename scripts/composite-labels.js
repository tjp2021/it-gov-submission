/**
 * Composite HTML-generated labels onto bottle templates
 *
 * Creates realistic test images with:
 * - Exact text control (from our HTML labels)
 * - Realistic bottle context
 * - Controllable degradation effects
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEST_DATA_DIR = path.join(__dirname, '../src/test-data');
const TEMPLATES_DIR = path.join(TEST_DATA_DIR, 'bottle-templates');
const LABELS_DIR = path.join(TEST_DATA_DIR, 'sample-labels');
const OUTPUT_DIR = path.join(TEST_DATA_DIR, 'sample-labels');

// Bottle types to generate templates for
const BOTTLE_TYPES = [
  {
    id: 'wine',
    prompt: 'Product photography of an empty wine bottle with no label, just dark glass, on a neutral background. Clean studio shot, front facing. Space for label visible.',
    labelPosition: { x: 120, y: 280, width: 280, height: 350 }
  },
  {
    id: 'whiskey',
    prompt: 'Product photography of an empty bourbon whiskey bottle with no label, amber/brown glass, on wooden surface. Clean shot, front facing. Rectangular body shape.',
    labelPosition: { x: 100, y: 250, width: 320, height: 400 }
  },
  {
    id: 'beer',
    prompt: 'Product photography of an empty brown glass beer bottle with no label, on bar counter. Clean shot, front facing. Standard 12oz bottle shape.',
    labelPosition: { x: 140, y: 220, width: 240, height: 320 }
  },
  {
    id: 'vodka',
    prompt: 'Product photography of an empty clear glass vodka bottle with no label, on reflective surface. Clean studio shot, front facing. Tall slim bottle.',
    labelPosition: { x: 130, y: 200, width: 260, height: 400 }
  }
];

// Effects to apply for challenging conditions
const EFFECTS = {
  none: async (img) => img,

  blur: async (img) => img.blur(1.5),

  lowContrast: async (img) => img.modulate({ brightness: 0.8, saturation: 0.7 }),

  highContrast: async (img) => img.modulate({ brightness: 1.1 }).sharpen(),

  warm: async (img) => img.tint({ r: 255, g: 240, b: 220 }),

  noise: async (img) => {
    // Add slight noise by reducing quality
    return img.jpeg({ quality: 60 }).png();
  }
};

// Labels to composite (map to bottle types)
const COMPOSITE_SCENARIOS = [
  {
    id: 'C1-wine-blur',
    sourceLabel: 'label-wrong-abv.png', // Reuse existing wine label
    bottleType: 'wine',
    effect: 'blur',
    description: 'Wine label with slight blur (focus issues)',
    expectedResult: 'FAIL', // ABV still wrong
    expectedReason: 'ABV mismatch should be detected despite blur',
    applicationData: {
      brandName: 'Chateau Margaux',
      classType: 'Cabernet Sauvignon',
      alcoholContent: '13.5% Alc./Vol.',
      netContents: '750 mL',
      nameAddress: 'Chateau Margaux Winery, Napa, California',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }
  },
  {
    id: 'C2-whiskey-lowlight',
    sourceLabel: 'label-perfect.png',
    bottleType: 'whiskey',
    effect: 'lowContrast',
    description: 'Bourbon label in dim lighting conditions',
    expectedResult: 'PASS',
    expectedReason: 'All fields should match despite low contrast',
    applicationData: {
      brandName: 'Old Tom Distillery',
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol. (90 Proof)',
      netContents: '750 mL',
      nameAddress: 'Old Tom Distillery, Louisville, Kentucky',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }
  },
  {
    id: 'C3-beer-warm',
    sourceLabel: 'label-warning-titlecase.png',
    bottleType: 'beer',
    effect: 'warm',
    description: 'Beer label under warm lighting',
    expectedResult: 'FAIL',
    expectedReason: 'Warning header format violation should be detected',
    applicationData: {
      brandName: 'HopMaster',
      classType: 'India Pale Ale',
      alcoholContent: '6.5%',
      netContents: '12 FL. OZ.',
      nameAddress: 'HopMaster Brewing Co., Portland, Oregon',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }
  },
  {
    id: 'C4-vodka-noise',
    sourceLabel: 'label-no-warning.png',
    bottleType: 'vodka',
    effect: 'noise',
    description: 'Vodka label with compression artifacts',
    expectedResult: 'FAIL',
    expectedReason: 'Missing government warning should be detected',
    applicationData: {
      brandName: 'Blue Fjord',
      classType: 'Premium Vodka',
      alcoholContent: '40% Alc./Vol.',
      netContents: '750 mL',
      nameAddress: 'Nordic Spirits, Inc., Minneapolis, Minnesota',
      countryOfOrigin: 'USA',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }
  }
];

async function generateBottleTemplate(bottleType) {
  if (!OPENAI_API_KEY) {
    console.log(`  ⚠️  No API key - creating placeholder for ${bottleType.id}`);
    return createPlaceholderBottle(bottleType);
  }

  const templatePath = path.join(TEMPLATES_DIR, `bottle-${bottleType.id}.png`);

  // Skip if already exists
  if (fs.existsSync(templatePath)) {
    console.log(`  ✓ Template exists: bottle-${bottleType.id}.png`);
    return templatePath;
  }

  console.log(`  🎨 Generating: bottle-${bottleType.id}.png`);

  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'dall-e-3',
      prompt: bottleType.prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json'
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(response.error.message));
            return;
          }
          const buffer = Buffer.from(response.data[0].b64_json, 'base64');
          fs.writeFileSync(templatePath, buffer);
          console.log(`     Saved: bottle-${bottleType.id}.png`);
          resolve(templatePath);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

async function createPlaceholderBottle(bottleType) {
  const templatePath = path.join(TEMPLATES_DIR, `bottle-${bottleType.id}.png`);

  // Create a simple gradient placeholder
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bottle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4a3728"/>
          <stop offset="100%" style="stop-color:#2a1f18"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="#1a1a1a"/>
      <rect x="156" y="80" width="200" height="400" rx="20" fill="url(#bottle)"/>
      <rect x="196" y="20" width="120" height="80" rx="10" fill="#2a1f18"/>
      <text x="256" y="500" text-anchor="middle" fill="#666" font-size="14">${bottleType.id} template</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .resize(512, 512)
    .png()
    .toFile(templatePath);

  console.log(`     Created placeholder: bottle-${bottleType.id}.png`);
  return templatePath;
}

async function compositeLabel(scenario) {
  const bottleType = BOTTLE_TYPES.find(b => b.id === scenario.bottleType);
  if (!bottleType) {
    throw new Error(`Unknown bottle type: ${scenario.bottleType}`);
  }

  const templatePath = path.join(TEMPLATES_DIR, `bottle-${bottleType.id}.png`);
  const labelPath = path.join(LABELS_DIR, scenario.sourceLabel);
  const outputPath = path.join(OUTPUT_DIR, `label-${scenario.id.toLowerCase()}.png`);

  if (!fs.existsSync(labelPath)) {
    throw new Error(`Source label not found: ${scenario.sourceLabel}`);
  }

  // Load and resize label to fit bottle
  const { width, height } = bottleType.labelPosition;
  const labelBuffer = await sharp(labelPath)
    .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();

  // Composite onto bottle
  let composite = sharp(templatePath)
    .composite([{
      input: labelBuffer,
      left: bottleType.labelPosition.x,
      top: bottleType.labelPosition.y
    }]);

  // Apply effect
  const effect = EFFECTS[scenario.effect] || EFFECTS.none;
  composite = await effect(composite);

  // Save
  await composite.png().toFile(outputPath);
  console.log(`  ✓ Created: label-${scenario.id.toLowerCase()}.png`);

  return outputPath;
}

async function updateApplicationsJson() {
  const applicationsPath = path.join(TEST_DATA_DIR, 'sample-applications.json');
  const applications = JSON.parse(fs.readFileSync(applicationsPath, 'utf-8'));

  // Add Group 4 metadata
  applications.groups.composite = {
    name: 'Group 4: Composite (Controlled Real-world)',
    description: 'HTML labels composited onto bottle templates with effects'
  };

  // Add scenarios
  for (const scenario of COMPOSITE_SCENARIOS) {
    const exists = applications.labels.some(l => l.id === scenario.id);
    if (!exists) {
      applications.labels.push({
        id: scenario.id,
        group: 'composite',
        description: scenario.description,
        htmlFile: `labels/label-${scenario.id.toLowerCase()}.png`,
        expectedResult: scenario.expectedResult,
        expectedReason: scenario.expectedReason,
        applicationData: scenario.applicationData
      });
    }
  }

  fs.writeFileSync(applicationsPath, JSON.stringify(applications, null, 2));
}

async function main() {
  console.log('🍾 Composite Label Generator\n');
  console.log('='.repeat(60));

  // Ensure directories exist
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }

  // Step 1: Generate bottle templates
  console.log('\n📦 Step 1: Generating bottle templates...\n');
  for (const bottleType of BOTTLE_TYPES) {
    try {
      await generateBottleTemplate(bottleType);
      // Rate limiting for DALL-E
      if (OPENAI_API_KEY) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error(`  ❌ Failed to generate ${bottleType.id}: ${error.message}`);
    }
  }

  // Step 2: Composite labels onto bottles
  console.log('\n🏷️  Step 2: Compositing labels onto bottles...\n');
  for (const scenario of COMPOSITE_SCENARIOS) {
    try {
      await compositeLabel(scenario);
    } catch (error) {
      console.error(`  ❌ Failed ${scenario.id}: ${error.message}`);
    }
  }

  // Step 3: Update sample-applications.json
  console.log('\n📝 Step 3: Updating test scenarios...\n');
  await updateApplicationsJson();
  console.log('  ✓ Updated sample-applications.json');

  console.log('\n' + '='.repeat(60));
  console.log('\n🐸 Done! Run `npm test composite` to test Group 4.\n');
}

main().catch(console.error);
