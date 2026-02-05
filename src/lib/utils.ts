import {
  ML_CONVERSIONS,
  ADDRESS_ABBREVIATIONS,
  ADDRESS_PREFIXES_TO_STRIP,
} from "./constants";

/**
 * Jaro-Winkler similarity algorithm
 * Returns a value between 0 (no similarity) and 1 (exact match)
 * Emphasizes prefix matching, ideal for name comparison
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
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

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler modification: boost score for common prefix
  let prefixLength = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(s1.length, s2.length, maxPrefix); i++) {
    if (s1[i] === s2[i]) prefixLength++;
    else break;
  }

  const prefixScale = 0.1;
  return jaro + prefixLength * prefixScale * (1 - jaro);
}

/**
 * Normalize text for comparison
 * - Lowercase
 * - Normalize apostrophes and quotes
 * - Remove punctuation except apostrophes
 * - Collapse whitespace
 */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^\w\s'"-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize whitespace only (for strict matching)
 */
export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Simple word-level diff
 * Returns a human-readable description of differences
 */
export function wordDiff(expected: string, found: string): string {
  const expectedWords = expected.split(/\s+/);
  const foundWords = found.split(/\s+/);

  const foundSet = new Set(foundWords);
  const expectedSet = new Set(expectedWords);

  const missing = expectedWords.filter(w => !foundSet.has(w));
  const extra = foundWords.filter(w => !expectedSet.has(w));

  // If most words are missing, show a simpler message
  const missingRatio = missing.length / expectedWords.length;
  if (missingRatio > 0.5) {
    return `Text significantly differs (${Math.round(missingRatio * 100)}% mismatch)`;
  }

  const parts: string[] = [];
  if (missing.length > 0) {
    // Show as phrase, not comma-separated words
    parts.push(`Missing: "${missing.join(" ")}"`);
  }
  if (extra.length > 0) {
    parts.push(`Extra: "${extra.join(" ")}"`);
  }

  return parts.length > 0 ? parts.join("; ") : "Text differs";
}

/**
 * Parse ABV from various formats
 * Returns percentage value (e.g., 45 for 45% or 90 Proof)
 */
export interface ParsedABV {
  percentage: number;
  source: "percentage" | "proof";
}

export function parseABV(s: string): ParsedABV | null {
  // Try percentage first: "45%", "45% Alc./Vol.", "45% Alcohol by Volume"
  const pctMatch = s.match(/(\d+\.?\d*)\s*%/);
  if (pctMatch) {
    return { percentage: parseFloat(pctMatch[1]), source: "percentage" };
  }

  // Try proof: "90 Proof", "90proof"
  const proofMatch = s.match(/(\d+\.?\d*)\s*[Pp]roof/);
  if (proofMatch) {
    return { percentage: parseFloat(proofMatch[1]) / 2, source: "proof" };
  }

  return null;
}

/**
 * Parse volume from various formats
 * Returns value normalized to milliliters
 */
export interface ParsedVolume {
  valueMl: number;
  original: string;
}

export function parseVolume(s: string): ParsedVolume | null {
  let workingString = s.toLowerCase().trim();

  // Sort units by length (longest first) to avoid partial matches
  const sortedUnits = Object.entries(ML_CONVERSIONS).sort(
    (a, b) => b[0].length - a[0].length
  );

  // Find ALL volume matches and sum them (handles "1 PINT. 0.9 FL. OZ." = 500mL)
  // Remove matched portions to avoid double-counting overlapping patterns
  let totalMl = 0;
  let matchFound = false;

  for (const [unit, mlFactor] of sortedUnits) {
    const escapedUnit = unit.replace(/\./g, "\\.");
    const regex = new RegExp(`(\\d+\\.?\\d*)\\s*${escapedUnit}(?![a-z])`, "gi");
    let match;
    while ((match = regex.exec(workingString)) !== null) {
      totalMl += parseFloat(match[1]) * mlFactor;
      matchFound = true;
      // Replace matched portion with spaces to prevent re-matching
      workingString = workingString.slice(0, match.index) +
        " ".repeat(match[0].length) +
        workingString.slice(match.index + match[0].length);
    }
  }

  if (matchFound) {
    return {
      valueMl: totalMl,
      original: s.trim(),
    };
  }

  return null;
}

/**
 * Normalize address for comparison
 * Expands common abbreviations and strips production phrases
 */
export function normalizeAddress(s: string): string {
  let normalized = s.toLowerCase();

  // Strip common production phrases (e.g., "Distilled and Bottled by")
  // Some prefixes are regex patterns (contain \w or other regex chars)
  for (const prefix of ADDRESS_PREFIXES_TO_STRIP) {
    const regex = new RegExp(`^${prefix}\\s*`, "i");
    normalized = normalized.replace(regex, "");
  }

  // Also strip any remaining "in [Country] by" patterns at the start
  normalized = normalized.replace(/^in\s+\w+\s+by\s*/i, "");

  // Remove newlines (label extraction often includes them)
  normalized = normalized.replace(/\n/g, " ");

  // Expand abbreviations
  for (const [abbr, full] of Object.entries(ADDRESS_ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\.?\\b`, "gi");
    normalized = normalized.replace(regex, full);
  }

  // Remove punctuation INCLUDING apostrophes and collapse whitespace
  // "Maker's" and "Makers" should match
  normalized = normalized.replace(/[.,''""-]/g, "").replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Normalize country of origin for comparison
 * Uses ISO 3166 library to handle international variations:
 * - USA, U.S.A., United States -> "United States of America"
 * - Deutschland -> "Germany"
 * - Italia -> "Italy"
 * - España -> "Spain"
 */
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import deLocale from "i18n-iso-countries/langs/de.json";
import esLocale from "i18n-iso-countries/langs/es.json";
import itLocale from "i18n-iso-countries/langs/it.json";
import frLocale from "i18n-iso-countries/langs/fr.json";
import ptLocale from "i18n-iso-countries/langs/pt.json";
import huLocale from "i18n-iso-countries/langs/hu.json";

// Register locales for multi-language country name lookup
countries.registerLocale(enLocale);
countries.registerLocale(deLocale);
countries.registerLocale(esLocale);
countries.registerLocale(itLocale);
countries.registerLocale(frLocale);
countries.registerLocale(ptLocale);
countries.registerLocale(huLocale);

// TTB-specific regions that are valid but not ISO countries
const TTB_VALID_REGIONS: Record<string, string> = {
  "scotland": "scotland",
  "england": "england",
  "wales": "wales",
  "northern ireland": "northern ireland",
  "puerto rico": "puerto rico",
  "u.s. virgin islands": "u.s. virgin islands",
};

// Archaic/alternative country names not in ISO library
const COUNTRY_SPECIAL_CASES: Record<string, string> = {
  // Ancient/native names
  "hellas": "GR",
  "eire": "IE",
  "nippon": "JP",
  "nihon": "JP",
  "zhongguo": "CN",

  // Old country names (pre-rename)
  "burma": "MM",
  "swaziland": "SZ",
  "macedonia": "MK",
  "czechoslovakia": "CZ", // Historical
  "yugoslavia": "RS", // Maps to Serbia as successor
  "ussr": "RU", // Maps to Russia as successor
  "soviet union": "RU",

  // Common abbreviations
  "nz": "NZ",
  "sa": "ZA", // South Africa
  "rsa": "ZA",
};

// Wine/spirit regions mapped to their countries
// These are NOT countries but appear on labels as origin designations
const REGION_TO_COUNTRY: Record<string, string> = {
  // French wine regions
  "champagne": "france",
  "burgundy": "france",
  "bourgogne": "france",
  "bordeaux": "france",
  "alsace": "france",
  "loire": "france",
  "rhone": "france",
  "provence": "france",

  // French spirit regions
  "cognac": "france",
  "armagnac": "france",

  // Italian wine regions
  "tuscany": "italy",
  "toscana": "italy",
  "piedmont": "italy",
  "piemonte": "italy",
  "veneto": "italy",
  "sicily": "italy",
  "sicilia": "italy",

  // Spanish wine regions
  "rioja": "spain",
  "ribera del duero": "spain",
  "priorat": "spain",
  "jerez": "spain",
  "sherry": "spain",

  // German wine regions
  "mosel": "germany",
  "rheingau": "germany",
  "pfalz": "germany",

  // Portuguese regions
  "douro": "portugal",
  "porto": "portugal",
  "madeira": "portugal",

  // Scotch whisky regions (map to Scotland, not UK)
  "islay": "scotland",
  "speyside": "scotland",
  "highland": "scotland",
  "lowland": "scotland",
  "campbeltown": "scotland",

  // US regions
  "napa": "united states of america",
  "napa valley": "united states of america",
  "sonoma": "united states of america",
  "oregon": "united states of america",
  "willamette": "united states of america",
  "kentucky": "united states of america",
  "tennessee": "united states of america",
};

export function normalizeCountryOfOrigin(s: string): string {
  let normalized = s.trim();

  // Strip "Product of" in multiple languages
  const productOfPatterns = [
    /^product\s+of\s+/i,           // English
    /^produit\s+de\s+/i,           // French
    /^producto\s+de\s+/i,          // Spanish
    /^prodotto\s+d[ie']\s*/i,      // Italian
    /^produkt\s+aus\s+/i,          // German
    /^produto\s+de\s+/i,           // Portuguese
    /^made\s+in\s+/i,              // Common alternative
    /^produced\s+in\s+/i,          // Common alternative
    /^imported\s+from\s+/i,        // Common alternative
  ];

  for (const pattern of productOfPatterns) {
    normalized = normalized.replace(pattern, "");
  }

  const lowered = normalized.toLowerCase();

  // Check TTB-valid regions first (Scotland for Scotch, etc.)
  if (TTB_VALID_REGIONS[lowered]) {
    return TTB_VALID_REGIONS[lowered];
  }

  // Check wine/spirit regions and map to country
  if (REGION_TO_COUNTRY[lowered]) {
    return REGION_TO_COUNTRY[lowered];
  }

  // Check special cases (archaic names not in ISO)
  if (COUNTRY_SPECIAL_CASES[lowered]) {
    const code = COUNTRY_SPECIAL_CASES[lowered];
    return countries.getName(code, "en")?.toLowerCase() || lowered;
  }

  // Try to find ISO country code in multiple languages
  const code =
    countries.getAlpha2Code(normalized, "en") ||
    countries.getAlpha2Code(normalized, "de") ||
    countries.getAlpha2Code(normalized, "es") ||
    countries.getAlpha2Code(normalized, "it") ||
    countries.getAlpha2Code(normalized, "fr") ||
    countries.getAlpha2Code(normalized, "pt") ||
    countries.getAlpha2Code(normalized, "hu");

  if (code) {
    // Return canonical English name
    return countries.getName(code, "en")?.toLowerCase() || normalized.toLowerCase();
  }

  // Fallback: return as-is (lowercased for comparison)
  return normalized.toLowerCase();
}
