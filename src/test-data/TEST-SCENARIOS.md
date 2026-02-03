# Test Scenarios

This document defines test scenarios for the TTB Label Verification Tool, organized by complexity and purpose.

---

## Group 1: Basic (Functional Validation)

**Purpose:** Verify core matching logic works correctly for standard cases.

| ID | Name | Tests | Expected |
|----|------|-------|----------|
| B1 | Perfect Match | All fields identical | PASS |
| B2 | Case Mismatch | "STONE'S THROW" vs "Stone's Throw" | PASS (fuzzy match) |
| B3 | Wrong ABV | Label: 14.5%, App: 13.5% | FAIL |
| B4 | Warning Title Case | "Government Warning" not "GOVERNMENT WARNING" | FAIL |
| B5 | Missing Warning | No government warning on label | FAIL |
| B6 | Imported Product | Full fields + country of origin | PASS |

**Status:** ✅ Implemented (`labels/label-*.html`)

---

## Group 2: Intermediate (Conversion & Normalization)

**Purpose:** Verify unit conversions, format variations, and normalization logic.

| ID | Name | Tests | Expected |
|----|------|-------|----------|
| I1 | Proof to ABV | Label: "90 Proof", App: "45%" | PASS (conversion) |
| I2 | ABV to Proof | Label: "40%", App: "80 Proof" | PASS (conversion) |
| I3 | mL to fl oz | Label: "750 mL", App: "25.4 fl oz" | PASS (conversion) |
| I4 | fl oz to mL | Label: "12 FL. OZ.", App: "355 mL" | PASS (conversion) |
| I5 | Address Abbreviations | "123 Main St." vs "123 Main Street" | PASS (normalization) |
| I6 | State Abbreviations | "Louisville, KY" vs "Louisville, Kentucky" | PASS (fuzzy) |
| I7 | Punctuation Variance | "Jack Daniel's" vs "Jack Daniels" | PASS (normalization) |
| I8 | Extra Spaces | "Old  Tom" vs "Old Tom" | PASS (normalization) |
| I9 | Partial Address | Full address vs city/state only | WARNING (agent review) |
| I10 | Class Type Variation | "Bourbon Whiskey" vs "Kentucky Straight Bourbon Whiskey" | WARNING (partial) |

**Status:** 🔲 Not implemented

---

## Group 3: Advanced (Edge Cases & Stress Tests)

**Purpose:** Verify robustness with real-world complexity and edge cases.

| ID | Name | Tests | Expected |
|----|------|-------|----------|
| A1 | Low Contrast | Light text on light background | Extraction challenge |
| A2 | Angled Photo | Label at 15° angle | Extraction challenge |
| A3 | Glare/Reflection | Simulated glare overlay | Extraction challenge |
| A4 | Script Font | Decorative/cursive brand name | Extraction challenge |
| A5 | Dense Label | Many text elements competing | Extraction challenge |
| A6 | Small Warning | Minimum legal size (1mm) warning text | Extraction challenge |
| A7 | Multi-Language | English + Spanish label | Correct field extraction |
| A8 | Vintage Style | Aged/weathered label appearance | Extraction challenge |
| A9 | Numeric Ambiguity | "750ml" vs "75 cl" vs "0.75L" | PASS (all equal) |
| A10 | Near-Miss ABV | Label: 45.0%, App: 45.5% | FAIL (0.5% difference) |

**Status:** 🔲 Not implemented

---

## Group 4: Regression (Bug Prevention)

**Purpose:** Tests added when bugs are found to prevent regression.

| ID | Name | Tests | Expected |
|----|------|-------|----------|
| R1 | *Reserved* | — | — |

**Status:** 🔲 Empty (populated as bugs are found)

---

## Test Matrix

| Scenario Group | Count | Focus Area |
|----------------|-------|------------|
| Basic | 6 | Core functionality |
| Intermediate | 10 | Conversions, normalization |
| Advanced | 10 | Real-world robustness |
| Regression | 0+ | Bug prevention |

---

## Running Tests

### Manual Testing
1. Start dev server: `npm run dev`
2. Open http://localhost:3000
3. Upload label from `sample-labels/`
4. Enter application data from `sample-applications.json`
5. Verify result matches expected outcome

### Generating Label Screenshots
```bash
node scripts/screenshot-labels.js
```

---

## Adding New Test Scenarios

1. Create HTML label in `labels/` following existing patterns
2. Add entry to `sample-applications.json`
3. Run screenshot script to generate PNG
4. Document in this file under appropriate group
5. Test manually to verify expected behavior
