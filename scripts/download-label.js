/**
 * Download a label image from a URL
 *
 * Usage:
 *   node scripts/download-label.js <url> <output-name>
 *
 * Example:
 *   node scripts/download-label.js "https://example.com/bourbon.jpg" makers-mark
 *
 * This saves to src/test-data/sample-labels/real/<output-name>.jpg
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2];
const NAME = process.argv[3];

if (!URL || !NAME) {
  console.log(`
Usage: node scripts/download-label.js <url> <output-name>

Example:
  node scripts/download-label.js "https://example.com/bourbon.jpg" makers-mark

Workflow for testing with real labels:
  1. Search Google Images for "bourbon whiskey label photo"
  2. Find a good image, right-click → Copy Image Address
  3. Run: node scripts/download-label.js "<url>" bourbon-1
  4. Degrade: node scripts/degrade-labels.js src/test-data/sample-labels/real/bourbon-1.jpg
  5. Use degraded versions in manual testing
`);
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, '../src/test-data/sample-labels/real');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const outputPath = path.join(OUTPUT_DIR, `${NAME}.jpg`);

console.log(`Downloading: ${URL}`);
console.log(`Saving to: ${outputPath}\n`);

const client = URL.startsWith('https') ? https : http;

const request = client.get(URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
}, (response) => {
  // Handle redirects
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    console.log(`Following redirect to: ${response.headers.location}`);
    const redirectUrl = response.headers.location.startsWith('http')
      ? response.headers.location
      : new globalThis.URL(response.headers.location, URL).toString();

    const redirectClient = redirectUrl.startsWith('https') ? https : http;
    redirectClient.get(redirectUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (redirectResponse) => {
      saveResponse(redirectResponse);
    }).on('error', handleError);
    return;
  }

  saveResponse(response);
});

request.on('error', handleError);

function saveResponse(response) {
  if (response.statusCode !== 200) {
    console.error(`Failed: HTTP ${response.statusCode}`);
    process.exit(1);
  }

  const file = fs.createWriteStream(outputPath);
  response.pipe(file);

  file.on('finish', () => {
    file.close();
    const stats = fs.statSync(outputPath);
    console.log(`Downloaded: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`\nNext step - create degraded versions:`);
    console.log(`  node scripts/degrade-labels.js ${outputPath}`);
  });
}

function handleError(err) {
  console.error('Error:', err.message);
  process.exit(1);
}
