/**
 * Fuzzy Threshold Analysis
 *
 * Question: Is 0.85 the right threshold for Jaro-Winkler matching?
 *
 * We need to:
 * 1. PASS things that are "the same but formatted differently" (Dave's scenario)
 * 2. FAIL things that are "actually different" (Tim vs Tom)
 */

// Import our actual matching function
const path = require('path');

// Jaro-Winkler implementation (copied from our utils to test standalone)
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

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

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler modification - boost for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Test cases based on real-world scenarios from the take-home doc
const TEST_CASES = [
  // TRUE MATCHES - should PASS (same thing, different formatting)
  // From Dave's interview: "STONE'S THROW" vs "Stone's Throw"
  { a: "STONE'S THROW", b: "Stone's Throw", shouldMatch: true, reason: "Case difference (Dave's scenario)" },
  { a: "OLD TOM DISTILLERY", b: "Old Tom Distillery", shouldMatch: true, reason: "Case difference" },
  { a: "KENTUCKY STRAIGHT BOURBON WHISKEY", b: "Kentucky Straight Bourbon Whiskey", shouldMatch: true, reason: "Case difference" },
  { a: "Stone's Throw", b: "Stones Throw", shouldMatch: true, reason: "Punctuation difference" },
  { a: "Old  Tom  Distillery", b: "Old Tom Distillery", shouldMatch: true, reason: "Extra spaces" },
  { a: "Jack Daniel's", b: "Jack Daniels", shouldMatch: true, reason: "Apostrophe difference" },
  { a: "Maker's Mark", b: "MAKER'S MARK", shouldMatch: true, reason: "Case + apostrophe" },
  { a: "Jim Beam", b: "JIM BEAM", shouldMatch: true, reason: "Simple case difference" },
  { a: "Wild Turkey", b: "WILD TURKEY", shouldMatch: true, reason: "Simple case difference" },
  { a: "Johnnie Walker", b: "JOHNNIE WALKER", shouldMatch: true, reason: "Simple case difference" },

  // TRUE NON-MATCHES - should FAIL (actually different things)
  { a: "Old Tom Distillery", b: "Old Tim Distillery", shouldMatch: false, reason: "Tom vs Tim - different name" },
  { a: "Old Tom Distillery", b: "Jack Daniel's", shouldMatch: false, reason: "Completely different brand" },
  { a: "Kentucky Straight Bourbon", b: "Tennessee Whiskey", shouldMatch: false, reason: "Different product type" },
  { a: "Maker's Mark", b: "Maker's Park", shouldMatch: false, reason: "Mark vs Park - different word" },
  { a: "Jim Beam", b: "Jim Bean", shouldMatch: false, reason: "Beam vs Bean - typo that changes meaning" },
  { a: "Wild Turkey", b: "Mild Turkey", shouldMatch: false, reason: "Wild vs Mild - different word" },
  { a: "Johnnie Walker", b: "Johnny Walker", shouldMatch: false, reason: "Johnnie vs Johnny - could be different brand" },
  { a: "Crown Royal", b: "Crown Royale", shouldMatch: false, reason: "Royal vs Royale - spelling variant" },
  { a: "Grey Goose", b: "Gray Goose", shouldMatch: false, reason: "Grey vs Gray - spelling variant" },
  { a: "Absolut Vodka", b: "Absolute Vodka", shouldMatch: false, reason: "Absolut vs Absolute - brand specific spelling" },

  // EDGE CASES - debatable
  { a: "Whiskey", b: "Whisky", shouldMatch: true, reason: "American vs Scottish spelling - same thing" },
  { a: "Distillery", b: "Distilery", shouldMatch: false, reason: "Misspelling - OCR error should flag for review" },
];

function runTest() {
  console.log('='.repeat(70));
  console.log('FUZZY THRESHOLD ANALYSIS');
  console.log('Finding the optimal Jaro-Winkler threshold');
  console.log('='.repeat(70));

  // First, show the similarity scores for all test cases
  console.log('\n' + '─'.repeat(70));
  console.log('SIMILARITY SCORES FOR TEST CASES');
  console.log('─'.repeat(70));

  console.log('\n| Pair | Score | Should Match |');
  console.log('|------|-------|--------------|');

  const scores = [];
  for (const tc of TEST_CASES) {
    const normA = normalizeText(tc.a);
    const normB = normalizeText(tc.b);
    const score = jaroWinkler(normA, normB);
    scores.push({ ...tc, score, normA, normB });

    const matchLabel = tc.shouldMatch ? '✅ YES' : '❌ NO';
    console.log(`| "${tc.a}" vs "${tc.b}" | ${score.toFixed(3)} | ${matchLabel} |`);
    console.log(`|   → ${tc.reason} |`);
  }

  // Analyze score distribution
  console.log('\n' + '─'.repeat(70));
  console.log('SCORE DISTRIBUTION');
  console.log('─'.repeat(70));

  const shouldMatch = scores.filter(s => s.shouldMatch);
  const shouldNotMatch = scores.filter(s => !s.shouldMatch);

  console.log(`\nShould MATCH (n=${shouldMatch.length}):`);
  console.log(`  Min: ${Math.min(...shouldMatch.map(s => s.score)).toFixed(3)}`);
  console.log(`  Max: ${Math.max(...shouldMatch.map(s => s.score)).toFixed(3)}`);
  console.log(`  Scores: ${shouldMatch.map(s => s.score.toFixed(3)).join(', ')}`);

  console.log(`\nShould NOT MATCH (n=${shouldNotMatch.length}):`);
  console.log(`  Min: ${Math.min(...shouldNotMatch.map(s => s.score)).toFixed(3)}`);
  console.log(`  Max: ${Math.max(...shouldNotMatch.map(s => s.score)).toFixed(3)}`);
  console.log(`  Scores: ${shouldNotMatch.map(s => s.score.toFixed(3)).join(', ')}`);

  // Find overlap
  const matchMin = Math.min(...shouldMatch.map(s => s.score));
  const noMatchMax = Math.max(...shouldNotMatch.map(s => s.score));

  console.log(`\nOverlap analysis:`);
  console.log(`  Lowest "should match" score: ${matchMin.toFixed(3)}`);
  console.log(`  Highest "should not match" score: ${noMatchMax.toFixed(3)}`);

  if (matchMin > noMatchMax) {
    console.log(`  ✅ NO OVERLAP - perfect separation possible`);
    console.log(`  Optimal threshold: ${((matchMin + noMatchMax) / 2).toFixed(3)}`);
  } else {
    console.log(`  ❌ OVERLAP EXISTS - no perfect threshold`);
  }

  // Test different thresholds
  console.log('\n' + '─'.repeat(70));
  console.log('THRESHOLD ACCURACY ANALYSIS');
  console.log('─'.repeat(70));

  const thresholds = [0.75, 0.80, 0.85, 0.90, 0.93, 0.95, 0.97];

  console.log('\n| Threshold | True Pos | True Neg | False Pos | False Neg | Accuracy | F1 Score |');
  console.log('|-----------|----------|----------|-----------|-----------|----------|----------|');

  let bestThreshold = 0;
  let bestF1 = 0;

  for (const threshold of thresholds) {
    let tp = 0, tn = 0, fp = 0, fn = 0;

    for (const s of scores) {
      const predicted = s.score >= threshold;
      const actual = s.shouldMatch;

      if (predicted && actual) tp++;
      else if (!predicted && !actual) tn++;
      else if (predicted && !actual) fp++;
      else if (!predicted && actual) fn++;
    }

    const accuracy = ((tp + tn) / scores.length * 100).toFixed(1);
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = (2 * precision * recall / (precision + recall) || 0).toFixed(3);

    if (parseFloat(f1) > bestF1) {
      bestF1 = parseFloat(f1);
      bestThreshold = threshold;
    }

    console.log(`| ${threshold.toFixed(2)}      | ${String(tp).padEnd(8)} | ${String(tn).padEnd(8)} | ${String(fp).padEnd(9)} | ${String(fn).padEnd(9)} | ${accuracy.padEnd(8)}% | ${f1.padEnd(8)} |`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log('PROBLEM CASES AT CURRENT THRESHOLD (0.85)');
  console.log('─'.repeat(70));

  const threshold = 0.85;
  console.log(`\nFalse Positives (score >= ${threshold} but should NOT match):`);
  for (const s of scores) {
    if (s.score >= threshold && !s.shouldMatch) {
      console.log(`  ❌ "${s.a}" vs "${s.b}" = ${s.score.toFixed(3)}`);
      console.log(`     Reason: ${s.reason}`);
    }
  }

  console.log(`\nFalse Negatives (score < ${threshold} but SHOULD match):`);
  for (const s of scores) {
    if (s.score < threshold && s.shouldMatch) {
      console.log(`  ❌ "${s.a}" vs "${s.b}" = ${s.score.toFixed(3)}`);
      console.log(`     Reason: ${s.reason}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('CONCLUSION');
  console.log('='.repeat(70));
  console.log(`\nBest threshold by F1 score: ${bestThreshold} (F1 = ${bestF1})`);
  console.log(`Current threshold: 0.85`);

  if (bestThreshold === 0.85) {
    console.log(`\n✅ Current threshold (0.85) is optimal`);
  } else {
    console.log(`\n⚠️  Consider changing threshold to ${bestThreshold}`);
  }
}

runTest();
