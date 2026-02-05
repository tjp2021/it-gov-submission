/**
 * Comprehensive test of ALL field matchers
 * Tests edge cases we may have handwaved
 */

const fs = require('fs');
const path = require('path');

// Load environment
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

// ============================================================
// UTILITY FUNCTIONS (copied from utils.ts for standalone testing)
// ============================================================

function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0.0;
  let transpositions = 0, k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
  let prefixLength = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefixLength++;
    else break;
  }
  return jaro + prefixLength * 0.1 * (1 - jaro);
}

const ML_CONVERSIONS = {
  ml: 1,
  cl: 10,
  l: 1000,
  "fl oz": 29.5735,
  "fl. oz": 29.5735,
  "fl.oz": 29.5735,
  "fl. oz.": 29.5735,
  oz: 29.5735,
  pint: 473.176,
  pt: 473.176,
  quart: 946.353,
  qt: 946.353,
  gallon: 3785.41,
  gal: 3785.41,
};

function parseABV(s) {
  const pctMatch = s.match(/(\d+\.?\d*)\s*%/);
  if (pctMatch) {
    return { percentage: parseFloat(pctMatch[1]), source: "percentage" };
  }
  const proofMatch = s.match(/(\d+\.?\d*)\s*[Pp]roof/);
  if (proofMatch) {
    return { percentage: parseFloat(proofMatch[1]) / 2, source: "proof" };
  }
  return null;
}

function parseVolume(s) {
  let workingString = s.toLowerCase().trim();
  const sortedUnits = Object.entries(ML_CONVERSIONS).sort((a, b) => b[0].length - a[0].length);

  // Find ALL volume matches and sum them (handles "1 PINT. 0.9 FL. OZ." = 500mL)
  let totalMl = 0;
  let matchFound = false;

  for (const [unit, mlFactor] of sortedUnits) {
    const escapedUnit = unit.replace(/\./g, "\\.");
    const regex = new RegExp(`(\\d+\\.?\\d*)\\s*${escapedUnit}(?![a-z])`, "gi");
    let match;
    while ((match = regex.exec(workingString)) !== null) {
      totalMl += parseFloat(match[1]) * mlFactor;
      matchFound = true;
      // Replace matched portion to prevent re-matching
      workingString = workingString.slice(0, match.index) + " ".repeat(match[0].length) + workingString.slice(match.index + match[0].length);
    }
  }

  return matchFound ? { valueMl: totalMl, original: s.trim() } : null;
}

const ADDRESS_ABBREVIATIONS = {
  st: "street", ave: "avenue", blvd: "boulevard", dr: "drive", rd: "road",
  ln: "lane", pl: "place", cir: "circle", hwy: "highway", ste: "suite", apt: "apartment",
  // States
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california",
  co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa",
  ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland",
  ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri",
  mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey",
  nm: "new mexico", ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio",
  ok: "oklahoma", or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina",
  sd: "south dakota", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont",
  va: "virginia", wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming",
  dc: "district of columbia",
};

const ADDRESS_PREFIXES_TO_STRIP = [
  "distilled and bottled by", "distilled, aged, and bottled by",
  "bottled by", "produced by", "produced and bottled by", "made by",
  "blended and bottled by", "blended by", "imported by", "imported and bottled by",
];

function normalizeAddress(s) {
  let normalized = s.toLowerCase();
  for (const prefix of ADDRESS_PREFIXES_TO_STRIP) {
    const regex = new RegExp(`^${prefix}\\s*`, "i");
    normalized = normalized.replace(regex, "");
  }
  normalized = normalized.replace(/\n/g, " ");
  for (const [abbr, full] of Object.entries(ADDRESS_ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\.?\\b`, "gi");
    normalized = normalized.replace(regex, full);
  }
  normalized = normalized.replace(/[.,''""-]/g, "").replace(/\s+/g, " ").trim();
  return normalized;
}

// Use same ISO library as production code
const countries = require('i18n-iso-countries');
countries.registerLocale(require('i18n-iso-countries/langs/en.json'));
countries.registerLocale(require('i18n-iso-countries/langs/de.json'));
countries.registerLocale(require('i18n-iso-countries/langs/es.json'));
countries.registerLocale(require('i18n-iso-countries/langs/it.json'));
countries.registerLocale(require('i18n-iso-countries/langs/fr.json'));
countries.registerLocale(require('i18n-iso-countries/langs/pt.json'));
countries.registerLocale(require('i18n-iso-countries/langs/hu.json'));

const TTB_VALID_REGIONS = {
  "scotland": "scotland",
  "england": "england",
  "wales": "wales",
  "northern ireland": "northern ireland",
  "puerto rico": "puerto rico",
};

const COUNTRY_SPECIAL_CASES = {
  "hellas": "GR",
  "eire": "IE",
  "nippon": "JP",
  "zhongguo": "CN",
};

function normalizeCountryOfOrigin(s) {
  let normalized = s.trim().replace(/^product\s+of\s+/i, "");
  const lowered = normalized.toLowerCase();

  // Check TTB-valid regions first
  if (TTB_VALID_REGIONS[lowered]) {
    return TTB_VALID_REGIONS[lowered];
  }

  // Check special cases (archaic names)
  if (COUNTRY_SPECIAL_CASES[lowered]) {
    const code = COUNTRY_SPECIAL_CASES[lowered];
    return (countries.getName(code, 'en') || lowered).toLowerCase();
  }

  // Try ISO lookup
  const code = countries.getAlpha2Code(normalized, 'en')
    || countries.getAlpha2Code(normalized, 'de')
    || countries.getAlpha2Code(normalized, 'es')
    || countries.getAlpha2Code(normalized, 'it')
    || countries.getAlpha2Code(normalized, 'fr')
    || countries.getAlpha2Code(normalized, 'pt')
    || countries.getAlpha2Code(normalized, 'hu');

  if (code) {
    return (countries.getName(code, 'en') || normalized).toLowerCase();
  }

  return normalized.toLowerCase();
}

// ============================================================
// TEST RUNNER
// ============================================================

function runTests(testName, tests, testFn) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${testName}`);
  console.log('='.repeat(70));

  let passed = 0, failed = 0;
  const failures = [];

  for (const tc of tests) {
    const result = testFn(tc);
    if (result.passed === tc.shouldPass) {
      passed++;
    } else {
      failed++;
      failures.push({ ...tc, result });
    }
  }

  console.log(`\nResults: ${passed}/${tests.length} passed (${(passed/tests.length*100).toFixed(1)}%)`);

  if (failures.length > 0) {
    console.log(`\nFAILURES:`);
    for (const f of failures) {
      const type = f.shouldPass ? 'FALSE NEGATIVE' : 'FALSE POSITIVE';
      console.log(`  ${type}: "${f.label}" vs "${f.app}"`);
      console.log(`    Expected: ${f.shouldPass ? 'PASS' : 'FAIL'}, Got: ${f.result.passed ? 'PASS' : 'FAIL'}`);
      console.log(`    Details: ${f.result.details}`);
      console.log(`    Reason: ${f.reason}`);
    }
  }

  return { passed, failed, total: tests.length };
}

// ============================================================
// 1. ABV MATCHING TESTS
// ============================================================

const ABV_TESTS = [
  // Standard formats - should pass
  { app: "45% ABV", label: "45% Alc./Vol.", shouldPass: true, reason: "Standard format variation" },
  { app: "45%", label: "45%", shouldPass: true, reason: "Exact match" },
  { app: "45% ABV", label: "45 %", shouldPass: true, reason: "Space before %" },
  { app: "45.5%", label: "45.5% ABV", shouldPass: true, reason: "Decimal percentage" },
  { app: "40% Alc. by Vol.", label: "40%", shouldPass: true, reason: "Format variation" },

  // Proof conversion - should pass
  { app: "90 Proof", label: "45%", shouldPass: true, reason: "Proof to ABV conversion" },
  { app: "45%", label: "90 Proof", shouldPass: true, reason: "ABV to Proof conversion" },
  { app: "80 Proof", label: "40% ABV", shouldPass: true, reason: "Standard vodka" },
  { app: "100 Proof", label: "50%", shouldPass: true, reason: "Cask strength bourbon" },
  { app: "86 Proof", label: "43%", shouldPass: true, reason: "Common whiskey proof" },
  { app: "86.4 Proof", label: "43.2%", shouldPass: true, reason: "Decimal proof" },

  // Different values - should fail
  { app: "45%", label: "40%", shouldPass: false, reason: "Different ABV" },
  { app: "90 Proof", label: "40%", shouldPass: false, reason: "90 Proof ≠ 40%" },
  { app: "80 Proof", label: "45%", shouldPass: false, reason: "80 Proof ≠ 45%" },

  // Edge cases
  { app: "12.5%", label: "12.5% alcohol by volume", shouldPass: true, reason: "Wine ABV format" },
  { app: "5%", label: "5.0%", shouldPass: true, reason: "Trailing zero" },
  { app: "Alc. 14% by vol.", label: "14%", shouldPass: true, reason: "European format" },
];

function testABV(tc) {
  const appParsed = parseABV(tc.app);
  const labelParsed = parseABV(tc.label);

  if (!appParsed || !labelParsed) {
    return {
      passed: false,
      details: `Parse failed: app=${appParsed?.percentage}, label=${labelParsed?.percentage}`
    };
  }

  const passed = appParsed.percentage === labelParsed.percentage;
  return {
    passed,
    details: `app=${appParsed.percentage}% (${appParsed.source}), label=${labelParsed.percentage}% (${labelParsed.source})`
  };
}

// ============================================================
// 2. VOLUME MATCHING TESTS
// ============================================================

const VOLUME_TOLERANCE = 0.005; // 0.5%

const VOLUME_TESTS = [
  // Standard formats - should pass
  { app: "750 mL", label: "750 ml", shouldPass: true, reason: "Case difference" },
  { app: "750mL", label: "750 mL", shouldPass: true, reason: "No space" },
  { app: "750 ML", label: "750ml", shouldPass: true, reason: "Uppercase" },
  { app: "1L", label: "1000 mL", shouldPass: true, reason: "L to mL" },
  { app: "1 L", label: "1000ml", shouldPass: true, reason: "L with space" },
  { app: "1.75L", label: "1750 mL", shouldPass: true, reason: "Handle size" },
  { app: "375 mL", label: "375 ml", shouldPass: true, reason: "Half bottle" },
  { app: "50 mL", label: "50ml", shouldPass: true, reason: "Miniature" },

  // US/Metric conversion - should pass (within 0.5% tolerance)
  { app: "750 mL", label: "25.4 fl oz", shouldPass: true, reason: "750mL ≈ 25.36 fl oz" },
  { app: "25.4 fl oz", label: "750 mL", shouldPass: true, reason: "Reverse conversion" },
  { app: "1L", label: "33.8 fl oz", shouldPass: true, reason: "1L ≈ 33.81 fl oz" },
  { app: "1.75L", label: "59.2 fl oz", shouldPass: true, reason: "1.75L ≈ 59.17 fl oz" },

  // Variations in fl oz format
  { app: "750 mL", label: "25.4 FL OZ", shouldPass: true, reason: "Uppercase FL OZ" },
  { app: "750 mL", label: "25.4 fl. oz.", shouldPass: true, reason: "With periods" },
  { app: "750 mL", label: "25.4 fl.oz.", shouldPass: true, reason: "No space before oz" },
  { app: "750 mL", label: "25.4fl oz", shouldPass: true, reason: "No space after number" },

  // Different values - should fail
  { app: "750 mL", label: "1L", shouldPass: false, reason: "Different size" },
  { app: "750 mL", label: "375 mL", shouldPass: false, reason: "Half size" },
  { app: "1L", label: "750 mL", shouldPass: false, reason: "Different liter size" },

  // Compound volumes (real label formats like "1 PINT. 0.9 FL. OZ." = 500mL)
  { app: "500 mL", label: "1 PINT. 0.9 FL. OZ.", shouldPass: true, reason: "Compound pint + fl oz" },
  { app: "1 PINT. 0.9 FL. OZ.", label: "500 mL", shouldPass: true, reason: "Reverse compound" },
  { app: "16.9 fl oz", label: "1 PINT. 0.9 FL. OZ.", shouldPass: true, reason: "Fl oz vs compound" },
  { app: "1 pint 0.9 fl oz", label: "500mL", shouldPass: true, reason: "Compound without periods" },

  // Edge cases
  { app: "50cl", label: "500mL", shouldPass: true, reason: "Centiliters" },
  { app: "70cl", label: "700mL", shouldPass: true, reason: "European bottle" },
  { app: "1 pt", label: "473 mL", shouldPass: true, reason: "Pint conversion" },
  { app: "1 qt", label: "946 mL", shouldPass: true, reason: "Quart conversion" },
];

function testVolume(tc) {
  const appParsed = parseVolume(tc.app);
  const labelParsed = parseVolume(tc.label);

  if (!appParsed || !labelParsed) {
    return {
      passed: false,
      details: `Parse failed: app=${appParsed?.valueMl}mL, label=${labelParsed?.valueMl}mL`
    };
  }

  const ratio = Math.abs(appParsed.valueMl - labelParsed.valueMl) / Math.max(appParsed.valueMl, labelParsed.valueMl);
  const passed = ratio <= VOLUME_TOLERANCE;

  return {
    passed,
    details: `app=${appParsed.valueMl.toFixed(1)}mL, label=${labelParsed.valueMl.toFixed(1)}mL, diff=${(ratio*100).toFixed(2)}%`
  };
}

// ============================================================
// 3. ADDRESS MATCHING TESTS
// ============================================================

const ADDRESS_THRESHOLD = 0.70;
const ADDRESS_PASS_THRESHOLD = 0.90;

const ADDRESS_TESTS = [
  // Exact matches - should pass
  { app: "Maker's Mark Distillery, Loretto, KY", label: "Maker's Mark Distillery, Loretto, KY", shouldPass: true, reason: "Exact match" },

  // State abbreviations - should pass
  { app: "Louisville, KY", label: "Louisville, Kentucky", shouldPass: true, reason: "State abbrev" },
  { app: "Portland, OR", label: "Portland, Oregon", shouldPass: true, reason: "State abbrev" },
  { app: "Napa, CA", label: "Napa, California", shouldPass: true, reason: "State abbrev" },
  { app: "San Francisco, CA 94102", label: "San Francisco, California 94102", shouldPass: true, reason: "State with zip" },

  // Street abbreviations - should pass
  { app: "123 Main St.", label: "123 Main Street", shouldPass: true, reason: "Street abbrev" },
  { app: "456 Oak Ave", label: "456 Oak Avenue", shouldPass: true, reason: "Avenue abbrev" },
  { app: "789 Vine Blvd", label: "789 Vine Boulevard", shouldPass: true, reason: "Boulevard abbrev" },

  // Production phrases stripped - should pass
  { app: "Jack Daniel's, Lynchburg, TN", label: "Distilled and Bottled by Jack Daniel's, Lynchburg, TN", shouldPass: true, reason: "Strip production phrase" },
  { app: "Heaven Hill, Bardstown, KY", label: "Produced and Bottled by Heaven Hill, Bardstown, KY", shouldPass: true, reason: "Strip produced by" },
  { app: "Westward Distillery, Portland, OR", label: "Bottled by Westward Distillery, Portland, OR", shouldPass: true, reason: "Strip bottled by" },

  // Case differences - should pass
  { app: "BUFFALO TRACE, FRANKFORT, KY", label: "Buffalo Trace, Frankfort, KY", shouldPass: true, reason: "Case difference" },

  // Punctuation differences - should pass
  { app: "Maker's Mark", label: "Makers Mark", shouldPass: true, reason: "Apostrophe" },
  { app: "Jack Daniel's", label: "Jack Daniels", shouldPass: true, reason: "Apostrophe in name" },

  // Partial address (label may omit parts) - should pass with WARNING
  { app: "Buffalo Trace Distillery, 113 Great Buffalo Trace, Frankfort, KY 40601", label: "Buffalo Trace, Frankfort, KY", shouldPass: true, reason: "Abbreviated on label" },

  // Different companies - should fail
  { app: "Jack Daniel's, Lynchburg, TN", label: "Jim Beam, Clermont, KY", shouldPass: false, reason: "Different distillery" },
  { app: "Buffalo Trace, Frankfort, KY", label: "Wild Turkey, Lawrenceburg, KY", shouldPass: false, reason: "Different company" },

  // Same company, different location (debatable)
  { app: "Brown-Forman, Louisville, KY", label: "Brown-Forman, Shively, KY", shouldPass: true, reason: "Same company, nearby facility" },
];

function testAddress(tc) {
  const a = normalizeAddress(tc.label);
  const b = normalizeAddress(tc.app);

  if (a === b) {
    return { passed: true, details: "Exact match after normalization" };
  }

  const similarity = jaroWinkler(a, b);
  const passed = similarity >= ADDRESS_THRESHOLD;

  return {
    passed,
    details: `similarity=${(similarity*100).toFixed(1)}%, threshold=${ADDRESS_THRESHOLD*100}%\n      normalized: "${a}" vs "${b}"`
  };
}

// ============================================================
// 4. COUNTRY OF ORIGIN TESTS
// ============================================================

const COUNTRY_TESTS = [
  // Standard formats - should pass
  { app: "USA", label: "USA", shouldPass: true, reason: "Exact match" },
  { app: "Scotland", label: "Product of Scotland", shouldPass: true, reason: "Strip 'Product of'" },
  { app: "Product of Scotland", label: "Scotland", shouldPass: true, reason: "Reverse strip" },
  { app: "Ireland", label: "IRELAND", shouldPass: true, reason: "Case difference" },
  { app: "FRANCE", label: "France", shouldPass: true, reason: "Case difference" },
  { app: "Mexico", label: "Product of Mexico", shouldPass: true, reason: "Tequila" },
  { app: "Japan", label: "Product of Japan", shouldPass: true, reason: "Japanese whisky" },
  { app: "Canada", label: "Product of Canada", shouldPass: true, reason: "Canadian whisky" },

  // US variations
  { app: "USA", label: "United States", shouldPass: true, reason: "USA = United States" },
  { app: "United States", label: "USA", shouldPass: true, reason: "Reverse" },
  { app: "USA", label: "U.S.A.", shouldPass: true, reason: "With periods" },
  { app: "United States of America", label: "USA", shouldPass: true, reason: "Full name" },
  { app: "US", label: "USA", shouldPass: true, reason: "US vs USA" },

  // UK variations
  { app: "UK", label: "United Kingdom", shouldPass: true, reason: "UK = United Kingdom" },
  { app: "Scotland", label: "UK", shouldPass: false, reason: "Scotland ≠ UK (different for labeling)" },
  { app: "England", label: "UK", shouldPass: false, reason: "England ≠ UK" },

  // WINE PRODUCING COUNTRIES - International name variations
  { app: "Germany", label: "Deutschland", shouldPass: true, reason: "German wine" },
  { app: "Deutschland", label: "Germany", shouldPass: true, reason: "Reverse" },
  { app: "Italy", label: "Italia", shouldPass: true, reason: "Italian wine" },
  { app: "Italia", label: "Italy", shouldPass: true, reason: "Reverse" },
  { app: "Spain", label: "España", shouldPass: true, reason: "Spanish wine" },
  { app: "España", label: "Spain", shouldPass: true, reason: "Reverse" },
  { app: "Portugal", label: "Portugal", shouldPass: true, reason: "Portuguese wine" },
  { app: "Austria", label: "Österreich", shouldPass: true, reason: "Austrian wine" },
  { app: "Greece", label: "Hellas", shouldPass: true, reason: "Greek wine" },
  { app: "Hungary", label: "Magyarország", shouldPass: true, reason: "Hungarian wine" },

  // New World wine countries
  { app: "Chile", label: "Chile", shouldPass: true, reason: "Chilean wine" },
  { app: "Argentina", label: "Argentina", shouldPass: true, reason: "Argentine wine" },
  { app: "Australia", label: "Australia", shouldPass: true, reason: "Australian wine" },
  { app: "New Zealand", label: "New Zealand", shouldPass: true, reason: "NZ wine" },
  { app: "South Africa", label: "South Africa", shouldPass: true, reason: "SA wine" },

  // Different countries - should fail
  { app: "Scotland", label: "Ireland", shouldPass: false, reason: "Different country" },
  { app: "USA", label: "Canada", shouldPass: false, reason: "Different country" },
  { app: "Mexico", label: "USA", shouldPass: false, reason: "Different country" },
  { app: "France", label: "Italy", shouldPass: false, reason: "Different wine regions" },
  { app: "Germany", label: "Austria", shouldPass: false, reason: "Different countries" },
  { app: "Spain", label: "Portugal", shouldPass: false, reason: "Different countries" },
  { app: "Chile", label: "Argentina", shouldPass: false, reason: "Different countries" },
];

function testCountry(tc) {
  const a = normalizeCountryOfOrigin(tc.label).toLowerCase();
  const b = normalizeCountryOfOrigin(tc.app).toLowerCase();

  if (a === b) {
    return { passed: true, details: "Exact match" };
  }

  if (a.includes(b) || b.includes(a)) {
    return { passed: true, details: `Contains match: "${a}" / "${b}"` };
  }

  return { passed: false, details: `No match: "${a}" vs "${b}"` };
}

// ============================================================
// 5. GOVERNMENT WARNING TEXT TESTS
// ============================================================

const STANDARD_WARNING = "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

const GOV_WARNING_TESTS = [
  // Exact match - should pass
  { app: STANDARD_WARNING, label: STANDARD_WARNING, shouldPass: true, reason: "Exact match" },

  // Whitespace variations - should pass
  { app: STANDARD_WARNING, label: STANDARD_WARNING.replace(/  /g, " "), shouldPass: true, reason: "Extra spaces" },
  { app: STANDARD_WARNING, label: STANDARD_WARNING.replace(/\n/g, " "), shouldPass: true, reason: "Newlines to spaces" },

  // Case difference - should pass (per strictMatch logic)
  { app: STANDARD_WARNING, label: STANDARD_WARNING.toLowerCase(), shouldPass: true, reason: "Case difference" },
  { app: STANDARD_WARNING, label: STANDARD_WARNING.toUpperCase(), shouldPass: true, reason: "All caps" },

  // Minor OCR errors - should FAIL (strict matching)
  { app: STANDARD_WARNING, label: STANDARD_WARNING.replace("health problems", "health problerns"), shouldPass: false, reason: "OCR error: rn for m" },
  { app: STANDARD_WARNING, label: STANDARD_WARNING.replace("pregnancy", "preg nancy"), shouldPass: false, reason: "OCR error: extra space" },
  { app: STANDARD_WARNING, label: STANDARD_WARNING.replace("(1)", "[1]"), shouldPass: false, reason: "Bracket style" },
  { app: STANDARD_WARNING, label: STANDARD_WARNING.replace("WARNING:", "WARNING"), shouldPass: false, reason: "Missing colon" },

  // Truncated warning - should fail
  { app: STANDARD_WARNING, label: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy", shouldPass: false, reason: "Truncated" },

  // Wrong warning - should fail
  { app: STANDARD_WARNING, label: "CONTAINS SULFITES", shouldPass: false, reason: "Wrong warning" },
];

function testGovWarning(tc) {
  const a = normalizeWhitespace(tc.label);
  const b = normalizeWhitespace(tc.app);

  if (a === b) {
    return { passed: true, details: "Exact match" };
  }

  if (a.toLowerCase() === b.toLowerCase()) {
    return { passed: true, details: "Case-insensitive match" };
  }

  return { passed: false, details: `Mismatch` };
}

// ============================================================
// RUN ALL TESTS
// ============================================================

console.log('='.repeat(70));
console.log('COMPREHENSIVE FIELD MATCHER TESTS');
console.log('Testing all assumptions and edge cases');
console.log('='.repeat(70));

const results = {
  abv: runTests('1. ABV MATCHING', ABV_TESTS, testABV),
  volume: runTests('2. VOLUME MATCHING', VOLUME_TESTS, testVolume),
  address: runTests('3. ADDRESS MATCHING', ADDRESS_TESTS, testAddress),
  country: runTests('4. COUNTRY OF ORIGIN MATCHING', COUNTRY_TESTS, testCountry),
  govWarning: runTests('5. GOVERNMENT WARNING TEXT', GOV_WARNING_TESTS, testGovWarning),
};

// Summary
console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

console.log('\n| Field | Passed | Failed | Accuracy |');
console.log('|-------|--------|--------|----------|');

let totalPassed = 0, totalFailed = 0;
for (const [field, result] of Object.entries(results)) {
  const pct = (result.passed / result.total * 100).toFixed(1);
  console.log(`| ${field.padEnd(12)} | ${String(result.passed).padEnd(6)} | ${String(result.failed).padEnd(6)} | ${pct.padEnd(8)}% |`);
  totalPassed += result.passed;
  totalFailed += result.failed;
}

const totalPct = (totalPassed / (totalPassed + totalFailed) * 100).toFixed(1);
console.log(`| ${'TOTAL'.padEnd(12)} | ${String(totalPassed).padEnd(6)} | ${String(totalFailed).padEnd(6)} | ${totalPct.padEnd(8)}% |`);

console.log('\n' + '='.repeat(70));
console.log('ISSUES FOUND');
console.log('='.repeat(70));

const issues = [];

// Check for systemic issues
if (results.country.failed > 0) {
  issues.push('Country matching: USA/US/United States variations not handled');
}

if (results.abv.failed > 0) {
  issues.push('ABV parsing: Some format variations not handled');
}

if (results.volume.failed > 0) {
  issues.push('Volume parsing: Some unit variations not handled');
}

if (results.address.failed > 0) {
  issues.push('Address matching: Threshold or normalization issues');
}

if (results.govWarning.failed > 0) {
  issues.push('Gov Warning: Strict matching may catch OCR errors as failures');
}

if (issues.length === 0) {
  console.log('\nNo systemic issues found!');
} else {
  for (const issue of issues) {
    console.log(`\n- ${issue}`);
  }
}
