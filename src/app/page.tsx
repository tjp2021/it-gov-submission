"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import MultiImageUploader from "@/components/MultiImageUploader";
import ApplicationForm, {
  defaultApplicationData,
} from "@/components/ApplicationForm";
import VerificationResults from "@/components/VerificationResults";
import LoadingState from "@/components/LoadingState";
import ConflictResolutionPanel from "@/components/ConflictResolutionPanel";
import DemoButton from "@/components/DemoButton";
import type {
  ApplicationData,
  VerificationResult,
  MultiImageVerificationResult,
  FieldResult,
  UploadedImage,
  FieldConflict,
  MergedExtraction,
} from "@/lib/types";
import { resolveConflict, allConflictsResolved } from "@/lib/merge-extraction";
import { computeOverallStatus } from "@/lib/verify-single";

type AppState = "input" | "extracting" | "conflict" | "comparing" | "results";

// Type guard to check if result is multi-image
function isMultiImageResult(
  result: VerificationResult | MultiImageVerificationResult
): result is MultiImageVerificationResult {
  return "imageCount" in result && result.imageCount > 1;
}

export default function Home() {
  const [state, setState] = useState<AppState>("input");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [applicationData, setApplicationData] = useState<ApplicationData>(
    defaultApplicationData
  );
  const [result, setResult] = useState<VerificationResult | MultiImageVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamMessage, setStreamMessage] = useState<string>("");
  const [streamFields, setStreamFields] = useState<FieldResult[]>([]);

  // Multi-image specific state
  const [mergedExtraction, setMergedExtraction] = useState<MergedExtraction | null>(null);
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const [extractionProgress, setExtractionProgress] = useState<{
    completed: number;
    total: number;
  }>({ completed: 0, total: 0 });

  // Build image previews map for conflict panel
  const imagePreviews = images.reduce<Record<string, string>>((acc, img, idx) => {
    acc[`img-${idx}`] = img.preview;
    return acc;
  }, {});

  const handleImagesChange = useCallback((newImages: UploadedImage[]) => {
    setImages(newImages);
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
        setImages([{
          id: `img-demo-${Date.now()}`,
          file,
          preview: imageUrl,
          label: "front",
        }]);
      }
      setError(null);
    },
    []
  );

  const handleVerify = async () => {
    if (images.length === 0) {
      setError("Please upload at least one label image");
      return;
    }

    if (!applicationData.brandName || !applicationData.classType) {
      setError("Please fill in required fields");
      return;
    }

    setError(null);
    setState("extracting");
    setStreamMessage("Starting...");
    setStreamFields([]);
    setMergedExtraction(null);
    setConflicts([]);
    setExtractionProgress({ completed: 0, total: images.length });

    try {
      const formData = new FormData();

      // Send images in multi-image format
      const imageLabels: Record<string, string> = {};
      images.forEach((img, idx) => {
        formData.append(`labelImage_${idx}`, img.file);
        imageLabels[String(idx)] = img.label;
      });
      formData.append("imageLabels", JSON.stringify(imageLabels));
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
      let completedExtractions = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith("event: ")) {
            const eventType = line.slice(7);
            const dataLine = lines[i + 1];
            if (dataLine?.startsWith("data: ")) {
              const data = JSON.parse(dataLine.slice(6));

              switch (eventType) {
                case "progress":
                  setStreamMessage(data.message);
                  if (data.stage === "comparing") {
                    setState("comparing");
                  }
                  break;

                case "image_extraction_start":
                  setStreamMessage(`Analyzing ${data.label} image (${data.index + 1}/${data.total})...`);
                  break;

                case "image_extraction_complete":
                  completedExtractions++;
                  setExtractionProgress({
                    completed: completedExtractions,
                    total: images.length,
                  });
                  break;

                case "conflict_detected":
                  // Conflicts detected - will handle after merge_complete
                  break;

                case "merge_complete":
                  if (data.conflictCount > 0) {
                    // We have conflicts - pause for resolution
                    // Note: conflicts are in the merge_complete data indirectly via conflict_detected
                  }
                  setStreamMessage(`Merged ${images.length} images`);
                  break;

                case "field":
                  setStreamFields(prev => [...prev, data as FieldResult]);
                  break;

                case "complete":
                  const resultData = data as VerificationResult | MultiImageVerificationResult;
                  setResult(resultData);

                  // Check if there are unresolved conflicts
                  if (isMultiImageResult(resultData) && resultData.unresolvedConflicts.length > 0) {
                    setMergedExtraction(resultData.mergedExtraction);
                    setConflicts(resultData.unresolvedConflicts);
                    setState("conflict");
                  } else {
                    setState("results");
                  }
                  return;

                case "error":
                  throw new Error(data.error);
              }
              i++; // Skip the data line we just processed
            }
          }
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setState("input");
    }
  };

  const handleConflictResolve = (fieldKey: string, selectedValue: string) => {
    if (!mergedExtraction) return;

    const updated = resolveConflict(mergedExtraction, fieldKey, selectedValue);
    setMergedExtraction(updated);

    // Update conflicts state to show resolution
    setConflicts(
      conflicts.map(c =>
        c.fieldKey === fieldKey
          ? { ...c, selectedValue, selectedAt: new Date().toISOString() }
          : c
      )
    );
  };

  const handleContinueAfterConflicts = () => {
    // All conflicts resolved, move to results
    // The result already has the data, we just need to transition
    setState("results");
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

    // Recompute overall status using shared logic (respects field categories)
    const overallStatus = computeOverallStatus(updatedResults);

    setResult({
      ...result,
      overallStatus,
      fieldResults: updatedResults,
    });
  };

  const handleReset = () => {
    setState("input");
    setImages([]);
    setApplicationData(defaultApplicationData);
    setResult(null);
    setError(null);
    setMergedExtraction(null);
    setConflicts([]);
    setExtractionProgress({ completed: 0, total: 0 });
  };

  // Check if all conflicts are resolved
  const allResolved = conflicts.every(c => c.selectedValue !== undefined);

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
              className="px-4 py-2 text-sm text-white hover:opacity-90 rounded-lg transition-opacity"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              Batch Mode
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {(state === "extracting" || state === "comparing") && (
            <LoadingState
              streamMessage={streamMessage}
              streamFields={streamFields}
              extractionProgress={images.length > 1 ? extractionProgress : undefined}
            />
          )}

          {state === "conflict" && (
            <div className="space-y-6">
              <ConflictResolutionPanel
                conflicts={conflicts}
                imagePreviews={imagePreviews}
                onResolve={handleConflictResolve}
              />

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={handleContinueAfterConflicts}
                  disabled={!allResolved}
                  className={`px-6 py-3 font-semibold rounded-lg transition-colors ${
                    allResolved
                      ? "text-white hover:opacity-90"
                      : "text-white opacity-60 cursor-not-allowed"
                  }`}
                  style={{ backgroundColor: '#1e3a5f' }}
                >
                  Continue to Results
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-3 text-gray-600 font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          {state === "results" && result && (
            <VerificationResults
              result={result}
              labelImages={images.map((img, idx) => ({
                id: `img-${idx}`,
                label: img.label,
                preview: img.preview,
              }))}
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

              {/* Multi-Image Upload */}
              <MultiImageUploader
                images={images}
                onImagesChange={handleImagesChange}
                maxImages={6}
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
                disabled={images.length === 0}
                className={`w-full py-4 text-lg font-semibold rounded-lg transition-colors ${
                  images.length > 0
                    ? "text-white hover:opacity-90"
                    : "text-white opacity-60 cursor-not-allowed"
                }`}
                style={{ backgroundColor: '#1e3a5f' }}
              >
                Verify Label{images.length > 1 ? `s (${images.length})` : ""}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>
            Prototype for TTB Compliance Division - Built with Gemini Flash
          </p>
        </footer>
      </div>
    </main>
  );
}
