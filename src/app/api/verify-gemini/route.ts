import { NextRequest, NextResponse } from "next/server";
import { verifySingleLabel, SingleVerificationResult } from "@/lib/verify-single";
import type { ApplicationData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Re-export type for backwards compatibility
export type GeminiVerificationResult = SingleVerificationResult;

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Validate image is not empty (minimum 100 bytes for valid image)
    if (imageFile.size < 100) {
      return NextResponse.json(
        { error: "Image file is empty or too small" },
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

    const result = await verifySingleLabel(imageBase64, mimeType, applicationData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result.result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Gemini verification error:", error);

    return NextResponse.json(
      { error: `Verification failed: ${message}` },
      { status: 500 }
    );
  }
}
