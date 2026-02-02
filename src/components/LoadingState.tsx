"use client";

import { useState, useEffect } from "react";

interface LoadingStateProps {
  startTime: number;
}

export default function LoadingState({ startTime }: LoadingStateProps) {
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState(0);

  const stages = [
    { label: "Uploading image...", duration: 500 },
    { label: "Analyzing label with AI...", duration: 3000 },
    { label: "Comparing fields...", duration: 500 },
    { label: "Generating results...", duration: 500 },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - startTime;
      setElapsed(diff);

      // Determine current stage based on elapsed time
      let cumulative = 0;
      for (let i = 0; i < stages.length; i++) {
        cumulative += stages[i].duration;
        if (diff < cumulative) {
          setStage(i);
          break;
        }
        if (i === stages.length - 1) {
          setStage(stages.length - 1);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      {/* Spinner */}
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
      </div>

      {/* Stage label */}
      <div className="text-center">
        <p className="text-lg font-medium text-gray-700">
          {stages[stage]?.label || "Processing..."}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {(elapsed / 1000).toFixed(1)}s elapsed
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {stages.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              i <= stage ? "bg-blue-600" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
