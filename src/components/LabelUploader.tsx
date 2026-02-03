"use client";

import { useState, useCallback, useRef } from "react";

interface LabelUploaderProps {
  onImageSelect: (file: File, preview: string) => void;
  currentPreview: string | null;
}

// Claude Vision API optimal dimensions (per PRD Section 3.7)
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;
const MAX_FINAL_SIZE = 5 * 1024 * 1024; // 5MB

async function preprocessImage(file: File): Promise<{ file: File; preview: string; wasResized: boolean }> {
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

export default function LabelUploader({
  onImageSelect,
  currentPreview,
}: LabelUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a JPG, PNG, WebP, or GIF image");
        return;
      }

      // Validate file size (20MB max before processing - generous limit)
      if (file.size > 20 * 1024 * 1024) {
        setError("Image must be under 20MB");
        return;
      }

      try {
        setIsProcessing(true);

        // Preprocess image: resize and compress for optimal API performance
        const { file: processedFile, preview } = await preprocessImage(file);

        // Validate final size after processing
        if (processedFile.size > MAX_FINAL_SIZE) {
          setError("Image still too large after compression. Please use a smaller image.");
          return;
        }

        onImageSelect(processedFile, preview);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process image");
      } finally {
        setIsProcessing(false);
      }
    },
    [onImageSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        validateAndProcessFile(file);
      }
    },
    [validateAndProcessFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        validateAndProcessFile(file);
      }
    },
    [validateAndProcessFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="space-y-4">
      <label className="block text-lg font-semibold text-gray-800">
        Label Image
      </label>

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : currentPreview
                ? "border-green-400 bg-green-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isProcessing ? (
          <div className="space-y-4">
            <div className="animate-spin text-4xl">⏳</div>
            <p className="text-lg text-gray-700">Processing image...</p>
            <p className="text-sm text-gray-500">Optimizing for verification</p>
          </div>
        ) : currentPreview ? (
          <div className="space-y-4">
            <img
              src={currentPreview}
              alt="Label preview"
              className="max-h-64 mx-auto rounded-lg shadow-md"
            />
            <p className="text-sm text-gray-600">
              Click or drag to replace image
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl">📷</div>
            <p className="text-lg text-gray-700">
              Drop label image here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports JPG, PNG, WebP, GIF - auto-optimized for fast verification
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-600 text-sm font-medium">{error}</p>
      )}
    </div>
  );
}
