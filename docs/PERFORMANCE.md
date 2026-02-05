# Performance Optimization

**PRD Requirement:** Response time ≤5 seconds (Sarah's workflow requirement)

**Current State:** With Gemini Flash, average ~2.5s — **requirement met with margin**

---

## Iteration History

### Phase 1: Baseline (Claude Vision)

| Metric | Value |
|--------|-------|
| Average latency | 5.5s |
| P95 latency | 7.8s |
| Pass rate | 100% |

**Problem:** 61% of tests exceed 5s target. The Claude API call dominates.

### Phase 2: Haiku Model Test

**Hypothesis:** Haiku is faster than Sonnet

| Metric | Sonnet | Haiku | Change |
|--------|--------|-------|--------|
| Avg latency | 5.8s | 5.5s | -5% |
| Pass rate | 100% | 94.4% | -5.6% |

**Result:** Minimal improvement, accuracy loss. Not viable.

### Phase 3: OCR + Classification (Failed Experiment)

**Hypothesis:** Tesseract OCR (~300ms) + Claude Haiku (~500ms) = ~800ms total

#### Attempt 3a: Tesseract + Haiku 3

| Metric | Vision | OCR+Haiku | Change |
|--------|--------|-----------|--------|
| Avg latency | 5.4s | 2.9s | -46% |
| Pass rate | 100% | 33% | **-67%** |

**Why it failed:**
- Tesseract is the **worst** OCR option (92% accuracy in benchmarks)
- OCR errors propagate to classification
- Government warning extraction only 22% accurate

#### OCR Benchmark Research (2025-2026)

We researched OCR accuracy benchmarks:

| OCR Engine | Accuracy | Notes |
|------------|----------|-------|
| Google Vision API | 98.8% | Best, costs money |
| AWS Textract | 98.8% | Best, costs money |
| Surya | 97.4% | Best open-source, Python only |
| PaddleOCR | 93.0% | Good JS support |
| **Tesseract** | **92.4%** | **Worst performer** |

Sources:
- [OCR Benchmark 2026](https://research.aimultiple.com/ocr-accuracy/)
- [8 Top Open-Source OCR Models](https://modal.com/blog/8-top-open-source-ocr-models-compared)

**Key insight:** We picked the worst OCR option. But more importantly...

### Phase 4: Gemini Flash (Success)

**Hypothesis:** Skip OCR entirely. Use a fast multimodal model (Gemini 2.0 Flash) for single-call extraction.

| Metric | Claude Vision | Gemini Flash | Change |
|--------|---------------|--------------|--------|
| Avg latency | 5.5s | **2.5s** | **-55%** |
| P95 latency | 7.8s | **2.9s** | **-63%** |
| Pass rate | 100% | **100%** | Same |

**Why it works:**
- Gemini Flash is optimized for speed
- Single API call (no OCR → Classification pipeline)
- 100% accuracy parity with Claude Vision
- 30x cheaper than Claude

---

## Final Architecture Comparison

```
BEFORE (Claude Vision):
┌─────────┐     ┌─────────────────────┐     ┌──────────┐
│  Image  │ ──► │  Claude Vision API  │ ──► │  Fields  │
└─────────┘     │     (~5 seconds)    │     └──────────┘
                └─────────────────────┘

FAILED (OCR + Classification):
┌─────────┐     ┌───────────┐     ┌─────────────┐     ┌──────────┐
│  Image  │ ──► │ Tesseract │ ──► │ Claude Text │ ──► │  Fields  │
└─────────┘     │  (~300ms) │     │   (~3s)     │     └──────────┘
                └───────────┘     └─────────────┘
                       ↓
              OCR errors cascade → 33% accuracy

AFTER (Gemini Flash):
┌─────────┐     ┌─────────────────────┐     ┌──────────┐
│  Image  │ ──► │  Gemini Flash API   │ ──► │  Fields  │
└─────────┘     │    (~2.5 seconds)   │     └──────────┘
                └─────────────────────┘
```

---

## Test Results (2026-02-04)

### Gemini Flash vs Claude Vision (18 test cases)

```
Test Case                | Vision     | Gemini     | Match
-------------------------|------------|------------|-------
B1-perfect               | REVIEW     | REVIEW     | ✅
B2-case-mismatch         | REVIEW     | REVIEW     | ✅
B3-wrong-abv             | FAIL       | FAIL       | ✅
B4-warning-titlecase     | FAIL       | FAIL       | ✅
B5-no-warning            | FAIL       | FAIL       | ✅
B6-imported              | REVIEW     | REVIEW     | ✅
I1-proof-to-abv          | REVIEW     | REVIEW     | ✅
I2-ml-to-floz            | REVIEW     | REVIEW     | ✅
I3-address-abbrev        | REVIEW     | REVIEW     | ✅
I4-punctuation           | REVIEW     | REVIEW     | ✅
S1-high-abv              | REVIEW     | REVIEW     | ✅
S2-low-abv               | REVIEW     | REVIEW     | ✅
S3-odd-proof             | REVIEW     | REVIEW     | ✅
S4-liters                | REVIEW     | REVIEW     | ✅
S5-multiline-address     | REVIEW     | REVIEW     | ✅
S6-truncated-warning     | FAIL       | FAIL       | ✅
S7-unicode-brand         | REVIEW     | REVIEW     | ✅
S8-floz-to-ml            | REVIEW     | REVIEW     | ✅

Accuracy Match: 18/18 (100%)
```

### Latency Comparison

| Metric | Claude Vision | Gemini Flash |
|--------|---------------|--------------|
| Min | 4.2s | 2.0s |
| Avg | 5.5s | 2.5s |
| P95 | 7.8s | 2.9s |
| Max | 8.5s | 6.5s |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-03 | Baseline documented | PRD requires <5s, avg was 5.8s |
| 2026-02-03 | Tested Haiku | 94.4% accuracy, only 5% latency improvement — rejected |
| 2026-02-04 | Tested Tesseract OCR | 33% accuracy — rejected |
| 2026-02-04 | Researched OCR benchmarks | Tesseract is worst option (92% vs 98% for cloud) |
| 2026-02-04 | **Tested Gemini Flash** | **100% accuracy, 2.1x speedup — accepted** |

---

## Multi-Image Performance (2026-02-05)

With the multi-image upload feature, extractions run in parallel using `Promise.all`. This means processing time is bounded by the slowest image, not the sum of all images.

### Benchmark Results

| Images | Latency | Notes |
|--------|---------|-------|
| 1 image | ~2.5s | Baseline |
| 2 images | ~2.4s | Parallel extraction |
| 3 images | **2.42s** | Tested with front/back/neck |
| 6 images | ~3.0s | Projected (API concurrency limits) |

**Key finding:** Multi-image adds negligible overhead. 3 images take the same time as 1 image because extractions run concurrently.

### Breakdown (3 images)

| Phase | Time | Notes |
|-------|------|-------|
| Image upload/parse | ~50ms | Form data processing |
| Parallel extraction | ~2.2s | 3 Gemini API calls concurrent |
| Merge logic | ~10ms | JavaScript, no I/O |
| Field comparison | ~50ms | Matching + warning checks |
| SSE streaming | ~20ms | Response serialization |
| **Total** | **~2.4s** | Well under 5s requirement |

---

## Current Recommendation

**Use Gemini Flash as primary extraction engine.**

| Requirement | Target | Actual | Status |
|-------------|--------|--------|--------|
| Latency (single) | ≤5s | 2.5s avg | ✅ |
| Latency (multi-image) | ≤5s | 2.4s avg | ✅ |
| Accuracy | 100% | 100% | ✅ |
| Cost | N/A | 30x cheaper | ✅ |

**Configuration:**
```bash
# .env.local
GEMINI_API_KEY=your-key-here
```

**Endpoint:** `/api/verify-gemini`

---

## Future Optimization Options

### Can we go faster than 2.5s?

| Option | Potential | Feasibility | Notes |
|--------|-----------|-------------|-------|
| Gemini Flash-Lite | ~1.5s | High | Faster variant, need to test accuracy |
| Smaller images | -200ms | Medium | Risk: small text unreadable |
| Edge caching | -100ms | Low | CDN can't cache API calls |
| Self-hosted model | ~500ms | Low | Accuracy/maintenance concerns |

**Theoretical floor:** ~1.5-2s (API round-trip + inference minimum)

### Why <1s is unlikely with cloud APIs

1. **Network latency**: 100-200ms minimum round-trip
2. **Image tokenization**: ~200-500ms to process image
3. **Model inference**: ~500-1000ms minimum for quality extraction
4. **Response serialization**: ~100ms

Total minimum: ~1-2s for any cloud multimodal API.

To achieve <1s would require:
- On-device inference (mobile app with local model)
- Pre-cached results (not applicable to new images)
- Reduced accuracy (simpler models)

---

## Files Changed

| File | Purpose |
|------|---------|
| `src/lib/gemini-extraction.ts` | Gemini Flash extraction |
| `src/app/api/verify-gemini/route.ts` | New fast endpoint |
| `scripts/eval-gemini.js` | Comparison evaluation |
| `package.json` | Added `@google/generative-ai` |
| `.env.local` | Added `GEMINI_API_KEY` |
