import Papa from "papaparse";
import type { BatchApplicationRow } from "./types";

const REQUIRED_COLUMNS = [
  "image_filename",
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "nameAddress",
] as const;

const OPTIONAL_COLUMNS = ["countryOfOrigin"] as const;

const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const MAX_ROWS = 10;

export interface CSVParseResult {
  data: BatchApplicationRow[];
  errors: string[];
  warnings: string[];
}

/**
 * Parse a CSV file into BatchApplicationRow[].
 * Validates required columns, enforces max 10 rows, detects duplicate filenames.
 * Row numbers in errors are human-friendly (1-indexed + header offset).
 */
export function parseCSV(csvText: string): CSVParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  // Check for parse-level errors
  for (const err of parsed.errors) {
    const row = err.row !== undefined ? ` (row ${err.row + 2})` : "";
    errors.push(`CSV parse error${row}: ${err.message}`);
  }

  if (errors.length > 0) {
    return { data: [], errors, warnings };
  }

  // Validate column headers
  const headers = parsed.meta.fields || [];
  const missingColumns = REQUIRED_COLUMNS.filter(
    (col) => !headers.includes(col)
  );

  if (missingColumns.length > 0) {
    errors.push(`Missing required columns: ${missingColumns.join(", ")}`);
    return { data: [], errors, warnings };
  }

  // Warn about unrecognized columns
  const extraColumns = headers.filter(
    (h) => !ALL_COLUMNS.includes(h as (typeof ALL_COLUMNS)[number])
  );
  if (extraColumns.length > 0) {
    warnings.push(`Ignored unrecognized columns: ${extraColumns.join(", ")}`);
  }

  // Validate row count
  if (parsed.data.length === 0) {
    errors.push("CSV has no data rows");
    return { data: [], errors, warnings };
  }

  if (parsed.data.length > MAX_ROWS) {
    errors.push(
      `CSV has ${parsed.data.length} rows — maximum is ${MAX_ROWS}`
    );
    return { data: [], errors, warnings };
  }

  // Validate each row
  const data: BatchApplicationRow[] = [];
  const seenFilenames = new Set<string>();

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNum = i + 2; // 1-indexed + header row

    // Check required fields are non-empty
    const emptyFields = REQUIRED_COLUMNS.filter(
      (col) => !row[col]?.trim()
    );
    if (emptyFields.length > 0) {
      errors.push(
        `Row ${rowNum}: missing values for ${emptyFields.join(", ")}`
      );
      continue;
    }

    const filename = row.image_filename.trim();

    // Check duplicate filenames
    const filenameLower = filename.toLowerCase();
    if (seenFilenames.has(filenameLower)) {
      errors.push(`Row ${rowNum}: duplicate filename "${filename}"`);
      continue;
    }
    seenFilenames.add(filenameLower);

    data.push({
      image_filename: filename,
      brandName: row.brandName.trim(),
      classType: row.classType.trim(),
      alcoholContent: row.alcoholContent.trim(),
      netContents: row.netContents.trim(),
      nameAddress: row.nameAddress.trim(),
      countryOfOrigin: row.countryOfOrigin?.trim() || undefined,
    });
  }

  return { data, errors, warnings };
}
