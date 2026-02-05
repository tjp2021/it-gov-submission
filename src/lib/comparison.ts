import type { MatchResult, FieldStatus } from "./types";
import {
  jaroWinkler,
  normalizeText,
  normalizeWhitespace,
  normalizeAddress,
  normalizeCountryOfOrigin,
  parseABV,
  parseVolume,
  wordDiff,
} from "./utils";
import {
  FUZZY_MATCH_THRESHOLD,
  ADDRESS_MATCH_THRESHOLD,
  VOLUME_TOLERANCE,
  CLASS_TYPE_ABBREVIATIONS,
} from "./constants";

/**
 * Strict text match (for government warning, country of origin)
 * Normalizes whitespace only, preserves case
 */
export function strictMatch(
  extracted: string | null,
  expected: string
): MatchResult {
  if (!extracted) {
    return {
      status: "NOT_FOUND",
      confidence: 0,
      details: "Field not found on label",
    };
  }

  const a = normalizeWhitespace(extracted);
  const b = normalizeWhitespace(expected);

  if (a === b) {
    return {
      status: "PASS",
      confidence: 1.0,
      details: "Exact match",
    };
  }

  // Check case-insensitive match for country of origin
  if (a.toLowerCase() === b.toLowerCase()) {
    return {
      status: "PASS",
      confidence: 0.95,
      details: "Match (case difference only)",
    };
  }

  return {
    status: "FAIL",
    confidence: 0,
    details: wordDiff(b, a),
  };
}

/**
 * ABV/Proof matching with conversion
 * 90 Proof = 45% ABV
 */
export function matchABV(
  extracted: string | null,
  expected: string
): MatchResult {
  if (!extracted) {
    return {
      status: "NOT_FOUND",
      confidence: 0,
      details: "Alcohol content not found on label",
    };
  }

  const a = parseABV(extracted);
  const b = parseABV(expected);

  if (!a) {
    return {
      status: "WARNING",
      confidence: 0.5,
      details: `Could not parse ABV from label: "${extracted}"`,
    };
  }

  if (!b) {
    return {
      status: "WARNING",
      confidence: 0.5,
      details: `Could not parse ABV from application: "${expected}"`,
    };
  }

  if (a.percentage === b.percentage) {
    const note =
      a.source !== b.source
        ? ` (converted: ${a.source} on label, ${b.source} on application)`
        : "";
    return {
      status: "PASS",
      confidence: 1.0,
      details: `ABV match: ${a.percentage}%${note}`,
    };
  }

  return {
    status: "FAIL",
    confidence: 0.9,
    details: `ABV mismatch: label=${a.percentage}% vs application=${b.percentage}%`,
  };
}

/**
 * Net contents matching with unit conversion
 * 750 mL ≈ 25.4 fl oz (0.5% tolerance)
 */
export function matchNetContents(
  extracted: string | null,
  expected: string
): MatchResult {
  if (!extracted) {
    return {
      status: "NOT_FOUND",
      confidence: 0,
      details: "Net contents not found on label",
    };
  }

  const a = parseVolume(extracted);
  const b = parseVolume(expected);

  if (!a) {
    return {
      status: "WARNING",
      confidence: 0.5,
      details: `Could not parse volume from label: "${extracted}"`,
    };
  }

  if (!b) {
    return {
      status: "WARNING",
      confidence: 0.5,
      details: `Could not parse volume from application: "${expected}"`,
    };
  }

  // Calculate relative difference
  const ratio = Math.abs(a.valueMl - b.valueMl) / Math.max(a.valueMl, b.valueMl);

  if (ratio <= VOLUME_TOLERANCE) {
    return {
      status: "PASS",
      confidence: 1.0,
      details: `Volume match: ${a.original} ≈ ${b.original} (${a.valueMl.toFixed(1)} mL)`,
    };
  }

  return {
    status: "FAIL",
    confidence: 0.9,
    details: `Volume mismatch: ${a.original} (${a.valueMl.toFixed(1)} mL) vs ${b.original} (${b.valueMl.toFixed(1)} mL)`,
  };
}

/**
 * Fuzzy matching for brand name, class/type
 * Uses Jaro-Winkler with 0.85 threshold
 * Also checks word-level matching to catch single-word differences like "Tim" vs "Tom"
 */
export function fuzzyMatch(
  extracted: string | null,
  expected: string,
  threshold: number = FUZZY_MATCH_THRESHOLD
): MatchResult {
  if (!extracted) {
    return {
      status: "NOT_FOUND",
      confidence: 0,
      details: "Field not found on label",
    };
  }

  const a = normalizeText(extracted);
  const b = normalizeText(expected);

  // Exact match after normalization (handles Dave's STONE'S THROW scenario)
  if (a === b) {
    return {
      status: "PASS",
      confidence: 1.0,
      details: "Match (after normalization)",
    };
  }

  const similarity = jaroWinkler(a, b);

  // Word-level check: ensure each significant word matches
  // This catches "Old Tim" vs "Old Tom" where string-level similarity is high but word differs
  const wordsA = a.split(/\s+/).filter(w => w.length > 2);
  const wordsB = b.split(/\s+/).filter(w => w.length > 2);

  let mismatchedWord: string | null = null;
  for (const wordB of wordsB) {
    // Find best matching word in extracted
    let bestMatch = 0;
    for (const wordA of wordsA) {
      bestMatch = Math.max(bestMatch, jaroWinkler(wordA, wordB));
    }
    // If any expected word doesn't have a good match, flag it
    if (bestMatch < 0.85) {
      mismatchedWord = wordB;
      break;
    }
  }

  if (mismatchedWord) {
    return {
      status: "FAIL",
      confidence: similarity,
      details: `Word mismatch detected: "${mismatchedWord}" not found in label`,
    };
  }

  if (similarity >= threshold) {
    return {
      status: "PASS",
      confidence: similarity,
      details: `High similarity (${(similarity * 100).toFixed(0)}%) — minor formatting differences`,
    };
  }

  if (similarity >= 0.6) {
    return {
      status: "WARNING",
      confidence: similarity,
      details: `Partial match (${(similarity * 100).toFixed(0)}%) — agent review recommended`,
    };
  }

  return {
    status: "FAIL",
    confidence: similarity,
    details: `Low similarity (${(similarity * 100).toFixed(0)}%) — likely mismatch`,
  };
}

/**
 * Expand class/type abbreviations (IPA -> India Pale Ale)
 */
function expandClassTypeAbbreviations(text: string): string {
  let expanded = text.toLowerCase();
  for (const [abbr, full] of Object.entries(CLASS_TYPE_ABBREVIATIONS)) {
    // Match whole word only
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    expanded = expanded.replace(regex, full);
  }
  return expanded;
}

/**
 * Class/Type matching with abbreviation expansion
 * IPA matches "India Pale Ale", VSOP matches "Very Superior Old Pale"
 */
export function classTypeMatch(
  extracted: string | null,
  expected: string
): MatchResult {
  if (!extracted) {
    return {
      status: "NOT_FOUND",
      confidence: 0,
      details: "Class/Type not found on label",
    };
  }

  // Expand abbreviations before comparison
  const a = normalizeText(expandClassTypeAbbreviations(extracted));
  const b = normalizeText(expandClassTypeAbbreviations(expected));

  // Exact match after normalization and abbreviation expansion
  if (a === b) {
    return {
      status: "PASS",
      confidence: 1.0,
      details: "Class/Type match",
    };
  }

  // Check if one contains the other (e.g., "Pale Ale" in "India Pale Ale")
  if (a.includes(b) || b.includes(a)) {
    return {
      status: "PASS",
      confidence: 0.95,
      details: "Class/Type match (one contains the other)",
    };
  }

  const similarity = jaroWinkler(a, b);

  if (similarity >= FUZZY_MATCH_THRESHOLD) {
    return {
      status: "PASS",
      confidence: similarity,
      details: `Class/Type match (${(similarity * 100).toFixed(0)}% similar)`,
    };
  }

  if (similarity >= 0.6) {
    return {
      status: "WARNING",
      confidence: similarity,
      details: `Class/Type partial match (${(similarity * 100).toFixed(0)}%) — review recommended`,
    };
  }

  return {
    status: "FAIL",
    confidence: similarity,
    details: `Class/Type mismatch: "${extracted}" vs "${expected}"`,
  };
}

/**
 * Address matching with lower threshold
 * Uses 0.70 threshold and defaults to WARNING for anything below 100%
 */
export function addressMatch(
  extracted: string | null,
  expected: string
): MatchResult {
  if (!extracted) {
    return {
      status: "NOT_FOUND",
      confidence: 0,
      details: "Name/address not found on label",
    };
  }

  const a = normalizeAddress(extracted);
  const b = normalizeAddress(expected);

  if (a === b) {
    return {
      status: "PASS",
      confidence: 1.0,
      details: "Exact address match",
    };
  }

  const similarity = jaroWinkler(a, b);

  if (similarity >= 0.9) {
    return {
      status: "PASS",
      confidence: similarity,
      details: `Address match (${(similarity * 100).toFixed(0)}%)`,
    };
  }

  if (similarity >= ADDRESS_MATCH_THRESHOLD) {
    return {
      status: "WARNING",
      confidence: similarity,
      details: `Address partial match (${(similarity * 100).toFixed(0)}%) — agent review recommended. Labels often abbreviate or omit parts of the full address.`,
    };
  }

  return {
    status: "FAIL",
    confidence: similarity,
    details: `Address mismatch (${(similarity * 100).toFixed(0)}%)`,
  };
}

/**
 * Country of origin matching
 * Normalizes "Product of X" format to just "X"
 */
export function countryMatch(
  extracted: string | null,
  expected: string
): MatchResult {
  if (!extracted) {
    return {
      status: "NOT_FOUND",
      confidence: 0,
      details: "Country of origin not found on label",
    };
  }

  const a = normalizeCountryOfOrigin(extracted).toLowerCase();
  const b = normalizeCountryOfOrigin(expected).toLowerCase();

  if (a === b) {
    return {
      status: "PASS",
      confidence: 1.0,
      details: "Country of origin match",
    };
  }

  // Check if one contains the other (e.g., "Scotland" in "Product of Scotland")
  if (a.includes(b) || b.includes(a)) {
    return {
      status: "PASS",
      confidence: 0.95,
      details: "Country of origin match (format variation)",
    };
  }

  return {
    status: "FAIL",
    confidence: 0,
    details: `Country mismatch: label="${extracted}" vs application="${expected}"`,
  };
}

/**
 * Brand name matching - strict with human review for differences
 * Brands are legal identities: "Absolut" ≠ "Absolute"
 * Only exact match after normalization passes automatically
 */
export function brandMatch(
  extracted: string | null,
  expected: string
): MatchResult {
  if (!extracted) {
    return {
      status: "NOT_FOUND",
      confidence: 0,
      details: "Brand name not found on label",
    };
  }

  const a = normalizeText(extracted);
  const b = normalizeText(expected);

  // Exact match after normalization (handles case, punctuation, whitespace)
  if (a === b) {
    return {
      status: "PASS",
      confidence: 1.0,
      details: "Brand name match",
    };
  }

  // Any difference requires human verification - brands are legal identities
  const similarity = jaroWinkler(a, b);
  return {
    status: "WARNING",
    confidence: similarity,
    details: `Brand name differs: "${extracted}" vs "${expected}" — requires verification (${(similarity * 100).toFixed(0)}% similar)`,
  };
}

/**
 * Route field comparison to appropriate matching function
 */
export function compareField(
  fieldName: string,
  matchType: string,
  extracted: string | null,
  expected: string
): MatchResult {
  switch (matchType) {
    case "strict":
      return strictMatch(extracted, expected);
    case "brand":
      return brandMatch(extracted, expected);
    case "classType":
      return classTypeMatch(extracted, expected);
    case "country":
      return countryMatch(extracted, expected);
    case "abv":
      return matchABV(extracted, expected);
    case "volume":
      return matchNetContents(extracted, expected);
    case "fuzzy":
      return fuzzyMatch(extracted, expected);
    case "address":
      return addressMatch(extracted, expected);
    default:
      return fuzzyMatch(extracted, expected);
  }
}
