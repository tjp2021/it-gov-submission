import Tesseract from "tesseract.js";
import sharp from "sharp";

export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  processingTimeMs: number;
}

export interface OCRError {
  success: false;
  text: "";
  confidence: 0;
  processingTimeMs: number;
  error: string;
}

/**
 * Preprocess image for better OCR accuracy
 * - Convert to grayscale
 * - Increase contrast
 * - Ensure reasonable size for processing
 */
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .grayscale()
    .normalize() // Auto-contrast
    .sharpen({ sigma: 1.0 }) // Slight sharpening for text clarity
    .toBuffer();
}

/**
 * Validate OCR output has expected patterns for alcohol labels
 * Returns true if text appears to be valid label content
 */
export function validateOCRText(text: string): boolean {
  if (text.length < 50) return false;

  // Check for expected patterns in alcohol labels
  const hasPercentOrProof = /%|proof/i.test(text);
  const hasVolumeIndicator = /ml|oz|liter|l\b/i.test(text);
  const hasWarningOrAlcohol = /warning|alcohol|surgeon|pregnancy/i.test(text);

  // Must have at least 2 of 3 patterns to be considered valid
  const patternCount = [hasPercentOrProof, hasVolumeIndicator, hasWarningOrAlcohol].filter(
    Boolean
  ).length;

  return patternCount >= 2;
}

/**
 * Extract text from image using Tesseract.js OCR
 * @param imageBase64 - Base64 encoded image data
 * @param mediaType - Image MIME type
 */
export async function extractTextFromImage(
  imageBase64: string,
  mediaType: string
): Promise<OCRResult | OCRError> {
  const startTime = Date.now();

  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, "base64");

    // Preprocess image for better OCR accuracy
    const processedBuffer = await preprocessImage(imageBuffer);

    // Run Tesseract OCR
    const result = await Tesseract.recognize(processedBuffer, "eng", {
      // Use default worker from CDN for simplicity
      // In production, could use local worker for better performance
    });

    const processingTimeMs = Date.now() - startTime;

    return {
      success: true,
      text: result.data.text,
      confidence: result.data.confidence,
      processingTimeMs,
    };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown OCR error";

    return {
      success: false,
      text: "",
      confidence: 0,
      processingTimeMs,
      error: message,
    };
  }
}

/**
 * Check if OCR result is reliable enough to use
 * @param result - OCR result to evaluate
 * @param confidenceThreshold - Minimum confidence (default 50%)
 */
export function isOCRReliable(
  result: OCRResult | OCRError,
  confidenceThreshold: number = 50
): boolean {
  if (!result.success) return false;

  // Check confidence threshold
  if (result.confidence < confidenceThreshold) return false;

  // Validate text has expected patterns
  if (!validateOCRText(result.text)) return false;

  return true;
}
