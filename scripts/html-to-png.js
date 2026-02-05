/**
 * Convert HTML labels to PNG using Playwright
 *
 * Usage: node scripts/html-to-png.js [specific-file.html]
 *        node scripts/html-to-png.js  # converts all HTML labels
 */

const fs = require('fs');
const path = require('path');

const LABELS_DIR = path.join(__dirname, '../src/test-data/labels');

async function convertHtmlToPng(htmlPath) {
  const { chromium } = await import('playwright');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport
  await page.setViewportSize({ width: 800, height: 600 });

  // Load HTML file
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  await page.setContent(htmlContent);

  // Wait for any fonts/images to load
  await page.waitForTimeout(500);

  // Get the label element bounds or use full page
  const labelElement = await page.$('.label');
  const bounds = labelElement
    ? await labelElement.boundingBox()
    : { x: 0, y: 0, width: 800, height: 600 };

  // Add padding
  const padding = 40;
  const clip = {
    x: Math.max(0, bounds.x - padding),
    y: Math.max(0, bounds.y - padding),
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };

  // Screenshot
  const pngPath = htmlPath.replace('.html', '.png');
  await page.screenshot({
    path: pngPath,
    clip,
  });

  await browser.close();

  console.log(`  ✅ ${path.basename(htmlPath)} → ${path.basename(pngPath)}`);
  return pngPath;
}

async function main() {
  const args = process.argv.slice(2);

  let htmlFiles;
  if (args.length > 0) {
    // Specific file(s)
    htmlFiles = args.map(f => {
      if (path.isAbsolute(f)) return f;
      return path.join(LABELS_DIR, f);
    });
  } else {
    // All HTML files in labels dir
    htmlFiles = fs.readdirSync(LABELS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => path.join(LABELS_DIR, f));
  }

  console.log(`\n🖼️  Converting ${htmlFiles.length} HTML labels to PNG\n`);

  for (const htmlFile of htmlFiles) {
    if (!fs.existsSync(htmlFile)) {
      console.log(`  ❌ Not found: ${htmlFile}`);
      continue;
    }
    try {
      await convertHtmlToPng(htmlFile);
    } catch (err) {
      console.log(`  ❌ Error converting ${path.basename(htmlFile)}: ${err.message}`);
    }
  }

  console.log('\n✅ Done\n');
}

main();
