# The Government Warning Problem — And How We Solved It

## Overview

This document records a design problem we discovered, analyzed, and resolved. The bold formatting check for government warnings made `PASS` unreachable — every verification returned `REVIEW` regardless of label quality. We solved this by introducing field categories that separate automatable checks from human-confirmation checks, so the overall status reflects what the system can actually verify while still surfacing what the agent must confirm.

**Status: RESOLVED** — see Part 10 for the solution.

---

## Part 1: The Regulatory Requirement

Per 27 CFR Part 16 (ABLA 1988), the government warning on alcohol labels must:
1. Be **word-for-word exact** text
2. Have "GOVERNMENT WARNING:" in **ALL CAPS**
3. Have "GOVERNMENT WARNING:" in **BOLD**

From the take-home document (Jenny Park interview):
> "the warning statement check is actually trickier than it sounds. It has to be exact. Like, word-for-word, and the 'GOVERNMENT WARNING:' part has to be in all caps and bold."

---

## Part 2: System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ MultiImageUploader│  │ ApplicationForm  │  │VerificationResults│ │
│  │ (1-6 images)      │  │ (form fields)    │  │ (field-by-field)  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────▲─────────┘  │
│           │                     │                     │             │
│           └──────────┬──────────┘                     │             │
│                      ▼                                │             │
│              FormData (images + JSON)                 │             │
└──────────────────────┬────────────────────────────────┼─────────────┘
                       │                                │
                       ▼                                │
┌──────────────────────────────────────────────────────────────────────┐
│                    /api/verify-stream (SSE)                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 1. parseMultiImageFormData()                                    │ │
│  │    - Validate: at least 1 image, max 6, non-empty              │ │
│  │    - Parse applicationData JSON                                 │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 2. extractFromImage() × N  [Promise.all - parallel]            │ │
│  │    ┌─────────────────────────────────────────────────────────┐ │ │
│  │    │              Gemini 2.0 Flash API                       │ │ │
│  │    │  - Image → Base64 → Gemini Vision                       │ │ │
│  │    │  - Returns: { brandName, classType, alcoholContent,     │ │ │
│  │    │              netContents, nameAddress, countryOfOrigin, │ │ │
│  │    │              governmentWarning, governmentWarningHeader,│ │ │
│  │    │              governmentWarningHeaderEmphasis }          │ │ │
│  │    └─────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 3. mergeExtractions()  [src/lib/merge-extraction.ts]           │ │
│  │    - Combine fields from all images                            │ │
│  │    - Track sources per field                                   │ │
│  │    - Detect conflicts (different values for same field)        │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 4. compareField()  [src/lib/comparison.ts]                     │ │
│  │    Per field, apply appropriate matcher:                       │ │
│  │    - brandName:      fuzzyMatch (Jaro-Winkler, 0.85)          │ │
│  │    - classType:      fuzzyMatch (Jaro-Winkler, 0.85)          │ │
│  │    - alcoholContent: matchABV (numeric, proof↔ABV)            │ │
│  │    - netContents:    matchNetContents (unit conversion)       │ │
│  │    - nameAddress:    addressMatch (Jaro-Winkler, 0.70)        │ │
│  │    - countryOfOrigin: strictMatch                              │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 5. verifyGovernmentWarning()  [src/lib/warning-check.ts]       │ │
│  │    ┌─────────────────────────────────────────────────────────┐ │ │
│  │    │  Check 1: Warning Present                               │ │ │
│  │    │  └─ PASS if found, FAIL if missing                     │ │ │
│  │    │                                                         │ │ │
│  │    │  Check 2: Header ALL CAPS                               │ │ │
│  │    │  └─ PASS if "GOVERNMENT WARNING:", FAIL otherwise      │ │ │
│  │    │                                                         │ │ │
│  │    │  Check 3: Header BOLD  ◄──── THE PROBLEM               │ │ │
│  │    │  └─ ALWAYS returns WARNING                             │ │ │
│  │    │  └─ Cannot reliably detect from photos                 │ │ │
│  │    │                                                         │ │ │
│  │    │  Check 4: Text Word-for-Word                            │ │ │
│  │    │  └─ PASS if exact match, FAIL with word-diff otherwise │ │ │
│  │    └─────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 6. computeOverallStatus()                                      │ │
│  │    if (hasUnresolvedFail) return "FAIL";                       │ │
│  │    if (hasWarningOrNotFound) return "REVIEW";  ◄── ALWAYS HIT │ │
│  │    return "PASS";  ◄── NEVER REACHED                          │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          ▼                                           │
│                   SSE: complete event                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: The Government Warning Check Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                  verifyGovernmentWarning()                          │
│                  src/lib/warning-check.ts                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Check 1:      │    │ Check 2:      │    │ Check 4:      │
│ Presence      │    │ ALL CAPS      │    │ Word-for-Word │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ Automatable:  │    │ Automatable:  │    │ Automatable:  │
│ ✅ YES        │    │ ✅ YES        │    │ ✅ YES        │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ Method:       │    │ Method:       │    │ Method:       │
│ Text search   │    │ Regex         │    │ Diff compare  │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ Returns:      │    │ Returns:      │    │ Returns:      │
│ PASS or FAIL  │    │ PASS or FAIL  │    │ PASS or FAIL  │
└───────────────┘    └───────────────┘    └───────────────┘

                              │
                              ▼
                    ┌───────────────┐
                    │ Check 3:      │
                    │ BOLD          │
                    ├───────────────┤
                    │ Automatable:  │
                    │ ❌ NO         │
                    ├───────────────┤
                    │ Why:          │
                    │ 71% accuracy  │
                    │ max achieved  │
                    ├───────────────┤
                    │ Returns:      │
                    │ ⚠️ ALWAYS     │
                    │ WARNING       │
                    └───────────────┘
```

---

## Part 4: Why Bold Detection Fails

### Tested Approaches and Results

| Approach | Accuracy | Why It Fails |
|----------|----------|--------------|
| Gemini direct detection | 50% on degraded images | Glare, blur cause false readings |
| Global image metrics (sharpness, brightness) | 57% | Can't detect localized glare |
| Local contrast analysis | 71% | Glare has same metrics as clean |
| Gemini self-assessment | 71% | Rates glare images as "perfect" |

See `docs/BOLD_DETECTION_ANALYSIS.md` for full empirical testing methodology and results.

### The Fundamental Problem

```
BOLD = font-weight: 700 (a CSS/typography property)

From a photograph, we see "thicker strokes" but cannot distinguish:

  ┌─────────────────┐     ┌─────────────────┐
  │  GOVERNMENT     │     │  GOVERNMENT     │
  │  (True Bold)    │     │  (Heavy Font)   │
  └─────────────────┘     └─────────────────┘
         │                        │
         └───────┬────────────────┘
                 ▼
         Look identical in photo

Also indistinguishable:
  - Semi-bold (600) vs Bold (700)
  - Ink spread on printed label
  - JPEG compression artifacts
  - Low-resolution capture
```

---

## Part 5: The PASS/REVIEW/FAIL Paradox

### The Status Computation

```typescript
// src/app/api/verify-stream/route.ts

function computeOverallStatus(fieldResults: FieldResult[]): OverallStatus {
  const hasUnresolvedFail = fieldResults.some(
    (r) => r.status === "FAIL" && !r.agentOverride
  );
  const hasWarningOrNotFound = fieldResults.some(
    (r) => r.status === "WARNING" || r.status === "NOT_FOUND"
  );

  if (hasUnresolvedFail) return "FAIL";
  if (hasWarningOrNotFound) return "REVIEW";  // ◄── Bold check triggers this
  return "PASS";                               // ◄── Never reached
}
```

### The Logic Chain

```
Bold check implementation (warning-check.ts):
┌────────────────────────────────────────────┐
│ results.push({                             │
│   fieldName: "Gov Warning — Header Bold",  │
│   status: "WARNING",  // ◄── HARDCODED     │
│   confidence: 0.5,                         │
│   details: "..."                           │
│ });                                        │
└────────────────────────────────────────────┘
                    │
                    ▼
           status === "WARNING"
                    │
                    ▼
         hasWarningOrNotFound = true
                    │
                    ▼
            return "REVIEW"
                    │
                    ▼
         PASS is unreachable
```

### Visual Proof - A "Perfect" Verification

```
┌─────────────────────────────────────────────────────────────────┐
│  Field                    │ Extracted    │ Expected    │ Status │
├───────────────────────────┼──────────────┼─────────────┼────────┤
│  Brand Name               │ Old Tom      │ Old Tom     │ PASS   │
│  Class/Type               │ Bourbon      │ Bourbon     │ PASS   │
│  Alcohol Content          │ 45%          │ 45%         │ PASS   │
│  Net Contents             │ 750 mL       │ 750 mL      │ PASS   │
│  Name & Address           │ Louisville   │ Louisville  │ PASS   │
│  Gov Warning — Present    │ Found        │ Required    │ PASS   │
│  Gov Warning — Caps       │ YES          │ YES         │ PASS   │
│  Gov Warning — Bold       │ ???          │ YES         │ ⚠️ WARN │ ◄──
│  Gov Warning — Text       │ [exact]      │ [exact]     │ PASS   │
├───────────────────────────┴──────────────┴─────────────┴────────┤
│  OVERALL STATUS:                                        REVIEW  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 6: The Test Architecture

### Test Expectations vs Reality

```
sample-applications.json:
┌─────────────────────────────────────────┐
│ {                                       │
│   "id": "B1-perfect",                   │
│   "expectedResult": "PASS",  ◄── LIE    │
│   ...                                   │
│ }                                       │
└─────────────────────────────────────────┘
                    │
                    ▼
          API returns "REVIEW"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Test runner workaround (run-tests.js):                         │
│                                                                  │
│  if (expected === 'PASS' && actual === 'REVIEW') {              │
│    // Accept REVIEW if only bold warning caused it              │
│    const nonBoldWarnings = fieldResults.filter(                 │
│      f => f.status === 'WARNING' &&                             │
│           f.fieldName !== 'Gov Warning — Header Bold'           │
│    );                                                           │
│    if (nonBoldWarnings.length === 0) {                          │
│      result.passed = true;  // ◄── WORKAROUND                   │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Actual Possible Outcomes

```
┌─────────────────────────────────────────────────────────────────┐
│                    POSSIBLE OUTCOMES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐                                                    │
│  │ REVIEW  │  All fields match (or warnings only)               │
│  └─────────┘  Agent must visually confirm bold → Approve        │
│       │                                                          │
│       │       This is the "success" case                        │
│       │                                                          │
│  ┌─────────┐                                                    │
│  │  FAIL   │  At least one field has unresolvable mismatch      │
│  └─────────┘  Agent reviews and rejects or overrides            │
│                                                                  │
│  ┌─────────┐                                                    │
│  │  PASS   │  ← NEVER RETURNED                                  │
│  └─────────┘    Exists in type system but unreachable           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 7: File Map

| File | Role in the Problem |
|------|---------------------|
| `src/lib/warning-check.ts` | Contains the hardcoded `status: "WARNING"` for bold |
| `src/lib/types.ts` | Defines `OverallStatus = "PASS" \| "REVIEW" \| "FAIL"` |
| `src/app/api/verify-stream/route.ts` | Contains `computeOverallStatus()` logic |
| `src/app/api/verify-gemini/route.ts` | Single-image endpoint, same logic |
| `src/lib/gemini-extraction.ts` | Asks Gemini for `governmentWarningHeaderEmphasis` (unused) |
| `scripts/run-tests.js` | Contains the PASS→REVIEW workaround |
| `scripts/run-multi-image-tests.js` | Uses `PASS_OR_REVIEW` expectation |
| `docs/BOLD_DETECTION_ANALYSIS.md` | Documents why 71% accuracy is max |

---

## Part 8: The Decision Tree

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Q: Why does every verification return REVIEW?                 │
│                                                                  │
│   A: Because bold detection cannot be automated reliably,       │
│      and bold is a regulatory requirement (27 CFR Part 16).     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Q: Is this a bug?                                             │
│                                                                  │
│   A: No. It's a deliberate design decision.                     │
│      Human review is mandatory for compliance.                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Q: Could we return PASS by removing the bold check?           │
│                                                                  │
│   A: Yes, but that would ignore a regulatory requirement.       │
│      We'd be approving potentially non-compliant labels.        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Q: What would make PASS possible?                             │
│                                                                  │
│   A: Either:                                                    │
│      1. A bold detection method with >99% accuracy, OR          │
│      2. Regulatory change removing bold requirement, OR         │
│      3. Different label submission format (vector/PDF)          │
│                                                                  │
│      None of these are currently available.                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 9: Options for Resolution

### Option A: Accept REVIEW as Success (Current)

Keep the current behavior. REVIEW means "all automated checks passed, human must confirm bold."

**Pros:**
- Compliant with regulations
- No risk of false approvals
- Honest about AI limitations

**Cons:**
- Every label requires human review
- Tests have workaround logic
- "PASS" exists but is never returned

### Option B: Remove Bold Check Entirely

Delete the bold check from `warning-check.ts`. Labels with matching fields would return PASS.

**Pros:**
- PASS becomes achievable
- Tests become simpler
- Faster workflow for agents

**Cons:**
- Ignores regulatory requirement
- Non-bold warnings could be approved
- Compliance liability

### Option C: Make Bold Check Optional/Configurable

Add a flag to skip bold verification for certain use cases.

**Pros:**
- Flexibility for different contexts
- PASS achievable when appropriate

**Cons:**
- Complexity
- Risk of misconfiguration
- Still doesn't solve the detection problem

### Option D: Change Status Semantics

Redefine statuses so WARNING doesn't block PASS:
- PASS = all fields match
- REVIEW = has warnings (bold) but not blocking
- FAIL = has failures

**Pros:**
- PASS becomes meaningful
- Clearer status semantics

**Cons:**
- Breaking change to API contract
- UI changes needed
- Different interpretation of "PASS"

---

## Summary

The system is working as designed. The paradox exists because:

1. **Regulatory reality**: Bold is required by law
2. **Technical reality**: Bold cannot be reliably detected from photos
3. **Design decision**: Err on the side of human review

PASS is unreachable not due to a bug, but because we chose compliance over automation.

---

## Part 10: The Resolution — Field Categories

### The Insight

The paradox existed because we treated all checks equally in status aggregation. But not all checks are equal:

- **Automated checks** (presence, caps, text match, field comparisons) — the system can verify these with high confidence. Their results should determine PASS/FAIL/REVIEW.
- **Confirmation checks** (bold formatting) — the system cannot verify these reliably. They should be surfaced to the agent separately, without blocking the overall status.

Mixing these two categories in a single status pipeline guaranteed that the unverifiable check would always contaminate the verifiable ones.

### The Architecture Change

We introduced a `category` field on every `FieldResult`:

```typescript
export type FieldCategory = "automated" | "confirmation";
```

**Status aggregation now filters by category:**

```typescript
function computeOverallStatus(fieldResults: FieldResult[]): OverallStatus {
  const automatedResults = fieldResults.filter(r => r.category === "automated");
  // Only automated results determine PASS/FAIL/REVIEW
}
```

**Confirmation checks become pending confirmations:**

```typescript
function buildPendingConfirmations(fieldResults: FieldResult[]): PendingConfirmation[] {
  return fieldResults
    .filter(r => r.category === "confirmation")
    .map(r => ({ id: r.fieldName, label: ..., confirmed: false }));
}
```

### What Changed

| Component | Before | After |
|-----------|--------|-------|
| Bold check category | (none — treated same as all checks) | `"confirmation"` |
| All other checks | (none) | `"automated"` |
| `computeOverallStatus()` | Aggregates ALL field results | Aggregates only `automated` results |
| `VerificationResult` | No pending confirmations | `pendingConfirmations[]` array |
| Perfect label status | REVIEW (always) | **PASS** + 1 pending confirmation |
| Test workarounds | PASS→REVIEW exception in test runners | Removed — PASS means PASS |

### Files Changed

| File | Change |
|------|--------|
| `src/lib/types.ts` | Added `FieldCategory`, `PendingConfirmation`, `category` on `FieldResult` |
| `src/lib/warning-check.ts` | Tagged bold as `"confirmation"`, all others as `"automated"` |
| `src/app/api/verify-stream/route.ts` | Filter by category in `computeOverallStatus()`, added `buildPendingConfirmations()` |
| `src/lib/verify-single.ts` | Same changes for single-image endpoint |
| `scripts/run-tests.js` | Removed PASS→REVIEW workaround |
| `scripts/run-multi-image-tests.js` | Changed expectations from `PASS_OR_REVIEW` to `PASS`, removed workaround |

### Why This Is Better

1. **PASS now means something.** A perfect label returns PASS — the system verified everything it can verify.
2. **Bold check isn't lost.** It appears as a pending confirmation the agent must address. The regulatory requirement is still enforced, just not by the status pipeline.
3. **No workarounds.** Tests directly assert expected outcomes. No "accept REVIEW when we meant PASS" logic.
4. **Extensible.** If other checks become unreliable in the future (e.g., address matching on certain label types), they can be moved to `"confirmation"` without breaking the status model.
5. **Honest architecture.** The system tells you what it knows (automated status) and what it needs help with (pending confirmations) separately, rather than collapsing both into a single ambiguous signal.

### Test Results After Change

| Suite | Result |
|-------|--------|
| Single-image (14 tests) | 14/14 PASS — B1-perfect now returns PASS |
| Multi-image (5 tests) | 4/5 PASS — M1 intermittent due to AI extraction variance on Brand Name |
| Input validation (8 tests) | 8/8 PASS |

---

*Document created: 2026-02-05*
*Resolution implemented: 2026-02-05*
*See also: `docs/BOLD_DETECTION_ANALYSIS.md` for empirical bold detection testing*
