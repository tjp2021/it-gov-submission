"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import LabelUploader from "@/components/LabelUploader";
import ApplicationForm, {
  defaultApplicationData,
} from "@/components/ApplicationForm";
import VerificationResults from "@/components/VerificationResults";
import LoadingState from "@/components/LoadingState";
import DemoButton from "@/components/DemoButton";
import type { ApplicationData, VerificationResult, FieldResult } from "@/lib/types";

type AppState = "input" | "loading" | "results";

export default function Home() {
  const [state, setState] = useState<AppState>("input");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [applicationData, setApplicationData] = useState<ApplicationData>(
    defaultApplicationData
  );
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStartTime, setLoadingStartTime] = useState<number>(0);
  const [streamMessage, setStreamMessage] = useState<string>("");
  const [streamElapsed, setStreamElapsed] = useState<number>(0);
  const [streamFields, setStreamFields] = useState<FieldResult[]>([]);

  const handleImageSelect = useCallback((file: File, preview: string) => {
    setImageFile(file);
    setImagePreview(preview);
    setError(null);
  }, []);

  const handleLoadDemo = useCallback(
    async (data: ApplicationData, imageUrl: string) => {
      setApplicationData(data);
      if (imageUrl) {
        // Convert data URL to File
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], "demo-label.png", { type: "image/png" });
        setImageFile(file);
        setImagePreview(imageUrl);
      }
      setError(null);
    },
    []
  );

  const handleVerify = async () => {
    if (!imageFile) {
      setError("Please upload a label image");
      return;
    }

    if (!applicationData.brandName || !applicationData.classType) {
      setError("Please fill in required fields");
      return;
    }

    setError(null);
    setState("loading");
    setLoadingStartTime(Date.now());
    setStreamMessage("Starting...");
    setStreamElapsed(0);
    setStreamFields([]);

    try {
      const formData = new FormData();
      formData.append("labelImage", imageFile);
      formData.append("applicationData", JSON.stringify(applicationData));

      const response = await fetch("/api/verify-stream", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Verification failed");
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const eventType = line.slice(7);
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith("data: ")) {
              const data = JSON.parse(dataLine.slice(6));

              switch (eventType) {
                case "progress":
                  setStreamMessage(data.message);
                  setStreamElapsed(data.elapsed);
                  break;
                case "field":
                  setStreamFields(prev => [...prev, data as FieldResult]);
                  break;
                case "complete":
                  setResult(data as VerificationResult);
                  setState("results");
                  return;
                case "error":
                  throw new Error(data.error);
              }
            }
          }
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setState("input");
    }
  };

  const handleFieldOverride = (
    fieldName: string,
    action: "accepted" | "confirmed_issue"
  ) => {
    if (!result) return;

    const updatedResults = result.fieldResults.map((r) => {
      if (r.fieldName === fieldName) {
        return {
          ...r,
          status: "OVERRIDDEN" as const,
          agentOverride: {
            action,
            timestamp: new Date().toISOString(),
          },
        };
      }
      return r;
    });

    // Recompute overall status
    const hasUnresolvedFail = updatedResults.some(
      (r) => r.status === "FAIL" && !r.agentOverride
    );
    const hasWarningOrNotFound = updatedResults.some(
      (r) => r.status === "WARNING" || r.status === "NOT_FOUND"
    );

    let overallStatus: "PASS" | "FAIL" | "REVIEW";
    if (hasUnresolvedFail) {
      overallStatus = "FAIL";
    } else if (hasWarningOrNotFound) {
      overallStatus = "REVIEW";
    } else {
      overallStatus = "PASS";
    }

    setResult({
      ...result,
      overallStatus,
      fieldResults: updatedResults,
    });
  };

  const handleReset = () => {
    setState("input");
    setImageFile(null);
    setImagePreview(null);
    setApplicationData(defaultApplicationData);
    setResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                TTB Label Verification Tool
              </h1>
              <p className="text-gray-600 mt-2">
                AI-powered alcohol beverage label verification
              </p>
            </div>
            <Link
              href="/batch"
              className="flex flex-col items-end"
            >
              <span className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg">
                Batch Mode →
              </span>
              <span className="text-xs text-gray-500 mt-1">
                Verify up to 300 labels at once
              </span>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {state === "loading" && (
            <LoadingState
              startTime={loadingStartTime}
              streamMessage={streamMessage}
              streamElapsed={streamElapsed}
              streamFields={streamFields}
            />
          )}

          {state === "results" && result && (
            <VerificationResults
              result={result}
              onFieldOverride={handleFieldOverride}
              onReset={handleReset}
            />
          )}

          {state === "input" && (
            <div className="space-y-8">
              {/* Demo Button */}
              <div className="flex justify-end">
                <DemoButton onLoadDemo={handleLoadDemo} />
              </div>

              {/* Label Upload */}
              <LabelUploader
                onImageSelect={handleImageSelect}
                currentPreview={imagePreview}
              />

              {/* Divider */}
              <hr className="border-gray-200" />

              {/* Application Form */}
              <ApplicationForm
                data={applicationData}
                onChange={setApplicationData}
              />

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              {/* Verify Button */}
              <button
                onClick={handleVerify}
                disabled={!imageFile}
                className={`w-full py-4 text-lg font-semibold rounded-lg transition-colors ${
                  imageFile
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                ▶ Verify Label
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
