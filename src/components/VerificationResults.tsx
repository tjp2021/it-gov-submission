"use client";

import type {
  VerificationResult,
  MultiImageVerificationResult,
  ImageLabel,
} from "@/lib/types";
import FieldResultCard from "./FieldResultCard";

interface LabelImageInfo {
  id: string;
  label: ImageLabel;
  preview: string;
}

interface VerificationResultsProps {
  result: VerificationResult | MultiImageVerificationResult;
  labelImages?: LabelImageInfo[];
  onFieldOverride: (fieldName: string, action: "accepted" | "confirmed_issue") => void;
  onReset: () => void;
}

// Type guard for multi-image result
function isMultiImageResult(
  result: VerificationResult | MultiImageVerificationResult
): result is MultiImageVerificationResult {
  return "imageCount" in result && result.imageCount > 1;
}

function getLabelDisplayName(label: ImageLabel): string {
  switch (label) {
    case "front": return "Front";
    case "back": return "Back";
    case "neck": return "Neck";
    case "side": return "Side";
    case "detail": return "Detail";
    default: return "Other";
  }
}

export default function VerificationResults({
  result,
  labelImages = [],
  onFieldOverride,
  onReset,
}: VerificationResultsProps) {
  const statusConfig = {
    PASS: {
      label: "PASSED",
      bg: "bg-green-100",
      border: "border-green-500",
      text: "text-green-800",
      icon: "PASS",
    },
    FAIL: {
      label: "FAILED",
      bg: "bg-red-100",
      border: "border-red-500",
      text: "text-red-800",
      icon: "FAIL",
    },
    REVIEW: {
      label: "NEEDS REVIEW",
      bg: "bg-amber-100",
      border: "border-amber-500",
      text: "text-amber-800",
      icon: "REVIEW",
    },
  };

  const config = statusConfig[result.overallStatus];
  const isMultiImage = isMultiImageResult(result);

  // Count results by status
  const counts = result.fieldResults.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Build image previews map for FieldResultCard
  const imagePreviews = labelImages.reduce<Record<string, string>>((acc, img) => {
    acc[img.id] = img.preview;
    return acc;
  }, {});

  const handleExport = () => {
    // Build export data based on whether multi-image or not
    if (isMultiImage) {
      const exportData = {
        exportedAt: new Date().toISOString(),
        version: "2.0",
        imageCount: result.imageCount,
        images: result.images.map((img) => ({
          id: img.imageId,
          label: img.imageLabel,
          fileName: img.fileName,
        })),
        overallStatus: result.overallStatus,
        mergedExtraction: {
          fields: result.mergedExtraction.fields,
          fieldSources: Object.fromEntries(
            Object.entries(result.mergedExtraction.fieldSources).map(
              ([key, sourced]) => [
                key,
                {
                  value: sourced.value,
                  foundInImages: sourced.sources.map((s) => s.imageId),
                  confirmedCount: sourced.sources.length,
                },
              ]
            )
          ),
        },
        conflictResolutions: result.mergedExtraction.conflicts
          .filter((c) => c.selectedValue)
          .map((c) => ({
            fieldKey: c.fieldKey,
            selectedValue: c.selectedValue,
            selectedFromImage: c.candidates.find(
              (cand) => cand.value === c.selectedValue
            )?.sources[0]?.imageId,
            rejectedValues: c.candidates
              .filter((cand) => cand.value !== c.selectedValue)
              .map((cand) => ({
                value: cand.value,
                fromImages: cand.sources.map((s) => s.imageId),
              })),
            resolvedAt: c.selectedAt,
          })),
        fieldResults: result.fieldResults.map((fr) => ({
          fieldName: fr.fieldName,
          applicationValue: fr.applicationValue,
          extractedValue: fr.extractedValue,
          status: fr.status,
          matchType: fr.matchType,
          confidence: fr.confidence,
          details: fr.details,
          sources: fr.sources?.map((s) => s.imageId),
          confirmedOnImages: fr.confirmedOnImages,
          hadConflict: fr.hadConflict,
          agentOverride: fr.agentOverride,
        })),
        summary: {
          totalFields: result.fieldResults.length,
          passed: counts.PASS || 0,
          failed: counts.FAIL || 0,
          warnings: counts.WARNING || 0,
          notFound: counts.NOT_FOUND || 0,
          overridden: counts.OVERRIDDEN || 0,
        },
      };

      downloadJson(exportData, `verification-multi-${new Date().toISOString().slice(0, 10)}.json`);
    } else {
      // Single image - original format
      const exportData = {
        exportedAt: new Date().toISOString(),
        overallStatus: result.overallStatus,
        processingTimeMs: result.processingTimeMs,
        fieldResults: result.fieldResults,
        summary: {
          totalFields: result.fieldResults.length,
          passed: counts.PASS || 0,
          failed: counts.FAIL || 0,
          warnings: counts.WARNING || 0,
          notFound: counts.NOT_FOUND || 0,
          overridden: counts.OVERRIDDEN || 0,
        },
      };

      downloadJson(exportData, `verification-${new Date().toISOString().slice(0, 10)}.json`);
    }
  };

  const downloadJson = (data: object, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Overall Status Banner */}
      <div
        className={`rounded-lg border-2 ${config.border} ${config.bg} p-6 text-center`}
      >
        <div className={`text-2xl mb-2 font-bold ${config.text}`}>{config.icon}</div>
        <h2 className={`text-2xl font-bold ${config.text}`}>
          {config.label}
        </h2>
        <p className="text-gray-600 mt-2">
          {counts.PASS || 0} passed, {counts.FAIL || 0} failed,{" "}
          {counts.WARNING || 0} warnings
        </p>
        {isMultiImage && (
          <p className="text-sm text-gray-500 mt-1">
            Based on {result.imageCount} images
          </p>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Processed in {(result.processingTimeMs / 1000).toFixed(1)}s
        </p>
      </div>

      {/* Label Images for Reference */}
      {labelImages.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Label Image{labelImages.length > 1 ? "s" : ""} (for reference)
          </h3>
          {labelImages.length === 1 ? (
            <img
              src={labelImages[0].preview}
              alt="Uploaded label"
              className="max-w-full max-h-64 mx-auto rounded border border-gray-300"
            />
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {labelImages.map((img) => (
                <div key={img.id} className="text-center">
                  <img
                    src={img.preview}
                    alt={`${img.label} label`}
                    className="w-full aspect-square object-contain rounded border border-gray-300 bg-white"
                  />
                  <span className="text-xs text-gray-500 mt-1 block">
                    {getLabelDisplayName(img.label)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Field Results */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Field-by-Field Results
        </h3>
        {result.fieldResults.map((fieldResult, index) => (
          <FieldResultCard
            key={`${fieldResult.fieldName}-${index}`}
            result={fieldResult}
            imagePreviews={imagePreviews}
            onOverride={(action) => onFieldOverride(fieldResult.fieldName, action)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onReset}
          className="px-4 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-colors"
          style={{ backgroundColor: '#1e3a5f' }}
        >
          Verify Another
        </button>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          Export Results
        </button>
      </div>

      {/* Extracted Fields Debug (collapsible) */}
      <details className="mt-6 text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
          Show extracted raw data
        </summary>
        <pre className="mt-2 p-4 bg-gray-100 rounded-lg overflow-x-auto text-xs text-black">
          {JSON.stringify(result.extractedFields, null, 2)}
        </pre>
        {isMultiImage && (
          <>
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 mt-4">
              Merged extraction details
            </summary>
            <pre className="mt-2 p-4 bg-gray-100 rounded-lg overflow-x-auto text-xs text-black">
              {JSON.stringify(result.mergedExtraction, null, 2)}
            </pre>
          </>
        )}
      </details>
    </div>
  );
}
