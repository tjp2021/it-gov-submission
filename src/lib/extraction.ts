import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedFields } from "./types";

const client = new Anthropic();

// Model configuration - use CLAUDE_MODEL env var to switch
// Options: "sonnet" (default, most accurate) or "haiku" (faster, lower cost)
const MODEL_MAP = {
  sonnet: "claude-sonnet-4-20250514",
  haiku: "claude-haiku-3-5-20241022",
} as const;

function getModel(): string {
  const modelKey = (process.env.CLAUDE_MODEL || "sonnet").toLowerCase();
  return MODEL_MAP[modelKey as keyof typeof MODEL_MAP] || MODEL_MAP.sonnet;
}

// Tool definition for structured label extraction
const extractLabelFieldsTool: Anthropic.Tool = {
  name: "extract_label_fields",
  description:
    "Extract mandatory TTB label fields from an alcohol beverage label image",
  input_schema: {
    type: "object" as const,
    properties: {
      brand_name: {
        type: "string",
        description:
          "The brand name as it appears on the label, preserving exact capitalization and punctuation. Null if not visible.",
      },
      class_type: {
        type: "string",
        description:
          "The class and/or type designation (e.g., 'Kentucky Straight Bourbon Whiskey', 'Cabernet Sauvignon', 'India Pale Ale'). Null if not visible.",
      },
      alcohol_content: {
        type: "string",
        description:
          "The alcohol content statement exactly as shown (e.g., '40% Alc./Vol. (80 Proof)'). Null if not visible.",
      },
      net_contents: {
        type: "string",
        description:
          "The net contents statement (e.g., '750 mL', '12 FL. OZ.'). Null if not visible.",
      },
      name_address: {
        type: "string",
        description:
          "The name and address of the producer, bottler, or importer as shown on the label. Null if not visible.",
      },
      country_of_origin: {
        type: "string",
        description: "Country of origin if shown on the label. Null if not visible.",
      },
      government_warning: {
        type: "string",
        description:
          "The complete government warning statement text. Include EXACTLY as printed, preserving capitalization. Null if not visible.",
      },
      government_warning_header_format: {
        type: "string",
        enum: ["ALL_CAPS", "MIXED_CASE", "NOT_FOUND"],
        description:
          "The capitalization of the 'GOVERNMENT WARNING:' header. Report ALL_CAPS if entirely uppercase, MIXED_CASE if any lowercase letters are present, NOT_FOUND if warning not visible.",
      },
      government_warning_header_emphasis: {
        type: "string",
        enum: ["APPEARS_BOLD_OR_HEAVY", "APPEARS_NORMAL_WEIGHT", "UNCERTAIN"],
        description:
          "Best-effort assessment of whether the header text appears visually heavier/bolder than the surrounding warning text. Report UNCERTAIN if you cannot confidently determine the font weight from the image.",
      },
      additional_observations: {
        type: "string",
        description:
          "Any notable observations about label quality, readability issues, or potential compliance concerns. Null if none.",
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
      "government_warning_header_emphasis",
    ],
  },
};

const SYSTEM_PROMPT = `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) label analysis specialist. Your job is to extract specific regulatory fields from alcohol beverage labels with extreme accuracy.

Extract EXACTLY what appears on the label — do not correct, normalize, or interpret. If text is unclear, extract your best reading and note the uncertainty in additional_observations. If a field is not visible on the label, return null for that field.

Use the extract_label_fields tool to return your findings in a structured format.`;

interface ExtractionResult {
  success: true;
  fields: ExtractedFields;
}

interface ExtractionError {
  success: false;
  error: string;
}

export type ExtractionResponse = ExtractionResult | ExtractionError;

/**
 * Extract label fields from an image using Claude Vision
 * @param imageBase64 - Base64 encoded image data
 * @param mediaType - Image MIME type (image/jpeg, image/png, image/webp, image/gif)
 */
export async function extractLabelFields(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<ExtractionResponse> {
  try {
    const model = getModel();
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [extractLabelFieldsTool],
      tool_choice: { type: "tool", name: "extract_label_fields" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Extract all mandatory TTB label fields from this alcohol beverage label image.",
            },
          ],
        },
      ],
    });

    // Find the tool use block in the response
    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return {
        success: false,
        error: "No tool use response from Claude",
      };
    }

    const input = toolUseBlock.input as Record<string, unknown>;

    // Map the tool response to our ExtractedFields type
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
      governmentWarningHeaderEmphasis:
        (input.government_warning_header_emphasis as
          | "APPEARS_BOLD_OR_HEAVY"
          | "APPEARS_NORMAL_WEIGHT"
          | "UNCERTAIN") || "UNCERTAIN",
      additionalObservations:
        (input.additional_observations as string) || null,
    };

    return { success: true, fields };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during extraction";
    return { success: false, error: message };
  }
}
