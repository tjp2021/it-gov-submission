#!/usr/bin/env node
/**
 * Test image size impact on latency
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const API_URL = 'http://localhost:3000/api/verify';

const SAMPLE_APPLICATION = {
  brandName: "Old Tom Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  nameAddress: "Old Tom Distillery, Louisville, Kentucky",
  countryOfOrigin: "",
  governmentWarning: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
};

async function testSize(imagePath, maxDim, quality) {
  const originalBuffer = fs.readFileSync(imagePath);

  // Resize image
  const resized = await sharp(originalBuffer)
    .resize(maxDim, maxDim, { fit: 'inside' })
    .jpeg({ quality })
    .toBuffer();

  const sizeKB = (resized.length / 1024).toFixed(1);

  const { FormData, fetch } = await import('undici');
  const formData = new FormData();
  const blob = new Blob([resized], { type: 'image/jpeg' });
  formData.set('labelImage', blob, 'test.jpg');
  formData.set('applicationData', JSON.stringify(SAMPLE_APPLICATION));

  const start = Date.now();
  const response = await fetch(API_URL, { method: 'POST', body: formData });
  const latency = Date.now() - start;

  const data = await response.json();
  return { maxDim, quality, sizeKB, latency, status: data.overallStatus };
}

async function main() {
  const imagePath = process.argv[2] || path.join(__dirname, '../public/demo-label.png');

  console.log('Testing image size impact on latency...');
  console.log('Image:', imagePath);
  console.log('');

  const tests = [
    { maxDim: 1568, quality: 85 },  // Current default
    { maxDim: 1024, quality: 85 },  // Smaller
    { maxDim: 800, quality: 85 },   // Even smaller
    { maxDim: 640, quality: 85 },   // Much smaller
  ];

  console.log('Size\t\tQuality\tFile\tLatency\tStatus');
  console.log('-'.repeat(55));

  for (const { maxDim, quality } of tests) {
    try {
      const result = await testSize(imagePath, maxDim, quality);
      console.log(`${result.maxDim}px\t\t${result.quality}%\t${result.sizeKB}KB\t${(result.latency/1000).toFixed(2)}s\t${result.status}`);
    } catch (err) {
      console.log(`${maxDim}px\t\tERROR: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('');
}

main().catch(console.error);
