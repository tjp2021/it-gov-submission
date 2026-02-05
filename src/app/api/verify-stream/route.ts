import { NextRequest } from "next/server";
import { extractWithGemini } from "@/lib/gemini-extraction";
import { compareField } from "@/lib/comparison";
import { verifyGovernmentWarning } from "@/lib/warning-check";
import { FIELD_CONFIG, STANDARD_WARNING_TEXT } from "@/lib/constants";
import { mergeExtractions, getUnresolvedConflicts } from "@/lib/merge-extraction";
import type {
  ApplicationData,
  ExtractedFields,
  FieldResult,
  VerificationResult,
  OverallStatus,
  MatchType,
  ImageSource,
  ImageLabel,
  ImageExtraction,
  MergedExtraction,
  MultiImageFieldResult,
  MultiImageVerificationResult,
  PendingConfirmation,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // Increased for multi-image processing

function computeOverallStatus(fieldResults: FieldResult[]): OverallStatus {
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

function buildPendingConfirmations(fieldResults: FieldResult[]): PendingConfirmation[] {
  // Build pending confirmations from "confirmation" category results
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

interface ParsedImage {
  index: number;
  file: File;
  label: ImageLabel;
}

const MAX_IMAGES = 6;
const MIN_IMAGE_SIZE = 100; // Minimum 100 bytes for a valid image

async function parseMultiImageFormData(formData: FormData): Promise<{
  images: ParsedImage[];
  applicationData: ApplicationData;
}> {
  const applicationDataJson = formData.get("applicationData") as string | null;

  if (!applicationDataJson) {
    throw new Error("Missing application data");
  }

  const applicationData: ApplicationData = JSON.parse(applicationDataJson);

  // Parse image labels
  const imageLabelsJson = formData.get("imageLabels") as string | null;
  const imageLabels: Record<string, ImageLabel> = imageLabelsJson
    ? JSON.parse(imageLabelsJson)
    : {};

  // Collect all images
  const images: ParsedImage[] = [];

  // Check for single image (backward compatibility)
  const singleImage = formData.get("labelImage") as File | null;
  if (singleImage && singleImage.size > 0) {
    images.push({
      index: 0,
      file: singleImage,
      label: imageLabels["0"] || "front",
    });
  }

  // Check for multi-image format: labelImage_0, labelImage_1, etc.
  // Only check up to MAX_IMAGES
  for (let i = 0; i < MAX_IMAGES; i++) {
    const image = formData.get(`labelImage_${i}`) as File | null;
    if (image && image.size > 0) {
      images.push({
        index: i,
        file: image,
        label: imageLabels[String(i)] || "other",
      });
    }
  }

  // Check if too many images were provided (beyond our limit)
  const extraImage = formData.get(`labelImage_${MAX_IMAGES}`) as File | null;
  if (extraImage) {
    throw new Error(`Maximum ${MAX_IMAGES} images allowed`);
  }

  if (images.length === 0) {
    throw new Error("At least one image is required");
  }

  // Validate each image has minimum size
  for (const img of images) {
    if (img.file.size < MIN_IMAGE_SIZE) {
      throw new Error(`Image ${img.file.name || img.index} is too small or empty`);
    }
  }

  return { images, applicationData };
}

async function extractFromImage(
  file: File,
  imageId: string,
  label: ImageLabel,
  fileName: string
): Promise<ImageExtraction> {
  const startTime = Date.now();

  const imageBuffer = await file.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString("base64");
  const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  const extractionResult = await extractWithGemini(imageBase64, mimeType);

  if (!extractionResult.success) {
    throw new Error(`Extraction failed for ${fileName}: ${extractionResult.error}`);
  }

  return {
    source: {
      imageId,
      imageLabel: label,
      fileName,
    },
    fields: extractionResult.fields,
    processingTimeMs: Date.now() - startTime,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Pre-validate input before starting SSE stream
  // This ensures validation errors return proper 400 status
  let formData: FormData;
  let parsedInput: { images: ParsedImage[]; applicationData: ApplicationData };

  try {
    formData = await request.formData();
    parsedInput = await parseMultiImageFormData(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { images, applicationData } = parsedInput;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // Stage 1: Parse input (already validated above)
        send("progress", { stage: "parsing", message: "Parsing request...", elapsed: Date.now() - startTime });

        const isMultiImage = images.length > 1;
        const imageSources: ImageSource[] = images.map((img, idx) => ({
          imageId: `img-${idx}`,
          imageLabel: img.label,
          fileName: img.file.name,
        }));

        send("progress", {
          stage: "processing",
          message: `Processing ${images.length} image${images.length > 1 ? "s" : ""}...`,
          imageCount: images.length,
          elapsed: Date.now() - startTime,
        });

        // Stage 2: Extract from all images in parallel
        const extractionPromises = images.map((img, idx) => {
          const imageId = `img-${idx}`;
          send("image_extraction_start", {
            imageId,
            label: img.label,
            index: idx,
            total: images.length,
          });

          return extractFromImage(img.file, imageId, img.label, img.file.name)
            .then((result) => {
              send("image_extraction_complete", {
                imageId,
                label: img.label,
                fields: result.fields,
                processingTimeMs: result.processingTimeMs,
              });
              return result;
            });
        });

        const imageExtractions = await Promise.all(extractionPromises);

        let extractedFields: ExtractedFields;
        let mergedExtraction: MergedExtraction | null = null;
        let fieldSourcesMap: Record<string, ImageSource[]> = {};

        if (isMultiImage) {
          // Merge extractions from multiple images
          send("progress", { stage: "merging", message: "Merging extractions...", elapsed: Date.now() - startTime });

          mergedExtraction = mergeExtractions(imageExtractions);
          extractedFields = mergedExtraction.fields;

          // Build field sources map
          for (const [fieldKey, sourced] of Object.entries(mergedExtraction.fieldSources)) {
            fieldSourcesMap[fieldKey] = sourced.sources;
          }

          // Notify about conflicts
          if (mergedExtraction.conflicts.length > 0) {
            send("conflict_detected", {
              conflictCount: mergedExtraction.conflicts.length,
              conflicts: mergedExtraction.conflicts,
            });
          }

          send("merge_complete", {
            mergedFields: extractedFields,
            conflictCount: mergedExtraction.conflicts.length,
          });
        } else {
          // Single image - use directly
          extractedFields = imageExtractions[0].fields;

          // All fields from single image
          const singleSource = imageSources[0];
          const fieldKeys = ["brandName", "classType", "alcoholContent", "netContents", "nameAddress", "countryOfOrigin", "governmentWarning"];
          for (const key of fieldKeys) {
            if (getExtractedValue(extractedFields, key)) {
              fieldSourcesMap[key] = [singleSource];
            }
          }
        }

        send("progress", { stage: "extracted", message: "Label analyzed", elapsed: Date.now() - startTime });

        // Stage 3: Compare fields
        send("progress", { stage: "comparing", message: "Comparing fields...", elapsed: Date.now() - startTime });

        const fieldResults: MultiImageFieldResult[] = [];
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

          const sources = fieldSourcesMap[fieldKey] || [];
          const conflict = mergedExtraction?.conflicts.find(c => c.fieldKey === fieldKey);

          const fieldResult: MultiImageFieldResult = {
            fieldName: config.displayName,
            applicationValue: applicationValue || "",
            extractedValue,
            status: matchResult.status,
            matchType: config.matchType as MatchType,
            confidence: matchResult.confidence,
            details: matchResult.details,
            category: "automated",  // Standard fields contribute to overall status
            // Multi-image specific fields
            sources: sources.length > 0 ? sources : undefined,
            confirmedOnImages: sources.length > 0 ? sources.length : undefined,
            hadConflict: conflict !== undefined,
            conflictResolution: conflict?.selectedValue
              ? {
                  selectedValue: conflict.selectedValue,
                  selectedFromImage: conflict.candidates.find(
                    c => c.value === conflict.selectedValue
                  )?.sources[0]?.imageId || "",
                  rejectedValues: conflict.candidates
                    .filter(c => c.value !== conflict.selectedValue)
                    .map(c => ({
                      value: c.value,
                      fromImages: c.sources.map(s => s.imageId),
                    })),
                  resolvedAt: conflict.selectedAt || new Date().toISOString(),
                }
              : undefined,
          };

          fieldResults.push(fieldResult);
          send("field", fieldResult);
        }

        // Government warning checks
        const warningResults = verifyGovernmentWarning(
          extractedFields,
          applicationData.governmentWarning || STANDARD_WARNING_TEXT
        );

        for (const warningResult of warningResults) {
          const multiImageWarningResult: MultiImageFieldResult = {
            ...warningResult,
            sources: fieldSourcesMap["governmentWarning"],
            confirmedOnImages: fieldSourcesMap["governmentWarning"]?.length,
          };
          fieldResults.push(multiImageWarningResult);
          send("field", multiImageWarningResult);
        }

        // Stage 4: Final result
        const overallStatus = computeOverallStatus(fieldResults);
        const pendingConfirmations = buildPendingConfirmations(fieldResults);
        const processingTimeMs = Date.now() - startTime;

        if (isMultiImage && mergedExtraction) {
          const result: MultiImageVerificationResult = {
            overallStatus,
            pendingConfirmations,
            processingTimeMs,
            extractedFields,
            fieldResults,
            // Multi-image specific
            imageCount: images.length,
            images: imageSources,
            mergedExtraction,
            unresolvedConflicts: getUnresolvedConflicts(mergedExtraction),
          };

          send("complete", result);
        } else {
          // Single image - return standard result for backward compatibility
          const result: VerificationResult = {
            overallStatus,
            pendingConfirmations,
            processingTimeMs,
            extractedFields,
            fieldResults,
          };

          send("complete", result);
        }

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
