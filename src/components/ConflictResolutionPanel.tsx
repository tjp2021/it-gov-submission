"use client";

import type { FieldConflict, ImageSource } from "@/lib/types";

interface ConflictResolutionPanelProps {
  conflicts: FieldConflict[];
  imagePreviews: Record<string, string>;
  onResolve: (fieldKey: string, selectedValue: string) => void;
}

function getLabelIcon(label: string): string {
  switch (label) {
    case "front": return "F";
    case "back": return "B";
    case "neck": return "N";
    case "side": return "S";
    case "detail": return "D";
    default: return "O";
  }
}

function ImageSourceBadge({ source, preview }: { source: ImageSource; preview?: string }) {
  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md text-xs"
      title={`${source.fileName} (${source.imageLabel})`}
    >
      {preview && (
        <img
          src={preview}
          alt={source.imageLabel}
          className="w-5 h-5 object-cover rounded"
        />
      )}
      <span className="font-medium text-gray-700">
        {getLabelIcon(source.imageLabel)}
      </span>
    </div>
  );
}

export default function ConflictResolutionPanel({
  conflicts,
  imagePreviews,
  onResolve,
}: ConflictResolutionPanelProps) {
  const resolvedCount = conflicts.filter(c => c.selectedValue !== undefined).length;
  const totalCount = conflicts.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">?</span>
          <div>
            <h3 className="font-semibold text-amber-800">
              Conflicting Values Detected
            </h3>
            <p className="text-sm text-amber-700">
              The images contain different values for {totalCount} field{totalCount !== 1 ? "s" : ""}.
              Please select the correct value for each.
            </p>
          </div>
        </div>
        {totalCount > 1 && (
          <div className="mt-3 text-sm text-amber-700">
            Progress: {resolvedCount} of {totalCount} resolved
          </div>
        )}
      </div>

      {/* Conflicts List */}
      <div className="space-y-4">
        {conflicts.map((conflict) => {
          const isResolved = conflict.selectedValue !== undefined;

          return (
            <div
              key={conflict.fieldKey}
              className={`border-2 rounded-lg p-4 ${
                isResolved
                  ? "border-green-200 bg-green-50"
                  : "border-amber-200 bg-white"
              }`}
            >
              {/* Field Name */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800">
                  {conflict.fieldDisplayName}
                </h4>
                {isResolved && (
                  <span className="text-sm text-green-600 font-medium">
                    Resolved
                  </span>
                )}
              </div>

              {/* Candidate Values */}
              <div className="space-y-2">
                {conflict.candidates.map((candidate, idx) => {
                  const isSelected = conflict.selectedValue !== undefined &&
                    candidate.value.toLowerCase().trim() === conflict.selectedValue.toLowerCase().trim();

                  return (
                    <label
                      key={idx}
                      className={`
                        flex items-start gap-3 p-3 rounded-lg border cursor-pointer
                        transition-colors
                        ${isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name={`conflict-${conflict.fieldKey}`}
                        checked={isSelected}
                        onChange={() => onResolve(conflict.fieldKey, candidate.value)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-gray-800 break-words">
                          {candidate.value}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-gray-500">Found on:</span>
                          {candidate.sources.map((source) => (
                            <ImageSourceBadge
                              key={source.imageId}
                              source={source}
                              preview={imagePreviews[source.imageId]}
                            />
                          ))}
                          {candidate.sources.length > 1 && (
                            <span className="text-xs text-green-600 font-medium">
                              ({candidate.sources.length} images agree)
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
