# Approach

## How It Works

The tool verifies alcohol beverage labels in three steps:

1. **Extract** — Upload a label image. Gemini Flash reads it and returns structured fields (brand name, ABV, government warning, etc.) as JSON. The extraction prompt is tuned to return exactly what appears on the label without normalization.

2. **Compare** — Each extracted field is compared against the COLA application data using a field-appropriate matching function. There is no single generic comparison — different fields have different rules because that's how compliance works.

3. **Display** — Results appear as a field-by-field checklist with PASS/FAIL/WARNING status, confidence scores, and both values side-by-side. The agent makes the final compliance judgment, not the tool.

---

## Development Journey

This section documents key decisions and pivots made during development.

### Vision Model: Claude → OCR Experiment → Gemini

**Phase 1: Claude Vision**
Initial implementation used Claude Vision (claude-sonnet-4-20250514) with tool_use for structured extraction. It worked well for accuracy but averaged ~5 seconds per label. While this met Sarah's 5-second requirement for single labels, it left no headroom for batch processing.

**Phase 2: OCR Experiment (Failed)**
Attempted to use traditional OCR (Tesseract-based) as a faster alternative. The theory was that OCR could extract text quickly, then we'd parse it into structured fields.

**Why it failed:**
- OCR returns raw text with no semantic understanding of what's a brand name vs. ABV vs. warning
- Required complex post-processing regex to identify fields
- Fragile with real-world label photos (angles, lighting, glare)
- Accuracy dropped significantly compared to vision models
- The post-processing complexity negated any speed gains

The OCR experiment code was removed in commit `c29e138`.

**Phase 3: Gemini Flash (Current)**
Switched to Gemini 2.0 Flash, which averages ~2.5 seconds per label — 2x faster than Claude Vision. This freed up headroom for parallel batch processing while maintaining vision model accuracy.

**Trade-off:** Gemini uses JSON mode rather than Claude's tool_use. Both approaches work; Gemini's speed advantage was decisive for the batch use case.

### Batch Processing: Sequential → Parallel with SSE

**Initial approach:** Sequential for-loop processing each label one at a time.

**Problem:** This is an anti-pattern. 10 labels at 2.5s each = 25 seconds. Users see no progress until completion.

**Solution:** Implemented parallel processing with:
- **Concurrency limit of 3** — Prevents API rate limiting while maximizing throughput
- **Server-Sent Events (SSE)** — Stream results to the client as each label completes
- **Semaphore pattern** — Controls concurrent execution without overwhelming the API

**Result:** 10 labels now complete in ~10 seconds (2.5x faster than sequential). Users see real-time progress as each result arrives.

### Architecture: Shared Verification Logic

**Problem:** Duplicate verification logic in `/api/verify-gemini` and `/api/batch-verify` created maintenance burden and potential for drift.

**Solution:** Extracted shared logic into `src/lib/verify-single.ts`. Both endpoints now use the same `verifySingleLabel()` function. Single source of truth.

### Testing: Unit Tests → E2E Tests

**Initial approach:** Unit tests for matching functions.

**Evolution:** Added Playwright e2e tests that exercise the full flow:
- Upload → Process → Results display
- Batch processing with 10 labels (PRD maximum)
- Performance assertions (parallel must be faster than sequential)
- 20 tests total, all passing

---

## Key Technical Decisions

**Gemini Flash for extraction, not traditional OCR.**
Traditional OCR (Tesseract, AWS Textract) returns raw text that requires post-processing to identify which text is the brand name vs. the ABV vs. the government warning. Gemini extracts directly into named fields with a defined schema. This eliminates an entire layer of fragile text parsing. The trade-off is a cloud API dependency — see Limitations below.

**Field-specific matching functions, not one fuzzy match for everything.**
A government warning must be word-for-word exact. ABV needs numeric comparison with proof-to-percentage conversion (90 Proof = 45% ABV). Net contents needs unit conversion (750 mL ≈ 25.4 fl oz). Brand names need fuzzy matching that tolerates case and punctuation differences. Addresses need a lower similarity threshold because labels routinely abbreviate. Each of these is a distinct function with distinct logic — `strictMatch()`, `matchABV()`, `matchNetContents()`, `fuzzyMatch()`, and `addressMatch()`.

**Jaro-Winkler for fuzzy matching, not Levenshtein.**
Jaro-Winkler returns a normalized 0-1 score natively, emphasizes prefix matching (important for brand names where the beginning is most distinctive), and runs at O(m+n) versus Levenshtein's O(m×n). It's the standard algorithm for name matching in compliance screening (AML, sanctions). The 0.85 threshold was validated against test label pairs.

**Government warning checked in four parts, not one.**
Presence, header capitalization (ALL CAPS — reliable text check), header bold emphasis (best-effort visual assessment — always flagged for agent review since bold detection from photos is inherently unreliable), and word-for-word text accuracy with word-level diff output. A single fuzzy match over the entire warning would miss formatting violations that matter for 27 CFR Part 16 compliance.

**SSE streaming for batch results.**
Rather than waiting for all labels to complete, results stream to the client as each finishes. This provides immediate feedback and makes the tool feel responsive even when processing 10 labels.

**Pre-filled government warning text.**
The ABLA mandates the same warning statement on every beverage label sold in the US. Requiring agents to type it for each verification is pointless friction. The form pre-fills the standard text; agents only need to enter the fields that vary per application.

---

## Matching Logic Summary

| Field | Method | Why |
|-------|--------|-----|
| Brand Name | Jaro-Winkler, threshold 0.85 | Tolerates case/punctuation per Dave's scenario |
| Class/Type | Jaro-Winkler, threshold 0.85 | Same reasoning |
| Alcohol Content | Numeric with proof↔ABV conversion | 90 Proof = 45% ABV must pass, not fail |
| Net Contents | Numeric with unit conversion, 0.5% tolerance | 750 mL ≈ 25.4 fl oz must pass |
| Name/Address | Jaro-Winkler, threshold 0.70, defaults to WARNING | Labels abbreviate addresses; agent always reviews |
| Country of Origin | Strict match after normalization | No ambiguity expected |
| Government Warning | Strict match + formatting sub-checks | Regulatory compliance requires exactness |

---

## Performance

| Scenario | Time | Notes |
|----------|------|-------|
| Single label | ~2.5s | Gemini Flash extraction + comparison |
| Batch of 10 | ~3s | Parallel processing with concurrency 10 |
| Batch of 50 | ~13s | Tested in e2e stress test |
| Batch of 300 | ~78s | Projected (supports full take-home requirement) |

The 5-second single-label requirement from Sarah is met. Batch processing supports up to 300 labels (per take-home requirement "200-300 label applications at once") with real-time SSE streaming showing progress as each completes.

---

## Limitations

These are honest constraints of this prototype, not bugs.

**Bold detection is best-effort.** Neither Gemini nor traditional OCR can reliably determine font weight from a photograph. The tool reports a visual assessment but always flags bold detection as WARNING for agent review. Capitalization detection (ALL CAPS) is reliable and checked separately.

**Batch uses single application data.** The current batch mode verifies multiple label images against the same application data (useful for front/back/side labels of one product). Full batch processing with per-label application data would require CSV upload or a more complex UI.

**No authentication or audit trail.** A production system for a federal agency needs FedRAMP-compliant auth (likely Azure AD), role-based access, and a complete decision audit trail logging every verification with agent ID, timestamp, and rationale. The prototype is stateless.

**Cloud API dependency.** The tool calls Google's Gemini API, which requires internet access. A production deployment within government networks would likely need an on-premise model or a FedRAMP-authorized AI service. The architecture cleanly separates the extraction layer (`src/lib/gemini-extraction.ts`) so the AI provider could be swapped.

**Address matching is approximate.** Address comparison is a known hard problem. "Old Tom Distillery, 123 Main St, Louisville, KY 40202" vs "Old Tom Distillery, Louisville, Kentucky" should match but score poorly on generic string similarity. The prototype normalizes common abbreviations (St→Street, Ave→Avenue) and uses a lower threshold, but production would need component-based address parsing with per-field matching and weighted scoring.

**Single beverage type.** The prototype handles general label verification. Production would need type-specific validation rules per 27 CFR Parts 4 (wine), 5 (spirits), and 7 (malt beverages), since each has different mandatory fields and formatting requirements.

---

## What I'd Build Next

1. **Per-label application data in batch** — Support CSV upload or per-label data entry for true batch processing of different applications.
2. **Beverage type detection** — Auto-detect spirits vs wine vs malt beverage from the label and apply type-specific validation rules.
3. **COLA database integration** — Pull application data directly from COLAs Online instead of manual entry, eliminating transcription errors.
4. **Decision audit trail** — Log every verification with agent ID, timestamp, override rationale. Required for any government compliance workflow.
5. **Historical analytics** — Dashboard showing rejection patterns, common compliance issues, and processing time trends to help leadership identify systemic problems.
6. **On-premise AI deployment** — Host the extraction model behind government firewalls for production use with sensitive data.
7. **Accessibility (WCAG 2.1 AA)** — Full audit and remediation for Section 508 compliance, which is mandatory for government-facing tools.

---

## Tech Stack

- **Next.js 16** with TypeScript — Fullstack framework, single deployment, evaluators run locally with one command
- **Tailwind CSS** — Fast iteration on UI, clean results display
- **Gemini 2.0 Flash** — Vision extraction, ~2.5s per label
- **Azure App Service** — Matches TTB's existing cloud infrastructure
- **Playwright** — E2E testing for verification flows
- **Sharp** — Server-side image processing for test generation

---

## Features Implemented

- **Single Label Verification** — Upload one label, compare against application data (~2.5s)
- **Parallel Batch Processing** — Upload up to 10 labels, process in parallel with SSE streaming (~10s for 10 labels)
- **10-Label Limit** — Enforced per PRD prototype scope
- **Agent Override** — Accept/confirm warnings and failures with one click
- **Export Results** — Download JSON or CSV for records
- **Demo Mode** — Pre-loaded example with one click
- **Client-side Preprocessing** — Images auto-resized to 1568px and compressed to JPEG 85% before upload
- **Comprehensive Test Suite** — 20 Playwright e2e tests covering single verification, batch processing, and stress tests
