# Field Matching Analysis

Comprehensive empirical testing of all field matching logic.

**Test suite**: `scripts/test-all-matchers.js`
**Results**: 89/89 tests passing (100%)

---

## Summary Table

| Field | Match Type | Threshold | Tested Cases | Accuracy | Key Tradeoffs |
|-------|------------|-----------|--------------|----------|---------------|
| Brand Name | `brand` | Exact | 7 | 100% | Any difference → WARNING (legal identity) |
| Class/Type | `fuzzy` | 0.85 | 28 | 89.3% | Rum/Rhum edge case passes |
| Alcohol Content | `abv` | Numeric | 17 | 100% | Proof÷2 conversion |
| Net Contents | `volume` | 0.5% | 23 | 100% | Unit conversion tolerance |
| Name & Address | `address` | 0.70/0.90 | 18 | 100% | Abbreviation expansion |
| Country of Origin | `country` | Alias | 20 | 100% | USA/UK variations normalized |
| Government Warning | `strict` | Exact | 11 | 100% | OCR errors fail (correct) |

---

## 1. Brand Name Matching

**Strategy**: Exact match only. Any difference → WARNING for human review.

**Rationale**: Brands are legal identities. "Absolut" ≠ "Absolute" even at 97.8% similarity.

**Test Cases**:
| Application | Label | Result | Reason |
|-------------|-------|--------|--------|
| Old Tom Distillery | OLD TOM DISTILLERY | PASS | Case normalized |
| Stone's Throw | STONE'S THROW | PASS | Apostrophe normalized |
| Absolut | Absolute | WARNING | Different spelling |
| Jim Beam | Jim Bean | WARNING | Typo requires review |

**Tradeoff**: More human review, but zero false auto-approvals for brand names.

---

## 2. Class/Type Matching

**Strategy**: Jaro-Winkler 0.85 threshold + word-level validation.

**Why 0.85?** Empirically tested (see `scripts/test-classtype-threshold.js`):
- 0.85: 89.3% accuracy
- 0.90: 85.7% accuracy (more false negatives)

**Word-Level Check**: Catches "Pinot Noir" vs "Pinot Grigio" where overall similarity is 0.908.

**Known Edge Case**: "Rum" vs "Rhum" (0.925 similarity) passes. Mitigated by overall workflow human review.

---

## 3. Alcohol Content (ABV) Matching

**Strategy**: Parse numeric value, convert proof to ABV (proof ÷ 2).

**Formats Tested**:
| Format | Example | Parsed |
|--------|---------|--------|
| Percentage | 45% ABV | 45% |
| Percentage w/ space | 45 % | 45% |
| Decimal | 45.5% | 45.5% |
| Proof | 90 Proof | 45% |
| Decimal proof | 86.4 Proof | 43.2% |
| European | Alc. 14% by vol. | 14% |

**Proof Conversion**: US standard (Proof = 2 × ABV). This is correct for TTB-regulated products.

---

## 4. Net Contents (Volume) Matching

**Strategy**: Parse numeric + unit, convert to mL, allow 0.5% tolerance.

**Why 0.5%?** Accounts for rounding in unit conversions:
- 750 mL = 25.3605 fl oz (often printed as 25.4)
- 0.5% tolerance handles this rounding

**Units Supported**:
| Unit | Conversion | Tested |
|------|------------|--------|
| mL, ml, ML | ×1 | ✅ |
| L, l | ×1000 | ✅ |
| cl | ×10 | ✅ |
| fl oz, FL OZ, fl. oz. | ×29.5735 | ✅ |
| pt (pint) | ×473.176 | ✅ |
| qt (quart) | ×946.353 | ✅ |

**Verified Conversions**:
| Metric | Imperial | Difference |
|--------|----------|------------|
| 750 mL | 25.4 fl oz | 0.15% ✅ |
| 1 L | 33.8 fl oz | 0.03% ✅ |
| 1.75 L | 59.2 fl oz | 0.05% ✅ |

**Known Limitations** (not supported):
| Format | Example | Why Not Supported |
|--------|---------|-------------------|
| Word fractions | "half gallon" | Informal, not on TTB labels |
| Historical notation | "1/5" (a fifth) | TTB standardized to metric (750 mL) |
| Fraction notation | "1/2 gallon" | Use "1892 mL" or "64 fl oz" instead |

TTB standard fills use metric (mL, L) or fl oz - these edge cases don't appear on compliant labels.

---

## 5. Name & Address Matching

**Strategy**: Normalize abbreviations, then Jaro-Winkler with tiered thresholds.

**Thresholds**:
- ≥ 0.90: PASS
- ≥ 0.70: WARNING (agent review)
- < 0.70: FAIL

**Why 0.70?** Labels often abbreviate:
- "Buffalo Trace Distillery, 113 Great Buffalo Trace, Frankfort, KY 40601"
- → "Buffalo Trace, Frankfort, KY"

**Normalizations**:
| Type | Before | After |
|------|--------|-------|
| State abbrev | KY | kentucky |
| Street abbrev | St. | street |
| Apostrophe | Maker's | makers |
| Production phrase | Bottled by X | X |
| Case | BUFFALO TRACE | buffalo trace |

---

## 6. Country of Origin Matching

**Strategy**: ISO 3166 library + TTB-specific regions + wine/spirit region mapping.

### Why This Approach?

TTB requires "Country of Origin" on labels, but labels often show:
- Regions instead of countries: "Champagne" instead of "France"
- Native language names: "Deutschland" instead of "Germany"
- Multilingual prefixes: "Produit de France" instead of "Product of France"

Our solution normalizes both the application value AND the extracted label value to a canonical form, then compares.

### Implementation

Uses `i18n-iso-countries` library with 7 language locales + custom mappings:

**1. Multilingual "Product of" Stripping:**
```
"Product of France"     → "France"
"Produit de France"     → "France"
"Producto de México"    → "México"
"Prodotto d'Italia"     → "Italia"
"Made in USA"           → "USA"
```

**2. Wine/Spirit Region → Country Mapping:**
| Region | Maps To | Why |
|--------|---------|-----|
| Champagne, Burgundy, Cognac | France | French wine/spirit regions |
| Rioja, Jerez | Spain | Spanish wine regions |
| Tuscany, Piedmont | Italy | Italian wine regions |
| Speyside, Islay, Highland | Scotland | Scotch whisky regions |
| Napa, Kentucky | USA | American wine/whiskey regions |

**3. TTB-Specific Regions** (kept as-is, not mapped to UK):
- Scotland, England, Wales, Northern Ireland
- Puerto Rico, U.S. Virgin Islands

**4. Old Country Names:**
| Old Name | Maps To |
|----------|---------|
| Burma | Myanmar |
| Swaziland | Eswatini |
| Macedonia | North Macedonia |
| Czechoslovakia | Czech Republic |

**5. ISO 3166 Lookup** (7 languages):
- English, German, Spanish, Italian, French, Portuguese, Hungarian

### Matching Examples

| Application | Label | Both Normalize To | Result |
|-------------|-------|-------------------|--------|
| Scotland | Speyside | scotland | PASS |
| Scotland | Islay | scotland | PASS |
| France | Champagne | france | PASS |
| France | Produit de France | france | PASS |
| Germany | Deutschland | germany | PASS |
| Spain | Rioja | spain | PASS |
| USA | Kentucky | united states of america | PASS |

### Edge Cases

- **Scotland ≠ UK**: Correctly fails. For TTB Scotch whisky labeling, "Scotland" is the required designation, not "UK".
- **Speyside ≠ Champagne**: Correctly fails (scotland ≠ france).
- **Region in form**: If someone enters "Champagne" as country (wrong, it's a region), it still works because it normalizes to "France".

---

## 7. Government Warning Text Matching

**Strategy**: Strict whitespace normalization, case-insensitive match.

**Why Strict?** Regulatory requirement — the warning must be exactly correct.

**Tested**:
| Scenario | Result | Correct? |
|----------|--------|----------|
| Exact match | PASS | ✅ |
| Case difference | PASS | ✅ |
| Extra whitespace | PASS | ✅ |
| OCR error "problerns" | FAIL | ✅ |
| Missing colon | FAIL | ✅ |
| Truncated | FAIL | ✅ |

**Tradeoff**: OCR errors cause failures, but this is correct behavior — a garbled warning is a compliance issue.

---

## Regulatory Clarifications

### ABV Tolerance (±0.3%)

[TTB regulations](https://www.ttb.gov/distilled-spirits/labeling) allow ±0.3 percentage points tolerance for **production variance** — the actual alcohol content in a bottle can vary from the labeled amount by this much.

**This does NOT apply to our verification** because:
- We compare **application data** (what producer submits) vs **label text** (what's printed)
- Both should state the same value — "45% ABV" on application and "45% ABV" on label
- The ±0.3% is for bottling QC, not label compliance

### Net Contents Tolerance

Per [27 CFR 5.70](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5), tolerances exist for:
- Manufacturing variances in container capacity
- Measuring errors during filling

**Our 0.5% tolerance** handles unit conversion rounding:
| Exact | Rounded | Difference |
|-------|---------|------------|
| 750 mL = 25.3605 fl oz | 25.4 fl oz | 0.15% |

This is appropriate because labels legitimately round converted values.

### Country Normalization

**Resolved**: Now uses `i18n-iso-countries` library instead of hardcoded aliases.

- Supports 7 language locales (EN, DE, ES, IT, FR, PT, HU)
- Handles wine-producing country variations (Deutschland→Germany, Italia→Italy)
- TTB-specific regions (Scotland, Puerto Rico) handled separately
- Archaic names (Hellas, Eire) handled via manual fallback

---

## Tradeoffs Summary

| Decision | Alternative | Why We Chose This |
|----------|-------------|-------------------|
| Brand = strict | Brand = fuzzy 0.90 | Legal identity, false approval is worse |
| Class/Type = 0.85 | 0.90 threshold | Empirically better accuracy |
| Address = 0.70 WARNING | 0.80 threshold | Labels often abbreviate heavily |
| Country aliases | Exact only | USA/United States is same country |
| Gov Warning = strict | Fuzzy for OCR tolerance | Regulatory compliance requires exact |
| Volume = 0.5% tolerance | Exact | Rounding in unit conversions |

---

## Running the Tests

```bash
# Run comprehensive matcher tests
node scripts/test-all-matchers.js

# Run class/type threshold analysis
node scripts/test-classtype-threshold.js

# Run brand matching tests
node scripts/test-brand-matching.js
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/constants.ts` | Added `COUNTRY_ALIASES` |
| `src/lib/utils.ts` | `normalizeCountryOfOrigin()` uses aliases |
| `src/lib/comparison.ts` | `brandMatch()` function added |
