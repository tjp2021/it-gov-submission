"use client";

import { useState } from "react";
import type { VerificationResult } from "@/lib/types";
import { computeOverallStatus } from "@/lib/verify-single";
import ImageModal from "./ImageModal";

interface BatchResult {
  id: string;
  fileName: string;
  brandName: string;
  imageUrl: string | null;
  result: VerificationResult | null;
  error: string | null;
}

interface BatchResultsProps {
  results: BatchResult[];
  onReset: () => void;
}

export default function BatchResults({ results: initialResults, onReset }: BatchResultsProps) {
  const [results, setResults] = useState<BatchResult[]>(initialResults);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<{ src: string; alt: string } | null>(null);

  const handleFieldOverride = (
    resultId: string,
    fieldName: string,
    action: "accepted" | "confirmed_issue"
  ) => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.id !== resultId || !r.result) return r;

        const updatedFields = r.result.fieldResults.map((f) => {
          if (f.fieldName !== fieldName) return f;
          return {
            ...f,
            ...(action === "accepted" ? { status: "OVERRIDDEN" as const } : {}),
            agentOverride: {
              action,
              timestamp: new Date().toISOString(),
            },
          };
        });

        return {
          ...r,
          result: {
            ...r.result,
            overallStatus: computeOverallStatus(updatedFields),
            fieldResults: updatedFields,
          },
        };
      })
    );
  };

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.result?.overallStatus === "PASS").length,
    fail: results.filter((r) => r.result?.overallStatus === "FAIL").length,
    review: results.filter((r) => r.result?.overallStatus === "REVIEW").length,
    error: results.filter((r) => r.error).length,
  };

  const handleExportAll = () => {
    const exportData = results.map((r) => ({
      fileName: r.fileName,
      brandName: r.brandName,
      status: r.result?.overallStatus || "ERROR",
      error: r.error,
      fields: r.result?.fieldResults.map((f) => ({
        field: f.fieldName,
        status: f.status,
        expected: f.applicationValue,
        extracted: f.extractedValue,
        confidence: f.confidence,
        agentOverride: f.agentOverride || null,
      })),
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-results-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ["File Name", "Brand Name", "Status", "Brand Match", "Class/Type", "ABV", "Volume", "Address", "Country", "Warning"];
    const rows = results.map((r) => {
      if (!r.result) {
        return [r.fileName, r.brandName, "ERROR", r.error || "Unknown error", "", "", "", "", "", ""];
      }
      const getFieldStatus = (name: string) => {
        const field = r.result?.fieldResults.find((f) => f.fieldName === name);
        return field ? field.status : "N/A";
      };
      return [
        r.fileName,
        r.brandName,
        r.result.overallStatus,
        getFieldStatus("Brand Name"),
        getFieldStatus("Class/Type"),
        getFieldStatus("Alcohol Content"),
        getFieldStatus("Net Contents"),
        getFieldStatus("Name & Address"),
        getFieldStatus("Country of Origin"),
        getFieldStatus("Gov Warning — Present"),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "PASS":
        return "bg-green-100 text-green-800 border-green-300";
      case "FAIL":
        return "bg-red-100 text-red-800 border-red-300";
      case "REVIEW":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getFieldStatusStyle = (status: string) => {
    switch (status) {
      case "PASS":
        return "bg-green-100 text-green-700";
      case "FAIL":
        return "bg-red-100 text-red-700";
      case "WARNING":
        return "bg-yellow-100 text-yellow-700";
      case "OVERRIDDEN":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Batch Results</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportAll}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Export JSON
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            New Batch
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-700">{summary.pass}</div>
          <div className="text-sm text-green-600">Passed</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-700">{summary.fail}</div>
          <div className="text-sm text-red-600">Failed</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-700">{summary.review}</div>
          <div className="text-sm text-yellow-600">Review</div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-gray-700">{summary.error}</div>
          <div className="text-sm text-gray-600">Errors</div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.map((r) => (
          <div
            key={r.id}
            className={`border rounded-lg overflow-hidden ${getStatusColor(r.result?.overallStatus || (r.error ? "ERROR" : undefined))}`}
          >
            <button
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {r.error
                    ? "⚠️"
                    : r.result?.overallStatus === "PASS"
                      ? "✅"
                      : r.result?.overallStatus === "FAIL"
                        ? "❌"
                        : "⚡"}
                </span>
                <div className="text-left">
                  <span className="font-medium block">{r.brandName || r.fileName}</span>
                  {r.brandName && (
                    <span className="text-xs text-gray-500">{r.fileName}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-sm rounded">
                  {r.error ? "ERROR" : r.result?.overallStatus}
                </span>
                <span className="text-gray-500">
                  {expandedId === r.id ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {/* Expanded Details */}
            {expandedId === r.id && (
              <div className="px-4 pb-4 bg-white border-t">
                {r.error ? (
                  <div className="py-3 text-red-600">{r.error}</div>
                ) : r.result ? (
                  <div className="py-3 flex gap-4">
                    {/* Label Image Thumbnail — click to enlarge */}
                    {r.imageUrl && (
                      <button
                        className="flex-shrink-0 cursor-zoom-in"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalImage({ src: r.imageUrl!, alt: `${r.brandName} label` });
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.imageUrl}
                          alt={`${r.brandName} label`}
                          className="w-32 h-40 object-contain rounded border border-gray-200 bg-white hover:border-blue-400 hover:shadow-md transition-all"
                        />
                        <span className="text-xs text-gray-400 mt-1 block">Click to enlarge</span>
                      </button>
                    )}
                    {/* Field Results */}
                    <div className="flex-1 space-y-2">
                      {r.result.fieldResults.map((field) => (
                        <div key={field.fieldName} className="space-y-1 py-1.5 border-b border-gray-100 last:border-0">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-700">{field.fieldName}</span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${getFieldStatusStyle(field.status)}`}
                              >
                                {field.status}
                              </span>
                              <span className="text-gray-400 text-xs">
                                {(field.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>

                          {/* Expected vs Extracted values */}
                          <div className="grid grid-cols-2 gap-2 text-xs ml-2">
                            <div>
                              <span className="text-gray-400">Expected: </span>
                              <span className="font-mono text-gray-700">{field.applicationValue || "\u2014"}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Found: </span>
                              <span className="font-mono text-gray-700">{field.extractedValue || "Not found"}</span>
                            </div>
                          </div>

                          {/* Details for failures */}
                          {(field.status === "FAIL" || field.status === "WARNING") && field.details && (
                            <p className="text-xs text-gray-500 ml-2">{field.details}</p>
                          )}

                          {/* Override buttons for FAIL/WARNING fields */}
                          {(field.status === "FAIL" || field.status === "WARNING") &&
                            !field.agentOverride && (
                              <div className="flex gap-2 ml-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFieldOverride(r.id, field.fieldName, "accepted");
                                  }}
                                  className="px-2 py-0.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFieldOverride(r.id, field.fieldName, "confirmed_issue");
                                  }}
                                  className="px-2 py-0.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Confirm Issue
                                </button>
                              </div>
                            )}

                          {/* Override status */}
                          {field.agentOverride && (
                            <div
                              className={`text-xs ml-2 ${
                                field.agentOverride.action === "accepted"
                                  ? "text-blue-600"
                                  : "text-red-600"
                              }`}
                            >
                              {field.agentOverride.action === "accepted"
                                ? "Agent accepted — overridden"
                                : "Agent confirmed issue"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {modalImage && (
        <ImageModal
          src={modalImage.src}
          alt={modalImage.alt}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  );
}
