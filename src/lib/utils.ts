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

  const missing: string[] = [];
  const extra: string[] = [];
  const changed: string[] = [];

  // Simple comparison - not a true LCS but sufficient for our needs
  const foundSet = new Set(foundWords);
  const expectedSet = new Set(expectedWords);

  for (const word of expectedWords) {
    if (!foundSet.has(word)) {
      missing.push(word);
    }
  }

  for (const word of foundWords) {
    if (!expectedSet.has(word)) {
      extra.push(word);
    }
  }

  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(`Missing: "${missing.join(", ")}"`);
  }
  if (extra.length > 0) {
    parts.push(`Extra: "${extra.join(", ")}"`);
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
import { ML_CONVERSIONS } from "./constants";

export interface ParsedVolume {
  valueMl: number;
  original: string;
}

export function parseVolume(s: string): ParsedVolume | null {
  const normalized = s.toLowerCase().trim();

  // Sort units by length (longest first) to avoid partial matches
  const sortedUnits = Object.entries(ML_CONVERSIONS).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [unit, mlFactor] of sortedUnits) {
    const escapedUnit = unit.replace(/\./g, "\\.");
    const regex = new RegExp(`(\\d+\\.?\\d*)\\s*${escapedUnit}`, "i");
    const match = normalized.match(regex);
    if (match) {
      return {
        valueMl: parseFloat(match[1]) * mlFactor,
        original: s.trim(),
      };
    }
  }

  return null;
}

/**
 * Normalize address for comparison
 * Expands common abbreviations and strips production phrases
 */
import { ADDRESS_ABBREVIATIONS, ADDRESS_PREFIXES_TO_STRIP } from "./constants";

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
 * Handles "Product of X" format
 */
export function normalizeCountryOfOrigin(s: string): string {
  let normalized = s.trim();

  // Strip "Product of" prefix (case insensitive)
  normalized = normalized.replace(/^product\s+of\s+/i, "");

  return normalized;
}
