# TTB Label Verification — Final Implementation Plan

> **Date:** February 5, 2026  
> **Owner:** Timothy Joo  
> **Total Estimated Time:** ~6 hours  
> **Priority:** Ship in this order. Stop at any point and you have a working, improved product.

---

## Overview — Four Workstreams

| # | Workstream | Time | Why This Order |
|---|-----------|------|---------------|
| 1 | Test Labels (HTML-rendered) | 30 min | Everything downstream depends on reliable test data |
| 2 | Gov Warning Architecture Fix | 1.5 hr | Fixes the core product bug — PASS becomes reachable |
| 3 | Demo Button (pre-loaded data) | 30 min | Evaluator first impression — click and see it work |
| 4 | Batch Refinement | 3 hr | Named stakeholder requirement, already partially built |

**Rule:** Complete each workstream fully before starting the next. Each one is independently shippable.

---

## Workstream 1: HTML Test Labels (30 min)

### Why First

Your AI-generated labels have garbled text. Every downstream test — gov warning extraction, batch demo, the live URL — depends on labels where you *know* the ground truth. Fix the foundation first.

### Tasks

#### 1.1 — Create test label HTML templates (15 min)

Create a file `test-labels/generate-labels.html` (or use a simple script). You need **5 labels** covering key scenarios:

| # | Filename | Scenario | Key Test |
|---|----------|----------|----------|
| 1 | `bourbon-perfect.png` | All fields correct, clean layout | Happy path → PASS |
| 2 | `bourbon-case-mismatch.png` | Brand "STONE'S THROW" (app has "Stone's Throw") | Dave scenario → fuzzy PASS |
| 3 | `wine-wrong-abv.png` | Label says 14.5%, app says 13.5% | Numeric FAIL |
| 4 | `beer-titlecase-warning.png` | "Government Warning:" not ALL CAPS | Jenny scenario → caps FAIL |
| 5 | `import-vodka-complete.png` | All fields + country of origin | Full field coverage |

**How to create each label:**

```html
<!-- bourbon-perfect.html — render in browser, screenshot at 2x -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f0; }
    .label {
      width: 500px;
      margin: 40px auto;
      padding: 30px;
      border: 2px solid #2c1810;
      background: #fffef8;
      font-family: 'Georgia', serif;
    }
    .brand { 
      text-align: center; 
      font-size: 28px; 
      font-weight: bold; 
      letter-spacing: 3px;
      color: #2c1810;
      margin-bottom: 8px;
    }
    .class-type {
      text-align: center;
      font-size: 16px;
      font-style: italic;
      color: #5a3e2b;
      margin-bottom: 16px;
    }
    .details {
      text-align: center;
      font-size: 14px;
      color: #333;
      margin-bottom: 6px;
    }
    .divider {
      border: none;
      border-top: 1px solid #ccc;
      margin: 16px 0;
    }
    .warning {
      font-size: 8.5px;
      line-height: 1.4;
      color: #333;
      margin-bottom: 12px;
    }
    .warning-header {
      font-weight: bold;
      text-transform: uppercase;
    }
    .producer {
      font-size: 10px;
      text-align: center;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="brand">OLD TOM DISTILLERY</div>
    <div class="class-type">Kentucky Straight Bourbon Whiskey</div>
    <div class="details">45% Alc./Vol. (90 Proof)</div>
    <div class="details">750 mL</div>
    <hr class="divider">
    <div class="warning">
      <span class="warning-header">GOVERNMENT WARNING:</span>
      (1) According to the Surgeon General, women should not drink
      alcoholic beverages during pregnancy because of the risk of birth defects.
      (2) Consumption of alcoholic beverages impairs your ability to drive a car
      or operate machinery, and may cause health problems.
    </div>
    <div class="producer">
      Bottled by Old Tom Distillery, Louisville, KY 40202
    </div>
  </div>
</body>
</html>
```

For label #4 (beer-titlecase-warning), change the warning header to:
```html
<span class="warning-header" style="text-transform: none;">Government Warning:</span>
```

#### 1.2 — Screenshot each label (5 min)

Open each HTML in browser. Set viewport to ~600px wide. Screenshot at 2x resolution (Cmd+Shift+4 on Mac, or use Chrome DevTools device toolbar at 2x DPR). Save as PNG.

**Alternative — script it:**
```bash
# If you have playwright or puppeteer installed:
npx playwright screenshot bourbon-perfect.html bourbon-perfect.png --viewport-size=600,800 --device-scale-factor=2
```

#### 1.3 — Create matching application data (5 min)

Update `src/test-data/sample-applications.json`:

```json
{
  "bourbon-perfect": {
    "brandName": "OLD TOM DISTILLERY",
    "classType": "Kentucky Straight Bourbon Whiskey",
    "alcoholContent": "45% Alc./Vol. (90 Proof)",
    "netContents": "750 mL",
    "nameAddress": "Old Tom Distillery, Louisville, KY 40202",
    "countryOfOrigin": "",
    "governmentWarning": "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
  },
  "bourbon-case-mismatch": {
    "brandName": "Stone's Throw",
    "classType": "Kentucky Straight Bourbon Whiskey",
    "alcoholContent": "43% Alc./Vol. (86 Proof)",
    "netContents": "750 mL",
    "nameAddress": "Stone's Throw Distillery, Frankfort, KY 40601",
    "countryOfOrigin": "",
    "governmentWarning": "..."
  },
  "wine-wrong-abv": {
    "brandName": "NAPA VALLEY RESERVE",
    "classType": "Cabernet Sauvignon",
    "alcoholContent": "13.5% Alc./Vol.",
    "netContents": "750 mL",
    "nameAddress": "Napa Valley Wines, Napa, CA 94558",
    "countryOfOrigin": "",
    "governmentWarning": "..."
  },
  "beer-titlecase-warning": {
    "brandName": "PACIFIC COAST BREWING",
    "classType": "India Pale Ale",
    "alcoholContent": "6.8% Alc./Vol.",
    "netContents": "12 FL. OZ.",
    "nameAddress": "Pacific Coast Brewing Co., Oakland, CA 94612",
    "countryOfOrigin": "",
    "governmentWarning": "..."
  },
  "import-vodka-complete": {
    "brandName": "CRYSTAL FROST",
    "classType": "Vodka",
    "alcoholContent": "40% Alc./Vol. (80 Proof)",
    "netContents": "750 mL",
    "nameAddress": "Imported by Euro Spirits LLC, New York, NY 10001",
    "countryOfOrigin": "Poland",
    "governmentWarning": "..."
  }
}
```

#### 1.4 — Smoke test (5 min)

Run your app locally. Upload `bourbon-perfect.png` with matching application data. Verify:
- All fields extracted correctly
- Gov warning text matches word-for-word
- No garbled text

If this works, your extraction layer is solid and all remaining work is reliable.

**Done gate:** 5 PNG labels in `src/test-data/sample-labels/`, matching JSON in `sample-applications.json`, bourbon-perfect returns all PASS on automated checks.

---

## Workstream 2: Gov Warning Architecture Fix (1.5 hours)

### Dependency: Workstream 1 complete (need reliable test labels to verify the fix)

### Tasks

#### 2.1 — Update types (10 min)

**File:** `src/lib/types.ts`

Add `category` to `FieldResult`:

```typescript
// ADD to existing FieldResult interface
interface FieldResult {
  fieldName: string;
  applicationValue: string;
  extractedValue: string | null;
  status: "PASS" | "FAIL" | "WARNING" | "NOT_FOUND" | "OVERRIDDEN";
  category: "automated" | "confirmation";  // ← NEW
  matchType: "strict" | "numeric" | "fuzzy" | "abv" | "volume" | "address";
  confidence: number;
  details: string;
  agentOverride?: {
    action: "accepted" | "confirmed_issue";
    timestamp: string;
  };
}
```

Add `PendingConfirmation` interface:

```typescript
// NEW interface
interface PendingConfirmation {
  id: string;
  label: string;
  description: string;
  aiAssessment: string;
  confirmed: boolean;
  confirmedAt?: string;
}
```

Update `VerificationResult`:

```typescript
interface VerificationResult {
  overallStatus: "PASS" | "FAIL" | "REVIEW";
  pendingConfirmations: PendingConfirmation[];  // ← NEW
  processingTimeMs: number;
  extractedFields: ExtractedFields;
  fieldResults: FieldResult[];
}
```

#### 2.2 — Tag all existing field results with `category: "automated"` (10 min)

**File:** `src/lib/comparison.ts`

Every place you construct a `FieldResult` for brand name, ABV, net contents, class/type, address, country of origin — add `category: "automated"`.

This is mechanical — find every `return { fieldName:...` or `results.push({...` and add the field. Don't change any logic.

#### 2.3 — Update warning-check.ts (15 min)

**File:** `src/lib/warning-check.ts`

Three changes:

**a)** Tag the three automatable checks as `category: "automated"`:
- "Gov Warning — Present"
- "Gov Warning — Header Caps"  
- "Gov Warning — Text Accuracy"

**b)** Tag the bold check as `category: "confirmation"`:
```typescript
results.push({
  fieldName: "Gov Warning — Header Bold",
  status: "WARNING",
  category: "confirmation",  // ← KEY CHANGE
  // ... rest stays the same
});
```

**c)** Store the AI's bold assessment for the confirmation UI:
```typescript
// The AI assessment string to show in the confirmation panel
const boldAssessment = extracted.government_warning_header_emphasis === "APPEARS_BOLD_OR_HEAVY"
  ? "AI assessment: Header appears visually emphasized"
  : extracted.government_warning_header_emphasis === "UNCERTAIN"
    ? "AI assessment: Could not determine from image"
    : "AI assessment: Header does not appear bold — verify carefully";
```

#### 2.4 — Update status aggregation (10 min)

**File:** wherever `computeOverallStatus()` lives (likely `src/lib/comparison.ts` or `src/app/api/verify/route.ts`)

```typescript
function computeOverallStatus(fieldResults: FieldResult[]): {
  overallStatus: "PASS" | "FAIL" | "REVIEW";
  pendingConfirmations: PendingConfirmation[];
} {
  const automated = fieldResults.filter(r => r.category === "automated");
  const confirmations = fieldResults.filter(r => r.category === "confirmation");

  const hasUnresolvedFail = automated.some(
    r => r.status === "FAIL" && !r.agentOverride
  );
  const hasWarningOrNotFound = automated.some(
    r => r.status === "WARNING" || r.status === "NOT_FOUND"
  );

  let overallStatus: "PASS" | "FAIL" | "REVIEW";
  if (hasUnresolvedFail) overallStatus = "FAIL";
  else if (hasWarningOrNotFound) overallStatus = "REVIEW";
  else overallStatus = "PASS";

  const pendingConfirmations: PendingConfirmation[] = confirmations.map(r => ({
    id: r.fieldName,
    label: "Bold Formatting",
    description: "Verify that 'GOVERNMENT WARNING:' header appears in bold on the label",
    aiAssessment: r.details,
    confirmed: false,
  }));

  return { overallStatus, pendingConfirmations };
}
```

#### 2.5 — Update API response (5 min)

**File:** `src/app/api/verify/route.ts`

Wire the new return shape:

```typescript
const { overallStatus, pendingConfirmations } = computeOverallStatus(fieldResults);

return Response.json({
  overallStatus,
  pendingConfirmations,
  processingTimeMs: Date.now() - startTime,
  extractedFields,
  fieldResults,
});
```

#### 2.6 — Build confirmation UI component (20 min)

**File:** `src/components/AgentConfirmation.tsx` (NEW)

```tsx
interface AgentConfirmationProps {
  confirmations: PendingConfirmation[];
  onConfirm: (id: string, confirmed: boolean) => void;
}

export function AgentConfirmation({ confirmations, onConfirm }: AgentConfirmationProps) {
  if (confirmations.length === 0) return null;

  return (
    <div className="mt-6 border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-blue-900 mb-3">
        🔲 Agent Confirmation Required
      </h3>
      {confirmations.map(c => (
        <label key={c.id} className="flex items-start gap-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={c.confirmed}
            onChange={(e) => onConfirm(c.id, e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600"
          />
          <div>
            <div className="font-medium text-gray-900">
              I confirm the "GOVERNMENT WARNING:" header appears in BOLD on the label
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {c.aiAssessment}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}
```

#### 2.7 — Integrate into VerificationResults (15 min)

**File:** `src/components/VerificationResults.tsx`

Two changes:

**a)** Filter out confirmation-category results from the main checklist:

```tsx
const automatedResults = fieldResults.filter(r => r.category === "automated");
// Render automatedResults in the existing checklist — NOT all fieldResults
```

**b)** Add the confirmation component after the checklist:

```tsx
<div>
  {/* Existing: overall status badge */}
  <StatusBadge status={overallStatus} />
  
  {/* Existing: automated field results checklist */}
  {automatedResults.map(r => <FieldResult key={r.fieldName} result={r} />)}
  
  {/* NEW: confirmation section */}
  <AgentConfirmation 
    confirmations={pendingConfirmations}
    onConfirm={handleConfirm}
  />
</div>
```

**c)** Update the summary count to say "8/8 automated checks passed" not "8/9":

```tsx
const passCount = automatedResults.filter(r => r.status === "PASS").length;
const totalAuto = automatedResults.length;
// Display: `${passCount}/${totalAuto} automated checks passed`
```

#### 2.8 — Update export JSON (5 min)

**File:** wherever your export function lives

Add `pendingConfirmations` to the export output and update summary counts:

```typescript
{
  exportedAt: new Date().toISOString(),
  overallStatus,
  pendingConfirmations,
  fieldResults,
  summary: {
    totalAutomatedFields: automated.length,
    passed: automated.filter(r => r.status === "PASS").length,
    failed: automated.filter(r => r.status === "FAIL").length,
    warnings: automated.filter(r => r.status === "WARNING").length,
    confirmationsPending: pendingConfirmations.filter(c => !c.confirmed).length,
  }
}
```

#### 2.9 — Remove test workaround (5 min)

Find and delete the PASS/REVIEW workaround in your tests:

```typescript
// DELETE THIS ENTIRE BLOCK:
if (expected === 'PASS' && actual === 'REVIEW') {
  const nonBoldWarnings = fieldResults.filter(
    f => f.status === 'WARNING' && f.fieldName !== 'Gov Warning — Header Bold'
  );
  if (nonBoldWarnings.length === 0) {
    result.passed = true;
  }
}
```

Tests should now expect `PASS` and get `PASS` for perfect labels.

#### 2.10 — Verify (5 min)

Run locally. Upload `bourbon-perfect.png`. Verify:
- Overall status shows **PASS** (not REVIEW)
- All 8 automated checks show in the checklist as PASS
- Bold confirmation appears as a separate checkbox section
- Clicking the checkbox updates the confirmation state

**Done gate:** Perfect label returns PASS. Bad label returns FAIL. Bold confirmation is a separate UX element.

---

## Workstream 3: Demo Button (30 min)

### Dependency: Workstreams 1 + 2 complete (demo needs reliable labels and the fix to show PASS)

### Why This Matters

The evaluator hits your URL. They see a blank form. They don't have a label image. They leave. **Game over.**

A "Try with example data" button that pre-loads an image + form data and runs verification in one click is the single highest-ROI UX feature you can add.

### Tasks

#### 3.1 — Add demo label to public directory (5 min)

Copy `bourbon-perfect.png` to `public/demo-label.png`.

#### 3.2 — Create demo data constant (5 min)

**File:** `src/lib/constants.ts` (or new file `src/lib/demo-data.ts`)

```typescript
export const DEMO_APPLICATION_DATA: ApplicationData = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  nameAddress: "Old Tom Distillery, Louisville, KY 40202",
  countryOfOrigin: "",
  governmentWarning: STANDARD_WARNING_TEXT,  // Already pre-filled
};

export const DEMO_LABEL_PATH = "/demo-label.png";
```

#### 3.3 — Build/update DemoButton component (15 min)

**File:** `src/components/DemoButton.tsx`

```tsx
interface DemoButtonProps {
  onLoadDemo: (image: File, applicationData: ApplicationData) => void;
  loading: boolean;
}

export function DemoButton({ onLoadDemo, loading }: DemoButtonProps) {
  const handleClick = async () => {
    // Fetch the demo label from public directory
    const response = await fetch(DEMO_LABEL_PATH);
    const blob = await response.blob();
    const file = new File([blob], "demo-label.png", { type: "image/png" });
    
    onLoadDemo(file, DEMO_APPLICATION_DATA);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full py-3 px-4 bg-blue-50 border-2 border-blue-200 
                 rounded-lg text-blue-700 font-medium hover:bg-blue-100 
                 transition-colors"
    >
      🚀 Try with example data — see it in action
    </button>
  );
}
```

#### 3.4 — Wire into main page (5 min)

**File:** `src/app/page.tsx`

Add the DemoButton above or below the upload area. When clicked, it should:
1. Pre-fill the form with `DEMO_APPLICATION_DATA`
2. Set the label image to the demo label
3. Optionally: auto-trigger verification (so the evaluator sees results immediately)

Auto-triggering is the power move — one click, 3 seconds later they see a full PASS result with the confirmation checkbox. That's the "wow" moment.

**Done gate:** Hit deployed URL → click "Try with example data" → see PASS result in <5 seconds. Zero friction.

---

## Workstream 4: Batch Refinement (3 hours)

### Dependency: Workstreams 1-3 complete (batch uses the same extraction + comparison + status logic)

### Current State

You said basic batch exists. I'm assuming you have:
- `/api/verify/batch` route (some form)
- `BatchUploader.tsx` component (some form)
- `BatchResults.tsx` component (some form)

The refinement adds: CSV upload option, proper image-to-application matching, summary dashboard, and drill-down.

### Tasks

#### 4.1 — Define batch CSV format (5 min)

**File:** `src/lib/types.ts`

```typescript
interface BatchApplicationRow {
  image_filename: string;  // Matches uploaded file name
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  nameAddress: string;
  countryOfOrigin?: string;
  // governmentWarning intentionally excluded — always pre-filled
}

interface BatchResult {
  batchId: string;
  processingTimeMs: number;
  results: BatchLabelResult[];
  summary: BatchSummary;
}

interface BatchLabelResult {
  label: string;          // Brand name or filename for display
  imageFilename: string;
  result: VerificationResult | { error: string };
}

interface BatchSummary {
  total: number;
  passed: number;
  failed: number;
  review: number;
  errors: number;
}
```

#### 4.2 — Build CSV parser utility (15 min)

**File:** `src/lib/csv-parser.ts` (NEW)

```typescript
// Use papaparse or hand-roll — it's simple CSV
// npm install papaparse @types/papaparse

import Papa from 'papaparse';

const REQUIRED_COLUMNS = [
  'image_filename', 'brandName', 'classType', 
  'alcoholContent', 'netContents', 'nameAddress'
];

export function parseApplicationCSV(csvText: string): {
  data: BatchApplicationRow[];
  errors: string[];
} {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const errors: string[] = [];

  // Validate required columns exist
  const headers = result.meta.fields || [];
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      errors.push(`Missing required column: ${col}`);
    }
  }

  if (errors.length > 0) return { data: [], errors };

  // Validate each row
  const data: BatchApplicationRow[] = result.data.map((row: any, i: number) => {
    if (!row.image_filename?.trim()) {
      errors.push(`Row ${i + 1}: missing image_filename`);
    }
    if (!row.brandName?.trim()) {
      errors.push(`Row ${i + 1}: missing brandName`);
    }
    return {
      image_filename: row.image_filename?.trim() || '',
      brandName: row.brandName?.trim() || '',
      classType: row.classType?.trim() || '',
      alcoholContent: row.alcoholContent?.trim() || '',
      netContents: row.netContents?.trim() || '',
      nameAddress: row.nameAddress?.trim() || '',
      countryOfOrigin: row.countryOfOrigin?.trim() || '',
    };
  });

  return { data, errors };
}
```

#### 4.3 — Build image-to-application matcher (10 min)

**File:** `src/lib/batch-matcher.ts` (NEW)

```typescript
export function matchImagesToApplications(
  images: File[],
  applications: BatchApplicationRow[]
): { matched: MatchedPair[]; errors: string[] } {
  const errors: string[] = [];
  const matched: MatchedPair[] = [];

  for (const app of applications) {
    const image = images.find(
      img => img.name.toLowerCase() === app.image_filename.toLowerCase()
    );
    if (!image) {
      errors.push(`No image file found matching "${app.image_filename}"`);
      continue;
    }
    matched.push({ image, application: app });
  }

  // Check for unmatched images
  const matchedFilenames = new Set(matched.map(m => m.image.name.toLowerCase()));
  for (const img of images) {
    if (!matchedFilenames.has(img.name.toLowerCase())) {
      errors.push(`Image "${img.name}" has no matching row in application data`);
    }
  }

  return { matched, errors };
}

interface MatchedPair {
  image: File;
  application: BatchApplicationRow;
}
```

#### 4.4 — Refine batch API route (30 min)

**File:** `src/app/api/verify-batch/route.ts`

```typescript
import { verifySingleLabel } from '../verify/route';  // or wherever your core verify lives

const MAX_BATCH_SIZE = 10;

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    
    // Extract images
    const images: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image_') && value instanceof File) {
        images.push(value);
      }
    }
    
    // Extract application data (JSON string or CSV string)
    const applicationsRaw = formData.get('applications') as string;
    const applicationsFormat = formData.get('format') as string; // 'json' or 'csv'
    
    let applications: BatchApplicationRow[];
    
    if (applicationsFormat === 'csv') {
      const { data, errors } = parseApplicationCSV(applicationsRaw);
      if (errors.length > 0) {
        return Response.json({ error: 'CSV validation failed', details: errors }, { status: 400 });
      }
      applications = data;
    } else {
      applications = JSON.parse(applicationsRaw);
    }

    // Validate batch size
    if (images.length > MAX_BATCH_SIZE) {
      return Response.json(
        { error: `Batch limited to ${MAX_BATCH_SIZE} labels. Received ${images.length}.` },
        { status: 400 }
      );
    }

    // Match images to application data
    const { matched, errors: matchErrors } = matchImagesToApplications(images, applications);
    if (matchErrors.length > 0) {
      return Response.json({ error: 'Matching failed', details: matchErrors }, { status: 400 });
    }

    // Process all labels in parallel
    const results = await Promise.allSettled(
      matched.map(async (pair) => {
        const appData: ApplicationData = {
          ...pair.application,
          governmentWarning: STANDARD_WARNING_TEXT,
        };
        return verifySingleLabel(pair.image, appData);
      })
    );

    // Assemble batch result
    const batchResults: BatchLabelResult[] = results.map((r, i) => ({
      label: matched[i].application.brandName || matched[i].image.name,
      imageFilename: matched[i].image.name,
      result: r.status === 'fulfilled'
        ? r.value
        : { error: r.reason?.message || 'Processing failed' },
    }));

    const summary: BatchSummary = {
      total: batchResults.length,
      passed: batchResults.filter(r => 'overallStatus' in r.result && r.result.overallStatus === 'PASS').length,
      failed: batchResults.filter(r => 'error' in r.result || ('overallStatus' in r.result && r.result.overallStatus === 'FAIL')).length,
      review: batchResults.filter(r => 'overallStatus' in r.result && r.result.overallStatus === 'REVIEW').length,
      errors: batchResults.filter(r => 'error' in r.result).length,
    };

    return Response.json({
      batchId: crypto.randomUUID(),
      processingTimeMs: Date.now() - startTime,
      results: batchResults,
      summary,
    });

  } catch (err: any) {
    return Response.json(
      { error: err.message || 'Batch processing failed' },
      { status: 500 }
    );
  }
}
```

#### 4.5 — Refine BatchUploader component (30 min)

**File:** `src/components/BatchUploader.tsx`

Key UX: two-panel layout. Left = image upload. Right = application data (toggle between form-per-label and CSV upload).

```tsx
export function BatchUploader({ onSubmit }: BatchUploaderProps) {
  const [images, setImages] = useState<File[]>([]);
  const [dataMode, setDataMode] = useState<'manual' | 'csv'>('csv');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [manualData, setManualData] = useState<BatchApplicationRow[]>([]);
  const [matchStatus, setMatchStatus] = useState<string>('');

  // When images are uploaded, show count
  // When CSV is uploaded, parse and validate, show match count
  // "Verify All" button only enabled when images + data match

  return (
    <div className="space-y-6">
      {/* Image upload zone */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setImages(Array.from(e.target.files || []))}
        />
        <p className="text-sm text-gray-500">
          Upload up to 10 label images (JPG, PNG, WebP)
        </p>
        {images.length > 0 && (
          <p className="text-sm font-medium text-green-700 mt-2">
            {images.length} image(s) selected
          </p>
        )}
      </div>

      {/* Data mode toggle */}
      <div className="flex gap-4">
        <button
          onClick={() => setDataMode('csv')}
          className={`px-4 py-2 rounded ${dataMode === 'csv' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
        >
          Upload CSV
        </button>
        <button
          onClick={() => setDataMode('manual')}
          className={`px-4 py-2 rounded ${dataMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
        >
          Enter Manually
        </button>
      </div>

      {/* CSV upload */}
      {dataMode === 'csv' && (
        <div>
          <input
            type="file"
            accept=".csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                setCsvFile(file);
                const text = await file.text();
                const { data, errors } = parseApplicationCSV(text);
                if (errors.length > 0) {
                  setMatchStatus(`CSV errors: ${errors.join(', ')}`);
                } else {
                  setMatchStatus(`${data.length} application records loaded`);
                  setManualData(data);
                }
              }
            }}
          />
          <a href="/sample-batch.csv" download className="text-sm text-blue-600 underline mt-2 block">
            Download sample CSV template
          </a>
        </div>
      )}

      {/* Match status */}
      {matchStatus && (
        <p className="text-sm font-medium">{matchStatus}</p>
      )}

      {/* Verify button */}
      <button
        onClick={() => onSubmit(images, manualData, dataMode === 'csv' ? 'csv' : 'json')}
        disabled={images.length === 0 || manualData.length === 0}
        className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg 
                   hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        ▶ Verify {images.length} Label{images.length !== 1 ? 's' : ''}
      </button>
    </div>
  );
}
```

#### 4.6 — Refine BatchResults component (30 min)

**File:** `src/components/BatchResults.tsx`

Summary dashboard at top, expandable drill-down per label.

```tsx
export function BatchResults({ batchResult }: { batchResult: BatchResult }) {
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);
  const { summary, results, processingTimeMs } = batchResult;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold">{summary.total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
          <div className="text-sm text-gray-500">Passed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
          <div className="text-sm text-gray-500">Failed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600">{summary.review}</div>
          <div className="text-sm text-gray-500">Review</div>
        </div>
        <div className="ml-auto text-sm text-gray-500 self-center">
          Processed in {(processingTimeMs / 1000).toFixed(1)}s
        </div>
      </div>

      {/* Per-label results */}
      {results.map((r, i) => (
        <div key={i} className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedLabel(expandedLabel === r.imageFilename ? null : r.imageFilename)}
            className="w-full p-4 flex items-center gap-3 hover:bg-gray-50"
          >
            {/* Status icon */}
            {'error' in r.result ? (
              <span className="text-red-500">⚠️</span>
            ) : r.result.overallStatus === 'PASS' ? (
              <span>✅</span>
            ) : r.result.overallStatus === 'FAIL' ? (
              <span>❌</span>
            ) : (
              <span>⚠️</span>
            )}

            <span className="font-medium">{r.label}</span>
            
            {'error' in r.result ? (
              <span className="text-sm text-red-500 ml-auto">{r.result.error}</span>
            ) : (
              <span className="text-sm text-gray-500 ml-auto">
                {r.result.fieldResults.filter(f => f.category === 'automated' && f.status === 'PASS').length}/
                {r.result.fieldResults.filter(f => f.category === 'automated').length} checks passed
              </span>
            )}
          </button>

          {/* Expanded detail view — reuse your existing VerificationResults component */}
          {expandedLabel === r.imageFilename && !('error' in r.result) && (
            <div className="border-t p-4">
              <VerificationResults result={r.result} />
            </div>
          )}
        </div>
      ))}

      {/* Export all */}
      <button
        onClick={() => exportBatchResults(batchResult)}
        className="px-4 py-2 border rounded hover:bg-gray-50"
      >
        📋 Export All Results
      </button>
    </div>
  );
}
```

#### 4.7 — Create sample CSV template (5 min)

**File:** `public/sample-batch.csv`

```csv
image_filename,brandName,classType,alcoholContent,netContents,nameAddress,countryOfOrigin
bourbon-perfect.png,OLD TOM DISTILLERY,Kentucky Straight Bourbon Whiskey,"45% Alc./Vol. (90 Proof)",750 mL,"Old Tom Distillery, Louisville, KY 40202",
wine-wrong-abv.png,NAPA VALLEY RESERVE,Cabernet Sauvignon,13.5% Alc./Vol.,750 mL,"Napa Valley Wines, Napa, CA 94558",
import-vodka-complete.png,CRYSTAL FROST,Vodka,"40% Alc./Vol. (80 Proof)",750 mL,"Imported by Euro Spirits LLC, New York, NY 10001",Poland
```

#### 4.8 — Wire batch into main page (15 min)

**File:** `src/app/page.tsx`

Add a toggle or tab between single verification and batch:

```tsx
const [mode, setMode] = useState<'single' | 'batch'>('single');

// In the UI:
<div className="flex gap-2 mb-6">
  <button onClick={() => setMode('single')} className={...}>
    Single Label
  </button>
  <button onClick={() => setMode('batch')} className={...}>
    Batch (up to 10)
  </button>
</div>

{mode === 'single' ? (
  <SingleVerificationFlow />
) : (
  <BatchVerificationFlow />
)}
```

#### 4.9 — Test batch end-to-end (15 min)

1. Upload 3 test label images + matching CSV
2. Verify all 3 process in parallel
3. Verify summary counts are correct
4. Verify drill-down shows individual field results
5. Verify export includes all results
6. Verify total time is roughly equal to single-label time (parallel, not sequential)

**Done gate:** Upload 3+ labels with CSV, see summary dashboard, drill into each, export works.

---

## Workstream 5 (Bonus): APPROACH.md Updates (15 min)

After all workstreams are complete, update APPROACH.md with:

1. **Bold detection section** — add the explanation from the architecture fix PRD (Section 6)
2. **Batch section** — document the 10-label cap and what production would need
3. **Multi-image note** — add to "What I'd Build Next": production would accept front + back photos per label, extract from each, merge results by confidence
4. **Test label approach** — note that you used HTML-rendered labels for reliable ground truth, with guidance that AI-generated label text is unreliable

---

## Final Checklist Before Submission

| # | Check | Status |
|---|-------|--------|
| 1 | `bourbon-perfect.png` → all automated checks PASS | ☐ |
| 2 | `beer-titlecase-warning.png` → caps check FAIL, overall FAIL | ☐ |
| 3 | `wine-wrong-abv.png` → ABV FAIL, overall FAIL | ☐ |
| 4 | Bold confirmation appears as checkbox, separate from checklist | ☐ |
| 5 | Demo button works on deployed URL — one click to full results | ☐ |
| 6 | Batch: 3 images + CSV → summary dashboard + drill-down | ☐ |
| 7 | Single label ≤5 seconds on deployed URL | ☐ |
| 8 | Export JSON includes pendingConfirmations | ☐ |
| 9 | README has clear setup instructions | ☐ |
| 10 | APPROACH.md documents bold decision + batch constraints | ☐ |
| 11 | No test workarounds remaining | ☐ |
| 12 | Deployed URL is live and accessible | ☐ |

---

*Execute in order. Each workstream is independently shippable. Stop at any point and you have a better product than before you started.*
