"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import BatchUploader from "@/components/BatchUploader";
import BatchResults from "@/components/BatchResults";
import type { MatchedBatchItem, VerificationResult } from "@/lib/types";

interface BatchResult {
  id: string;
  fileName: string;
  brandName: string;
  result: VerificationResult | null;
  error: string | null;
}

type AppState = "input" | "processing" | "results";

interface SSEResultEvent {
  type: "result";
  id: string;
  fileName: string;
  brandName: string;
  result: VerificationResult | null;
  error: string | null;
  index: number;
  total: number;
}

interface SSECompleteEvent {
  type: "complete";
  totalProcessed: number;
  totalTimeMs: number;
}

interface SSEErrorEvent {
  type: "error";
  error: string;
}

type SSEEvent = SSEResultEvent | SSECompleteEvent | SSEErrorEvent;

export default function BatchPage() {
  const [state, setState] = useState<AppState>("input");
  const [matchedItems, setMatchedItems] = useState<MatchedBatchItem[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleReady = useCallback((items: MatchedBatchItem[]) => {
    setMatchedItems(items);
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    setMatchedItems([]);
    setError(null);
  }, []);

  const handleVerifyBatch = async () => {
    if (matchedItems.length === 0) {
      setError("No labels ready for verification. Upload images and provide application data.");
      return;
    }

    setError(null);
    setState("processing");
    setProgress({ current: 0, total: matchedItems.length });

    // Build FormData with per-label images and app data
    const formData = new FormData();

    for (const item of matchedItems) {
      formData.append(`image_${item.id}`, item.imageFile);
      formData.append(`appData_${item.id}`, JSON.stringify(item.applicationData));
    }

    const batchResults: BatchResult[] = [];

    try {
      const response = await fetch("/api/batch-verify", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Batch verification failed");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6);
          } else if (line === "" && eventType && eventData) {
            const event = JSON.parse(eventData) as SSEEvent;

            if (event.type === "result") {
              const resultEvent = event as SSEResultEvent;

              batchResults.push({
                id: resultEvent.id,
                fileName: resultEvent.fileName,
                brandName: resultEvent.brandName,
                result: resultEvent.result,
                error: resultEvent.error,
              });

              setProgress({ current: batchResults.length, total: matchedItems.length });
            } else if (event.type === "complete") {
              console.log(`Batch completed in ${(event as SSECompleteEvent).totalTimeMs}ms`);
            } else if (event.type === "error") {
              throw new Error((event as SSEErrorEvent).error);
            }

            eventType = "";
            eventData = "";
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    }

    setResults(batchResults);
    setState("results");
  };

  const handleReset = () => {
    setState("input");
    setMatchedItems([]);
    setResults([]);
    setError(null);
    setProgress({ current: 0, total: 0 });
  };

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Batch Label Verification
              </h1>
              <p className="text-gray-600 mt-2">
                Verify up to 10 labels with individual application data
              </p>
            </div>
            <Link
              href="/"
              className="flex flex-col items-end"
            >
              <span className="px-4 py-2 text-sm text-white hover:opacity-90 rounded-lg" style={{ backgroundColor: '#1e3a5f' }}>
                ← Single Mode
              </span>
              <span className="text-xs text-gray-500 mt-1">
                One label at a time
              </span>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {/* Processing State */}
          {state === "processing" && (
            <div className="text-center py-12 space-y-4">
              <div className="text-4xl animate-pulse">⏳</div>
              <h2 className="text-xl font-semibold">Processing Labels...</h2>
              <div className="w-full max-w-md mx-auto">
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      backgroundColor: '#1e3a5f',
                      width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-gray-600">
                  {progress.current} of {progress.total} labels
                </p>
              </div>
            </div>
          )}

          {/* Results State */}
          {state === "results" && (
            <BatchResults results={results} onReset={handleReset} />
          )}

          {/* Input State */}
          {state === "input" && (
            <div className="space-y-8">
              <BatchUploader onReady={handleReady} onClear={handleClear} />

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              {/* Verify Button */}
              <button
                onClick={handleVerifyBatch}
                disabled={matchedItems.length === 0}
                className="w-full py-4 text-lg font-semibold rounded-lg transition-colors text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#1e3a5f' }}
              >
                Verify {matchedItems.length} Label{matchedItems.length !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>
            Prototype for TTB Compliance Division • Built with Gemini Flash
          </p>
        </footer>
      </div>
    </main>
  );
}
