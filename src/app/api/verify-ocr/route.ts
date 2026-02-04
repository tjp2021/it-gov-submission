import { NextRequest, NextResponse } from "next/server";
import { extractTextFromImage, isOCRReliable } from "@/lib/ocr";
import { classifyLabelText } from "@/lib/classification";
import { extractLabelFields } from "@/lib/extraction";
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
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30; // Allow up to 30 seconds

// OCR confidence threshold for fallback decision
const OCR_CONFIDENCE_THRESHOLD = 50;

/**
 * Compute overall status from field results
 */
function computeOverallStatus(fieldResults: FieldResult[]): OverallStatus {
  const hasUnresolvedFail = fieldResults.some(
    (r) => r.status === "FAIL" && !r.agentOverride
  );
  const hasWarningOrNotFound = fieldResults.some(
    (r) => r.status === "WARNING" || r.status === "NOT_FOUND"
  );

  if (hasUnresolvedFail) return "FAIL";
  if (hasWarningOrNotFound) return "REVIEW";
  return "PASS";
}

/**
 * Get extracted value for a field from ExtractedFields
 */
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

export interface OCRVerificationResult extends VerificationResult {
  timing: {
    ocrTimeMs: number;
    classificationTimeMs: number;
    totalTimeMs: number;
    usedFallback: boolean;
    fallbackReason?: string;
  };
  ocrConfidence?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const imageFile = formData.get("labelImage") as File | null;
    const applicationDataJson = formData.get("applicationData") as string | null;

    // Validate inputs
    if (!imageFile) {
      return NextResponse.json(
        { error: "No label image provided" },
        { status: 400 }
      );
    }

    if (!applicationDataJson) {
      return NextResponse.json(
        { error: "No application data provided" },
        { status: 400 }
      );
    }

    let applicationData: ApplicationData;
    try {
      applicationData = JSON.parse(applicationDataJson);
    } catch {
      return NextResponse.json(
        { error: "Invalid application data JSON" },
        { status: 400 }
      );
    }

    // Convert image to base64
    const imageBuffer = await imageFile.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");

    // Determine media type
    const mimeType = imageFile.type;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)
    ) {
      return NextResponse.json(
        {
          error: `Unsupported image type: ${mimeType}. Supported: JPEG, PNG, WebP, GIF`,
        },
        { status: 400 }
      );
    }

    // Step 1: Try OCR extraction
    const ocrResult = await extractTextFromImage(imageBase64, mimeType);

    let extractedFields: ExtractedFields;
    let usedFallback = false;
    let fallbackReason: string | undefined;
    let ocrTimeMs = ocrResult.processingTimeMs;
    let classificationTimeMs = 0;

    // Step 2: Check if OCR is reliable enough
    if (isOCRReliable(ocrResult, OCR_CONFIDENCE_THRESHOLD)) {
      // OCR succeeded - classify the text
      const classificationResult = await classifyLabelText(ocrResult.text);
      classificationTimeMs = classificationResult.processingTimeMs;

      if (classificationResult.success) {
        extractedFields = classificationResult.fields;
      } else {
        // Classification failed - fall back to Vision
        usedFallback = true;
        fallbackReason = `Classification failed: ${classificationResult.error}`;
        const visionResult = await extractLabelFields(
          imageBase64,
          mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif"
        );
        if (!visionResult.success) {
          return NextResponse.json(
            { error: `Vision fallback failed: ${visionResult.error}` },
            { status: 500 }
          );
        }
        extractedFields = visionResult.fields;
      }
    } else {
      // OCR not reliable - fall back to Vision
      usedFallback = true;
      if (!ocrResult.success) {
        fallbackReason = `OCR failed: ${"error" in ocrResult ? ocrResult.error : "unknown error"}`;
      } else if (ocrResult.confidence < OCR_CONFIDENCE_THRESHOLD) {
        fallbackReason = `OCR confidence too low: ${ocrResult.confidence.toFixed(1)}%`;
      } else {
        fallbackReason = "OCR text validation failed (missing expected patterns)";
      }

      const visionResult = await extractLabelFields(
        imageBase64,
        mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif"
      );
      if (!visionResult.success) {
        return NextResponse.json(
          { error: `Vision fallback failed: ${visionResult.error}` },
          { status: 500 }
        );
      }
      extractedFields = visionResult.fields;
    }

    // Build field results
    const fieldResults: FieldResult[] = [];

    // Compare standard fields (not government warning - handled separately)
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

      // Skip optional fields that weren't provided
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
      });
    }

    // Add government warning verification (multiple sub-checks)
    const warningResults = verifyGovernmentWarning(
      extractedFields,
      applicationData.governmentWarning || STANDARD_WARNING_TEXT
    );
    fieldResults.push(...warningResults);

    // Compute overall status
    const overallStatus = computeOverallStatus(fieldResults);
    const totalTimeMs = Date.now() - startTime;

    const result: OCRVerificationResult = {
      overallStatus,
      processingTimeMs: totalTimeMs,
      extractedFields,
      fieldResults,
      timing: {
        ocrTimeMs,
        classificationTimeMs,
        totalTimeMs,
        usedFallback,
        fallbackReason,
      },
      ocrConfidence: ocrResult.success ? ocrResult.confidence : undefined,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during verification";
    console.error("OCR Verification error:", error);

    return NextResponse.json(
      { error: `Verification failed: ${message}` },
      { status: 500 }
    );
  }
}
