// Claude Vision API optimal dimensions (per PRD Section 3.7)
export const MAX_DIMENSION = 1568;
export const JPEG_QUALITY = 0.85;
export const MAX_FINAL_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB pre-processing

export const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface PreprocessResult {
  file: File;
  preview: string;
  wasResized: boolean;
}

/**
 * Preprocesses an image for optimal API performance:
 * - Resizes if dimensions exceed MAX_DIMENSION
 * - Compresses to JPEG with quality setting
 */
export async function preprocessImage(file: File): Promise<PreprocessResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      img.src = dataUrl;
    };

    img.onload = () => {
      const { width, height } = img;
      const longestEdge = Math.max(width, height);

      // Check if resizing is needed
      if (longestEdge <= MAX_DIMENSION && file.size <= MAX_FINAL_SIZE) {
        // No preprocessing needed - return original
        resolve({ file, preview: img.src, wasResized: false });
        return;
      }

      // Calculate new dimensions maintaining aspect ratio
      let newWidth = width;
      let newHeight = height;
      if (longestEdge > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / longestEdge;
        newWidth = Math.round(width * scale);
        newHeight = Math.round(height * scale);
      }

      // Create canvas and draw resized image
      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Convert to JPEG blob with compression
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to compress image"));
            return;
          }

          // Create new File object from blob
          const processedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" }
          );

          // Get preview data URL
          const preview = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

          resolve({
            file: processedFile,
            preview,
            wasResized: width !== newWidth || height !== newHeight,
          });
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Validates a file for image upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: "Please upload a JPG, PNG, WebP, or GIF image" };
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return { valid: false, error: "Image must be under 20MB" };
  }

  return { valid: true };
}
