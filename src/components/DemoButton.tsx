"use client";

import type { ApplicationData } from "@/lib/types";
import { STANDARD_WARNING_TEXT } from "@/lib/constants";

interface DemoButtonProps {
  onLoadDemo: (data: ApplicationData, imageUrl: string) => void;
}

// Demo application data matching a sample bourbon label
const demoApplicationData: ApplicationData = {
  brandName: "Old Tom Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  nameAddress: "Old Tom Distillery, Louisville, Kentucky",
  countryOfOrigin: "",
  governmentWarning: STANDARD_WARNING_TEXT,
};

// Demo label image (will be loaded from public folder)
const demoImageUrl = "/demo-label.png";

export default function DemoButton({ onLoadDemo }: DemoButtonProps) {
  const handleClick = async () => {
    try {
      // Fetch the demo image and convert to data URL
      const response = await fetch(demoImageUrl);
      if (!response.ok) {
        console.error("Demo image not found");
        // Still load the form data even if image fails
        onLoadDemo(demoApplicationData, "");
        return;
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        onLoadDemo(demoApplicationData, reader.result as string);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error loading demo:", error);
      onLoadDemo(demoApplicationData, "");
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
    >
      <span>🎯</span>
      <span>Try with example data</span>
    </button>
  );
}

export { demoApplicationData };
