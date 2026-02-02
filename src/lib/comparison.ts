import type { MatchResult, FieldStatus } from "./types";
import {
  jaroWinkler,
  normalizeText,
  normalizeWhitespace,
  normalizeAddress,
  parseABV,
  parseVolume,
  wordDiff,
} from "./utils";
import {
  FUZZY_MATCH_THRESHOLD,
  ADDRESS_MATCH_THRESHOLD,
  VOLUME_TOLERANCE,
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
