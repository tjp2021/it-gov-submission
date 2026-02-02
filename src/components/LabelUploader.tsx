"use client";

import { useState, useCallback, useRef } from "react";

interface LabelUploaderProps {
  onImageSelect: (file: File, preview: string) => void;
  currentPreview: string | null;
}

export default function LabelUploader({
  onImageSelect,
  currentPreview,
}: LabelUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = useCallback(
    (file: File) => {
      setError(null);

      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a JPG, PNG, WebP, or GIF image");
        return;
      }

      // Validate file size (10MB max before processing)
      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be under 10MB");
        return;
      }

      // Create preview and pass to parent
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = e.target?.result as string;
        onImageSelect(file, preview);
      };
      reader.readAsDataURL(file);
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

        {currentPreview ? (
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
              Supports JPG, PNG, WebP, GIF (max 10MB)
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
