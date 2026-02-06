# TTB AI-Powered Alcohol Label Verification App — PRD & Build Plan

> **Version:** v1
> **Last Updated:** February 5, 2026
> **Status:** Completed — see Section 0.5 for deviations from plan
> **Owner:** Timothy Joo
> **Context:** Take-home project for Treasury TTB position

---

## 0. What This Document Is

This is the comprehensive plan for a take-home project: build an AI-powered prototype that helps TTB compliance agents verify alcohol beverage labels. This document extracts every requirement, stakeholder signal, and constraint from the project brief, then defines architecture, tech decisions, evaluation criteria, and implementation plan.

---

## 0.5 Deviations from Plan

This PRD was written before implementation. The table below records where the as-built system deviates from the original plan and why. The rest of this document reflects the original plan. For the as-built system, see `docs/APPROACH.md`.

| Planned | Actual | Why |
|---------|--------|-----|
| Claude Vision (Sonnet) | Gemini 2.0 Flash | 5s → 2.5s, same accuracy, 30x cheaper. See `docs/PERFORMANCE.md` |
| Azure App Service | Vercel | Zero-config Next.js deploy. Production would use Azure per Marcus. |
| `ANTHROPIC_API_KEY` | `GEMINI_API_KEY` | Consequence of model switch |
| Batch: shared app data | Per-label CSV + manual entry | Real workflows need different data per label |
| `LabelUploader` (single image) | `MultiImageUploader` (1-6 images) | Products have front/back/neck labels, need merge |
| Bold check blocks PASS | Bold is "confirmation" category | 71% accuracy made PASS unreachable. See `docs/GOVERNMENT_WARNING_PARADOX.md` |
| Next.js 14+ | Next.js 16.1.6 | Latest stable at build time |

---

## 1. Project Brief — Parsed Requirements

### 1.1 Explicit Deliverables

| Deliverable | Details |
|-------------|---------|
| Source Code Repository | GitHub, all source, README with setup/run instructions, brief docs on approach/tools/assumptions |
| Deployed Application URL | Working prototype they can access and test |

### 1.2 Evaluation Criteria (Verbatim from Brief)

1. Correctness and completeness of core requirements
2. Code quality and organization
3. Appropriate technical choices for the scope
4. User experience and error handling
5. Attention to requirements
6. Creative problem-solving

### 1.3 Key Quote from Brief

> "A working core application with clean code is preferred over ambitious but incomplete features. Document any trade-offs or limitations."

**Translation:** Ship something that works end-to-end. Don't half-build 10 features. Nail the core, document what you'd add.

---

## 2. Stakeholder Analysis — Hidden Requirements

The brief is structured as stakeholder interviews. This is intentional — they're testing whether you can extract requirements from messy, conversational input, not just follow a spec sheet. Every line matters.

### 2.1 Sarah Chen (Deputy Director, Label Compliance)

| Signal | Requirement | Priority |
|--------|-------------|----------|
| "150,000 label applications a year, 47 agents" | System must be fast and efficient | Context |
| "Making sure the number on the form is the same as the number on the label" | **Core feature: Form-to-label field matching/verification** | P0 |
| "Half their day doing data entry verification" | The verification workflow is the primary use case, not discovery | P0 |
| "If we can't get results back in about 5 seconds, nobody's going to use it" | **Hard performance constraint: ≤5 second response time** | P0 |
| "Something my mother could figure out—she's 73" | **Extreme simplicity in UX. Zero learning curve.** | P0 |
| "Half our team is over 50" | Large, clear text. High contrast. No hidden UI patterns | P0 |
| "Handle batch uploads... 200, 300 label applications at once" | **Batch processing feature** | P1 |
| "Janet from our Seattle office has been asking about this for years" | Named stakeholder wants batch — shows organizational demand | P1 |

### 2.2 Marcus Williams (IT Systems Administrator)

| Signal | Requirement | Priority |
|--------|-------------|----------|
| "Azure now after the migration in 2019" | Azure ecosystem is their world — deploy there if possible, or at minimum be cloud-native | Context |
| "Standalone proof-of-concept" | **Not integrating with COLA.** Standalone app. | P0 |
| "Not storing anything sensitive for this exercise" | No need for auth, PII handling, or data retention for prototype | Simplification |
| "Network blocks outbound traffic to a lot of domains" | **Consider on-premise/self-hosted AI inference if going to production.** For prototype, note this as a consideration. | Context |
| "FedRAMP certification... 18 months just for the paperwork" | Shows bureaucratic reality — prototype must be clearly a POC, not a production deployment | Context |

### 2.3 Dave Morrison (Senior Agent, 28 years)

| Signal | Requirement | Priority |
|--------|-------------|----------|
| "'STONE'S THROW' on the label but 'Stone's Throw' in the application. Technically a mismatch? Sure. But it's obviously the same thing." | **Case-insensitive matching. Fuzzy matching for trivial differences (caps, punctuation).** | P0 |
| "You need judgment" | AI should flag likely mismatches but allow agent to make final call — not auto-reject | P0 |
| "Just don't make my life harder" | The tool should reduce friction, not add steps. Agent workflow should be streamlined. | P0 |

### 2.4 Jenny Park (Junior Agent, 8 months)

| Signal | Requirement | Priority |
|--------|-------------|----------|
| "Printed checklist on my desk... Brand name—check. ABV—check. Warning statement—check" | **The UI should feel like a checklist. Field-by-field verification with clear pass/fail.** | P0 |
| "Warning statement has to be exact. Word-for-word." | **Government Warning verification must be strict: exact text, 'GOVERNMENT WARNING:' in all caps + bold** | P0 |
| "'Government Warning' in title case instead of all caps. Rejected." | Capitalization check is critical for the warning header | P0 |
| "Images that aren't perfectly shot... weird angles... lighting is bad... glare" | **Robust image processing — handle real-world label photos** | P1 |

---

## 3. Synthesized Requirements

### 3.1 Core Feature (P0): Label Verification

**The flow:**
1. Agent uploads a label image (photo of a physical label or digital label artwork)
2. Agent enters (or uploads) the application data (the fields from the COLA application form)
3. System extracts text from the label image using AI vision
4. System compares extracted label fields against application data
5. System presents field-by-field verification results in a checklist format
6. Agent reviews, makes final judgment, and either approves or flags issues

### 3.2 Mandatory Label Fields to Verify

Based on TTB BAM (Beverage Alcohol Manual) and 27 CFR Parts 4, 5, 7:

| Field | Verification Type | Notes |
|-------|-------------------|-------|
| **Brand Name** | Fuzzy match (case-insensitive, punctuation-tolerant) | Dave's "STONE'S THROW" scenario |
| **Class/Type Designation** | Fuzzy match | e.g., "Kentucky Straight Bourbon Whiskey" |
| **Alcohol Content** | Exact numeric match (with format flexibility) | "45% Alc./Vol." or "45% Alcohol by Volume" or "90 Proof" |
| **Net Contents** | Exact numeric match (with unit normalization) | "750 mL" = "750 ml" = "25.4 fl oz" |
| **Name and Address** | Fuzzy match | Bottler/producer/importer |
| **Country of Origin** | Exact match (imports only) | Required for imported products |
| **Government Warning Statement** | **Strict exact match** with formatting checks | See Section 3.3 |

### 3.3 Government Warning Statement — Exact Requirements

Per ABLA of 1988 (27 CFR Part 16):

**Required text (word-for-word):**
```
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink
alcoholic beverages during pregnancy because of the risk of birth defects.
(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate
machinery, and may cause health problems.
```

**Format requirements:**
- "GOVERNMENT WARNING" must be in ALL CAPS and BOLD
- Remainder of statement must NOT be in bold
- Must appear as a continuous paragraph
- Must be separate and apart from all other information
- Must be on a contrasting background
- Must be readily legible under ordinary conditions
- Minimum type sizes: 3mm (>3L), 2mm (>237mL to 3L), 1mm (≤237mL)

**Verification checks:**
1. Text present on label (existence check)
2. "GOVERNMENT WARNING:" in all caps (formatting check)
3. Complete text matches word-for-word (content check)
4. Appears as continuous paragraph, separate from other info (layout check — best effort via AI)

### 3.4 Matching Logic Tiers

| Tier | Logic | Applied To |
|------|-------|------------|
| **Strict** | Exact text match (after whitespace normalization) | Government Warning text |
| **Numeric** | Extract numeric value + unit, compare values | ABV, Net Contents |
| **Fuzzy** | Case-insensitive, punctuation-normalized, similarity threshold | Brand Name, Class/Type, Name/Address |

### 3.5 Batch Processing (P1)

- Upload multiple label images at once
- Enter application data for each (or upload a CSV/structured data file)
- Process all labels, show summary results dashboard
- Individual drill-down for each label's field-by-field results

### 3.6 Performance

- **Single label verification: ≤5 seconds** (Sarah's hard requirement)
- Batch: Background processing with progress indicator is acceptable
- Must feel fast — show streaming/progressive results if possible

### 3.7 Image Preprocessing (Client-Side)

Per Anthropic's documentation, images larger than 1568px on either dimension are resized server-side, adding latency without improving quality. Images over 5MB are rejected by the API.

**Client-side preprocessing before upload:**
1. Validate file type: accept JPG, PNG, WebP only. Reject TIFF, BMP, multi-page PDF with clear error message listing supported formats.
2. Validate file size: reject files over 10MB before any processing.
3. Resize: if either dimension exceeds 1568px, resize proportionally so the longest edge = 1568px. Use `<canvas>` element for client-side resize.
4. Compress: convert to JPEG at 85% quality (balances text readability with file size).
5. Final size check: after compression, verify the result is under 5MB (the API limit). If not, reduce quality to 70% and retry.

**Why 1568px and not smaller:** The government warning text is often printed in small type (minimum 1mm per regulation). Compressing too aggressively makes small text unreadable to Claude Vision. 1568px matches Anthropic's recommended max without server-side resizing.

### 3.8 Batch Processing Constraints

**Prototype scope:** Cap batch at 10 labels maximum. Process in parallel using `Promise.allSettled()` (not sequential). Display individual results as each completes via streaming. Total batch time = ~single label time (parallel) + overhead.

**Why not 200-300:** Sarah mentioned 200-300 labels, but sequential API calls for 200 labels at 3-4s each = 10-13 minutes in a single HTTP request. That exceeds any reasonable timeout. Parallel calls hit Anthropic rate limits. For the prototype, 10 labels demonstrates the batch concept. APPROACH.md documents that production would need a job queue architecture (e.g., Bull/Redis queue with worker processes) and a poll-for-results pattern.

---

## 4. Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│          Next.js App (React + TypeScript)            │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Upload   │  │  Form    │  │  Results           │  │
│  │  (Image)  │  │  (Data)  │  │  (Checklist View)  │  │
│  └────┬─────┘  └────┬─────┘  └───────────────────┘  │
│       │              │                                │
│       └──────┬───────┘                                │
│              ▼                                        │
│       API Route Handler                               │
│       /api/verify                                     │
└──────────────┬────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│                 VERIFICATION ENGINE                    │
│                                                       │
│  1. Label Extraction (Claude Vision API)              │
│     - Send label image to Claude                      │
│     - Extract structured fields via tool_use          │
│                                                       │
│  2. Field Comparison Engine                           │
│     - Strict matching (Gov Warning)                   │
│     - Numeric matching (ABV, Net Contents)            │
│     - Fuzzy matching (Brand, Class/Type, Address)     │
│                                                       │
│  3. Results Assembly                                  │
│     - Per-field PASS/FAIL/WARNING                     │
│     - Confidence scores                               │
│     - Mismatch details with specific diff             │
└──────────────────────────────────────────────────────┘
```

### 4.2 Why This Architecture

**Single application (Next.js fullstack) because:**
- Take-home project — simplicity wins over microservices
- One deploy, one repo, one URL
- API routes handle backend logic without a separate server
- Evaluators can `npm install && npm run dev` immediately
- Brief says "appropriate technical choices for the scope"

**Claude Vision API for extraction because:**
- Best-in-class multimodal understanding
- Handles messy real-world images (angles, glare, lighting — Jenny's concern)
- Can extract structured data with tool_use (no OCR fragility)
- Single API call, fast response (supports ≤5s target)
- Shows Tim's Claude/Anthropic expertise — directly relevant to Treasury AI role

**NOT using traditional OCR (Tesseract, AWS Textract) because:**
- Fragile with real-world label photos
- Requires significant preprocessing for rotation, glare, perspective correction
- Claude Vision handles these natively
- Brief encourages creative problem-solving

### 4.3 Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 14+ (App Router) | Fullstack React, easy deploy, industry standard |
| Language | TypeScript | Type safety, professional signal |
| Styling | Tailwind CSS | Fast iteration, clean UI |
| AI/Vision | Claude API (claude-sonnet-4-20250514) | Best multimodal, tool_use for structured extraction |
| Deployment | Azure App Service | Aligns with TTB's existing Azure infrastructure (per Marcus) |
| Image Handling | Next.js Image + native File API | No extra dependencies |

**Why Azure App Service:**
- TTB is already on Azure (migrated in 2019 per Marcus) — deploying there shows you listened
- App Service supports Next.js with minimal config
- Free/Basic tier covers prototype
- Signals production-readiness: same cloud, same ecosystem, easier path from POC to real deployment
- Evaluators get a working URL, same as any cloud host

**Azure App Service — Specific Deployment Config:**

1. **next.config.ts** — Enable standalone output:
```typescript
const nextConfig = {
  output: 'standalone',
  // ... other config
};
```

2. **package.json** — Build script copies static assets into standalone:
```json
"scripts": {
  "build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/"
}
```

3. **Azure App Service settings:**
   - Runtime: Node 20 LTS (`az webapp config set --linux-fx-version "NODE|20-lts"`)
   - Startup command: `node server.js`
   - SKU: Basic B1 (always-on, avoids cold start)
   - Set `ANTHROPIC_API_KEY` in Application Settings (environment variables)

4. **Deploy via GitHub Actions:**
   - On push to main: `npm install` → `npm run build` → deploy `.next/standalone/` folder
   - Use `azure/webapps-deploy@v3` action with publish profile secret

This is a well-documented pattern — multiple production guides confirm this exact flow for Next.js 14+ on Azure App Service.

### 4.4 API Design

**POST /api/verify**

```typescript
// Request
{
  labelImage: File,              // The label image (uploaded)
  applicationData: {
    brandName: string,
    classType: string,
    alcoholContent: string,      // e.g., "45% Alc./Vol. (90 Proof)"
    netContents: string,         // e.g., "750 mL"
    nameAddress: string,         // Bottler/producer
    countryOfOrigin?: string,    // For imports
    governmentWarning: string    // Expected warning text
  }
}

// Response
{
  overallStatus: "PASS" | "FAIL" | "REVIEW",
  processingTimeMs: number,
  extractedFields: {             // What AI read from the label
    brandName: string | null,
    classType: string | null,
    alcoholContent: string | null,
    netContents: string | null,
    nameAddress: string | null,
    countryOfOrigin: string | null,
    governmentWarning: string | null,
    rawExtraction: string        // Full text for debugging
  },
  fieldResults: [
    {
      fieldName: string,
      applicationValue: string,
      extractedValue: string | null,
      status: "PASS" | "FAIL" | "WARNING" | "NOT_FOUND" | "OVERRIDDEN",
      matchType: "strict" | "numeric" | "fuzzy" | "abv" | "volume" | "address",
      confidence: number,        // 0-1
      details: string,           // Human-readable explanation
      agentOverride?: {          // Present only if agent used override
        action: "accepted" | "confirmed_issue",
        timestamp: string
      }
    }
  ]
}
```

**`overallStatus` aggregation logic:**

```typescript
function computeOverallStatus(fieldResults: FieldResult[]): "PASS" | "FAIL" | "REVIEW" {
  const hasUnresolvedFail = fieldResults.some(
    r => r.status === "FAIL" && !r.agentOverride
  );
  const hasWarningOrNotFound = fieldResults.some(
    r => r.status === "WARNING" || r.status === "NOT_FOUND"
  );
  
  if (hasUnresolvedFail) return "FAIL";
  if (hasWarningOrNotFound) return "REVIEW";
  return "PASS";
}
```

**Rules:** Any un-overridden FAIL → overall FAIL. No fails but any WARNING or NOT_FOUND → overall REVIEW. All PASS (or overridden) → overall PASS. Agent override changes a field to OVERRIDDEN, which does not count as FAIL for aggregation but is logged for audit.

**Export Results spec:**

The `[ 📋 Export Results ]` button generates a downloadable JSON file:

```typescript
{
  exportedAt: string,           // ISO timestamp
  labelImageName: string,
  overallStatus: string,
  processingTimeMs: number,
  fieldResults: FieldResult[],  // Full array including any agent overrides
  summary: {
    totalFields: number,
    passed: number,
    failed: number,
    warnings: number,
    overridden: number
  }
}
```

For the prototype, JSON export is the deliverable. CSV export (human-readable, one row per field) is a stretch goal. Production would integrate with COLA system directly rather than export files.

**POST /api/verify/batch**

```typescript
// Request — max 10 labels per batch (prototype constraint)
{
  labels: Array<{              // Validated: reject if length > 10
    labelImage: File,
    applicationData: ApplicationData
  }>
}

// Response — results stream in as each label completes (SSE or poll)
{
  batchId: string,
  status: "processing" | "complete",
  results: Array<VerificationResult>,  // Grows as each label finishes
  summary: {
    total: number,
    completed: number,
    passed: number,
    failed: number,
    needsReview: number
  }
}
```

**Batch implementation:** Process all labels in parallel via `Promise.allSettled()`. Each label is an independent Claude API call. Return partial results as each resolves (via Server-Sent Events if time allows, otherwise poll endpoint). Cap at 10 to stay within Anthropic rate limits and HTTP timeout windows. Document in APPROACH.md that production batch (200-300 labels per Sarah) would require a job queue (Bull + Redis) with background workers and a separate status polling endpoint.

---

## 5. Label Extraction — Claude Vision Prompt Design

### 5.1 Extraction Strategy

Use Claude's tool_use (function calling) to get structured output, not free-text parsing.

**System prompt:**
```
You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) label analysis 
specialist. Your job is to extract specific regulatory fields from alcohol 
beverage labels with extreme accuracy.

Extract EXACTLY what appears on the label — do not correct, normalize, or 
interpret. If text is unclear, extract your best reading and note the 
uncertainty. If a field is not visible on the label, return null for that field.
```

**Tool definition:**
```typescript
{
  name: "extract_label_fields",
  description: "Extract mandatory TTB label fields from an alcohol beverage label image",
  input_schema: {
    type: "object",
    properties: {
      brand_name: {
        type: "string",
        nullable: true,
        description: "The brand name as it appears on the label, preserving exact capitalization and punctuation"
      },
      class_type: {
        type: "string",
        nullable: true,
        description: "The class and/or type designation (e.g., 'Kentucky Straight Bourbon Whiskey', 'Cabernet Sauvignon', 'India Pale Ale')"
      },
      alcohol_content: {
        type: "string",
        nullable: true,
        description: "The alcohol content statement exactly as shown (e.g., '40% Alc./Vol. (80 Proof)')"
      },
      net_contents: {
        type: "string",
        nullable: true,
        description: "The net contents statement (e.g., '750 mL', '12 FL. OZ.')"
      },
      name_address: {
        type: "string",
        nullable: true,
        description: "The name and address of the producer, bottler, or importer as shown on the label"
      },
      country_of_origin: {
        type: "string",
        nullable: true,
        description: "Country of origin if shown on the label"
      },
      government_warning: {
        type: "string",
        nullable: true,
        description: "The complete government warning statement text. Include EXACTLY as printed, preserving capitalization."
      },
      government_warning_header_format: {
        type: "string",
        enum: ["ALL_CAPS", "MIXED_CASE", "NOT_FOUND"],
        description: "The capitalization of the 'GOVERNMENT WARNING:' header. Report ALL_CAPS if the header text is entirely uppercase, MIXED_CASE if any lowercase letters are present."
      },
      government_warning_header_emphasis: {
        type: "string",
        enum: ["APPEARS_BOLD_OR_HEAVY", "APPEARS_NORMAL_WEIGHT", "UNCERTAIN"],
        description: "Best-effort assessment of whether the header text appears visually heavier/bolder than the surrounding warning text. This is a subjective visual assessment — report UNCERTAIN if you cannot confidently determine the font weight from the image."
      },
      additional_observations: {
        type: "string",
        nullable: true,
        description: "Any notable observations about label quality, readability issues, or potential compliance concerns"
      }
    },
    required: ["brand_name", "class_type", "alcohol_content", "net_contents", 
               "name_address", "government_warning", "government_warning_header_format"]
  }
}
```

### 5.2 Why Tool Use Over JSON Prompting

- Schema-guaranteed structured output — no parsing fragility
- Claude returns exactly the fields we define
- If a field can't be extracted, it returns null (not a hallucinated value)
- Consistent with Tim's approach in GatsbyAI (demonstrates pattern knowledge)

---

## 6. Field Comparison Engine

### 6.1 Matching Functions

#### 6.1.1 Strict Match — Government Warning

```typescript
function strictMatch(extracted: string, expected: string): MatchResult {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  const a = normalize(extracted);
  const b = normalize(expected);
  return {
    status: a === b ? "PASS" : "FAIL",
    confidence: a === b ? 1.0 : 0.0,
    details: a === b ? "Exact match" : wordDiff(a, b)
  };
}

// Word-level diff: split both strings by whitespace, compare word-by-word
// Output example: "Expected: '...car or operate...' | Found: '...car, operate...' | Diff: missing 'or', unexpected ','"
function wordDiff(expected: string, found: string): string {
  const wordsA = expected.split(/\s+/);
  const wordsB = found.split(/\s+/);
  const diffs: string[] = [];
  // Use longest common subsequence to identify added/removed/changed words
  // For prototype: simple sequential comparison with alignment
  // Output: list of specific word-level differences for agent review
  // Implementation: use 'diff' npm package or hand-roll LCS-based word diff
  return `Differences found: ${diffs.join('; ')}`;
}
```

**Implementation note:** Use the `diff` npm package (BSD licensed, widely used) for word-level comparison. It provides `diffWords()` which returns an array of change objects with `added`, `removed`, and `value` properties. This is a solved problem — no need to hand-roll.

#### 6.1.2 Numeric Match — ABV and Net Contents

The original `numericMatch()` had three critical bugs:
1. Grabbed the first number via generic regex — fails when string contains multiple numbers (e.g., "45% Alc./Vol. (90 Proof)" → grabs 45, but "90 Proof" → grabs 90)
2. No proof-to-ABV conversion (US proof = 2 × ABV, so 90 proof = 45% ABV)
3. No unit conversion for net contents (750 mL = 25.4 fl oz)

**Fixed implementation:**

```typescript
// ── ABV Matching ──
interface ParsedABV {
  percentage: number;  // Always normalized to ABV percentage
  source: 'percentage' | 'proof';
}

function parseABV(s: string): ParsedABV | null {
  // Try percentage first: "45%", "45% Alc./Vol.", "45% Alcohol by Volume"
  const pctMatch = s.match(/(\d+\.?\d*)\s*%/);
  if (pctMatch) return { percentage: parseFloat(pctMatch[1]), source: 'percentage' };
  
  // Try proof: "90 Proof", "90proof"
  const proofMatch = s.match(/(\d+\.?\d*)\s*[Pp]roof/);
  if (proofMatch) return { percentage: parseFloat(proofMatch[1]) / 2, source: 'proof' };
  
  return null;
}

function matchABV(extracted: string, expected: string): MatchResult {
  const a = parseABV(extracted);
  const b = parseABV(expected);
  
  if (!a || !b) return { status: "WARNING", confidence: 0.5, details: "Could not parse ABV value" };
  if (a.percentage === b.percentage) {
    const note = a.source !== b.source ? ` (converted: ${a.source} on label, ${b.source} on application)` : '';
    return { status: "PASS", confidence: 1.0, details: `ABV match: ${a.percentage}%${note}` };
  }
  return { status: "FAIL", confidence: 0.9, details: `ABV mismatch: label=${a.percentage}% vs application=${b.percentage}%` };
}

// ── Net Contents Matching ──
const ML_CONVERSIONS: Record<string, number> = {
  'ml': 1,
  'cl': 10,
  'l': 1000,
  'fl oz': 29.5735,
  'fl. oz': 29.5735,
  'fl.oz': 29.5735,
  'oz': 29.5735,       // In beverage context, oz = fl oz
  'pt': 473.176,
  'qt': 946.353,
  'gal': 3785.41,
};

interface ParsedVolume {
  valueMl: number;     // Always normalized to mL
  original: string;    // Original string for display
}

function parseVolume(s: string): ParsedVolume | null {
  const normalized = s.toLowerCase().trim();
  // Try each unit pattern, longest first to avoid partial matches
  for (const [unit, mlFactor] of Object.entries(ML_CONVERSIONS).sort((a, b) => b[0].length - a[0].length)) {
    const regex = new RegExp(`(\\d+\\.?\\d*)\\s*${unit.replace('.', '\\.')}`, 'i');
    const match = normalized.match(regex);
    if (match) {
      return { valueMl: parseFloat(match[1]) * mlFactor, original: s.trim() };
    }
  }
  return null;
}

function matchNetContents(extracted: string, expected: string): MatchResult {
  const a = parseVolume(extracted);
  const b = parseVolume(expected);
  
  if (!a || !b) return { status: "WARNING", confidence: 0.5, details: "Could not parse volume" };
  // Allow 0.5% tolerance for rounding (e.g., 25.4 fl oz → 750.7 mL vs 750 mL)
  const tolerance = 0.005;
  const ratio = Math.abs(a.valueMl - b.valueMl) / Math.max(a.valueMl, b.valueMl);
  if (ratio <= tolerance) {
    return { status: "PASS", confidence: 1.0, details: `Volume match: ${a.original} ≈ ${b.original} (${a.valueMl.toFixed(1)} mL)` };
  }
  return { status: "FAIL", confidence: 0.9, details: `Volume mismatch: ${a.original} (${a.valueMl.toFixed(1)} mL) vs ${b.original} (${b.valueMl.toFixed(1)} mL)` };
}
```

#### 6.1.3 Fuzzy Match — Brand Name, Class/Type

**Algorithm choice:** Jaro-Winkler similarity (not Levenshtein).

**Why Jaro-Winkler:** It returns a normalized 0-1 score natively (no manual normalization needed), emphasizes prefix matching which is ideal for brand names where the beginning is most distinctive, and is faster than Levenshtein at O(m+n) vs O(m×n). Industry practice for name matching in compliance/AML screening consistently recommends Jaro-Winkler for individual names and short entity strings.

**Implementation:** Use the `jaro-winkler` npm package (or implement — it's ~30 lines). Standard parameters: prefix weight p=0.1, max prefix length=4.

```typescript
import { jaroWinkler } from './utils';  // Implement or use npm package

function fuzzyMatch(extracted: string, expected: string, threshold: number = 0.85): MatchResult {
  const normalize = (s: string) => s
    .toLowerCase()
    .replace(/['']/g, "'")          // Normalize apostrophes
    .replace(/[""]/g, '"')          // Normalize quotes  
    .replace(/[^\w\s'"-]/g, '')     // Strip other punctuation
    .replace(/\s+/g, ' ')           // Collapse whitespace
    .trim();
  
  const a = normalize(extracted);
  const b = normalize(expected);
  
  // Exact match after normalization — handles Dave's "STONE'S THROW" scenario
  if (a === b) return { status: "PASS", confidence: 1.0, details: "Match (after normalization)" };
  
  // Jaro-Winkler similarity (0-1, higher = more similar)
  const similarity = jaroWinkler(a, b);
  
  if (similarity >= threshold) {
    return { status: "PASS", confidence: similarity, details: `High similarity (${(similarity * 100).toFixed(0)}%) — minor formatting differences` };
  }
  if (similarity >= 0.6) {
    return { status: "WARNING", confidence: similarity, details: `Partial match (${(similarity * 100).toFixed(0)}%) — agent review recommended` };
  }
  return { status: "FAIL", confidence: similarity, details: `Low similarity (${(similarity * 100).toFixed(0)}%) — likely mismatch` };
}
```

**Threshold validation plan:** Before submission, test the 0.85 threshold against all test label pairs. Verify that:
- "STONE'S THROW" vs "Stone's Throw" → scores above 0.85 (should PASS after normalization anyway)
- "Old Tom Distillery" vs "OLD TOM DISTILLERY" → scores above 0.85 (normalization handles this)
- "Maker's Mark" vs "Jack Daniel's" → scores well below 0.6 (should FAIL)
- "Kentucky Straight Bourbon Whiskey" vs "Kentucky Straight Bourbon" → test if partial class names score correctly

If any real scenarios fall in unexpected ranges, adjust threshold accordingly.

#### 6.1.4 Address Match — Component-Aware Fuzzy

Address matching is a known hard problem. "Old Tom Distillery, 123 Main St, Louisville, KY 40202" vs "Old Tom Distillery, Louisville, Kentucky" should match despite the second being less complete. A single Jaro-Winkler over the entire string will score this poorly.

**Prototype approach:** Use fuzzy match with a LOWER threshold (0.70 instead of 0.85) and always report as WARNING for anything below 100% match. The agent always makes the final call on address matches.

```typescript
function addressMatch(extracted: string, expected: string): MatchResult {
  // Normalize address abbreviations before comparison
  const normalizeAddress = (s: string) => s
    .toLowerCase()
    .replace(/\bst\.?\b/g, 'street')
    .replace(/\bave\.?\b/g, 'avenue')
    .replace(/\bblvd\.?\b/g, 'boulevard')
    .replace(/\bdr\.?\b/g, 'drive')
    .replace(/\brd\.?\b/g, 'road')
    .replace(/\bln\.?\b/g, 'lane')
    .replace(/\bct\.?\b/g, 'court')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const a = normalizeAddress(extracted);
  const b = normalizeAddress(expected);
  
  if (a === b) return { status: "PASS", confidence: 1.0, details: "Exact address match" };
  
  const similarity = jaroWinkler(a, b);
  
  // Address matching uses a LOWER threshold (0.70) and defaults to WARNING
  // because addresses structurally differ (label may abbreviate, omit zip, etc.)
  if (similarity >= 0.90) {
    return { status: "PASS", confidence: similarity, details: `Address match (${(similarity * 100).toFixed(0)}%)` };
  }
  if (similarity >= 0.70) {
    return { status: "WARNING", confidence: similarity, details: `Address partial match (${(similarity * 100).toFixed(0)}%) — agent review recommended. Labels often abbreviate or omit parts of the full address.` };
  }
  return { status: "FAIL", confidence: similarity, details: `Address mismatch (${(similarity * 100).toFixed(0)}%)` };
}
```

**Production note:** A production system would use component-based address parsing (entity name, street number, street name, city, state, zip) with per-component matching and weighted scoring. The `usaddress` Python library or similar structured parser would split addresses before comparison. For this prototype, the lowered threshold + mandatory WARNING + side-by-side display is sufficient since the agent is always the final reviewer.

#### 6.1.5 Field-to-Function Routing

Each field uses a specific matching function — not a generic catch-all:

| Field | Function | Threshold | Notes |
|-------|----------|-----------|-------|
| Brand Name | `fuzzyMatch()` | 0.85 | Jaro-Winkler, handles case/punctuation |
| Class/Type | `fuzzyMatch()` | 0.85 | Jaro-Winkler |
| Alcohol Content | `matchABV()` | exact | Proof↔ABV conversion |
| Net Contents | `matchNetContents()` | 0.5% tolerance | mL↔fl oz↔L conversion |
| Name/Address | `addressMatch()` | 0.70 | Lower threshold, defaults to WARNING |
| Country of Origin | `strictMatch()` | exact | After normalization |
| Government Warning | `strictMatch()` | exact | Plus formatting sub-checks (Section 6.2) |

### 6.2 Government Warning Special Handling

The warning gets its own dedicated check function with multiple sub-checks:

```typescript
function verifyGovernmentWarning(extracted: ExtractedFields, expected: string): FieldResult[] {
  const results: FieldResult[] = [];
  
  // Check 1: Warning text present on label
  results.push({
    fieldName: "Gov Warning — Present",
    status: extracted.government_warning ? "PASS" : "FAIL",
    details: extracted.government_warning ? "Warning statement found on label" : "WARNING STATEMENT NOT FOUND ON LABEL"
  });
  
  // Check 2: "GOVERNMENT WARNING:" header in all caps (RELIABLE — text comparison)
  results.push({
    fieldName: "Gov Warning — Header Caps",
    status: extracted.government_warning_header_format === "ALL_CAPS" ? "PASS" : "FAIL",
    details: extracted.government_warning_header_format === "ALL_CAPS" 
      ? "Header in ALL CAPS ✓" 
      : `Header format: ${extracted.government_warning_header_format} — must be ALL CAPS per 27 CFR Part 16`
  });
  
  // Check 3: Header appears bold (BEST-EFFORT — visual assessment from image)
  // Bold detection from photographs is inherently unreliable. 
  // Claude Vision can assess visual weight but cannot definitively determine CSS font-weight.
  // This check is always WARNING tier, never PASS/FAIL, because we cannot be certain.
  results.push({
    fieldName: "Gov Warning — Header Bold",
    status: "WARNING",  // Always WARNING — agent must visually confirm
    details: extracted.government_warning_header_emphasis === "APPEARS_BOLD_OR_HEAVY"
      ? "Header appears visually emphasized (best-effort assessment) — agent should visually confirm bold formatting"
      : extracted.government_warning_header_emphasis === "UNCERTAIN"
        ? "Could not determine if header is bold from image — agent should visually confirm"
        : "Header does not appear bold — agent should visually confirm. Per 27 CFR Part 16, 'GOVERNMENT WARNING' must be in bold."
  });
  
  // Check 4: Complete text match (word-for-word)
  if (extracted.government_warning) {
    const textMatch = strictMatch(extracted.government_warning, STANDARD_WARNING_TEXT);
    results.push({
      fieldName: "Gov Warning — Text Accuracy",
      ...textMatch
    });
  }
  
  return results;
}
```

### 6.3 The "Dave Problem" — Intelligent Mismatch Handling

Dave's "STONE'S THROW" vs "Stone's Throw" scenario is the heart of the UX challenge. The system must:

1. **Recognize trivial differences** (case, punctuation, spacing) and pass them with a note
2. **Flag ambiguous differences** as "WARNING — agent review" rather than auto-fail
3. **Clearly fail** on genuine mismatches (wrong brand name, wrong ABV)

The three-tier status system handles this:
- **PASS** → Exact or close-enough match, no action needed
- **WARNING** → Possible match but differences detected, agent should verify
- **FAIL** → Clear mismatch, likely needs rejection or correction

---

## 7. UI/UX Design

### 7.1 Design Principles (From Stakeholder Signals)

| Principle | Source | Implementation |
|-----------|--------|----------------|
| "My mother could figure out" | Sarah | Giant upload button, minimal UI, no hidden menus |
| "Half our team is over 50" | Sarah | 16px+ base font, high contrast, clear labels |
| "Printed checklist on my desk" | Jenny | Results displayed as a visual checklist with ✅/❌/⚠️ |
| "Don't make my life harder" | Dave | Minimal required inputs, smart defaults |
| "5 seconds or nobody uses it" | Sarah | Loading state with progress, feel fast |

### 7.2 Screen Flow

**Screen 1: Upload & Input**
```
┌──────────────────────────────────────────────┐
│  🏛️  TTB Label Verification Tool              │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │                                         │  │
│  │    📸 Drop label image here             │  │
│  │       or click to browse                │  │
│  │                                         │  │
│  │    [Supports JPG, PNG, PDF]             │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Application Data                             │
│  ┌─────────────────────────────────────────┐  │
│  │ Brand Name:     [ OLD TOM DISTILLERY  ] │  │
│  │ Class/Type:     [ Kentucky Straight... ] │  │
│  │ Alcohol Content: [ 45% Alc./Vol. ...  ] │  │
│  │ Net Contents:    [ 750 mL             ] │  │
│  │ Name & Address:  [ Old Tom Distille.. ] │  │
│  │ Country of Origin: [ (optional)       ] │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  [ ▶ Verify Label ]                           │
│                                               │
│  — or —                                       │
│                                               │
│  [ 📁 Batch Upload (Multiple Labels) ]        │
└──────────────────────────────────────────────┘
```

**Screen 2: Results (Checklist View)**
```
┌──────────────────────────────────────────────┐
│  🏛️  Verification Results                     │
│                                               │
│  Overall: ⚠️ NEEDS REVIEW  (5/7 passed)       │
│  Processed in 3.2 seconds                     │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ ✅ Brand Name                            │  │
│  │    Application: "OLD TOM DISTILLERY"     │  │
│  │    Label:       "Old Tom Distillery"     │  │
│  │    Match: 95% — case difference only     │  │
│  │                                         │  │
│  │ ✅ Class/Type                            │  │
│  │    Application: "Kentucky Straight..."   │  │
│  │    Label:       "Kentucky Straight..."   │  │
│  │    Match: 100% — exact match             │  │
│  │                                         │  │
│  │ ✅ Alcohol Content                       │  │
│  │    Application: "45% Alc./Vol."          │  │
│  │    Label:       "45% Alc./Vol. (90...)"  │  │
│  │    Match: Numeric match (45%)            │  │
│  │                                         │  │
│  │ ⚠️ Government Warning — Header Format    │  │
│  │    Expected: ALL CAPS + BOLD             │  │
│  │    Found: ALL CAPS, bold not confirmed   │  │
│  │    ⚠️ Agent review recommended           │  │
│  │    [ ✓ Accept ] [ ✗ Confirm Issue ]      │  │
│  │                                         │  │
│  │ ❌ Government Warning — Text             │  │
│  │    Missing word: "or" before "operate"   │  │
│  │    Expected: "...drive a car or oper..." │  │
│  │    Found:    "...drive a car, oper..."   │  │
│  │    [ ✓ Accept ] [ ✗ Confirm Issue ]      │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  [ 🔄 Verify Another ]  [ 📋 Export Results ] │
└──────────────────────────────────────────────┘
```

### 7.3 Key UX Decisions

**Pre-filled Government Warning:**
The government warning text is the same for EVERY alcohol beverage. The form should pre-fill this field with the standard ABLA text. Agent should never have to type it. One less thing to do = Dave stays happy.

**Image Preview:**
After upload, show a thumbnail of the label image alongside the results so the agent can visually confirm.

**Color Coding:**
- ✅ Green = PASS (clear match)
- ⚠️ Amber = WARNING (needs agent judgment)
- ❌ Red = FAIL (clear mismatch or missing)
- Gray = NOT FOUND (field not detected on label)

**Responsive but Desktop-First:**
Compliance agents work at desks on monitors. Design for 1440px+ viewports. Mobile should work but isn't the primary target.

**Side-by-Side Display (Critical):**
Every field result shows the application value and the extracted label value next to each other. This is the primary runtime mitigation for extraction errors and matching edge cases — the agent can always visually compare and apply human judgment. Dave said "you need judgment" — the UI must support that.

**Agent Override:**
Each field result card with a WARNING or FAIL status includes an "Accept" override action. This lets agents like Dave mark trivial differences (case, punctuation) as acceptable without the system blocking their workflow. Override decisions are logged in the exported results for audit purposes.

---

## 8. Test Data Strategy

### 8.1 Test Labels

Per the brief: *"We encourage you to create or source additional test labels—AI image generation tools work well for this."*

**Strategy: Create 5-6 test label images covering key scenarios:**

| # | Label | Tests |
|---|-------|-------|
| 1 | Perfect bourbon label — all fields correct | Happy path, all PASS |
| 2 | Bourbon with "Stone's Throw" case mismatch | Dave scenario — fuzzy match should PASS |
| 3 | Wine label with wrong ABV (label says 14.5%, app says 13.5%) | Numeric FAIL |
| 4 | Beer label with "Government Warning" in title case (not all caps) | Jenny's scenario — warning header FAIL |
| 5 | Label missing government warning entirely | WARNING NOT FOUND |
| 6 | Imported spirit with all fields correct + country of origin | Full field coverage |

**How to create test labels (in priority order):**

1. **HTML/CSS mockup labels (PRIMARY)** — Create realistic label layouts in HTML with precise, controlled text. Screenshot at 1568px width. This guarantees text is correct and readable. Claude Vision will extract exactly what we put there. Use realistic fonts (serif for brand names, sans-serif for regulatory text), background textures, and proper layout spacing.

2. **Real bottle photo (1-2 labels)** — Photograph an actual bottle label with a phone camera at a slight angle with imperfect lighting. This tests Claude Vision's robustness with real-world images (Jenny's concern). The specific label doesn't need to match our test application data — we can create matching application data after extraction.

3. **AI image generation (LAST RESORT ONLY)** — AI generators (DALL-E, Midjourney) are notoriously unreliable at rendering specific, accurate text. If used at all, use ONLY for generating a label background/aesthetic, then overlay correct text via HTML/CSS compositing. Never rely on AI-generated text to be correct — it will garble the government warning.

### 8.2 Pre-loaded Demo Data

For the deployed URL, include pre-loaded example data that evaluators can click to immediately see the system in action without needing to find/upload test images themselves. This dramatically improves the evaluation experience.

**"Try it with example data" button** that pre-fills the form with a sample application + loads a sample label image.

---

## 9. Evaluation Framework

### 9.1 Self-Evaluation Checks

Before submitting, verify these pass:

| Check | Type | Criteria |
|-------|------|----------|
| E-001 | Functional | Single label upload + verify works end-to-end |
| E-002 | Functional | All 7 mandatory fields are extracted and compared |
| E-003 | Functional | Government warning gets strict text verification |
| E-004 | Functional | Government warning header format is checked (caps/bold) |
| E-005 | Functional | Fuzzy matching handles case/punctuation differences (Dave scenario) |
| E-006 | Functional | Results display as field-by-field checklist |
| E-007 | Performance | Single label verification completes in ≤5 seconds |
| E-008 | UX | Upload + form is obvious with zero instruction needed |
| E-009 | UX | Results use clear color coding (green/amber/red) |
| E-010 | UX | Error states handled gracefully (bad image, API failure) |
| E-011 | Code | README has clear setup + run instructions |
| E-012 | Code | Code is clean, organized, well-typed |
| E-013 | Deploy | Live URL works and is accessible |
| E-014 | Stretch | Batch upload works for multiple labels |
| E-015 | Stretch | Pre-loaded demo data available for evaluators |

### 9.2 Scoring Matrix (How I Think They'll Grade)

| Criteria (from brief) | Weight | What Wins Points |
|------------------------|--------|-----------------|
| Correctness & completeness | 25% | All 7 fields verified, gov warning handled properly, matching logic is sound |
| Code quality & organization | 20% | Clean TypeScript, clear separation of concerns, good naming, tests |
| Appropriate technical choices | 15% | Claude Vision for extraction (smart), Next.js fullstack (appropriate scope), Azure deploy (matches their infra) |
| User experience & error handling | 20% | Checklist UI, color coding, pre-filled warning text, graceful errors, ≤5s response |
| Attention to requirements | 10% | Shows you read the interviews carefully: fuzzy matching, batch upload, simplicity |
| Creative problem-solving | 10% | Pre-loaded demo, intelligent mismatch handling, production-ready architecture notes |

---

## 10. Project Structure

```
ttb-label-verification/
├── README.md                          # Setup, run instructions, approach doc
├── APPROACH.md                        # Detailed approach, tools, assumptions, trade-offs
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── .env.local                         # ANTHROPIC_API_KEY (gitignored)
├── .env.example                       # Template showing required env vars
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (fonts, metadata)
│   │   ├── page.tsx                   # Main page — upload + form + results
│   │   ├── globals.css                # Tailwind base styles
│   │   │
│   │   └── api/
│   │       ├── verify/
│   │       │   └── route.ts           # POST /api/verify — single label verification
│   │       └── verify-batch/
│   │           └── route.ts           # POST /api/verify/batch — batch processing
│   │
│   ├── components/
│   │   ├── LabelUploader.tsx          # Image upload with drag-and-drop
│   │   ├── ApplicationForm.tsx        # Form fields for application data
│   │   ├── VerificationResults.tsx    # Checklist display of results
│   │   ├── FieldResult.tsx            # Individual field pass/fail/warning card
│   │   ├── BatchUploader.tsx          # Batch upload interface
│   │   ├── BatchResults.tsx           # Summary dashboard for batch results
│   │   ├── DemoButton.tsx             # "Try with example data" pre-fill
│   │   └── LoadingState.tsx           # Processing animation
│   │
│   ├── lib/
│   │   ├── extraction.ts             # Claude Vision API call + tool definition
│   │   ├── comparison.ts             # Field matching: matchABV, matchNetContents, fuzzyMatch, addressMatch, strictMatch
│   │   ├── warning-check.ts          # Government warning special verification
│   │   ├── types.ts                  # TypeScript type definitions
│   │   ├── constants.ts              # Standard warning text, field configs
│   │   └── utils.ts                  # Jaro-Winkler similarity, text normalization, word diff helpers
│   │
│   └── test-data/
│       ├── sample-labels/             # Test label images
│       └── sample-applications.json   # Matching application data for test labels
│
└── public/
    └── demo-label.png                 # Pre-loaded demo label image
```

---

## 11. Key Technical Decisions & Trade-offs

### 11.1 Decisions Made

| Decision | Alternative Considered | Why This Choice |
|----------|----------------------|-----------------|
| Claude Vision for OCR | Tesseract, AWS Textract, Google Vision | Best multimodal quality, handles real-world photos, structured extraction via tool_use, directly relevant to role |
| Next.js fullstack | Separate React + FastAPI | Single deploy, simpler for take-home, evaluators can run locally with one command |
| Azure App Service for deployment | Vercel, Railway, AWS | TTB is already on Azure — deploying to their cloud shows attention to stakeholder context and eases production path |
| Client-side form (not CSV upload for single) | Always require structured data upload | Lower barrier to entry. Agents can type in values quickly for single labels |
| Pre-filled gov warning | Require agent to input warning text | Warning text is identical for all beverages — no reason to make agents type it |
| Fuzzy matching for brand names | Strict matching everywhere | Dave explicitly told us case/punctuation differences shouldn't auto-reject |

### 11.2 Documented Trade-offs

| Trade-off | What I Built | What Production Would Need |
|-----------|-------------|--------------------------|
| Authentication | None (prototype) | FedRAMP-compliant auth (likely Azure AD) |
| Data persistence | Stateless (no database) | Audit trail, decision logging, COLA integration |
| AI provider | Claude API (cloud) | On-premise model deployment (network restrictions) |
| Batch processing | Sequential API calls | Queue-based architecture with worker processes |
| Image preprocessing | Rely on Claude Vision's robustness | Dedicated preprocessing pipeline (deskew, denoise, enhance) |
| Beverage type handling | General extraction (all types) | Type-specific validation rules per 27 CFR Parts 4, 5, 7 |

### 11.3 What I'd Build Next (Documented for Brief)

1. **Beverage type detection** — Auto-detect spirits vs wine vs beer and apply type-specific rules
2. **COLA database integration** — Pull application data directly from COLAs Online API
3. **Decision audit trail** — Log every verification decision with agent ID, timestamp, rationale
4. **Historical analytics** — Dashboard showing rejection patterns, common issues, processing times
5. **On-premise AI** — Deploy model behind government firewall for production use
6. **Accessibility audit** — Full WCAG 2.1 AA compliance for government accessibility requirements

---

## 12. Implementation Plan

### Phase 1: Foundation (2 hours)

- [ ] Initialize Next.js project with TypeScript, Tailwind
- [ ] Set up project structure (see Section 10)
- [ ] Define TypeScript types (`types.ts`)
- [ ] Implement constants (`constants.ts` — standard warning text, field configs)
- [ ] Implement text utilities (`utils.ts` — Levenshtein, normalization)
- [ ] Set up `.env.local` with Anthropic API key

### Phase 2: Core Engine (3 hours)

- [ ] Implement Claude Vision extraction (`extraction.ts`)
  - System prompt + tool definition
  - Image-to-structured-data pipeline
  - Error handling for API failures
- [ ] Implement comparison engine (`comparison.ts`)
  - `strictMatch()` — for gov warning text
  - `numericMatch()` — for ABV, net contents
  - `fuzzyMatch()` — for brand name, class/type, address
- [ ] Implement government warning checker (`warning-check.ts`)
  - Text accuracy check
  - Header formatting check (ALL CAPS + BOLD)
  - Presence check
- [ ] Wire up API route (`/api/verify/route.ts`)
  - Accept multipart form data (image + JSON)
  - Call extraction → comparison → return results
  - Add timing measurement

### Phase 3: UI (3 hours)

- [ ] Build `LabelUploader` — drag-and-drop with preview
- [ ] Build `ApplicationForm` — form fields with pre-filled gov warning
- [ ] Build `VerificationResults` — checklist display with color coding
- [ ] Build `FieldResult` — individual card with pass/fail/warning
- [ ] Build `LoadingState` — processing animation with timing
- [ ] Build `DemoButton` — pre-loaded example data
- [ ] Wire up main page flow (upload → form → verify → results)
- [ ] Polish: responsive layout, error states, empty states

### Phase 4: Batch Processing (1.5 hours)

- [ ] Build `BatchUploader` component
- [ ] Implement `/api/verify/batch` route
- [ ] Build `BatchResults` summary view
- [ ] Progress indicator for batch processing

### Phase 5: Test Data & Polish (1.5 hours)

- [ ] Create/generate 5-6 test label images
- [ ] Create matching application data JSON
- [ ] Set up pre-loaded demo data
- [ ] Test all scenarios (happy path, mismatches, edge cases)
- [ ] Verify ≤5 second performance target

### Phase 6: Deploy & Document (1 hour)

- [ ] Deploy to Azure App Service (az webapp up or GitHub Actions CI/CD)
- [ ] Write README (setup, run, approach summary)
- [ ] Write APPROACH.md (detailed approach, tools, assumptions, trade-offs)
- [ ] Final test of deployed URL
- [ ] Push to GitHub

**Total estimated: ~12 hours**

---

## 13. README Outline (For Submission)

```markdown
# TTB Label Verification Tool

AI-powered prototype for verifying alcohol beverage labels against COLA 
application data. Built for the Treasury TTB Compliance Division.

## Quick Start
1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and add your Anthropic API key
4. `npm run dev`
5. Open http://localhost:3000

## Live Demo
[Deployed URL]

## Approach
- Claude Vision API extracts structured fields from label images
- Three-tier matching: strict (gov warning), numeric (ABV), fuzzy (brand names)
- Checklist-style UI designed for compliance agent workflow
- See APPROACH.md for detailed documentation

## Tech Stack
Next.js 14, TypeScript, Tailwind CSS, Claude API (Sonnet), Azure App Service

## Trade-offs & Limitations
[See APPROACH.md — Section on trade-offs]
```

---

## 14. Risk Register

| # | Risk | Likelihood | Impact | Design-Time Prevention | Runtime Mitigation |
|---|------|------------|--------|----------------------|-------------------|
| R1 | Claude Vision extracts fields incorrectly | Medium | High | Test with diverse label styles; tune extraction prompt with examples | Agent always sees extracted value alongside application value — side-by-side comparison lets agent catch extraction errors visually. Confidence score flags low-certainty extractions. |
| R2 | API latency exceeds 5 seconds (Sarah's hard constraint) | Medium | High | Use Sonnet (faster than Opus); compress images client-side before upload; keep prompt minimal | Stream partial UI (show "Extracting..." → "Comparing..." progress steps) so agent perceives responsiveness even at 4+ seconds. Display actual processing time on results. |
| R3 | Fuzzy matching false positive (PASS on a real mismatch) | Medium | High | Conservative similarity threshold (0.85); extensive normalization test cases | WARNING tier for anything below 100% match forces agent review. Both values displayed side-by-side — agent makes final compliance judgment, not the tool. The tool assists, doesn't decide. |
| R4 | Fuzzy matching false negative (FAIL on a trivial difference) | Low | Medium | Aggressive text normalization (case, punctuation, apostrophes, whitespace) | Agent sees both values side-by-side and can visually confirm they match despite the FAIL status. Include "Agent Override" action on each field result so agents like Dave can mark trivial differences as acceptable. |
| R5 | Government warning false pass (misses formatting violation) | Medium | High | Dedicated multi-check verification: separate checks for text accuracy, header capitalization, header bold, and presence — not a single fuzzy match | Each sub-check reported independently. Even if text matches, header format is flagged separately. Jenny's title-case scenario gets caught by the capitalization sub-check even if content is correct. |
| R6 | Anthropic API outage or rate limiting | Low | Critical | N/A (external dependency) | Graceful error state: clear message ("Verification service temporarily unavailable — please try again in a few minutes") instead of a crash. Log failures for monitoring. For prototype scope, no fallback OCR — document this as a production consideration. |
| R7 | Oversized or unsupported image upload (20MB TIFF, multi-page PDF) | Medium | Low | Document supported formats (JPG, PNG, PDF single-page) and max file size in UI | Client-side validation: check file type and size before upload. Clear error message with supported formats listed. Reject gracefully, don't send to API. |
| R8 | Azure App Service cold start latency | Low | Low | Use Basic tier (always-on) or configure health check ping | First request may be slow — subsequent requests are fast. Not a major concern for prototype evaluation. |
| R9 | Evaluator doesn't have Anthropic API key for local run | Medium | Low | N/A | Deployed URL is the primary demo. README clearly notes API key requirement for local development. |

---

## 15. Differentiation — Why This Stands Out

### Technical Signals
- **Claude Vision + tool_use** for structured extraction — not basic OCR
- **Three-tier matching logic** (strict/numeric/fuzzy) — shows understanding of domain nuance
- **Government warning deep verification** — not just text match but format checks
- **Clean TypeScript with proper types** — professional engineering

### Domain Signals
- **Read the interviews carefully** — fuzzy matching directly addresses Dave's scenario
- **Pre-filled government warning** — shows you know the ABLA (warning text is always identical)
- **Checklist UI** — mirrors Jenny's current workflow
- **5-second target** — directly addresses Sarah's hard requirement

### Product Thinking
- **Pre-loaded demo data** — evaluator can test immediately without setup
- **Documented trade-offs** — shows you know what production needs vs prototype scope
- **"What I'd build next" section** — demonstrates systems thinking beyond the assignment
- **Batch processing** — addresses a named stakeholder's (Janet) multi-year request

---

*This document is the source of truth for the TTB Label Verification take-home project. Edit directly; do not create copies.*
