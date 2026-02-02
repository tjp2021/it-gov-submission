"use client";

import { STANDARD_WARNING_TEXT } from "@/lib/constants";
import type { ApplicationData } from "@/lib/types";

interface ApplicationFormProps {
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
}

export default function ApplicationForm({
  data,
  onChange,
}: ApplicationFormProps) {
  const handleChange = (
    field: keyof ApplicationData,
    value: string
  ) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">
        Application Data (from COLA)
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Brand Name */}
        <div>
          <label
            htmlFor="brandName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Brand Name *
          </label>
          <input
            id="brandName"
            type="text"
            value={data.brandName}
            onChange={(e) => handleChange("brandName", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., Old Tom Distillery"
          />
        </div>

        {/* Class/Type */}
        <div>
          <label
            htmlFor="classType"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Class/Type *
          </label>
          <input
            id="classType"
            type="text"
            value={data.classType}
            onChange={(e) => handleChange("classType", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., Kentucky Straight Bourbon Whiskey"
          />
        </div>

        {/* Alcohol Content */}
        <div>
          <label
            htmlFor="alcoholContent"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Alcohol Content *
          </label>
          <input
            id="alcoholContent"
            type="text"
            value={data.alcoholContent}
            onChange={(e) => handleChange("alcoholContent", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., 45% Alc./Vol. (90 Proof)"
          />
        </div>

        {/* Net Contents */}
        <div>
          <label
            htmlFor="netContents"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Net Contents *
          </label>
          <input
            id="netContents"
            type="text"
            value={data.netContents}
            onChange={(e) => handleChange("netContents", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., 750 mL"
          />
        </div>

        {/* Name & Address */}
        <div className="md:col-span-2">
          <label
            htmlFor="nameAddress"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name & Address (Producer/Bottler/Importer) *
          </label>
          <input
            id="nameAddress"
            type="text"
            value={data.nameAddress}
            onChange={(e) => handleChange("nameAddress", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., Old Tom Distillery, Louisville, KY"
          />
        </div>

        {/* Country of Origin */}
        <div className="md:col-span-2">
          <label
            htmlFor="countryOfOrigin"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Country of Origin (for imports)
          </label>
          <input
            id="countryOfOrigin"
            type="text"
            value={data.countryOfOrigin || ""}
            onChange={(e) => handleChange("countryOfOrigin", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., Scotland (leave blank for domestic)"
          />
        </div>
      </div>

      {/* Government Warning - Pre-filled */}
      <div>
        <label
          htmlFor="governmentWarning"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Government Warning Statement *
          <span className="ml-2 text-xs font-normal text-gray-500">
            (Pre-filled per ABLA — same for all beverages)
          </span>
        </label>
        <textarea
          id="governmentWarning"
          value={data.governmentWarning}
          onChange={(e) => handleChange("governmentWarning", e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
        />
      </div>

      <p className="text-sm text-gray-500">* Required fields</p>
    </div>
  );
}

// Default form data with pre-filled government warning
export const defaultApplicationData: ApplicationData = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  nameAddress: "",
  countryOfOrigin: "",
  governmentWarning: STANDARD_WARNING_TEXT,
};
