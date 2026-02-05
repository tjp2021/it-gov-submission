/**
 * Screenshot the bold test HTML files
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function screenshot() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const htmlPath = path.join(__dirname, '../src/test-data/sample-labels/test-bold/label-NOT-bold.html');
  const outputPath = path.join(__dirname, '../src/test-data/sample-labels/test-bold/label-NOT-bold.png');

  // Ensure directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await page.goto('file://' + htmlPath);
  await page.setViewport({ width: 450, height: 400 });

  // Screenshot just the body
  const body = await page.$('body');
  await body.screenshot({ path: outputPath });

  console.log(`Created: ${outputPath}`);

  await browser.close();
}

screenshot().catch(console.error);
