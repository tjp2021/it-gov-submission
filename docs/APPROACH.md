# Approach

## How It Works

The tool verifies alcohol beverage labels in three steps:

1. **Extract** — Upload a label image. Claude Vision reads it and returns structured fields (brand name, ABV, government warning, etc.) via tool_use, which guarantees schema-conformant output without fragile JSON parsing.

2. **Compare** — Each extracted field is compared against the COLA application data using a field-appropriate matching function. There is no single generic comparison — different fields have different rules because that's how compliance works.

3. **Display** — Results appear as a field-by-field checklist with PASS/FAIL/WARNING status, confidence scores, and both values side-by-side. The agent makes the final compliance judgment, not the tool.

## Key Technical Decisions

**Claude Vision + tool_use for extraction, not traditional OCR.**
Traditional OCR (Tesseract, AWS Textract) returns raw text that requires post-processing to identify which text is the brand name vs. the ABV vs. the government warning. Claude Vision with tool_use extracts directly into named fields with a defined schema. This eliminates an entire layer of fragile text parsing. The trade-off is a cloud API dependency — see Limitations below.

**Field-specific matching functions, not one fuzzy match for everything.**
A government warning must be word-for-word exact. ABV needs numeric comparison with proof-to-percentage conversion (90 Proof = 45% ABV). Net contents needs unit conversion (750 mL ≈ 25.4 fl oz). Brand names need fuzzy matching that tolerates case and punctuation differences. Addresses need a lower similarity threshold because labels routinely abbreviate. Each of these is a distinct function with distinct logic — `strictMatch()`, `matchABV()`, `matchNetContents()`, `fuzzyMatch()`, and `addressMatch()`.

**Jaro-Winkler for fuzzy matching, not Levenshtein.**
Jaro-Winkler returns a normalized 0-1 score natively, emphasizes prefix matching (important for brand names where the beginning is most distinctive), and runs at O(m+n) versus Levenshtein's O(m×n). It's the standard algorithm for name matching in compliance screening (AML, sanctions). The 0.85 threshold was validated against test label pairs.

**Government warning checked in four parts, not one.**
Presence, header capitalization (ALL CAPS — reliable text check), header bold emphasis (best-effort visual assessment — always flagged for agent review since bold detection from photos is inherently unreliable), and word-for-word text accuracy with word-level diff output. A single fuzzy match over the entire warning would miss formatting violations that matter for 27 CFR Part 16 compliance.

**Azure App Service deployment.**
The brief indicates TTB migrated to Azure in 2019. Deploying to their existing cloud ecosystem shows attention to operational context and demonstrates a realistic production path. The app uses Next.js standalone output mode with `node server.js` startup — a well-documented Azure deployment pattern.

**Pre-filled government warning text.**
The ABLA mandates the same warning statement on every beverage label sold in the US. Requiring agents to type it for each verification is pointless friction. The form pre-fills the standard text; agents only need to enter the fields that vary per application.

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

## Limitations

These are honest constraints of this prototype, not bugs.

**Bold detection is best-effort.** Neither Claude Vision nor traditional OCR can reliably determine font weight from a photograph. The tool reports a visual assessment but always flags bold detection as WARNING for agent review. Capitalization detection (ALL CAPS) is reliable and checked separately.

**Batch processing is sequential.** Sarah mentioned 200-300 labels per session. Sequential API calls for 200 labels at ~5 seconds each would take 16+ minutes. The prototype provides batch mode at `/batch` that processes labels one at a time with progress tracking. Production would need a job queue (Bull/Redis workers) with a poll-for-results pattern for higher throughput.

**No authentication or audit trail.** A production system for a federal agency needs FedRAMP-compliant auth (likely Azure AD), role-based access, and a complete decision audit trail logging every verification with agent ID, timestamp, and rationale. The prototype is stateless.

**Cloud API dependency.** The tool calls Anthropic's Claude API, which requires internet access. A production deployment within government networks would likely need an on-premise model or a FedRAMP-authorized AI service. The architecture cleanly separates the extraction layer so the AI provider could be swapped.

**Address matching is approximate.** Address comparison is a known hard problem. "Old Tom Distillery, 123 Main St, Louisville, KY 40202" vs "Old Tom Distillery, Louisville, Kentucky" should match but score poorly on generic string similarity. The prototype normalizes common abbreviations (St→Street, Ave→Avenue) and uses a lower threshold, but production would need component-based address parsing with per-field matching and weighted scoring.

**Single beverage type.** The prototype handles general label verification. Production would need type-specific validation rules per 27 CFR Parts 4 (wine), 5 (spirits), and 7 (malt beverages), since each has different mandatory fields and formatting requirements.

## What I'd Build Next

1. **Beverage type detection** — Auto-detect spirits vs wine vs malt beverage from the label and apply type-specific validation rules.
2. **COLA database integration** — Pull application data directly from COLAs Online instead of manual entry, eliminating transcription errors.
3. **Decision audit trail** — Log every verification with agent ID, timestamp, override rationale. Required for any government compliance workflow.
4. **Historical analytics** — Dashboard showing rejection patterns, common compliance issues, and processing time trends to help leadership identify systemic problems.
5. **On-premise AI deployment** — Host the extraction model behind government firewalls for production use with sensitive data.
6. **Accessibility (WCAG 2.1 AA)** — Full audit and remediation for Section 508 compliance, which is mandatory for government-facing tools.

## Tech Stack

- **Next.js 16** with TypeScript — Fullstack framework, single deployment, evaluators run locally with one command
- **Tailwind CSS** — Fast iteration on UI, clean results display
- **Claude API** (claude-sonnet-4-20250514) — Vision extraction via tool_use
- **Azure App Service** — Matches TTB's existing cloud infrastructure
- **Sharp** — Server-side image processing for test generation
- **Puppeteer** — HTML-to-PNG conversion for ground truth test labels

## Features Implemented

- **Single Label Verification** — Upload one label, compare against application data
- **Batch Processing** — Upload multiple labels, verify against same application data
- **Agent Override** — Accept/confirm warnings and failures with one click
- **Export Results** — Download JSON or CSV for records
- **Demo Mode** — Pre-loaded example with one click
- **Client-side Preprocessing** — Images auto-resized and compressed before upload
- **Comprehensive Test Suite** — 18 automated tests covering basic, intermediate, and stress cases
