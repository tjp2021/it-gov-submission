/**
 * Class/Type threshold analysis
 * Testing 0.85 vs 0.90 with real-world examples
 */

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

// Test cases - Application vs Label (what user enters vs what OCR extracts)
const TEST_CASES = [
  // SHOULD PASS - Same thing, formatting differences
  { app: "Kentucky Straight Bourbon Whiskey", label: "KENTUCKY STRAIGHT BOURBON WHISKEY", shouldMatch: true, reason: "Case difference" },
  { app: "Kentucky Straight Bourbon Whiskey", label: "Kentucky Straight Bourbon", shouldMatch: true, reason: "Whiskey omitted on label" },
  { app: "Whiskey", label: "Whisky", shouldMatch: true, reason: "American vs Scottish spelling" },
  { app: "Single Malt Scotch Whisky", label: "Single Malt Scotch", shouldMatch: true, reason: "Whisky omitted" },
  { app: "Añejo Tequila", label: "Anejo Tequila", shouldMatch: true, reason: "Accent variation" },
  { app: "London Dry Gin", label: "LONDON DRY GIN", shouldMatch: true, reason: "Case difference" },
  { app: "Blended Scotch Whisky", label: "Blended Scotch", shouldMatch: true, reason: "Whisky omitted" },
  { app: "Irish Whiskey", label: "Irish Whisky", shouldMatch: true, reason: "ey vs y spelling" },
  { app: "Cabernet Sauvignon", label: "CABERNET SAUVIGNON", shouldMatch: true, reason: "Case difference" },
  { app: "Straight Rye Whiskey", label: "Straight Rye", shouldMatch: true, reason: "Whiskey omitted" },
  { app: "Small Batch Bourbon", label: "Small-Batch Bourbon", shouldMatch: true, reason: "Hyphen variation" },
  { app: "Cask Strength Bourbon", label: "Cask-Strength Bourbon", shouldMatch: true, reason: "Hyphen variation" },

  // SHOULD FAIL - Different products
  { app: "Bourbon", label: "Rye", shouldMatch: false, reason: "Different spirit type" },
  { app: "Vodka", label: "Gin", shouldMatch: false, reason: "Different spirit type" },
  { app: "Tequila", label: "Mezcal", shouldMatch: false, reason: "Different agave spirit" },
  { app: "Scotch Whisky", label: "Irish Whiskey", shouldMatch: false, reason: "Different origin" },
  { app: "Red Wine", label: "White Wine", shouldMatch: false, reason: "Different wine type" },
  { app: "Cabernet Sauvignon", label: "Merlot", shouldMatch: false, reason: "Different grape" },
  { app: "Pinot Noir", label: "Pinot Grigio", shouldMatch: false, reason: "Different grape" },
  { app: "Kentucky Bourbon", label: "Tennessee Whiskey", shouldMatch: false, reason: "Different state/style" },
  { app: "Rum", label: "Rhum", shouldMatch: false, reason: "Could be different (Rhum Agricole)" },
  { app: "Blanco Tequila", label: "Reposado Tequila", shouldMatch: false, reason: "Different age class" },
  { app: "Silver Tequila", label: "Añejo Tequila", shouldMatch: false, reason: "Different age class" },
  { app: "London Dry Gin", label: "Old Tom Gin", shouldMatch: false, reason: "Different gin style" },
  { app: "Navy Strength Gin", label: "London Dry Gin", shouldMatch: false, reason: "Different strength designation" },

  // EDGE CASES - Debatable
  { app: "Bourbon Whiskey", label: "Bourbon", shouldMatch: true, reason: "Whiskey redundant" },
  { app: "Straight Bourbon Whiskey", label: "Bourbon Whiskey", shouldMatch: true, reason: "Straight often omitted" },
  { app: "Single Barrel Bourbon", label: "Single Barrel", shouldMatch: true, reason: "Bourbon implied" },
];

console.log('='.repeat(80));
console.log('CLASS/TYPE THRESHOLD ANALYSIS');
console.log('='.repeat(80));

console.log('\n| Application | Label | Score | Should | 0.85 | 0.90 |');
console.log('|-------------|-------|-------|--------|------|------|');

const results = [];
for (const tc of TEST_CASES) {
  const a = normalizeText(tc.app);
  const b = normalizeText(tc.label);
  const score = a === b ? 1.0 : jaroWinkler(a, b);

  const pass85 = score >= 0.85;
  const pass90 = score >= 0.90;

  results.push({ ...tc, score, pass85, pass90 });

  const shouldStr = tc.shouldMatch ? 'PASS' : 'FAIL';
  const r85 = pass85 === tc.shouldMatch ? '✅' : '❌';
  const r90 = pass90 === tc.shouldMatch ? '✅' : '❌';

  console.log(`| ${tc.app.slice(0,25).padEnd(25)} | ${tc.label.slice(0,20).padEnd(20)} | ${score.toFixed(3)} | ${shouldStr.padEnd(4)} | ${r85}   | ${r90}   |`);
}

// Calculate accuracy
const correct85 = results.filter(r => r.pass85 === r.shouldMatch).length;
const correct90 = results.filter(r => r.pass90 === r.shouldMatch).length;

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`\nTotal tests: ${results.length}`);
console.log(`Accuracy at 0.85: ${correct85}/${results.length} (${(correct85/results.length*100).toFixed(1)}%)`);
console.log(`Accuracy at 0.90: ${correct90}/${results.length} (${(correct90/results.length*100).toFixed(1)}%)`);

// Show errors at each threshold
console.log('\n--- Errors at 0.85 threshold ---');
for (const r of results) {
  if (r.pass85 !== r.shouldMatch) {
    const errType = r.pass85 ? 'FALSE POSITIVE' : 'FALSE NEGATIVE';
    console.log(`${errType}: "${r.app}" vs "${r.label}" (${r.score.toFixed(3)}) - ${r.reason}`);
  }
}

console.log('\n--- Errors at 0.90 threshold ---');
for (const r of results) {
  if (r.pass90 !== r.shouldMatch) {
    const errType = r.pass90 ? 'FALSE POSITIVE' : 'FALSE NEGATIVE';
    console.log(`${errType}: "${r.app}" vs "${r.label}" (${r.score.toFixed(3)}) - ${r.reason}`);
  }
}

// Find optimal threshold
console.log('\n' + '='.repeat(80));
console.log('THRESHOLD SWEEP');
console.log('='.repeat(80));
console.log('\n| Threshold | Accuracy | False Pos | False Neg |');
console.log('|-----------|----------|-----------|-----------|');

for (let t = 0.80; t <= 0.98; t += 0.02) {
  let fp = 0, fn = 0;
  for (const r of results) {
    const pass = r.score >= t;
    if (pass && !r.shouldMatch) fp++;
    if (!pass && r.shouldMatch) fn++;
  }
  const correct = results.length - fp - fn;
  console.log(`| ${t.toFixed(2)}      | ${(correct/results.length*100).toFixed(1).padEnd(8)}% | ${String(fp).padEnd(9)} | ${String(fn).padEnd(9)} |`);
}
