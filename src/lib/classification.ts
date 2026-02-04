import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedFields } from "./types";

const client = new Anthropic();

// Try Haiku 3 for fast, low-cost classification
// Falls back to Sonnet if Haiku not available
const CLASSIFICATION_MODEL = "claude-3-haiku-20240307";

// Tool definition for structured label field classification
const classifyLabelFieldsTool: Anthropic.Tool = {
  name: "classify_label_fields",
  description:
    "Classify and extract TTB label fields from OCR-extracted text",
  input_schema: {
    type: "object" as const,
    properties: {
      brand_name: {
        type: "string",
        description:
          "The brand name as it appears in the text, preserving exact capitalization and punctuation. Null if not found.",
      },
      class_type: {
        type: "string",
        description:
          "The class and/or type designation (e.g., 'Kentucky Straight Bourbon Whiskey', 'Cabernet Sauvignon', 'India Pale Ale'). Null if not found.",
      },
      alcohol_content: {
        type: "string",
        description:
          "The alcohol content statement exactly as shown (e.g., '40% Alc./Vol. (80 Proof)'). Null if not found.",
      },
      net_contents: {
        type: "string",
        description:
          "The net contents statement (e.g., '750 mL', '12 FL. OZ.'). Null if not found.",
      },
      name_address: {
        type: "string",
        description:
          "The name and address of the producer, bottler, or importer. Null if not found.",
      },
      country_of_origin: {
        type: "string",
        description: "Country of origin if mentioned in the text. Null if not found.",
      },
      government_warning: {
        type: "string",
        description:
          "The complete government warning statement text. Include EXACTLY as it appears, preserving capitalization. Null if not found.",
      },
      government_warning_header_format: {
        type: "string",
        enum: ["ALL_CAPS", "MIXED_CASE", "NOT_FOUND"],
        description:
          "The capitalization of the 'GOVERNMENT WARNING:' header based on the text. Report ALL_CAPS if 'GOVERNMENT WARNING' appears entirely uppercase, MIXED_CASE if any lowercase letters are present, NOT_FOUND if warning not visible.",
      },
      additional_observations: {
        type: "string",
        description:
          "Any notable observations about text quality, missing information, or potential compliance concerns. Null if none.",
      },
    },
    required: [
      "brand_name",
      "class_type",
      "alcohol_content",
      "net_contents",
      "name_address",
      "government_warning",
      "government_warning_header_format",
    ],
  },
};

const SYSTEM_PROMPT = `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) label classification specialist. Your job is to extract specific regulatory fields from OCR-extracted text of alcohol beverage labels.

The text you receive has been extracted via OCR from a label image. It may contain OCR errors, line breaks, or formatting artifacts.

Extract EXACTLY what appears in the text — do not correct spelling errors that might be OCR mistakes, but DO fix obvious line break issues in the middle of words. If a field is not present in the text, return null for that field.

For the government warning header format:
- Check if "GOVERNMENT WARNING" appears in ALL CAPS in the text
- If it appears as "Government Warning" or any mixed case, report MIXED_CASE
- If not found, report NOT_FOUND

Use the classify_label_fields tool to return your findings in a structured format.`;

interface ClassificationResult {
  success: true;
  fields: ExtractedFields;
  processingTimeMs: number;
}

interface ClassificationError {
  success: false;
  error: string;
  processingTimeMs: number;
}

export type ClassificationResponse = ClassificationResult | ClassificationError;

/**
 * Classify label text into structured fields using Claude Haiku
 * @param rawText - OCR-extracted text from label image
 */
export async function classifyLabelText(
  rawText: string
): Promise<ClassificationResponse> {
  const startTime = Date.now();

  try {
    const response = await client.messages.create({
      model: CLASSIFICATION_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [classifyLabelFieldsTool],
      tool_choice: { type: "tool", name: "classify_label_fields" },
      messages: [
        {
          role: "user",
          content: `Extract all mandatory TTB label fields from this OCR text:\n\n${rawText}`,
        },
      ],
    });

    const processingTimeMs = Date.now() - startTime;

    // Find the tool use block in the response
    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return {
        success: false,
        error: "No tool use response from Claude",
        processingTimeMs,
      };
    }

    const input = toolUseBlock.input as Record<string, unknown>;

    // Map the tool response to our ExtractedFields type
    // Note: governmentWarningHeaderEmphasis is always UNCERTAIN for OCR
    // because we cannot detect bold from text alone
    const fields: ExtractedFields = {
      brandName: (input.brand_name as string) || null,
      classType: (input.class_type as string) || null,
      alcoholContent: (input.alcohol_content as string) || null,
      netContents: (input.net_contents as string) || null,
      nameAddress: (input.name_address as string) || null,
      countryOfOrigin: (input.country_of_origin as string) || null,
      governmentWarning: (input.government_warning as string) || null,
      governmentWarningHeaderFormat:
        (input.government_warning_header_format as
          | "ALL_CAPS"
          | "MIXED_CASE"
          | "NOT_FOUND") || "NOT_FOUND",
      // OCR cannot detect bold - always return UNCERTAIN
      // This triggers WARNING status, same behavior as Vision when uncertain
      governmentWarningHeaderEmphasis: "UNCERTAIN",
      additionalObservations:
        (input.additional_observations as string) || null,
    };

    return { success: true, fields, processingTimeMs };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const message =
      error instanceof Error ? error.message : "Unknown error during classification";
    return { success: false, error: message, processingTimeMs };
  }
}
