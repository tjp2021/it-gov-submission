/**
 * Quick test of brand matching logic
 */

// Simulating the brandMatch function
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

function brandMatch(extracted, expected) {
  if (!extracted) {
    return { status: "NOT_FOUND", confidence: 0 };
  }

  const a = normalizeText(extracted);
  const b = normalizeText(expected);

  if (a === b) {
    return { status: "PASS", confidence: 1.0, details: "Brand name match" };
  }

  const similarity = jaroWinkler(a, b);
  return {
    status: "WARNING",
    confidence: similarity,
    details: `Requires verification (${(similarity * 100).toFixed(0)}% similar)`,
  };
}

// Test cases
const tests = [
  // Should PASS (exact after normalization)
  { extracted: "OLD TOM DISTILLERY", expected: "Old Tom Distillery", shouldPass: true },
  { extracted: "STONE'S THROW", expected: "Stone's Throw", shouldPass: true },
  { extracted: "Jack Daniel's", expected: "JACK DANIEL'S", shouldPass: true },

  // Should WARNING (any difference)
  { extracted: "Old Tim Distillery", expected: "Old Tom Distillery", shouldPass: false },
  { extracted: "Absolut", expected: "Absolute", shouldPass: false },
  { extracted: "Jim Bean", expected: "Jim Beam", shouldPass: false },
  { extracted: "Grey Goose", expected: "Gray Goose", shouldPass: false },
];

console.log('Brand Matching Test Results:\n');
console.log('| Extracted | Expected | Status | Correct |');
console.log('|-----------|----------|--------|---------|');

let passed = 0;
for (const t of tests) {
  const result = brandMatch(t.extracted, t.expected);
  const isPass = result.status === "PASS";
  const correct = isPass === t.shouldPass;
  if (correct) passed++;

  console.log(`| ${t.extracted.padEnd(20)} | ${t.expected.padEnd(20)} | ${result.status.padEnd(7)} | ${correct ? '✅' : '❌'} |`);
}

console.log(`\n${passed}/${tests.length} correct`);
