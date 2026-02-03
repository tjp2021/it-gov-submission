# Alternative Architecture: OCR + Text Classification

## Why This Document Exists

During performance optimization, we identified that our current architecture uses Claude Vision for two distinct tasks that could be separated for better performance. This document explains an alternative approach that could significantly reduce latency.

---

## What is OCR?

**OCR (Optical Character Recognition)** is technology that extracts text from images. It's been a solved problem for decades.

```
Image of text → OCR → Plain text string
```

**Examples:**
- **Tesseract** — Open source, Google-maintained, runs locally (~100-500ms)
- **Apple Vision Framework** — On-device iOS/macOS (~50-200ms)
- **Google Cloud Vision** — Cloud API (~200-500ms)
- **AWS Textract** — Cloud API (~300-600ms)

OCR doesn't understand *meaning* — it just reads characters. It would extract:

```
"OLD TOM DISTILLERY Kentucky Straight Bourbon Whiskey 45% Alc./Vol.
(90 Proof) 750 mL Old Tom Distillery, Louisville, Kentucky GOVERNMENT
WARNING: (1) According to the Surgeon General..."
```

But it doesn't know which part is the brand name vs. the ABV vs. the warning.

---

## Current Architecture (Claude Vision)

```
┌─────────────┐      ┌─────────────────────────────────┐      ┌──────────────┐
│ Label Image │ ───► │ Claude Vision (claude-sonnet-4) │ ───► │ Structured   │
│   (100KB)   │      │                                 │      │ Fields JSON  │
└─────────────┘      │ Does TWO jobs:                  │      └──────────────┘
                     │ 1. Read text from image (OCR)   │
                     │ 2. Identify which text is what  │
                     │                                 │
                     │ Time: ~5 seconds                │
                     └─────────────────────────────────┘
```

**Problem:** We're using a $15/million-token multimodal model to do a job that Tesseract does for free in 200ms.

---

## Proposed Architecture (OCR + Text Classification)

```
┌─────────────┐      ┌─────────────┐      ┌──────────────────────┐      ┌──────────────┐
│ Label Image │ ───► │ OCR Engine  │ ───► │ Claude Text-Only     │ ───► │ Structured   │
│   (100KB)   │      │ (Tesseract) │      │ (claude-haiku)       │      │ Fields JSON  │
└─────────────┘      │             │      │                      │      └──────────────┘
                     │ Job: Read   │      │ Job: Classify which  │
                     │ ALL text    │      │ text is which field  │
                     │             │      │                      │
                     │ Time: ~200ms│      │ Time: ~500ms-1s      │
                     └─────────────┘      └──────────────────────┘

                     Total: ~700ms - 1.5s (vs 5s currently)
```

### Step 1: OCR Extracts Raw Text

Input: Label image
Output: All text found on the label

```
"OLD TOM DISTILLERY Kentucky Straight Bourbon Whiskey 45% Alc./Vol.
(90 Proof) 750 mL Old Tom Distillery, Louisville, Kentucky GOVERNMENT
WARNING: (1) According to the Surgeon General, women should not drink
alcoholic beverages during pregnancy because of the risk of birth
defects. (2) Consumption of alcoholic beverages impairs your ability
to drive a car or operate machinery, and may cause health problems."
```

### Step 2: Claude Classifies the Text

We send the raw text (NOT the image) to Claude with a prompt like:

```
Given this text extracted from an alcohol label, identify:
- Brand Name
- Class/Type
- Alcohol Content
- Net Contents
- Producer Name & Address
- Government Warning

Text:
"""
OLD TOM DISTILLERY Kentucky Straight Bourbon Whiskey 45% Alc./Vol.
(90 Proof) 750 mL Old Tom Distillery, Louisville, Kentucky GOVERNMENT
WARNING: (1) According to the Surgeon General...
"""
```

Claude responds with structured JSON — but processes in ~500ms-1s because:
1. No image to tokenize/process
2. Much smaller input (text vs image tokens)
3. Can use Haiku (fast) since it's just text classification

### Step 3: Compare Fields (Unchanged)

Our existing comparison logic works exactly the same.

---

## Why This Is Faster

| Step | Current | Proposed |
|------|---------|----------|
| Image → Tokens | ~1-2s (Claude tokenizes image) | 0s (not needed) |
| Visual Processing | ~2-3s (Claude "reads" image) | ~200ms (OCR) |
| Field Identification | ~1s (part of Claude Vision) | ~500ms-1s (Claude text) |
| **Total** | **~5s** | **~700ms-1.5s** |

**Why is text-only Claude faster?**
- Text input: ~500 tokens for a label's text
- Image input: ~1,500+ tokens for a small image (images are expensive)
- Claude processes text much faster than images

---

## Trade-offs

### Pros
- **3-5x faster** latency
- **Cheaper** — text tokens cost less than image tokens
- **Can use Haiku** — text classification doesn't need Sonnet's power
- **More debuggable** — can inspect OCR output separately from classification

### Cons
- **Two failure points** — OCR could fail, then Claude could fail
- **OCR quality varies** — poor photos may produce garbled text
- **Lost visual context** — Claude can't see layout, font sizes, bold text
- **Government warning bold check** — currently we check if header "appears bold" (vision). With OCR, we lose this entirely.

### The Bold Check Problem

Current approach: Claude Vision reports `APPEARS_BOLD_OR_HEAVY` based on visual inspection.

OCR approach: We only get text, not formatting. Options:
1. **Drop bold check** — accept that we can't detect it
2. **Keep Vision for warning only** — hybrid: OCR for text, Vision just for bold check
3. **Use OCR that preserves some formatting** — some OCR engines report font weight (limited)

---

## OCR Options

### Server-Side (Node.js)

**Tesseract.js** — Port of Tesseract to JavaScript
```javascript
const Tesseract = require('tesseract.js');
const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
```
- Free, runs locally
- ~500ms-2s depending on image size
- Good accuracy on clear text

**Google Cloud Vision API**
```javascript
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();
const [result] = await client.textDetection(imageBuffer);
```
- ~200-500ms
- Very accurate
- Costs money ($1.50 per 1000 images)

### Client-Side (Browser)

**Tesseract.js in browser**
- Works but slower (~2-5s)
- Runs on user's device

**Native APIs (if we build native app)**
- Apple Vision: ~50-200ms, excellent accuracy
- Google ML Kit: ~100-300ms, excellent accuracy

---

## Implementation Plan

If we proceed with this approach:

### Phase 1: Spike (2 hours)
1. Add Tesseract.js to the project
2. Create `/api/verify-ocr` endpoint
3. Test latency and accuracy on our test suite
4. Compare results to current approach

### Phase 2: Decision
- If OCR approach is faster AND accurate enough → migrate
- If accuracy suffers → stay with Claude Vision or hybrid

### Phase 3: Migration (if proceeding)
1. Replace `extractLabelFields()` with two-step process
2. Update prompts for text classification
3. Decide on bold detection strategy
4. Update tests

---

## Recommendation

**Spike it before committing.** The theory is sound, but we need to verify:

1. Does Tesseract accurately read alcohol labels? (curved text, fancy fonts, small government warning)
2. Can Claude Haiku reliably classify the fields from raw text?
3. What's the actual end-to-end latency?

If the spike shows <2s latency with comparable accuracy, migrate. If not, we've learned something and stay with current approach.

---

## Questions to Resolve

1. **Bold detection** — Do we care enough to keep it? (Could argue it's always "agent review" anyway)
2. **OCR engine choice** — Tesseract (free, local) vs Cloud Vision (fast, costs money)?
3. **Error handling** — What if OCR returns garbage? Fallback to Claude Vision?
4. **Hybrid option** — OCR for most fields, Vision only for warning formatting check?
