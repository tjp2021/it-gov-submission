"use client";

import { useState, useCallback, useRef } from "react";
import type { UploadedImage, ImageLabel } from "@/lib/types";
import {
  preprocessImage,
  validateImageFile,
  MAX_FINAL_SIZE,
} from "@/lib/image-preprocessing";

interface MultiImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
}

const IMAGE_LABELS: Array<{ value: ImageLabel; label: string }> = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "neck", label: "Neck" },
  { value: "side", label: "Side" },
  { value: "detail", label: "Detail" },
  { value: "other", label: "Other" },
];

function generateId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function MultiImageUploader({
  images,
  onImagesChange,
  maxImages = 6,
}: MultiImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingCount, setProcessingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);

      const fileArray = Array.from(files);
      const remainingSlots = maxImages - images.length;

      if (fileArray.length > remainingSlots) {
        setError(`Can only add ${remainingSlots} more image${remainingSlots !== 1 ? "s" : ""}`);
        return;
      }

      // Validate all files first
      for (const file of fileArray) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          setError(validation.error || "Invalid file");
          return;
        }
      }

      setProcessingCount(fileArray.length);

      try {
        // Process all files in parallel
        const processedImages = await Promise.all(
          fileArray.map(async (file, index): Promise<UploadedImage> => {
            const result = await preprocessImage(file);

            if (result.file.size > MAX_FINAL_SIZE) {
              throw new Error(`Image "${file.name}" still too large after compression`);
            }

            // Auto-assign label based on position and existing images
            const existingLabels = images.map(img => img.label);
            let defaultLabel: ImageLabel = "front";

            // Try to assign a logical default based on order
            const labelPriority: ImageLabel[] = ["front", "back", "neck", "side", "detail", "other"];
            for (const label of labelPriority) {
              if (!existingLabels.includes(label)) {
                defaultLabel = label;
                existingLabels.push(label); // Reserve for next iteration
                break;
              }
            }

            return {
              id: generateId(),
              file: result.file,
              preview: result.preview,
              label: defaultLabel,
            };
          })
        );

        onImagesChange([...images, ...processedImages]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process images");
      } finally {
        setProcessingCount(0);
      }
    },
    [images, onImagesChange, maxImages]
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

      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [processFiles]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveImage = useCallback(
    (id: string) => {
      onImagesChange(images.filter(img => img.id !== id));
    },
    [images, onImagesChange]
  );

  const handleLabelChange = useCallback(
    (id: string, label: ImageLabel) => {
      onImagesChange(
        images.map(img => (img.id === id ? { ...img, label } : img))
      );
    },
    [images, onImagesChange]
  );

  const canAddMore = images.length < maxImages;
  const isProcessing = processingCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-lg font-semibold text-gray-800">
          Label Images
        </label>
        <span className="text-sm text-gray-500">
          {images.length} of {maxImages} images
        </span>
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative border-2 border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              {/* Image Preview */}
              <div className="aspect-square relative">
                <img
                  src={image.preview}
                  alt={`Label ${image.label}`}
                  className="w-full h-full object-contain"
                />
                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveImage(image.id)}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center justify-center text-lg font-bold shadow-md"
                  title="Remove image"
                >
                  x
                </button>
              </div>

              {/* Label Selector */}
              <div className="p-2 border-t border-gray-200 bg-gray-50">
                <select
                  value={image.label}
                  onChange={(e) => handleLabelChange(image.id, e.target.value as ImageLabel)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {IMAGE_LABELS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone / Add More */}
      {canAddMore && (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-200
            ${isDragging
              ? "border-blue-500 bg-blue-50"
              : images.length > 0
                ? "border-gray-300 hover:border-gray-400 bg-gray-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {isProcessing ? (
            <div className="space-y-2">
              <div className="animate-spin text-3xl">...</div>
              <p className="text-gray-700">
                Processing {processingCount} image{processingCount !== 1 ? "s" : ""}...
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl">
                {images.length === 0 ? "+" : "+"}
              </div>
              <p className="text-gray-700">
                {images.length === 0
                  ? "Drop label images here or click to browse"
                  : "Add more images"}
              </p>
              <p className="text-sm text-gray-500">
                {images.length === 0
                  ? `Upload 1-${maxImages} images of the same product (front, back, neck, etc.)`
                  : `${maxImages - images.length} slot${maxImages - images.length !== 1 ? "s" : ""} remaining`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-red-600 text-sm font-medium">{error}</p>
      )}

      {/* Help Text */}
      {images.length === 0 && (
        <p className="text-sm text-gray-500">
          Tip: Upload multiple angles of the same product for better accuracy. The system will merge information from all images.
        </p>
      )}
    </div>
  );
}
