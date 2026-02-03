"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import BatchUploader from "@/components/BatchUploader";
import BatchResults from "@/components/BatchResults";
import ApplicationForm, { defaultApplicationData } from "@/components/ApplicationForm";
import type { ApplicationData, VerificationResult } from "@/lib/types";

interface BatchFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "processing" | "done" | "error";
}

interface BatchResult {
  id: string;
  fileName: string;
  result: VerificationResult | null;
  error: string | null;
}

type AppState = "input" | "processing" | "results";

export default function BatchPage() {
  const [state, setState] = useState<AppState>("input");
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [applicationData, setApplicationData] = useState<ApplicationData>(
    defaultApplicationData
  );
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFilesSelect = useCallback((newFiles: BatchFile[]) => {
    setFiles(newFiles);
    setError(null);
  }, []);

  const handleVerifyBatch = async () => {
    if (files.length === 0) {
      setError("Please upload at least one label image");
      return;
    }

    if (!applicationData.brandName || !applicationData.classType) {
      setError("Please fill in required application fields");
      return;
    }

    setError(null);
    setState("processing");
    setProgress({ current: 0, total: files.length });

    const batchResults: BatchResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length });

      // Update file status
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: "processing" } : f))
      );

      try {
        const formData = new FormData();
        formData.append("labelImage", file.file);
        formData.append("applicationData", JSON.stringify(applicationData));

        const response = await fetch("/api/verify", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          batchResults.push({
            id: file.id,
            fileName: file.file.name,
            result: null,
            error: data.error || "Verification failed",
          });
          setFiles((prev) =>
            prev.map((f) => (f.id === file.id ? { ...f, status: "error" } : f))
          );
        } else {
          batchResults.push({
            id: file.id,
            fileName: file.file.name,
            result: data,
            error: null,
          });
          setFiles((prev) =>
            prev.map((f) => (f.id === file.id ? { ...f, status: "done" } : f))
          );
        }
      } catch (err) {
        batchResults.push({
          id: file.id,
          fileName: file.file.name,
          result: null,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, status: "error" } : f))
        );
      }
    }

    setResults(batchResults);
    setState("results");
  };

  const handleReset = () => {
    setState("input");
    setFiles([]);
    setApplicationData(defaultApplicationData);
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
                Verify multiple labels against the same application data
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              Single Mode
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
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
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
              {/* Batch Uploader */}
              <BatchUploader
                onFilesSelect={handleFilesSelect}
                files={files}
              />

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Application Form */}
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  All uploaded labels will be verified against this application data:
                </p>
                <ApplicationForm
                  data={applicationData}
                  onChange={setApplicationData}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              {/* Verify Button */}
              <button
                onClick={handleVerifyBatch}
                disabled={files.length === 0}
                className={`w-full py-4 text-lg font-semibold rounded-lg transition-colors ${
                  files.length > 0
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                ▶ Verify {files.length} Label{files.length !== 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>
            Prototype for TTB Compliance Division • Built with Claude Vision
          </p>
        </footer>
      </div>
    </main>
  );
}
