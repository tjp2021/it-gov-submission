// Application data entered by the agent (from COLA form)
export interface ApplicationData {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  nameAddress: string;
  countryOfOrigin?: string;
  governmentWarning: string;
}

// Fields extracted from the label image by Claude Vision
export interface ExtractedFields {
  brandName: string | null;
  classType: string | null;
  alcoholContent: string | null;
  netContents: string | null;
  nameAddress: string | null;
  countryOfOrigin: string | null;
  governmentWarning: string | null;
  governmentWarningHeaderFormat: "ALL_CAPS" | "MIXED_CASE" | "NOT_FOUND";
  governmentWarningHeaderEmphasis:
    | "APPEARS_BOLD_OR_HEAVY"
    | "APPEARS_NORMAL_WEIGHT"
    | "UNCERTAIN";
  additionalObservations: string | null;
}

// Match types for different field comparison strategies
export type MatchType =
  | "strict"
  | "brand"
  | "classType"
  | "numeric"
  | "fuzzy"
  | "abv"
  | "volume"
  | "address"
  | "country";

// Status for individual field verification
export type FieldStatus =
  | "PASS"
  | "FAIL"
  | "WARNING"
  | "NOT_FOUND"
  | "OVERRIDDEN";

// Category for field results - determines how they affect overall status
// "automated" - contributes to PASS/FAIL/REVIEW status
// "confirmation" - requires agent confirmation, does not block PASS
export type FieldCategory = "automated" | "confirmation";

// Overall verification status
export type OverallStatus = "PASS" | "FAIL" | "REVIEW";

// Pending confirmation that agent must complete (e.g., bold check)
export interface PendingConfirmation {
  id: string;
  label: string;
  description: string;
  aiAssessment?: string;
  confirmed: boolean;
  confirmedAt?: string;
}

// Agent override action
export interface AgentOverride {
  action: "accepted" | "confirmed_issue";
  timestamp: string;
}

// Result for a single field comparison
export interface FieldResult {
  fieldName: string;
  applicationValue: string;
  extractedValue: string | null;
  status: FieldStatus;
  matchType: MatchType;
  confidence: number;
  details: string;
  category: FieldCategory;  // "automated" or "confirmation"
  agentOverride?: AgentOverride;
}

// Complete verification response
export interface VerificationResult {
  overallStatus: OverallStatus;
  pendingConfirmations: PendingConfirmation[];  // Agent must confirm these
  processingTimeMs: number;
  extractedFields: ExtractedFields;
  fieldResults: FieldResult[];
}

// Batch CSV row — one row per label, maps to ApplicationData
export interface BatchApplicationRow {
  image_filename: string;
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  nameAddress: string;
  countryOfOrigin?: string;
  // governmentWarning excluded — auto-filled with STANDARD_WARNING_TEXT
}

// A matched batch item: image file paired with its application data
export interface MatchedBatchItem {
  id: string;
  imageFile: File;
  applicationData: ApplicationData;
  originalFilename: string;
  brandName: string;
}

// Internal match result from comparison functions
export interface MatchResult {
  status: FieldStatus;
  confidence: number;
  details: string;
}

// =============================================
// Multi-Image Upload Types
// =============================================

// Image label identifying which part of the product this image shows
export type ImageLabel = "front" | "back" | "neck" | "side" | "detail" | "other";

// Image identification for source tracking
export interface ImageSource {
  imageId: string;
  imageLabel: ImageLabel;
  fileName: string;
}

// Uploaded image with metadata (client-side)
export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  label: ImageLabel;
}

// Extraction result from a single image
export interface ImageExtraction {
  source: ImageSource;
  fields: ExtractedFields;
  processingTimeMs: number;
}

// Field value with source tracking (which images it was found on)
export interface SourcedFieldValue {
  value: string;
  sources: ImageSource[];
}

// Conflict requiring human resolution
export interface FieldConflict {
  fieldKey: string;
  fieldDisplayName: string;
  candidates: SourcedFieldValue[];
  selectedValue?: string;
  selectedAt?: string;
}

// Merged extraction from multiple images
export interface MergedExtraction {
  fields: ExtractedFields;
  fieldSources: Record<string, SourcedFieldValue>;
  conflicts: FieldConflict[];
  imageExtractions: ImageExtraction[];
}

// Extended field result with source tracking (for multi-image)
export interface MultiImageFieldResult extends FieldResult {
  sources?: ImageSource[];
  confirmedOnImages?: number;
  hadConflict?: boolean;
  conflictResolution?: {
    selectedValue: string;
    selectedFromImage: string;
    rejectedValues: Array<{ value: string; fromImages: string[] }>;
    resolvedAt: string;
  };
}

// Final verification result for multi-image flow
export interface MultiImageVerificationResult extends VerificationResult {
  imageCount: number;
  images: ImageSource[];
  mergedExtraction: MergedExtraction;
  unresolvedConflicts: FieldConflict[];
  fieldResults: MultiImageFieldResult[];
}
