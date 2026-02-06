"use client";

import { useState } from "react";
import type { ApplicationData } from "@/lib/types";
import { STANDARD_WARNING_TEXT } from "@/lib/constants";

interface DemoButtonProps {
  onLoadDemo: (data: ApplicationData, imageUrl: string) => void;
}

interface DemoScenario {
  id: string;
  name: string;
  description: string;
  expectedOutcome: "PASS" | "FAIL" | "REVIEW";
  imagePath: string;
  applicationData: ApplicationData;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "perfect",
    name: "Perfect Label",
    description: "All fields match — should PASS",
    expectedOutcome: "PASS",
    imagePath: "/demos/label-perfect.png",
    applicationData: {
      brandName: "Old Tom Distillery",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      nameAddress: "Old Tom Distillery, Louisville, Kentucky",
      countryOfOrigin: "",
      governmentWarning: STANDARD_WARNING_TEXT,
    },
  },
  {
    id: "case-mismatch",
    name: "Case Mismatch",
    description: "Fuzzy matching handles case differences",
    expectedOutcome: "PASS",
    imagePath: "/demos/label-case-mismatch.png",
    applicationData: {
      brandName: "Stone's Throw",
      classType: "Small Batch Bourbon Whiskey",
      alcoholContent: "46% Alc./Vol.",
      netContents: "750 mL",
      nameAddress: "Stone's Throw Distillery, Frankfort, Kentucky",
      countryOfOrigin: "",
      governmentWarning: STANDARD_WARNING_TEXT,
    },
  },
  {
    id: "wrong-abv",
    name: "Wrong ABV",
    description: "Label shows 14.5% but application has 13.5%",
    expectedOutcome: "FAIL",
    imagePath: "/demos/label-wrong-abv.png",
    applicationData: {
      brandName: "Chateau Margaux",
      classType: "Cabernet Sauvignon",
      alcoholContent: "13.5% Alc./Vol.",
      netContents: "750 mL",
      nameAddress: "Chateau Margaux Winery, Napa, California",
      countryOfOrigin: "",
      governmentWarning: STANDARD_WARNING_TEXT,
    },
  },
  {
    id: "warning-titlecase",
    name: "Wrong Warning Format",
    description: "Warning header in title case, not ALL CAPS",
    expectedOutcome: "FAIL",
    imagePath: "/demos/label-warning-titlecase.png",
    applicationData: {
      brandName: "HopMaster",
      classType: "India Pale Ale",
      alcoholContent: "6.5%",
      netContents: "12 FL. OZ.",
      nameAddress: "HopMaster Brewing Co., Portland, Oregon",
      countryOfOrigin: "",
      governmentWarning: STANDARD_WARNING_TEXT,
    },
  },
  {
    id: "imported",
    name: "Imported Spirit",
    description: "Full field coverage incl. country of origin",
    expectedOutcome: "PASS",
    imagePath: "/demos/label-imported.png",
    applicationData: {
      brandName: "Glenfiddich",
      classType: "Single Malt Scotch Whisky",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      nameAddress: "William Grant & Sons, Dufftown, Banffshire, Scotland",
      countryOfOrigin: "Scotland",
      governmentWarning: STANDARD_WARNING_TEXT,
    },
  },
];

const outcomeBadgeStyles: Record<string, string> = {
  PASS: "bg-green-100 text-green-800",
  FAIL: "bg-red-100 text-red-800",
  REVIEW: "bg-yellow-100 text-yellow-800",
};

export default function DemoButton({ onLoadDemo }: DemoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleScenarioClick = async (scenario: DemoScenario) => {
    setLoading(scenario.id);
    try {
      const response = await fetch(scenario.imagePath);
      if (!response.ok) {
        onLoadDemo(scenario.applicationData, "");
        return;
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        onLoadDemo(scenario.applicationData, reader.result as string);
        setIsOpen(false);
        setLoading(null);
      };
      reader.onerror = () => {
        onLoadDemo(scenario.applicationData, "");
        setIsOpen(false);
        setLoading(null);
      };
      reader.readAsDataURL(blob);
    } catch {
      onLoadDemo(scenario.applicationData, "");
      setIsOpen(false);
      setLoading(null);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
      >
        Try with example data
      </button>
    );
  }

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Choose a demo scenario
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DEMO_SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => handleScenarioClick(scenario)}
            disabled={loading !== null}
            className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900">
                {scenario.name}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${outcomeBadgeStyles[scenario.expectedOutcome]}`}
              >
                {scenario.expectedOutcome}
              </span>
            </div>
            <p className="text-xs text-gray-500">{scenario.description}</p>
            {loading === scenario.id && (
              <p className="text-xs text-blue-500 mt-1">Loading...</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
