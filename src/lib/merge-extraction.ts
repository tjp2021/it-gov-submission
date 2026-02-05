import type {
  ExtractedFields,
  ImageExtraction,
  ImageSource,
  SourcedFieldValue,
  FieldConflict,
  MergedExtraction,
} from "./types";
import { FIELD_CONFIG } from "./constants";

/**
 * Normalizes a value for comparison (case-insensitive, whitespace-collapsed)
 */
function normalizeValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Groups field values by their normalized form
 */
function groupValuesBySimilarity(
  values: Array<{ value: string; source: ImageSource }>
): Map<string, SourcedFieldValue> {
  const groups = new Map<string, SourcedFieldValue>();

  for (const { value, source } of values) {
    const normalized = normalizeValue(value);
    if (!normalized) continue;

    const existing = groups.get(normalized);
    if (existing) {
      existing.sources.push(source);
    } else {
      groups.set(normalized, {
        value, // Keep the first original value
        sources: [source],
      });
    }
  }

  return groups;
}

/**
 * Extracts a field value from ExtractedFields
 */
function getFieldValue(fields: ExtractedFields, fieldKey: string): string | null {
  const value = fields[fieldKey as keyof ExtractedFields];
  return typeof value === "string" ? value : null;
}

/**
 * Gets all extractable field keys (excluding special fields)
 */
function getExtractableFieldKeys(): string[] {
  return [
    "brandName",
    "classType",
    "alcoholContent",
    "netContents",
    "nameAddress",
    "countryOfOrigin",
    "governmentWarning",
  ];
}

/**
 * Merges extractions from multiple images into a single result
 *
 * For each field:
 * - Collect values from all images that found it
 * - Group by normalized value (case-insensitive, whitespace-collapsed)
 * - If single unique value → use it, track sources
 * - If multiple different values → create FieldConflict, default to most common
 *
 * @param extractions - Array of extraction results from individual images
 * @returns Merged extraction with source tracking and conflicts
 */
export function mergeExtractions(extractions: ImageExtraction[]): MergedExtraction {
  const mergedFields: Partial<ExtractedFields> = {};
  const fieldSources: Record<string, SourcedFieldValue> = {};
  const conflicts: FieldConflict[] = [];

  const fieldKeys = getExtractableFieldKeys();

  for (const fieldKey of fieldKeys) {
    // Collect all values for this field from all extractions
    const valuesWithSources: Array<{ value: string; source: ImageSource }> = [];

    for (const extraction of extractions) {
      const value = getFieldValue(extraction.fields, fieldKey);
      if (value) {
        valuesWithSources.push({
          value,
          source: extraction.source,
        });
      }
    }

    if (valuesWithSources.length === 0) {
      // No image found this field
      mergedFields[fieldKey as keyof ExtractedFields] = null as never;
      continue;
    }

    // Group by normalized value
    const groups = groupValuesBySimilarity(valuesWithSources);
    const groupArray = Array.from(groups.values());

    if (groupArray.length === 1) {
      // All images agree (or only one found it)
      const sourced = groupArray[0];
      mergedFields[fieldKey as keyof ExtractedFields] = sourced.value as never;
      fieldSources[fieldKey] = sourced;
    } else {
      // Multiple different values - CONFLICT
      // Sort by number of sources (most common first), then by value alphabetically
      groupArray.sort((a, b) => {
        if (b.sources.length !== a.sources.length) {
          return b.sources.length - a.sources.length;
        }
        return a.value.localeCompare(b.value);
      });

      // Default to most common value
      const mostCommon = groupArray[0];
      mergedFields[fieldKey as keyof ExtractedFields] = mostCommon.value as never;
      fieldSources[fieldKey] = mostCommon;

      // Create conflict record
      const displayName = FIELD_CONFIG[fieldKey as keyof typeof FIELD_CONFIG]?.displayName || fieldKey;
      conflicts.push({
        fieldKey,
        fieldDisplayName: displayName,
        candidates: groupArray,
      });
    }
  }

  // Handle special fields (non-extractable) - take from first extraction that has them
  const firstExtraction = extractions[0]?.fields;
  if (firstExtraction) {
    if (!mergedFields.governmentWarningHeaderFormat) {
      mergedFields.governmentWarningHeaderFormat = firstExtraction.governmentWarningHeaderFormat;
    }
    if (!mergedFields.governmentWarningHeaderEmphasis) {
      mergedFields.governmentWarningHeaderEmphasis = firstExtraction.governmentWarningHeaderEmphasis;
    }
    if (!mergedFields.additionalObservations) {
      // Combine additional observations from all images
      const observations = extractions
        .map(e => e.fields.additionalObservations)
        .filter(Boolean)
        .join("; ");
      mergedFields.additionalObservations = observations || null;
    }
  }

  // Ensure all required ExtractedFields properties exist
  const completeFields: ExtractedFields = {
    brandName: mergedFields.brandName ?? null,
    classType: mergedFields.classType ?? null,
    alcoholContent: mergedFields.alcoholContent ?? null,
    netContents: mergedFields.netContents ?? null,
    nameAddress: mergedFields.nameAddress ?? null,
    countryOfOrigin: mergedFields.countryOfOrigin ?? null,
    governmentWarning: mergedFields.governmentWarning ?? null,
    governmentWarningHeaderFormat: mergedFields.governmentWarningHeaderFormat ?? "NOT_FOUND",
    governmentWarningHeaderEmphasis: mergedFields.governmentWarningHeaderEmphasis ?? "UNCERTAIN",
    additionalObservations: mergedFields.additionalObservations ?? null,
  };

  return {
    fields: completeFields,
    fieldSources,
    conflicts,
    imageExtractions: extractions,
  };
}

/**
 * Resolves a conflict by applying a human-selected value
 *
 * @param merged - Current merged extraction state
 * @param fieldKey - The field key with the conflict
 * @param selectedValue - The value selected by the user
 * @returns Updated MergedExtraction with the conflict resolved
 */
export function resolveConflict(
  merged: MergedExtraction,
  fieldKey: string,
  selectedValue: string
): MergedExtraction {
  // Find the conflict
  const conflictIndex = merged.conflicts.findIndex(c => c.fieldKey === fieldKey);
  if (conflictIndex === -1) {
    // No conflict for this field, return unchanged
    return merged;
  }

  const conflict = merged.conflicts[conflictIndex];

  // Find the candidate with this value
  const selectedCandidate = conflict.candidates.find(
    c => normalizeValue(c.value) === normalizeValue(selectedValue)
  );

  if (!selectedCandidate) {
    // Selected value not in candidates, return unchanged
    return merged;
  }

  // Update the merged fields with the selected value
  const updatedFields = { ...merged.fields };
  updatedFields[fieldKey as keyof ExtractedFields] = selectedValue as never;

  // Update field sources
  const updatedFieldSources = { ...merged.fieldSources };
  updatedFieldSources[fieldKey] = selectedCandidate;

  // Mark conflict as resolved
  const updatedConflicts = [...merged.conflicts];
  updatedConflicts[conflictIndex] = {
    ...conflict,
    selectedValue,
    selectedAt: new Date().toISOString(),
  };

  return {
    ...merged,
    fields: updatedFields,
    fieldSources: updatedFieldSources,
    conflicts: updatedConflicts,
  };
}

/**
 * Checks if all conflicts have been resolved
 */
export function allConflictsResolved(merged: MergedExtraction): boolean {
  return merged.conflicts.every(c => c.selectedValue !== undefined);
}

/**
 * Gets unresolved conflicts
 */
export function getUnresolvedConflicts(merged: MergedExtraction): FieldConflict[] {
  return merged.conflicts.filter(c => c.selectedValue === undefined);
}
