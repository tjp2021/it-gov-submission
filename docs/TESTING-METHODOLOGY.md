# Testing Methodology

This document describes the testing approach for the TTB Label Verification Tool.

---

## Overview

The verification tool is tested using **synthetic label images** with **known expected outcomes**. This approach provides:

1. **Reproducibility** — Tests can be re-run with identical inputs
2. **Coverage** — Specific edge cases can be intentionally constructed
3. **Validation** — Expected outcomes are known before testing

---

## Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TEST DATA PIPELINE                        │
│                                                              │
│  HTML Label     Puppeteer      PNG Image     Verification   │
│  Mockups    ──► Screenshot ──► Files     ──► Tool          │
│                 Script                                       │
│                                                              │
│  sample-applications.json provides matching COLA data        │
└─────────────────────────────────────────────────────────────┘
```

### Why Synthetic Labels?

Real label photos introduce uncontrolled variables:
- Lighting conditions
- Camera angle
- Image quality
- Unknown ground truth

Synthetic HTML labels provide:
- Pixel-perfect text (known extraction target)
- Controlled formatting (intentional errors for testing)
- Documented expected outcomes
- Reproducible test conditions

---

## Test Scenario Groups

### Group 1: Basic (Functional Validation)

**Purpose:** Verify the core matching logic works correctly.

| ID | Scenario | What It Tests |
|----|----------|---------------|
| B1 | Perfect Match | Happy path — all fields identical |
| B2 | Case Mismatch | Fuzzy matching handles "STONE'S THROW" vs "Stone's Throw" |
| B3 | Wrong ABV | Numeric comparison correctly fails on 1% difference |
| B4 | Warning Title Case | Header format check catches "Government Warning" |
| B5 | Missing Warning | Presence check fails when warning absent |
| B6 | Imported Product | Full field coverage including country of origin |

**Coverage:** Core field types, basic pass/fail conditions

### Group 2: Intermediate (Conversion & Normalization)

**Purpose:** Verify unit conversions and text normalization.

| ID | Scenario | What It Tests |
|----|----------|---------------|
| I1 | Proof to ABV | 90 Proof = 45% conversion |
| I2 | mL to fl oz | 750 mL ≈ 25.4 fl oz conversion |
| I3 | Address Abbreviations | "St." → "Street", "KY" → "Kentucky" |
| I4 | Punctuation Variance | "Maker's" vs "Makers" normalization |

**Coverage:** Unit conversion logic, text normalization rules

### Group 3: Advanced (Edge Cases) — Future

**Purpose:** Test robustness with challenging real-world conditions.

| ID | Scenario | What It Tests |
|----|----------|---------------|
| A1 | Low Contrast | Extraction from poor visibility |
| A2 | Angled Photo | Perspective distortion handling |
| A3 | Glare/Reflection | Partial obstruction handling |
| A4+ | ... | See TEST-SCENARIOS.md for full list |

**Coverage:** Claude Vision robustness, real-world conditions

### Group 4: Regression — As Needed

**Purpose:** Prevent bugs from recurring.

Tests added when bugs are discovered, documenting:
- The specific input that caused the bug
- The incorrect behavior observed
- The correct expected behavior

---

## Test Data Structure

### Label Files

```
src/test-data/
├── labels/                    # HTML mockups (source of truth)
│   ├── label-perfect.html
│   ├── label-case-mismatch.html
│   └── ...
├── sample-labels/             # Generated PNG screenshots
│   ├── label-perfect.png
│   ├── label-case-mismatch.png
│   └── ...
├── sample-applications.json   # Matching COLA data + expected results
└── TEST-SCENARIOS.md          # Scenario definitions
```

### Application Data Schema

```json
{
  "id": "B1-perfect",
  "group": "basic",
  "description": "Human-readable description",
  "htmlFile": "labels/label-perfect.html",
  "expectedResult": "PASS | FAIL | REVIEW",
  "expectedReason": "Why this result is expected",
  "applicationData": {
    "brandName": "...",
    "classType": "...",
    "alcoholContent": "...",
    "netContents": "...",
    "nameAddress": "...",
    "countryOfOrigin": "...",
    "governmentWarning": "..."
  }
}
```

---

## Running Tests

### Manual Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the application:
   ```
   http://localhost:3000
   ```

3. For each test scenario:
   - Upload the PNG from `sample-labels/`
   - Enter the application data from `sample-applications.json`
   - Click "Verify Label"
   - Compare result to `expectedResult`

### Generating Screenshots

When HTML labels are added or modified:

```bash
node scripts/screenshot-labels.js
```

This uses Puppeteer to render each HTML file and capture the `.label` element as a PNG.

---

## Test Result Interpretation

### Status Mapping

| Tool Output | Test Expectation | Result |
|-------------|------------------|--------|
| PASS | PASS | ✅ Test passed |
| PASS | FAIL | ❌ False positive |
| FAIL | FAIL | ✅ Test passed |
| FAIL | PASS | ❌ False negative |
| REVIEW | PASS | ⚠️ May need threshold tuning |
| REVIEW | FAIL | ⚠️ May need threshold tuning |

### Expected Warnings

Some warnings are **by design** and do not indicate test failure:

- **"Gov Warning — Header Bold"** always shows WARNING because bold detection from images is unreliable. The agent must visually confirm.

---

## Adding New Test Scenarios

1. **Create the HTML label** in `src/test-data/labels/`
   - Follow existing patterns for styling
   - Include intentional variations for what you're testing

2. **Add to sample-applications.json**
   - Assign an ID following the pattern: `{Group}{Number}-{slug}`
   - Document the expected result and reason

3. **Generate the screenshot**
   ```bash
   node scripts/screenshot-labels.js
   ```

4. **Update TEST-SCENARIOS.md** with the new scenario

5. **Run the test manually** to verify expected behavior

6. **Commit** with a descriptive message

---

## Quality Criteria

A test scenario is well-designed when:

- [ ] It tests exactly one thing (single variable)
- [ ] The expected outcome is unambiguous
- [ ] The reason for the expected outcome is documented
- [ ] It would catch a regression if the tested feature broke

---

## Future: Automated Testing

The current approach is manual. Future improvements could include:

1. **Automated test runner** — Script that runs all scenarios and compares results
2. **CI integration** — Run tests on every pull request
3. **Visual regression** — Detect UI changes in result display
4. **Performance benchmarks** — Track processing time over releases
