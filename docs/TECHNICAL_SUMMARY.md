# TTB Label Verification Tool — Technical Summary

> Internal development reference document

## Mission

Build an AI-powered tool for TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance officers to verify alcohol beverage labels against COLA (Certificate of Label Approval) application data.

**Current process:** Agents manually compare label images against application forms — slow, error-prone, 200-300 labels/day.

**Target:** Automate extraction and comparison, surface discrepancies for agent review.

---

## PRD Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| **≤5 second response time** | ✅ ~2.5s avg | Gemini Flash, 50% under target |
| Fuzzy matching for brand names | ✅ | Exact after normalization; any difference → WARNING |
| ABV/Proof conversion | ✅ | 90 Proof = 45% ABV |
| Volume unit conversion | ✅ | mL ↔ fl oz, 0.5% tolerance |
| Strict government warning check | ✅ | Presence + caps + bold (confirmation) + text accuracy |
| Agent override buttons | ✅ | Accept/Confirm Issue per field |
| Export results | ✅ | JSON + CSV export |
| Demo button | ✅ | 5 pre-loaded scenarios |
| Batch processing | ✅ | Per-label CSV + manual entry at /batch |
| Vercel deployment ready | ✅ | Live at gov-submission.vercel.app |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Next.js App                        │
├─────────────────────────────────────────────────────────┤
│  Frontend (React)          │  API Routes               │
│  - MultiImageUploader      │  - /api/verify-gemini     │
│  - ApplicationForm         │  - /api/verify-stream     │
│  - VerificationResults     │  - /api/batch-verify      │
│  - ConflictResolutionPanel │                           │
│  - DemoButton (5 scenarios)│                           │
│  - BatchUploader (CSV)     │                           │
│  - BatchResults            │                           │
│  - FieldResultCard         │                           │
│  - LoadingState            │                           │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│   Gemini 2.0 Flash (gemini-2.0-flash)                    │
│   - ~2.5s inference, 100% accuracy, JSON schema output   │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│                  Comparison Engine                        │
│                                                          │
│  Field categories:                                       │
│  - "automated" → affects PASS/FAIL/REVIEW status         │
│  - "confirmation" → agent checkbox, doesn't block PASS   │
│                                                          │
│  - brandMatch() — exact after normalization              │
│  - fuzzyMatch() — class/type (Jaro-Winkler 0.85)        │
│  - matchABV() — numeric + proof conversion               │
│  - matchNetContents() — volume + unit conversion         │
│  - addressMatch() — normalize abbreviations (0.70)       │
│  - strictMatch() — government warning text               │
│  - warningCheck() — 4 sub-checks (3 automated, 1 conf.) │
└──────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions

1. **Gemini 2.0 Flash + JSON schema** — Structured extraction directly into named fields. Tried Claude Vision (5s, accurate) and Tesseract OCR (33% accuracy) first. Gemini is 2x faster with same accuracy. See `docs/PERFORMANCE.md`.
2. **Field categories** — Bold check is `"confirmation"` (doesn't block PASS), everything else is `"automated"`. Solves the paradox where 71% bold detection accuracy made PASS unreachable. See `docs/GOVERNMENT_WARNING_PARADOX.md`.
3. **Jaro-Winkler** — O(m+n) fuzzy matching, prefix-weighted (good for brand names)
4. **Field-specific matchers** — Different fields need different logic (fuzzy vs strict vs numeric)
5. **Government warning split into 4 checks** — Presence, header caps, header bold (confirmation), text accuracy
6. **Client-side image preprocessing** — Resize to 1568px, JPEG 85% before upload
7. **Streaming API** — SSE for progressive results in multi-image and batch modes

---

## Constraints

### Bold Detection (Solved with Categories)

Government warning header must be bold (27 CFR Part 16). Neither Gemini nor any OCR can reliably detect font weight from photos (71% max accuracy). Solution: bold check is `category: "confirmation"` — surfaces as a pending confirmation for the agent without blocking PASS status. See `docs/GOVERNMENT_WARNING_PARADOX.md`.

### Address Matching

Address comparison is approximate. Labels abbreviate ("St" vs "Street", "KY" vs "Kentucky"). Current approach:
- Normalize common abbreviations
- Lower threshold (0.70 vs 0.85)
- Default to WARNING for agent review

---

## Test Coverage

| Suite | Tests | Pass Rate |
|-------|-------|-----------|
| Single-image (basic + intermediate) | 14 | 100% |
| Multi-image (merge + conflict) | 5 | 100% |
| Input validation | 8 | 100% |
| Batch processing | 8 | 100% |
| CSV parser + matcher (unit) | 16 | 100% |
| E2E (Playwright) | 25 | 100% |

```bash
npm test              # Single-image tests (14)
npm run test:multi    # Multi-image tests (5)
npm run test:validation # Validation tests (8)
npm run test:batch    # Batch tests (8)
npm run test:csv      # CSV unit tests (16)
npm run test:e2e      # Playwright E2E (25)
```

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                    # Main verification UI (multi-image)
│   ├── batch/page.tsx              # Batch processing
│   └── api/
│       ├── verify-gemini/route.ts  # Single label verification
│       ├── verify-stream/route.ts  # SSE streaming (multi-image)
│       └── batch-verify/route.ts   # Batch with SSE
├── components/                     # 9 components
│   ├── MultiImageUploader.tsx      # Multi-image upload (1-6 images)
│   ├── ApplicationForm.tsx         # COLA data entry
│   ├── VerificationResults.tsx     # Results + overrides
│   ├── FieldResultCard.tsx         # Individual field result
│   ├── ConflictResolutionPanel.tsx # Multi-image conflict resolution
│   ├── DemoButton.tsx              # 5 demo scenarios
│   ├── LoadingState.tsx            # SSE streaming progress
│   ├── BatchUploader.tsx           # CSV + manual batch entry
│   └── BatchResults.tsx            # Batch results dashboard
├── lib/                            # 11 modules
│   ├── gemini-extraction.ts        # Gemini 2.0 Flash API
│   ├── comparison.ts               # Field matchers
│   ├── warning-check.ts            # Gov warning sub-checks
│   ├── verify-single.ts            # Shared verification logic
│   ├── merge-extraction.ts         # Multi-image field merge
│   ├── csv-parser.ts               # CSV application data parser
│   ├── batch-matcher.ts            # Image-to-application matching
│   ├── image-preprocessing.ts      # Image optimization
│   ├── constants.ts                # Standard warning text, thresholds
│   ├── utils.ts                    # Normalization, Jaro-Winkler
│   └── types.ts                    # TypeScript interfaces
```

---

## Resolved Design Questions

These were open questions during early development. All have been resolved:

1. **Latency:** Solved by switching to Gemini Flash — 2.5s average, well under the 5s requirement. See `docs/PERFORMANCE.md`.

2. **Accuracy vs Speed:** Gemini Flash matches Claude Vision at 100% accuracy while being 2x faster. No trade-off needed.

3. **Bold detection:** Solved with the category architecture — bold is a `"confirmation"` field that surfaces as an agent checkbox without blocking PASS. See `docs/GOVERNMENT_WARNING_PARADOX.md`.

4. **Streaming:** Implemented for both multi-image (`/api/verify-stream`) and batch (`/api/batch-verify`) endpoints using SSE.

---

## Running Locally

```bash
npm install
export GEMINI_API_KEY=your-key-here
npm run dev
# Open http://localhost:3000
```
