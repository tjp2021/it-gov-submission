#!/usr/bin/env node
/**
 * Direct API Latency Benchmark
 *
 * Tests raw API response time bypassing the test harness.
 * Usage: node scripts/benchmark.js [image-path]
 *
 * If no image provided, uses the demo label.
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000/api/verify';

// Sample application data for testing
const SAMPLE_APPLICATION = {
  brandName: "Old Tom Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  nameAddress: "Old Tom Distillery, Louisville, Kentucky",
  countryOfOrigin: "",
  governmentWarning: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
};

async function benchmark(imagePath, runs = 5) {
  console.log('🏎️  Direct API Latency Benchmark\n');
  console.log('='.repeat(50));
  console.log(`Image: ${imagePath}`);
  console.log(`Runs: ${runs}`);
  console.log('='.repeat(50) + '\n');

  // Read image
  const imageBuffer = fs.readFileSync(imagePath);
  const fileSizeKB = (imageBuffer.length / 1024).toFixed(1);
  console.log(`Image size: ${fileSizeKB} KB\n`);

  const latencies = [];

  for (let i = 0; i < runs; i++) {
    process.stdout.write(`Run ${i + 1}/${runs}... `);

    const { FormData, fetch } = await import('undici');
    const formData = new FormData();

    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' :
                     ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                     ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.set('labelImage', blob, path.basename(imagePath));
    formData.set('applicationData', JSON.stringify(SAMPLE_APPLICATION));

    const startTime = Date.now();

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      });

      const latency = Date.now() - startTime;
      latencies.push(latency);

      if (response.ok) {
        const data = await response.json();
        console.log(`${latency}ms - ${data.overallStatus}`);
      } else {
        const error = await response.json();
        console.log(`${latency}ms - ERROR: ${error.error}`);
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }

    // Small delay between runs
    if (i < runs - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Calculate stats
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];

    console.log('\n' + '='.repeat(50));
    console.log('\n📊 LATENCY RESULTS\n');
    console.log(`  Min:  ${min}ms (${(min/1000).toFixed(2)}s)`);
    console.log(`  Max:  ${max}ms (${(max/1000).toFixed(2)}s)`);
    console.log(`  Avg:  ${avg.toFixed(0)}ms (${(avg/1000).toFixed(2)}s)`);
    console.log(`  P50:  ${p50}ms (${(p50/1000).toFixed(2)}s)`);
    console.log(`  P95:  ${p95}ms (${(p95/1000).toFixed(2)}s)`);

    const target = 5000;
    const underTarget = latencies.filter(l => l <= target).length;
    console.log(`\n  Under ${target}ms: ${underTarget}/${latencies.length} (${((underTarget/latencies.length)*100).toFixed(0)}%)`);

    if (avg <= target) {
      console.log('\n  ✅ MEETS 5s TARGET');
    } else {
      console.log(`\n  ⚠️  EXCEEDS TARGET by ${((avg - target)/1000).toFixed(2)}s avg`);
    }
  }

  console.log('\n');
}

async function main() {
  const args = process.argv.slice(2);
  let imagePath = args[0];
  let runs = parseInt(args[1]) || 5;

  if (!imagePath) {
    // Default to demo label
    imagePath = path.join(__dirname, '../public/demo-label.png');
    if (!fs.existsSync(imagePath)) {
      imagePath = path.join(__dirname, '../src/test-data/sample-labels/label-perfect.png');
    }
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    console.log('\nUsage: node scripts/benchmark.js [image-path] [runs]');
    console.log('Example: node scripts/benchmark.js ./my-label.jpg 10');
    process.exit(1);
  }

  // Check if server is running
  try {
    const { fetch } = await import('undici');
    await fetch('http://localhost:3000', { method: 'HEAD' });
  } catch {
    console.error('❌ Dev server not running. Start it with: npm run dev\n');
    process.exit(1);
  }

  await benchmark(imagePath, runs);
}

main().catch(console.error);
