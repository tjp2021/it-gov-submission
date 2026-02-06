"use client";

import { useState } from "react";
import type { MatchedBatchItem, ApplicationData } from "@/lib/types";
import { STANDARD_WARNING_TEXT } from "@/lib/constants";

interface BatchDemoButtonProps {
  onLoadDemo: (items: MatchedBatchItem[], label: string) => void;
}

interface BatchDemoScenario {
  id: string;
  name: string;
  description: string;
  expectedOutcome: string;
  images: {
    path: string;
    filename: string;
    applicationData: ApplicationData;
    brandName: string;
  }[];
}

// Application data matching the single-image DemoButton scenarios
const PERFECT_APP_DATA: ApplicationData = {
  brandName: "Old Tom Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  nameAddress: "Old Tom Distillery, Louisville, Kentucky",
  countryOfOrigin: "",
  governmentWarning: STANDARD_WARNING_TEXT,
};

const CASE_MISMATCH_APP_DATA: ApplicationData = {
  brandName: "Stone's Throw",
  classType: "Small Batch Bourbon Whiskey",
  alcoholContent: "46% Alc./Vol.",
  netContents: "750 mL",
  nameAddress: "Stone's Throw Distillery, Frankfort, Kentucky",
  countryOfOrigin: "",
  governmentWarning: STANDARD_WARNING_TEXT,
};

const IMPORTED_APP_DATA: ApplicationData = {
  brandName: "Glenfiddich",
  classType: "Single Malt Scotch Whisky",
  alcoholContent: "40% Alc./Vol. (80 Proof)",
  netContents: "750 mL",
  nameAddress: "William Grant & Sons, Dufftown, Banffshire, Scotland",
  countryOfOrigin: "Scotland",
  governmentWarning: STANDARD_WARNING_TEXT,
};

const WRONG_ABV_CORRECT_DATA: ApplicationData = {
  brandName: "Chateau Margaux",
  classType: "Cabernet Sauvignon",
  alcoholContent: "14.5% Alc./Vol.",
  netContents: "750 mL",
  nameAddress: "Chateau Margaux Winery, Napa, California",
  countryOfOrigin: "",
  governmentWarning: STANDARD_WARNING_TEXT,
};

const WRONG_ABV_BAD_DATA: ApplicationData = {
  brandName: "Chateau Margaux",
  classType: "Cabernet Sauvignon",
  alcoholContent: "13.5% Alc./Vol.",
  netContents: "750 mL",
  nameAddress: "Chateau Margaux Winery, Napa, California",
  countryOfOrigin: "",
  governmentWarning: STANDARD_WARNING_TEXT,
};

const BATCH_DEMO_SCENARIOS: BatchDemoScenario[] = [
  {
    id: "csv-pass",
    name: "Demo CSV",
    description: "3 labels with correct CSV data — all should PASS",
    expectedOutcome: "3 PASS",
    images: [
      { path: "/demos/label-perfect.png", filename: "label-perfect.png", applicationData: PERFECT_APP_DATA, brandName: "Old Tom Distillery" },
      { path: "/demos/label-case-mismatch.png", filename: "label-case-mismatch.png", applicationData: CASE_MISMATCH_APP_DATA, brandName: "Stone's Throw" },
      { path: "/demos/label-imported.png", filename: "label-imported.png", applicationData: IMPORTED_APP_DATA, brandName: "Glenfiddich" },
    ],
  },
  {
    id: "manual-pass",
    name: "Demo Manual",
    description: "3 labels with correct manual entry — all should PASS",
    expectedOutcome: "3 PASS",
    images: [
      { path: "/demos/label-perfect.png", filename: "label-perfect.png", applicationData: PERFECT_APP_DATA, brandName: "Old Tom Distillery" },
      { path: "/demos/label-case-mismatch.png", filename: "label-case-mismatch.png", applicationData: CASE_MISMATCH_APP_DATA, brandName: "Stone's Throw" },
      { path: "/demos/label-imported.png", filename: "label-imported.png", applicationData: IMPORTED_APP_DATA, brandName: "Glenfiddich" },
    ],
  },
  {
    id: "csv-failure",
    name: "CSV Failure",
    description: "1 label has wrong ABV — 2 PASS, 1 FAIL",
    expectedOutcome: "2 PASS, 1 FAIL",
    images: [
      { path: "/demos/label-perfect.png", filename: "label-perfect.png", applicationData: PERFECT_APP_DATA, brandName: "Old Tom Distillery" },
      { path: "/demos/label-wrong-abv.png", filename: "label-wrong-abv.png", applicationData: WRONG_ABV_BAD_DATA, brandName: "Chateau Margaux" },
      { path: "/demos/label-imported.png", filename: "label-imported.png", applicationData: IMPORTED_APP_DATA, brandName: "Glenfiddich" },
    ],
  },
  {
    id: "manual-failure",
    name: "Manual Failure",
    description: "All 3 labels have wrong data — all should FAIL",
    expectedOutcome: "3 FAIL",
    images: [
      {
        path: "/demos/label-perfect.png",
        filename: "label-perfect.png",
        brandName: "Wrong Brand Name",
        applicationData: {
          brandName: "Wrong Brand Name",
          classType: "Pinot Noir",
          alcoholContent: "12%",
          netContents: "1 L",
          nameAddress: "Fake Company, Nowhere, Texas",
          countryOfOrigin: "",
          governmentWarning: STANDARD_WARNING_TEXT,
        },
      },
      {
        path: "/demos/label-case-mismatch.png",
        filename: "label-case-mismatch.png",
        brandName: "Totally Wrong",
        applicationData: {
          brandName: "Totally Wrong",
          classType: "Lager",
          alcoholContent: "5%",
          netContents: "355 mL",
          nameAddress: "Unknown LLC, Springfield, Illinois",
          countryOfOrigin: "",
          governmentWarning: STANDARD_WARNING_TEXT,
        },
      },
      {
        path: "/demos/label-imported.png",
        filename: "label-imported.png",
        brandName: "Fake Scotch",
        applicationData: {
          brandName: "Fake Scotch",
          classType: "Blended Whiskey",
          alcoholContent: "35%",
          netContents: "1 L",
          nameAddress: "Not Real Inc., Dallas, Texas",
          countryOfOrigin: "Canada",
          governmentWarning: STANDARD_WARNING_TEXT,
        },
      },
    ],
  },
];

const outcomeBadgeStyles: Record<string, string> = {
  "3 PASS": "bg-green-100 text-green-800",
  "3 FAIL": "bg-red-100 text-red-800",
  "2 PASS, 1 FAIL": "bg-yellow-100 text-yellow-800",
};

async function fetchImageAsFile(imagePath: string, filename: string): Promise<File> {
  const response = await fetch(imagePath);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

export default function BatchDemoButton({ onLoadDemo }: BatchDemoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleScenarioClick = async (scenario: BatchDemoScenario) => {
    setLoading(scenario.id);
    try {
      const files = await Promise.all(
        scenario.images.map((img) => fetchImageAsFile(img.path, img.filename))
      );

      const items: MatchedBatchItem[] = scenario.images.map((img, i) => ({
        id: `demo-${i}`,
        imageFile: files[i],
        applicationData: img.applicationData,
        originalFilename: img.filename,
        brandName: img.brandName,
      }));

      onLoadDemo(items, scenario.name);
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to load batch demo:", err);
    } finally {
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
          Choose a batch demo scenario
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BATCH_DEMO_SCENARIOS.map((scenario) => (
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
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${outcomeBadgeStyles[scenario.expectedOutcome] || "bg-gray-100 text-gray-800"}`}
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
