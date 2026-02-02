"use client";

import { useState, useCallback } from "react";
import LabelUploader from "@/components/LabelUploader";
import ApplicationForm, {
  defaultApplicationData,
} from "@/components/ApplicationForm";
import VerificationResults from "@/components/VerificationResults";
import LoadingState from "@/components/LoadingState";
import DemoButton from "@/components/DemoButton";
import type { ApplicationData, VerificationResult } from "@/lib/types";

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

    try {
      const formData = new FormData();
      formData.append("labelImage", imageFile);
      formData.append("applicationData", JSON.stringify(applicationData));

      const response = await fetch("/api/verify", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setResult(data);
      setState("results");
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
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            TTB Label Verification Tool
          </h1>
          <p className="text-gray-600 mt-2">
            AI-powered alcohol beverage label verification
          </p>
        </header>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {state === "loading" && <LoadingState startTime={loadingStartTime} />}

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
