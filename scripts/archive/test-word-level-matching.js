/**
 * Test word-level matching for problem cases
 */

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
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

// Test individual word pairs
const WORD_PAIRS = [
  { a: 'tom', b: 'tim' },
  { a: 'beam', b: 'bean' },
  { a: 'mark', b: 'park' },
  { a: 'wild', b: 'mild' },
  { a: 'johnnie', b: 'johnny' },
  { a: 'royal', b: 'royale' },
  { a: 'grey', b: 'gray' },
  { a: 'absolut', b: 'absolute' },
  { a: 'distillery', b: 'distilery' },
  { a: 'whiskey', b: 'whisky' },
];

console.log('Word-level Jaro-Winkler scores:\n');
console.log('| Word A | Word B | Score | < 0.85? |');
console.log('|--------|--------|-------|---------|');

for (const p of WORD_PAIRS) {
  const score = jaroWinkler(p.a, p.b);
  const fails = score < 0.85 ? '✅ FAIL' : '❌ PASS';
  console.log(`| ${p.a.padEnd(10)} | ${p.b.padEnd(10)} | ${score.toFixed(3)} | ${fails} |`);
}

console.log('\n\nWord-level check (threshold 0.85) catches:');
for (const p of WORD_PAIRS) {
  const score = jaroWinkler(p.a, p.b);
  if (score < 0.85) {
    console.log(`  ✅ "${p.a}" vs "${p.b}" (${score.toFixed(3)})`);
  }
}

console.log('\nWord-level check MISSES (still passes):');
for (const p of WORD_PAIRS) {
  const score = jaroWinkler(p.a, p.b);
  if (score >= 0.85) {
    console.log(`  ❌ "${p.a}" vs "${p.b}" (${score.toFixed(3)})`);
  }
}
