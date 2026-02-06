"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { MatchedBatchItem } from "@/lib/types";
import { parseCSV } from "@/lib/csv-parser";
import { matchBatch, buildManualItem } from "@/lib/batch-matcher";

interface BatchUploaderProps {
  onReady: (items: MatchedBatchItem[]) => void;
  onClear: () => void;
}

const MAX_BATCH_SIZE = 10;
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;
const MAX_FINAL_SIZE = 5 * 1024 * 1024; // 5MB

type DataMode = "csv" | "manual";

interface ManualFormData {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  nameAddress: string;
  countryOfOrigin: string;
}

const emptyForm: ManualFormData = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  nameAddress: "",
  countryOfOrigin: "",
};

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

      if (longestEdge <= MAX_DIMENSION && file.size <= MAX_FINAL_SIZE) {
        resolve({ file, preview: img.src });
        return;
      }

      let newWidth = width;
      let newHeight = height;
      if (longestEdge > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / longestEdge;
        newWidth = Math.round(width * scale);
        newHeight = Math.round(height * scale);
      }

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

interface ProcessedFile {
  id: string;
  originalName: string;
  file: File;
  preview: string;
}

export default function BatchUploader({ onReady, onClear }: BatchUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("csv");
  const [manualForms, setManualForms] = useState<Record<string, ManualFormData>>({});

  // CSV state
  const [csvRows, setCsvRows] = useState<ReturnType<typeof parseCSV> | null>(null);
  const [matchResult, setMatchResult] = useState<ReturnType<typeof matchBatch> | null>(null);
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Re-run matching when files or CSV data changes
  useEffect(() => {
    if (dataMode === "csv" && csvRows && csvRows.data.length > 0 && processedFiles.length > 0) {
      const files = processedFiles.map((pf) => pf.file);
      const result = matchBatch(files, csvRows.data);
      setMatchResult(result);

      if (result.matched.length > 0 && result.unmatchedImages.length === 0 && result.unmatchedRows.length === 0) {
        onReady(result.matched);
      } else if (result.matched.length > 0) {
        // Partial match — still provide what we have so parent can decide
        onReady(result.matched);
      } else {
        onReady([]);
      }
    } else if (dataMode === "csv") {
      setMatchResult(null);
      onReady([]);
    }
  }, [dataMode, csvRows, processedFiles, onReady]);

  // Re-build manual items when forms change
  useEffect(() => {
    if (dataMode === "manual" && processedFiles.length > 0) {
      const items: MatchedBatchItem[] = [];
      for (const pf of processedFiles) {
        const form = manualForms[pf.id];
        if (form && form.brandName && form.classType && form.alcoholContent && form.netContents && form.nameAddress) {
          items.push(buildManualItem(pf.file, form));
        }
      }
      onReady(items);
    } else if (dataMode === "manual") {
      onReady([]);
    }
  }, [dataMode, processedFiles, manualForms, onReady]);

  const processFiles = useCallback(
    async (fileList: FileList) => {
      setError(null);
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const newFiles: ProcessedFile[] = [];

      const remainingSlots = MAX_BATCH_SIZE - processedFiles.length;
      if (remainingSlots <= 0) {
        setError(`Maximum ${MAX_BATCH_SIZE} labels per batch.`);
        return;
      }

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        if (newFiles.length >= remainingSlots) {
          setError(
            `Maximum ${MAX_BATCH_SIZE} labels per batch. Only added ${newFiles.length} of ${fileList.length} files.`
          );
          break;
        }

        if (!validTypes.includes(file.type)) continue;
        if (file.size > 20 * 1024 * 1024) continue;

        try {
          const { file: processedFile, preview } = await preprocessImage(file);
          if (processedFile.size > MAX_FINAL_SIZE) continue;

          newFiles.push({
            id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
            originalName: file.name,
            file: processedFile,
            preview,
          });
        } catch {
          continue;
        }
      }

      if (newFiles.length === 0 && fileList.length > 0) {
        setError("No valid image files found. Please upload JPG, PNG, WebP, or GIF files.");
        return;
      }

      setProcessedFiles((prev) => {
        const updated = [...prev, ...newFiles];
        // Init empty manual forms for new files
        setManualForms((prevForms) => {
          const next = { ...prevForms };
          for (const f of newFiles) {
            if (!next[f.id]) next[f.id] = { ...emptyForm };
          }
          return next;
        });
        return updated;
      });
    },
    [processedFiles]
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

  const handleRemove = useCallback((id: string) => {
    setProcessedFiles((prev) => prev.filter((f) => f.id !== id));
    setManualForms((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setProcessedFiles([]);
    setManualForms({});
    setCsvRows(null);
    setMatchResult(null);
    setCsvWarnings([]);
    setCsvErrors([]);
    setError(null);
    onClear();
  }, [onClear]);

  const handleCSVUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseCSV(text);
      setCsvRows(result);
      setCsvErrors(result.errors);
      setCsvWarnings(result.warnings);
    };
    reader.readAsText(file);

    // Reset input so re-uploading the same file triggers onChange
    e.target.value = "";
  }, []);

  const handleManualFormChange = useCallback(
    (fileId: string, field: keyof ManualFormData, value: string) => {
      setManualForms((prev) => ({
        ...prev,
        [fileId]: { ...prev[fileId], [field]: value },
      }));
    },
    []
  );

  const allManualComplete = processedFiles.length > 0 && processedFiles.every((pf) => {
    const form = manualForms[pf.id];
    return form && form.brandName && form.classType && form.alcoholContent && form.netContents && form.nameAddress;
  });

  return (
    <div className="space-y-6">
      {/* Image Upload Zone */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-lg font-semibold text-gray-800">
            Label Images ({processedFiles.length}/{MAX_BATCH_SIZE})
          </label>
          {processedFiles.length > 0 && (
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
                : processedFiles.length > 0
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
          <div className="space-y-1">
            <p className="text-lg text-gray-700">
              Drop label images here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              JPG, PNG, WebP, GIF — up to {MAX_BATCH_SIZE} images
            </p>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm font-medium mt-2">{error}</p>}

        {/* Image Thumbnails */}
        {processedFiles.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
            {processedFiles.map((pf) => (
              <div key={pf.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                <img src={pf.preview} alt={pf.originalName} className="w-full h-20 object-cover" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(pf.id);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  x
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-[10px] px-1 py-0.5 truncate">
                  {pf.originalName}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Mode Toggle */}
      {processedFiles.length > 0 && (
        <>
          <hr className="border-gray-200" />

          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-3">
              Application Data
            </label>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDataMode("csv")}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  dataMode === "csv"
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
              >
                Upload CSV
              </button>
              <button
                onClick={() => setDataMode("manual")}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  dataMode === "manual"
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
              >
                Enter Manually
              </button>
            </div>

            {/* CSV Mode */}
            {dataMode === "csv" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300"
                  >
                    Choose CSV File
                  </button>
                  <a
                    href="/sample-batch.csv"
                    download
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Download template
                  </a>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </div>

                {csvErrors.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-700 mb-1">CSV Errors</p>
                    {csvErrors.map((err, i) => (
                      <p key={i} className="text-sm text-red-600">{err}</p>
                    ))}
                  </div>
                )}

                {csvWarnings.length > 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    {csvWarnings.map((w, i) => (
                      <p key={i} className="text-sm text-yellow-700">{w}</p>
                    ))}
                  </div>
                )}

                {/* Match Preview */}
                {matchResult && csvErrors.length === 0 && (
                  <div className={`p-3 rounded-lg border ${
                    matchResult.unmatchedImages.length === 0 && matchResult.unmatchedRows.length === 0
                      ? "bg-green-50 border-green-200"
                      : "bg-yellow-50 border-yellow-200"
                  }`}>
                    <p className="text-sm font-medium">
                      {matchResult.matched.length}/{processedFiles.length} images matched to CSV rows
                    </p>
                    {matchResult.unmatchedImages.length > 0 && (
                      <p className="text-sm text-yellow-700 mt-1">
                        Unmatched images: {matchResult.unmatchedImages.join(", ")}
                      </p>
                    )}
                    {matchResult.unmatchedRows.length > 0 && (
                      <p className="text-sm text-yellow-700 mt-1">
                        Unmatched CSV rows: {matchResult.unmatchedRows.join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {!csvRows && (
                  <p className="text-sm text-gray-500">
                    Upload a CSV with columns: image_filename, brandName, classType, alcoholContent, netContents, nameAddress, countryOfOrigin (optional).
                    Government warning is auto-filled.
                  </p>
                )}
              </div>
            )}

            {/* Manual Mode */}
            {dataMode === "manual" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Fill in application data for each label. Government warning is auto-filled.
                  {!allManualComplete && processedFiles.length > 0 && (
                    <span className="text-yellow-600 ml-1">
                      — Complete all required fields to enable verification.
                    </span>
                  )}
                </p>

                {processedFiles.map((pf) => (
                  <ManualForm
                    key={pf.id}
                    fileId={pf.id}
                    fileName={pf.originalName}
                    preview={pf.preview}
                    form={manualForms[pf.id] || emptyForm}
                    onChange={handleManualFormChange}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Compact per-image application data form */
function ManualForm({
  fileId,
  fileName,
  preview,
  form,
  onChange,
}: {
  fileId: string;
  fileName: string;
  preview: string;
  form: ManualFormData;
  onChange: (fileId: string, field: keyof ManualFormData, value: string) => void;
}) {
  const fields: { key: keyof ManualFormData; label: string; required: boolean }[] = [
    { key: "brandName", label: "Brand Name", required: true },
    { key: "classType", label: "Class/Type", required: true },
    { key: "alcoholContent", label: "Alcohol Content", required: true },
    { key: "netContents", label: "Net Contents", required: true },
    { key: "nameAddress", label: "Name & Address", required: true },
    { key: "countryOfOrigin", label: "Country of Origin", required: false },
  ];

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center gap-3 mb-3">
        <img src={preview} alt={fileName} className="w-10 h-10 object-cover rounded" />
        <span className="text-sm font-medium text-gray-800 truncate">{fileName}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label, required }) => (
          <div key={key} className={key === "nameAddress" ? "col-span-2" : ""}>
            <label className="block text-xs text-gray-600 mb-0.5">
              {label}{required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={form[key]}
              onChange={(e) => onChange(fileId, key, e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
              placeholder={label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
