"use client";

import type { VerificationResult, FieldResult } from "@/lib/types";
import FieldResultCard from "./FieldResultCard";

interface VerificationResultsProps {
  result: VerificationResult;
  onFieldOverride: (fieldName: string, action: "accepted" | "confirmed_issue") => void;
  onReset: () => void;
}

export default function VerificationResults({
  result,
  onFieldOverride,
  onReset,
}: VerificationResultsProps) {
  const statusConfig = {
    PASS: {
      label: "PASSED",
      bg: "bg-green-100",
      border: "border-green-500",
      text: "text-green-800",
      icon: "✅",
    },
    FAIL: {
      label: "FAILED",
      bg: "bg-red-100",
      border: "border-red-500",
      text: "text-red-800",
      icon: "❌",
    },
    REVIEW: {
      label: "NEEDS REVIEW",
      bg: "bg-amber-100",
      border: "border-amber-500",
      text: "text-amber-800",
      icon: "⚠️",
    },
  };

  const config = statusConfig[result.overallStatus];

  // Count results by status
  const counts = result.fieldResults.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleExport = () => {
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

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verification-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Overall Status Banner */}
      <div
        className={`rounded-lg border-2 ${config.border} ${config.bg} p-6 text-center`}
      >
        <div className="text-3xl mb-2">{config.icon}</div>
        <h2 className={`text-2xl font-bold ${config.text}`}>
          {config.label}
        </h2>
        <p className="text-gray-600 mt-2">
          {counts.PASS || 0} passed, {counts.FAIL || 0} failed,{" "}
          {counts.WARNING || 0} warnings
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Processed in {(result.processingTimeMs / 1000).toFixed(1)}s
        </p>
      </div>

      {/* Field Results */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Field-by-Field Results
        </h3>
        {result.fieldResults.map((fieldResult, index) => (
          <FieldResultCard
            key={`${fieldResult.fieldName}-${index}`}
            result={fieldResult}
            onOverride={(action) => onFieldOverride(fieldResult.fieldName, action)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onReset}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 Verify Another
        </button>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          📋 Export Results
        </button>
      </div>

      {/* Extracted Fields Debug (collapsible) */}
      <details className="mt-6 text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
          Show extracted raw data
        </summary>
        <pre className="mt-2 p-4 bg-gray-100 rounded-lg overflow-x-auto text-xs">
          {JSON.stringify(result.extractedFields, null, 2)}
        </pre>
      </details>
    </div>
  );
}
