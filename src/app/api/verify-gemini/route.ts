import { NextRequest, NextResponse } from "next/server";
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
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

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

export interface GeminiVerificationResult extends VerificationResult {
  engine: "gemini";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const imageFile = formData.get("labelImage") as File | null;
    const applicationDataJson = formData.get("applicationData") as string | null;

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

    const imageBuffer = await imageFile.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");

    const mimeType = imageFile.type;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)
    ) {
      return NextResponse.json(
        { error: `Unsupported image type: ${mimeType}` },
        { status: 400 }
      );
    }

    // Extract with Gemini Flash
    const extractionResult = await extractWithGemini(imageBase64, mimeType);

    if (!extractionResult.success) {
      return NextResponse.json(
        { error: `Gemini extraction failed: ${extractionResult.error}` },
        { status: 500 }
      );
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
      });
    }

    const warningResults = verifyGovernmentWarning(
      extractedFields,
      applicationData.governmentWarning || STANDARD_WARNING_TEXT
    );
    fieldResults.push(...warningResults);

    const overallStatus = computeOverallStatus(fieldResults);
    const processingTimeMs = Date.now() - startTime;

    const result: GeminiVerificationResult = {
      overallStatus,
      processingTimeMs,
      extractedFields,
      fieldResults,
      engine: "gemini",
    };

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Gemini verification error:", error);

    return NextResponse.json(
      { error: `Verification failed: ${message}` },
      { status: 500 }
    );
  }
}
