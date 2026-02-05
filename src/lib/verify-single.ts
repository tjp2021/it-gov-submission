/**
 * Shared single-label verification logic
 * Used by both /api/verify-gemini and /api/batch-verify endpoints
 */

import { extractWithGemini } from "@/lib/gemini-extraction";
import { compareField } from "@/lib/comparison";
import { verifyGovernmentWarning } from "@/lib/warning-check";
import { FIELD_CONFIG, STANDARD_WARNING_TEXT } from "@/lib/constants";
import type {
  ApplicationData,
  ExtractedFields,
  FieldResult,
  VerificationResult,
  OverallStatus,
  MatchType,
  PendingConfirmation,
} from "@/lib/types";

export function computeOverallStatus(fieldResults: FieldResult[]): OverallStatus {
  // Only consider "automated" category results for status aggregation
  // "confirmation" category (e.g., bold check) requires agent action but doesn't block PASS
  const automatedResults = fieldResults.filter(r => r.category === "automated");

  const hasUnresolvedFail = automatedResults.some(
    (r) => r.status === "FAIL" && !r.agentOverride
  );
  const hasWarningOrNotFound = automatedResults.some(
    (r) => r.status === "WARNING" || r.status === "NOT_FOUND"
  );

  if (hasUnresolvedFail) return "FAIL";
  if (hasWarningOrNotFound) return "REVIEW";
  return "PASS";
}

export function buildPendingConfirmations(fieldResults: FieldResult[]): PendingConfirmation[] {
  return fieldResults
    .filter(r => r.category === "confirmation")
    .map(r => ({
      id: r.fieldName,
      label: r.fieldName.replace("Gov Warning — ", ""),
      description: r.details,
      aiAssessment: r.extractedValue || undefined,
      confirmed: false,
    }));
}

function getExtractedValue(
  fields: ExtractedFields,
  fieldKey: string
): string | null {
  const keyMap: Record<string, keyof ExtractedFields> = {
    brandName: "brandName",
    classType: "classType",
    alcoholContent: "alcoholContent",
    netContents: "netContents",
    nameAddress: "nameAddress",
    countryOfOrigin: "countryOfOrigin",
    governmentWarning: "governmentWarning",
  };

  const mappedKey = keyMap[fieldKey];
  if (!mappedKey) return null;

  const value = fields[mappedKey];
  return typeof value === "string" ? value : null;
}

export interface SingleVerificationResult extends VerificationResult {
  engine: "gemini";
}

export interface VerificationSuccess {
  success: true;
  result: SingleVerificationResult;
}

export interface VerificationError {
  success: false;
  error: string;
}

export type SingleVerificationResponse = VerificationSuccess | VerificationError;

/**
 * Verify a single label image against application data
 * Core logic extracted for reuse across endpoints
 */
export async function verifySingleLabel(
  imageBase64: string,
  mimeType: string,
  applicationData: ApplicationData
): Promise<SingleVerificationResponse> {
  const startTime = Date.now();

  // Validate mime type
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)
  ) {
    return {
      success: false,
      error: `Unsupported image type: ${mimeType}`,
    };
  }

  // Extract with Gemini Flash
  const extractionResult = await extractWithGemini(imageBase64, mimeType);

  if (!extractionResult.success) {
    return {
      success: false,
      error: `Gemini extraction failed: ${extractionResult.error}`,
    };
  }

  const extractedFields = extractionResult.fields;

  // Build field results
  const fieldResults: FieldResult[] = [];

  const standardFields = [
    "brandName",
    "classType",
    "alcoholContent",
    "netContents",
    "nameAddress",
    "countryOfOrigin",
  ] as const;

  for (const fieldKey of standardFields) {
    const config = FIELD_CONFIG[fieldKey];
    const applicationValue =
      applicationData[fieldKey as keyof ApplicationData];

    if (!config.required && !applicationValue) {
      continue;
    }

    const extractedValue = getExtractedValue(extractedFields, fieldKey);
    const matchResult = compareField(
      fieldKey,
      config.matchType,
      extractedValue,
      applicationValue || ""
    );

    fieldResults.push({
      fieldName: config.displayName,
      applicationValue: applicationValue || "",
      extractedValue,
      status: matchResult.status,
      matchType: config.matchType as MatchType,
      confidence: matchResult.confidence,
      details: matchResult.details,
      category: "automated",
    });
  }

  const warningResults = verifyGovernmentWarning(
    extractedFields,
    applicationData.governmentWarning || STANDARD_WARNING_TEXT
  );
  fieldResults.push(...warningResults);

  const overallStatus = computeOverallStatus(fieldResults);
  const pendingConfirmations = buildPendingConfirmations(fieldResults);
  const processingTimeMs = Date.now() - startTime;

  const result: SingleVerificationResult = {
    overallStatus,
    pendingConfirmations,
    processingTimeMs,
    extractedFields,
    fieldResults,
    engine: "gemini",
  };

  return { success: true, result };
}
