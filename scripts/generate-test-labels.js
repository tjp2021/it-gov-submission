/**
 * Generate synthetic test label images using DALL-E
 *
 * Creates challenging real-world condition images for testing:
 * - Glare and reflections
 * - Angled/perspective shots
 * - Low contrast/poor lighting
 * - Blurry/out of focus
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OUTPUT_DIR = path.join(__dirname, '../src/test-data/sample-labels');

// Test scenarios for Group 3: Advanced (Real-world Conditions)
const SCENARIOS = [
  {
    id: 'A1-glare',
    description: 'Wine label with glare/reflection from flash photography',
    prompt: 'Close-up photograph of a wine bottle label with visible glare and light reflection from camera flash. The label shows "CHATEAU LUMIERE" as the brand name, "Cabernet Sauvignon" as the wine type, "13.5% ALC./VOL." and "750 mL". The glare partially obscures some text. Realistic product photography style.',
    expectedResult: 'REVIEW',
    expectedReason: 'Glare may obscure some fields, requiring manual verification',
    applicationData: {
      brandName: 'Chateau Lumiere',
      classType: 'Cabernet Sauvignon',
      alcoholContent: '13.5% Alc./Vol.',
      netContents: '750 mL',
      nameAddress: 'Chateau Lumiere Winery, Sonoma, California',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }
  },
  {
    id: 'A2-angled',
    description: 'Whiskey label photographed at 45-degree angle',
    prompt: 'Photograph of a bourbon whiskey bottle label taken at a 45-degree angle, showing perspective distortion. The label clearly shows "GOLDEN OAK" brand name, "Kentucky Straight Bourbon Whiskey", "90 PROOF", and "750 mL". Shot on wooden bar surface. Realistic photography.',
    expectedResult: 'PASS',
    expectedReason: 'Claude Vision should handle moderate perspective distortion',
    applicationData: {
      brandName: 'Golden Oak',
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL',
      nameAddress: 'Golden Oak Distillery, Bardstown, Kentucky',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }
  },
  {
    id: 'A3-lowlight',
    description: 'Beer label in dim bar lighting',
    prompt: 'Photograph of a craft beer bottle label in dim, warm bar lighting conditions. Low contrast image. The label shows "MIDNIGHT BREWING" brand, "Imperial Stout" style, "9.5% ABV", and "12 FL OZ". Moody atmosphere, slight underexposure. Realistic bar photography.',
    expectedResult: 'REVIEW',
    expectedReason: 'Low contrast may affect text extraction accuracy',
    applicationData: {
      brandName: 'Midnight Brewing',
      classType: 'Imperial Stout',
      alcoholContent: '9.5%',
      netContents: '12 FL. OZ.',
      nameAddress: 'Midnight Brewing Company, Denver, Colorado',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }
  },
  {
    id: 'A4-blurry',
    description: 'Slightly out of focus vodka label',
    prompt: 'Slightly blurry, out of focus photograph of a vodka bottle label. Mild motion blur or focus issues. The label shows "CRYSTAL PEAK" brand name, "PREMIUM VODKA", "40% ALC./VOL.", and "750 mL". The text is readable but not sharp. Realistic amateur photography.',
    expectedResult: 'REVIEW',
    expectedReason: 'Blur may reduce OCR confidence',
    applicationData: {
      brandName: 'Crystal Peak',
      classType: 'Premium Vodka',
      alcoholContent: '40% Alc./Vol.',
      netContents: '750 mL',
      nameAddress: 'Crystal Peak Spirits, Minneapolis, Minnesota',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }
  },
  {
    id: 'A5-partial',
    description: 'Gin label partially covered by hand holding bottle',
    prompt: 'Photograph of a gin bottle being held, with fingers partially covering the label. The visible portions show "BOTANIST BAY" brand name, "London Dry Gin", and partial view of "47%" alcohol content and "750 mL". Some text obscured by hand. Realistic lifestyle photography.',
    expectedResult: 'REVIEW',
    expectedReason: 'Partial occlusion requires careful extraction',
    applicationData: {
      brandName: 'Botanist Bay',
      classType: 'London Dry Gin',
      alcoholContent: '47% Alc./Vol.',
      netContents: '750 mL',
      nameAddress: 'Botanist Bay Distillers, Portland, Oregon',
      countryOfOrigin: '',
      governmentWarning: 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
    }
  }
];

async function generateImage(prompt) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
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
          } else {
            resolve(response.data[0].b64_json);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

async function saveImage(base64Data, filename) {
  const buffer = Buffer.from(base64Data, 'base64');
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`  Saved: ${filename}`);
  return filepath;
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🎨 Generating synthetic test labels with DALL-E\n');
  console.log('='.repeat(60));

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results = [];

  for (const scenario of SCENARIOS) {
    console.log(`\n📸 Generating: ${scenario.id}`);
    console.log(`   ${scenario.description}`);

    try {
      const base64Image = await generateImage(scenario.prompt);
      const filename = `label-${scenario.id.toLowerCase()}.png`;
      await saveImage(base64Image, filename);

      results.push({
        ...scenario,
        generated: true,
        filename
      });

      // Rate limiting - DALL-E has limits
      await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.push({
        ...scenario,
        generated: false,
        error: error.message
      });
    }
  }

  // Update sample-applications.json with new scenarios
  const applicationsPath = path.join(__dirname, '../src/test-data/sample-applications.json');
  const applications = JSON.parse(fs.readFileSync(applicationsPath, 'utf-8'));

  // Add Group 3 metadata if not exists
  if (!applications.groups) {
    applications.groups = {};
  }
  applications.groups.advanced = {
    name: 'Group 3: Advanced (Real-world Conditions)',
    description: 'AI-generated images with challenging real-world conditions'
  };

  // Add successful scenarios
  for (const result of results.filter(r => r.generated)) {
    // Check if already exists
    const exists = applications.labels.some(l => l.id === result.id);
    if (!exists) {
      applications.labels.push({
        id: result.id,
        group: 'advanced',
        description: result.description,
        htmlFile: `labels/${result.filename}`, // Points to PNG despite path
        expectedResult: result.expectedResult,
        expectedReason: result.expectedReason,
        applicationData: result.applicationData
      });
    }
  }

  fs.writeFileSync(applicationsPath, JSON.stringify(applications, null, 2));
  console.log(`\n✅ Updated sample-applications.json`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 GENERATION SUMMARY\n');
  const successful = results.filter(r => r.generated).length;
  const failed = results.filter(r => !r.generated).length;
  console.log(`  Generated: ${successful}/${SCENARIOS.length}`);
  if (failed > 0) {
    console.log(`  Failed: ${failed}`);
    results.filter(r => !r.generated).forEach(r => {
      console.log(`    - ${r.id}: ${r.error}`);
    });
  }

  console.log('\n🐸 Done!\n');
}

main().catch(console.error);
