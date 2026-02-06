"use client";

import type { FieldResult, MultiImageFieldResult, ImageSource } from "@/lib/types";

interface FieldResultCardProps {
  result: FieldResult | MultiImageFieldResult;
  imagePreviews?: Record<string, string>;
  onOverride?: (action: "accepted" | "confirmed_issue") => void;
}

// Type guard for multi-image result
function isMultiImageFieldResult(
  result: FieldResult | MultiImageFieldResult
): result is MultiImageFieldResult {
  return "sources" in result && Array.isArray(result.sources);
}

function getLabelShort(label: string): string {
  switch (label) {
    case "front": return "F";
    case "back": return "B";
    case "neck": return "N";
    case "side": return "S";
    case "detail": return "D";
    default: return "O";
  }
}

function SourceBadge({
  source,
  preview,
}: {
  source: ImageSource;
  preview?: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs"
      title={`${source.fileName} (${source.imageLabel})`}
    >
      {preview && (
        <img
          src={preview}
          alt={source.imageLabel}
          className="w-4 h-4 object-cover rounded"
        />
      )}
      <span className="font-medium text-gray-600">
        {getLabelShort(source.imageLabel)}
      </span>
    </div>
  );
}

export default function FieldResultCard({
  result,
  imagePreviews = {},
  onOverride,
}: FieldResultCardProps) {
  const statusConfig = {
    PASS: {
      icon: "PASS",
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
    },
    FAIL: {
      icon: "FAIL",
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
    },
    WARNING: {
      icon: "WARN",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-800",
    },
    NOT_FOUND: {
      icon: "?",
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-600",
    },
    OVERRIDDEN: {
      icon: "O",
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
    },
  };

  const config = statusConfig[result.status];
  const showOverrideButtons =
    (result.status === "WARNING" || result.status === "FAIL") &&
    !result.agentOverride &&
    onOverride;

  const isMultiImage = isMultiImageFieldResult(result);
  const sources = isMultiImage ? result.sources : undefined;
  const confirmedCount = isMultiImage ? result.confirmedOnImages : undefined;
  const hadConflict = isMultiImage ? result.hadConflict : false;

  return (
    <div
      className={`rounded-lg border-2 ${config.border} ${config.bg} p-4 space-y-3`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold px-2 py-0.5 rounded ${config.text} ${config.bg} border ${config.border}`}>
            {config.icon}
          </span>
          <span className={`font-semibold ${config.text}`}>
            {result.fieldName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Confirmed count badge */}
          {confirmedCount && confirmedCount > 1 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {confirmedCount} images agree
            </span>
          )}
          {/* Conflict indicator */}
          {hadConflict && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              Resolved conflict
            </span>
          )}
          {result.confidence > 0 && result.confidence < 1 && (
            <span className="text-sm text-gray-500">
              {(result.confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
      </div>

      {/* Source attribution */}
      {sources && sources.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Found on:</span>
          <div className="flex gap-1">
            {sources.map((source) => (
              <SourceBadge
                key={source.imageId}
                source={source}
                preview={imagePreviews[source.imageId]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Values comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500 block mb-1">Application:</span>
          <span className="font-mono bg-white px-2 py-1 rounded border border-gray-200 block break-words text-black">
            {result.applicationValue || "\u2014"}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block mb-1">Label:</span>
          <span className="font-mono bg-white px-2 py-1 rounded border border-gray-200 block break-words text-black">
            {result.extractedValue || "Not found"}
          </span>
        </div>
      </div>

      {/* Details */}
      <p className={`text-sm ${config.text}`}>{result.details}</p>

      {/* Conflict resolution info */}
      {isMultiImage && result.conflictResolution && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-200">
          <div className="font-medium text-gray-700 mb-1">Conflict Resolution:</div>
          <div>Selected: &quot;{result.conflictResolution.selectedValue}&quot;</div>
          {result.conflictResolution.rejectedValues.length > 0 && (
            <div className="mt-1">
              Rejected:{" "}
              {result.conflictResolution.rejectedValues.map((rv, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  &quot;{rv.value}&quot;
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Override buttons */}
      {showOverrideButtons && (
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={() => onOverride("accepted")}
            className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => onOverride("confirmed_issue")}
            className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Confirm Issue
          </button>
        </div>
      )}

      {/* Override status */}
      {result.agentOverride && (
        <div className={`text-sm pt-2 border-t border-gray-200 ${
          result.agentOverride.action === "accepted" ? "text-blue-600" : "text-red-600"
        }`}>
          {result.agentOverride.action === "accepted"
            ? "Agent accepted — overridden, will not block approval"
            : "Agent confirmed issue — remains flagged as a failure"}
        </div>
      )}
    </div>
  );
}
