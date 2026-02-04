import { NextRequest } from "next/server";
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Create a streaming response using Server-Sent Events
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // Stage 1: Parse input
        send("progress", { stage: "parsing", message: "Parsing request...", elapsed: Date.now() - startTime });

        const formData = await request.formData();
        const imageFile = formData.get("labelImage") as File | null;
        const applicationDataJson = formData.get("applicationData") as string | null;

        if (!imageFile || !applicationDataJson) {
          send("error", { error: "Missing image or application data" });
          controller.close();
          return;
        }

        let applicationData: ApplicationData;
        try {
          applicationData = JSON.parse(applicationDataJson);
        } catch {
          send("error", { error: "Invalid application data JSON" });
          controller.close();
          return;
        }

        // Stage 2: Process image
        send("progress", { stage: "processing", message: "Processing image...", elapsed: Date.now() - startTime });

        const imageBuffer = await imageFile.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString("base64");
        const mimeType = imageFile.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

        // Stage 3: Extract with Gemini Flash
        send("progress", { stage: "extracting", message: "Analyzing label with AI...", elapsed: Date.now() - startTime });

        const extractionResult = await extractWithGemini(imageBase64, mimeType);

        if (!extractionResult.success) {
          send("error", { error: `Extraction failed: ${extractionResult.error}` });
          controller.close();
          return;
        }

        const extractedFields = extractionResult.fields;
        send("progress", { stage: "extracted", message: "Label analyzed", elapsed: Date.now() - startTime });

        // Stage 4: Compare fields
        send("progress", { stage: "comparing", message: "Comparing fields...", elapsed: Date.now() - startTime });

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
          const applicationValue = applicationData[fieldKey as keyof ApplicationData];

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

          const fieldResult: FieldResult = {
            fieldName: config.displayName,
            applicationValue: applicationValue || "",
            extractedValue,
            status: matchResult.status,
            matchType: config.matchType as MatchType,
            confidence: matchResult.confidence,
            details: matchResult.details,
          };

          fieldResults.push(fieldResult);

          // Stream each field result as it's computed
          send("field", fieldResult);
        }

        // Government warning checks
        const warningResults = verifyGovernmentWarning(
          extractedFields,
          applicationData.governmentWarning || STANDARD_WARNING_TEXT
        );

        for (const warningResult of warningResults) {
          fieldResults.push(warningResult);
          send("field", warningResult);
        }

        // Stage 5: Final result
        const overallStatus = computeOverallStatus(fieldResults);
        const processingTimeMs = Date.now() - startTime;

        const result: VerificationResult = {
          overallStatus,
          processingTimeMs,
          extractedFields,
          fieldResults,
        };

        send("complete", result);
        controller.close();

      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send("error", { error: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
