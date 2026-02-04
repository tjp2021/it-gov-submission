import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExtractedFields } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Gemini 2.0 Flash - fast and accurate
const MODEL = "gemini-2.0-flash";

const EXTRACTION_PROMPT = `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) label analysis specialist. Extract specific regulatory fields from this alcohol beverage label image.

Extract EXACTLY what appears on the label — do not correct, normalize, or interpret.

Return a JSON object with these fields:
{
  "brand_name": "string or null",
  "class_type": "string or null",
  "alcohol_content": "string or null",
  "net_contents": "string or null",
  "name_address": "string or null",
  "country_of_origin": "string or null",
  "government_warning": "string or null - the COMPLETE warning text INCLUDING the 'GOVERNMENT WARNING:' header",
  "government_warning_header_format": "ALL_CAPS" | "MIXED_CASE" | "NOT_FOUND",
  "government_warning_header_emphasis": "APPEARS_BOLD_OR_HEAVY" | "APPEARS_NORMAL_WEIGHT" | "UNCERTAIN",
  "additional_observations": "string or null"
}

For government_warning_header_format:
- ALL_CAPS if "GOVERNMENT WARNING" is entirely uppercase
- MIXED_CASE if any lowercase letters present
- NOT_FOUND if warning not visible

For government_warning_header_emphasis:
- APPEARS_BOLD_OR_HEAVY if the header looks visually heavier than surrounding text
- APPEARS_NORMAL_WEIGHT if it appears same weight
- UNCERTAIN if you cannot determine

Return ONLY valid JSON, no markdown, no explanation.`;

interface ExtractionResult {
  success: true;
  fields: ExtractedFields;
  processingTimeMs: number;
}

interface ExtractionError {
  success: false;
  error: string;
  processingTimeMs: number;
}

export type GeminiExtractionResponse = ExtractionResult | ExtractionError;

/**
 * Extract label fields from an image using Gemini Flash
 * @param imageBase64 - Base64 encoded image data
 * @param mediaType - Image MIME type
 */
export async function extractWithGemini(
  imageBase64: string,
  mediaType: string
): Promise<GeminiExtractionResponse> {
  const startTime = Date.now();

  try {
    const model = genAI.getGenerativeModel({ model: MODEL });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mediaType,
          data: imageBase64,
        },
      },
      { text: EXTRACTION_PROMPT },
    ]);

    const processingTimeMs = Date.now() - startTime;
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    let parsed: Record<string, unknown>;
    try {
      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch {
      return {
        success: false,
        error: `Failed to parse Gemini response as JSON: ${text.substring(0, 200)}`,
        processingTimeMs,
      };
    }

    // Map to ExtractedFields
    const fields: ExtractedFields = {
      brandName: (parsed.brand_name as string) || null,
      classType: (parsed.class_type as string) || null,
      alcoholContent: (parsed.alcohol_content as string) || null,
      netContents: (parsed.net_contents as string) || null,
      nameAddress: (parsed.name_address as string) || null,
      countryOfOrigin: (parsed.country_of_origin as string) || null,
      governmentWarning: (parsed.government_warning as string) || null,
      governmentWarningHeaderFormat:
        (parsed.government_warning_header_format as
          | "ALL_CAPS"
          | "MIXED_CASE"
          | "NOT_FOUND") || "NOT_FOUND",
      governmentWarningHeaderEmphasis:
        (parsed.government_warning_header_emphasis as
          | "APPEARS_BOLD_OR_HEAVY"
          | "APPEARS_NORMAL_WEIGHT"
          | "UNCERTAIN") || "UNCERTAIN",
      additionalObservations:
        (parsed.additional_observations as string) || null,
    };

    return { success: true, fields, processingTimeMs };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const message =
      error instanceof Error ? error.message : "Unknown Gemini error";
    return { success: false, error: message, processingTimeMs };
  }
}
