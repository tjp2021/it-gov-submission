import type { ExtractedFields, FieldResult } from "./types";
import { strictMatch } from "./comparison";
import { STANDARD_WARNING_TEXT } from "./constants";

/**
 * Comprehensive government warning verification
 * Returns multiple field results for different aspects of the warning
 */
export function verifyGovernmentWarning(
  extracted: ExtractedFields,
  expectedWarningText: string = STANDARD_WARNING_TEXT
): FieldResult[] {
  const results: FieldResult[] = [];

  // Check 1: Warning text present on label
  results.push({
    fieldName: "Gov Warning — Present",
    applicationValue: "Required",
    extractedValue: extracted.governmentWarning ? "Found" : "Not found",
    status: extracted.governmentWarning ? "PASS" : "FAIL",
    matchType: "strict",
    confidence: extracted.governmentWarning ? 1.0 : 0,
    details: extracted.governmentWarning
      ? "Warning statement found on label"
      : "WARNING STATEMENT NOT FOUND ON LABEL",
  });

  // Check 2: "GOVERNMENT WARNING:" header in all caps (RELIABLE — text comparison)
  const headerStatus =
    extracted.governmentWarningHeaderFormat === "ALL_CAPS"
      ? "PASS"
      : extracted.governmentWarningHeaderFormat === "NOT_FOUND"
        ? "NOT_FOUND"
        : "FAIL";

  results.push({
    fieldName: "Gov Warning — Header Caps",
    applicationValue: "ALL CAPS required",
    extractedValue: extracted.governmentWarningHeaderFormat,
    status: headerStatus,
    matchType: "strict",
    confidence: headerStatus === "PASS" ? 1.0 : 0,
    details:
      headerStatus === "PASS"
        ? "Header in ALL CAPS ✓"
        : headerStatus === "NOT_FOUND"
          ? "Warning header not found"
          : `Header format: ${extracted.governmentWarningHeaderFormat} — must be ALL CAPS per 27 CFR Part 16`,
  });

  // Check 3: Header appears bold (BEST-EFFORT — visual assessment from image)
  // Bold detection from photographs is inherently unreliable.
  // This check is always WARNING tier, never auto-PASS/FAIL, because we cannot be certain.
  let boldDetails: string;
  switch (extracted.governmentWarningHeaderEmphasis) {
    case "APPEARS_BOLD_OR_HEAVY":
      boldDetails =
        "Header appears visually emphasized (best-effort assessment) — agent should visually confirm bold formatting";
      break;
    case "UNCERTAIN":
      boldDetails =
        "Could not determine if header is bold from image — agent should visually confirm";
      break;
    case "APPEARS_NORMAL_WEIGHT":
      boldDetails =
        "Header does not appear bold — agent should visually confirm. Per 27 CFR Part 16, 'GOVERNMENT WARNING' must be in bold.";
      break;
    default:
      boldDetails = "Bold assessment unavailable — agent should visually confirm";
  }

  results.push({
    fieldName: "Gov Warning — Header Bold",
    applicationValue: "Bold required",
    extractedValue: extracted.governmentWarningHeaderEmphasis,
    status: "WARNING", // Always WARNING — agent must visually confirm
    matchType: "strict",
    confidence: 0.5,
    details: boldDetails,
  });

  // Check 4: Complete text match (word-for-word)
  if (extracted.governmentWarning) {
    const textMatch = strictMatch(extracted.governmentWarning, expectedWarningText);

    results.push({
      fieldName: "Gov Warning — Text Accuracy",
      applicationValue: truncateForDisplay(expectedWarningText),
      extractedValue: truncateForDisplay(extracted.governmentWarning),
      status: textMatch.status,
      matchType: "strict",
      confidence: textMatch.confidence,
      details: textMatch.details,
    });
  } else {
    results.push({
      fieldName: "Gov Warning — Text Accuracy",
      applicationValue: truncateForDisplay(expectedWarningText),
      extractedValue: null,
      status: "NOT_FOUND",
      matchType: "strict",
      confidence: 0,
      details: "Cannot verify text — warning not found on label",
    });
  }

  return results;
}

/**
 * Truncate long text for display in results
 */
function truncateForDisplay(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
