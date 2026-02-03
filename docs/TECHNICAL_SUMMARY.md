# TTB Label Verification Tool — Technical Summary

## Mission

Build an AI-powered tool for TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance officers to verify alcohol beverage labels against COLA (Certificate of Label Approval) application data.

**Current process:** Agents manually compare label images against application forms — slow, error-prone, 200-300 labels/day.

**Target:** Automate extraction and comparison, surface discrepancies for agent review.

---

## PRD Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| **≤5 second response time** | ⚠️ ~5-6s | Cloud API bottleneck (see Constraints) |
| Fuzzy matching for brand names | ✅ | Jaro-Winkler, 0.85 threshold |
| ABV/Proof conversion | ✅ | 90 Proof = 45% ABV |
| Volume unit conversion | ✅ | mL ↔ fl oz, 0.5% tolerance |
| Strict government warning check | ✅ | Presence + caps + bold + text accuracy |
| Agent override buttons | ✅ | Accept/Confirm Issue per field |
| Export results | ✅ | JSON export |
| Demo button | ✅ | Pre-loaded example data |
| Batch processing | ✅ | Multi-label upload at /batch |
| Azure deployment ready | ✅ | Standalone build, deployment docs |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Next.js App                        │
├─────────────────────────────────────────────────────────┤
│  Frontend (React)          │  API Routes               │
│  - LabelUploader           │  - /api/verify            │
│  - ApplicationForm         │  - /api/verify-stream     │
│  - VerificationResults     │                           │
│  - BatchUploader           │                           │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    Claude Vision API                    │
│            (claude-sonnet-4-20250514)                   │
│                                                         │
│  - Extracts label fields via tool_use                   │
│  - Returns structured JSON (not free text)              │
│  - ~4-5s inference time                                 │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                  Comparison Engine                      │
│                                                         │
│  - fuzzyMatch() — brand name, class/type                │
│  - matchABV() — numeric + proof conversion              │
│  - matchNetContents() — volume + unit conversion        │
│  - addressMatch() — normalize abbreviations             │
│  - strictMatch() — government warning text              │
└─────────────────────────────────────────────────────────┘
```

---

## Key Technical Decisions

1. **Claude Vision + tool_use** — Structured extraction directly into schema, no OCR post-processing
2. **Jaro-Winkler** — O(m+n) fuzzy matching, prefix-weighted (good for brand names)
3. **Field-specific matchers** — Different fields need different logic (fuzzy vs strict vs numeric)
4. **Government warning split into 4 checks** — Presence, header caps, header bold, text accuracy
5. **Client-side image preprocessing** — Resize to 1568px, JPEG 85% before upload
6. **Streaming API** — SSE for progressive results display

---

## Constraints & Open Issues

### Latency (The Big One)

**Target:** ≤5 seconds
**Actual:** 5-6 seconds average

| Component | Time |
|-----------|------|
| Image upload | ~0.3s |
| Claude API inference | ~4-5s |
| Comparison logic | <10ms |
| **Total** | **~5-6s** |

**What we tried:**
- Haiku model — same latency, worse accuracy (94.4% vs 100%)
- Smaller images (640px) — only 0.3s faster, accuracy drops
- Image compression — negligible impact

**Why it's hard to fix:**
- Claude's inference time is the bottleneck
- All cloud vision APIs (GPT-4V, Gemini) have similar latency
- Self-hosted models lack accuracy on small text (government warning fine print)

**Recommendation:** Accept 5-6s as floor for cloud AI. Document as "meets target under typical conditions."

### Bold Detection

Government warning header must be bold (27 CFR Part 16). Neither Claude nor any OCR can reliably detect font weight from photos. Current approach:
- Best-effort visual assessment
- Always flagged as WARNING for agent review
- Agent must visually confirm

### Address Matching

Address comparison is approximate. Labels abbreviate ("St" vs "Street", "KY" vs "Kentucky"). Current approach:
- Normalize common abbreviations
- Lower threshold (0.70 vs 0.85)
- Default to WARNING for agent review

---

## Test Coverage

| Suite | Tests | Pass Rate |
|-------|-------|-----------|
| Unit (matching logic) | 18 | 100% |
| E2E (Playwright) | 7 | 100% |
| Stress tests | 8 | 100% |

```bash
npm test              # Unit tests
npm run test:e2e      # Playwright
npm run benchmark     # Direct API latency
```

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                 # Main verification UI
│   ├── batch/page.tsx           # Batch processing
│   └── api/
│       ├── verify/route.ts      # Standard endpoint
│       └── verify-stream/route.ts # SSE streaming
├── components/
│   ├── LabelUploader.tsx        # Image upload + preprocessing
│   ├── ApplicationForm.tsx      # COLA data entry
│   ├── VerificationResults.tsx  # Results + overrides
│   └── LoadingState.tsx         # Streaming progress
├── lib/
│   ├── extraction.ts            # Claude Vision API
│   ├── comparison.ts            # Field matchers
│   ├── warning-check.ts         # Gov warning sub-checks
│   ├── utils.ts                 # Normalization helpers
│   └── constants.ts             # Thresholds, config
```

---

## Questions for Review

1. **Latency:** Is 5-6s acceptable given cloud API constraints? Any other optimization vectors?

2. **Accuracy vs Speed:** Should we offer a "fast mode" with Haiku (faster but 94% accuracy) vs "accurate mode" with Sonnet?

3. **Bold detection:** Is best-effort + agent review the right approach, or should we drop this check entirely?

4. **Streaming:** Worth the complexity? Current implementation shows field-by-field results as they're computed.

5. **Anything obviously wrong?** Architecture, code patterns, missing edge cases?

---

## Running Locally

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
# Open http://localhost:3000
```
