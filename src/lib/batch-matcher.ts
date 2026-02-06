import type { ApplicationData, BatchApplicationRow, MatchedBatchItem } from "./types";
import { STANDARD_WARNING_TEXT } from "./constants";

export interface MatchResult {
  matched: MatchedBatchItem[];
  unmatchedImages: string[];
  unmatchedRows: string[];
}

/**
 * Strip extension from a filename to get the basename.
 * Handles preprocessImage() renaming .png → .jpg.
 */
function basename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").toLowerCase();
}

/**
 * Match uploaded Files to CSV rows.
 * - Case-insensitive exact filename match first
 * - Basename fallback (handles .png → .jpg from preprocessImage)
 * - Auto-fills governmentWarning with STANDARD_WARNING_TEXT
 */
export function matchBatch(
  files: File[],
  rows: BatchApplicationRow[]
): MatchResult {
  const matched: MatchedBatchItem[] = [];
  const usedRowIndices = new Set<number>();
  const matchedFileIndices = new Set<number>();

  // Build lookup maps for CSV rows
  const exactMap = new Map<string, number>(); // lowercase filename → row index
  const baseMap = new Map<string, number[]>(); // basename → row indices

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lower = row.image_filename.toLowerCase();
    exactMap.set(lower, i);

    const base = basename(row.image_filename);
    if (!baseMap.has(base)) {
      baseMap.set(base, []);
    }
    baseMap.get(base)!.push(i);
  }

  // Pass 1: exact filename match (case-insensitive)
  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    const lower = file.name.toLowerCase();
    const rowIdx = exactMap.get(lower);

    if (rowIdx !== undefined && !usedRowIndices.has(rowIdx)) {
      matched.push(buildItem(file, rows[rowIdx]));
      usedRowIndices.add(rowIdx);
      matchedFileIndices.add(fi);
    }
  }

  // Pass 2: basename fallback for unmatched files
  for (let fi = 0; fi < files.length; fi++) {
    if (matchedFileIndices.has(fi)) continue;

    const file = files[fi];
    const base = basename(file.name);
    const candidates = baseMap.get(base) || [];

    for (const rowIdx of candidates) {
      if (!usedRowIndices.has(rowIdx)) {
        matched.push(buildItem(file, rows[rowIdx]));
        usedRowIndices.add(rowIdx);
        matchedFileIndices.add(fi);
        break;
      }
    }
  }

  // Collect unmatched
  const unmatchedImages = files
    .filter((_, i) => !matchedFileIndices.has(i))
    .map((f) => f.name);

  const unmatchedRows = rows
    .filter((_, i) => !usedRowIndices.has(i))
    .map((r) => r.image_filename);

  return { matched, unmatchedImages, unmatchedRows };
}

function buildItem(file: File, row: BatchApplicationRow): MatchedBatchItem {
  const appData: ApplicationData = {
    brandName: row.brandName,
    classType: row.classType,
    alcoholContent: row.alcoholContent,
    netContents: row.netContents,
    nameAddress: row.nameAddress,
    countryOfOrigin: row.countryOfOrigin || "",
    governmentWarning: STANDARD_WARNING_TEXT,
  };

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    imageFile: file,
    applicationData: appData,
    originalFilename: file.name,
    brandName: row.brandName,
  };
}

/**
 * Build a MatchedBatchItem from manual form entry (no CSV).
 */
export function buildManualItem(
  file: File,
  formData: Omit<ApplicationData, "governmentWarning">
): MatchedBatchItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    imageFile: file,
    applicationData: {
      ...formData,
      countryOfOrigin: formData.countryOfOrigin || "",
      governmentWarning: STANDARD_WARNING_TEXT,
    },
    originalFilename: file.name,
    brandName: formData.brandName,
  };
}
