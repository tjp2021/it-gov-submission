"use client";

import { useState, useEffect } from "react";
import type { FieldResult } from "@/lib/types";

interface LoadingStateProps {
  startTime: number;
  streamMessage?: string;
  streamFields?: FieldResult[];
}

export default function LoadingState({
  startTime,
  streamMessage,
  streamFields = []
}: LoadingStateProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  const displayMessage = streamMessage ?? "Processing...";

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PASS": return "✓";
      case "FAIL": return "✗";
      case "WARNING": return "⚠";
      default: return "?";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PASS": return "text-green-600";
      case "FAIL": return "text-red-600";
      case "WARNING": return "text-yellow-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      {/* Spinner */}
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
      </div>

      {/* Stage label */}
      <div className="text-center">
        <p className="text-lg font-medium text-gray-700">
          {displayMessage}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {(elapsed / 1000).toFixed(1)}s elapsed
        </p>
      </div>

      {/* Streaming field results */}
      {streamFields.length > 0 && (
        <div className="w-full max-w-md bg-gray-50 rounded-lg p-4 space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Results streaming...</p>
          {streamFields.map((field, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{field.fieldName}</span>
              <span className={`font-medium ${getStatusColor(field.status)}`}>
                {getStatusIcon(field.status)} {field.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
