"use client";

import type { FieldResult } from "@/lib/types";

interface FieldResultCardProps {
  result: FieldResult;
  onOverride?: (action: "accepted" | "confirmed_issue") => void;
}

export default function FieldResultCard({
  result,
  onOverride,
}: FieldResultCardProps) {
  const statusConfig = {
    PASS: {
      icon: "✅",
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
    },
    FAIL: {
      icon: "❌",
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
    },
    WARNING: {
      icon: "⚠️",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-800",
    },
    NOT_FOUND: {
      icon: "❓",
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-600",
    },
    OVERRIDDEN: {
      icon: "🔄",
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

  return (
    <div
      className={`rounded-lg border-2 ${config.border} ${config.bg} p-4 space-y-3`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <span className={`font-semibold ${config.text}`}>
            {result.fieldName}
          </span>
        </div>
        {result.confidence > 0 && result.confidence < 1 && (
          <span className="text-sm text-gray-500">
            {(result.confidence * 100).toFixed(0)}% confidence
          </span>
        )}
      </div>

      {/* Values comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500 block mb-1">Application:</span>
          <span className="font-mono bg-white px-2 py-1 rounded border border-gray-200 block break-words">
            {result.applicationValue || "—"}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block mb-1">Label:</span>
          <span className="font-mono bg-white px-2 py-1 rounded border border-gray-200 block break-words">
            {result.extractedValue || "Not found"}
          </span>
        </div>
      </div>

      {/* Details */}
      <p className={`text-sm ${config.text}`}>{result.details}</p>

      {/* Override buttons */}
      {showOverrideButtons && (
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={() => onOverride("accepted")}
            className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            ✓ Accept
          </button>
          <button
            onClick={() => onOverride("confirmed_issue")}
            className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            ✗ Confirm Issue
          </button>
        </div>
      )}

      {/* Override status */}
      {result.agentOverride && (
        <div className="text-sm text-blue-600 pt-2 border-t border-gray-200">
          Agent override: {result.agentOverride.action === "accepted" ? "Accepted" : "Issue confirmed"}
        </div>
      )}
    </div>
  );
}
