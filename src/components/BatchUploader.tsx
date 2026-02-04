"use client";

import { useState, useCallback, useRef } from "react";

interface BatchFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "processing" | "done" | "error";
}

interface BatchUploaderProps {
  onFilesSelect: (files: BatchFile[]) => void;
  files: BatchFile[];
}

const MAX_BATCH_SIZE = 300;
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;
const MAX_FINAL_SIZE = 5 * 1024 * 1024; // 5MB

async function preprocessImage(file: File): Promise<{ file: File; preview: string }> {
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
        resolve({ file, preview: img.src });
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

          const processedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" }
          );

          const preview = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
          resolve({ file: processedFile, preview });
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function BatchUploader({ onFilesSelect, files }: BatchUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (fileList: FileList) => {
      setError(null);
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const newFiles: BatchFile[] = [];

      // Check if we've already hit the limit
      const remainingSlots = MAX_BATCH_SIZE - files.length;
      if (remainingSlots <= 0) {
        setError(`Maximum ${MAX_BATCH_SIZE} labels per batch.`);
        return;
      }

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        // Stop if we've hit the limit
        if (newFiles.length >= remainingSlots) {
          setError(`Maximum ${MAX_BATCH_SIZE} labels per batch. Only added ${newFiles.length} of ${fileList.length} files.`);
          break;
        }

        if (!validTypes.includes(file.type)) {
          continue; // Skip invalid files
        }

        if (file.size > 20 * 1024 * 1024) {
          continue; // Skip files > 20MB
        }

        // Preprocess image: resize and compress for optimal API performance
        try {
          const { file: processedFile, preview } = await preprocessImage(file);

          // Skip if still too large after compression
          if (processedFile.size > MAX_FINAL_SIZE) {
            continue;
          }

          newFiles.push({
            id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
            file: processedFile,
            preview,
            status: "pending",
          });
        } catch {
          // Skip files that fail to process
          continue;
        }
      }

      if (newFiles.length === 0 && fileList.length > 0) {
        setError("No valid image files found. Please upload JPG, PNG, WebP, or GIF files.");
        return;
      }

      onFilesSelect([...files, ...newFiles]);
    },
    [files, onFilesSelect]
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
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      onFilesSelect(files.filter((f) => f.id !== id));
    },
    [files, onFilesSelect]
  );

  const handleClearAll = useCallback(() => {
    onFilesSelect([]);
  }, [onFilesSelect]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-lg font-semibold text-gray-800">
          Label Images ({files.length}/{MAX_BATCH_SIZE} selected)
        </label>
        {files.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear All
          </button>
        )}
      </div>

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : files.length > 0
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
          multiple
        />

        <div className="space-y-2">
          <div className="text-3xl">📁</div>
          <p className="text-lg text-gray-700">
            Drop multiple label images here or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supports JPG, PNG, WebP, GIF - select multiple files at once
          </p>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm font-medium">{error}</p>}

      {/* File Preview Grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
          {files.map((f) => (
            <div
              key={f.id}
              className={`relative group rounded-lg overflow-hidden border-2 ${
                f.status === "done"
                  ? "border-green-400"
                  : f.status === "error"
                    ? "border-red-400"
                    : f.status === "processing"
                      ? "border-blue-400"
                      : "border-gray-200"
              }`}
            >
              <img
                src={f.preview}
                alt={f.file.name}
                className="w-full h-24 object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity" />

              {/* Status Badge */}
              <div className="absolute top-1 left-1">
                {f.status === "processing" && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    Processing...
                  </span>
                )}
                {f.status === "done" && (
                  <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded">
                    Done
                  </span>
                )}
                {f.status === "error" && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded">
                    Error
                  </span>
                )}
              </div>

              {/* Remove Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(f.id);
                }}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>

              {/* Filename */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                {f.file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
