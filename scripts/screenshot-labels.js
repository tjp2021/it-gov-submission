const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const labelsDir = path.join(__dirname, '../src/test-data/labels');
const outputDir = path.join(__dirname, '../src/test-data/sample-labels');

async function screenshotLabels() {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 800, height: 1000 });

  // Get all HTML files
  const htmlFiles = fs.readdirSync(labelsDir).filter(f => f.endsWith('.html'));

  for (const file of htmlFiles) {
    const htmlPath = path.join(labelsDir, file);
    const pngName = file.replace('.html', '.png');
    const pngPath = path.join(outputDir, pngName);

    console.log(`Screenshotting ${file}...`);

    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    // Find the label element and screenshot just that
    const label = await page.$('.label');
    if (label) {
      await label.screenshot({ path: pngPath });
    } else {
      // Fallback to full page
      await page.screenshot({ path: pngPath });
    }

    console.log(`  -> ${pngName}`);
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to src/test-data/sample-labels/');
}

screenshotLabels().catch(console.error);
