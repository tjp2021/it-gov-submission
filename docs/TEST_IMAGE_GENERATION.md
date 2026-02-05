# Test Image Generation Strategy

## Decision: AI Generation → Programmatic Compositing

**Date:** February 4, 2026
**Status:** Implemented

---

## Problem Statement

We need realistic bottle photos for testing the TTB Label Verification system. These photos must:

1. Contain **exact, known text** (brand name, ABV, government warning)
2. Simulate real-world conditions (lighting variations)
3. Allow verification of PASS/FAIL accuracy, not just OCR robustness

---

## Why AI Image Generation Failed

### DALL-E 3

| Issue | Impact |
|-------|--------|
| **Garbled text** | Generates made-up text ("KENNTUCKKY", "455%", "NET COTNGTENSATIED") |
| **No reference support** | Cannot preserve text from input image |
| **Government warning impossible** | 50+ word text never renders correctly |

### Ideogram 3.0 Remix (even at 100% strength)

| Issue | Impact |
|-------|--------|
| **Still garbles text** | "Kentucky" → "Whiskoy", "Alc./Vol." → "Ale./Vol." |
| **Preserves layout, not characters** | Visual style preserved but letters change |
| **Government warning still broken** | "women should not drink" → "women chculd net drink" |

### Root Cause

**AI image generation fundamentally cannot preserve exact text.** Models learn visual patterns, not character sequences. Even "reference-preserving" features re-render text based on what the model "thinks" letters should look like.

---

## Solution: Programmatic Compositing

Instead of AI, we use **Sharp** to programmatically composite our clean labels onto a bottle template.

### How It Works

```
Blank Bottle Template     +     Clean Label PNG     =     Realistic Bottle
┌─────────────────────┐         ┌──────────────┐         ┌─────────────────────┐
│                     │         │ OLD TOM      │         │                     │
│     [empty glass    │    +    │ DISTILLERY   │    =    │   [bottle with      │
│      bottle]        │         │ 45% ABV      │         │    EXACT label      │
│                     │         │ GOVT WARNING │         │    text visible]    │
└─────────────────────┘         └──────────────┘         └─────────────────────┘
      (AI-generated)                (our source)              (programmatic)
```

### Benefits

| Feature | Result |
|---------|--------|
| **100% text preservation** | Character-for-character accuracy |
| **Controlled variations** | Brightness, warmth, contrast |
| **Fast generation** | ~0.5s per image (no API calls) |
| **Free** | No API costs |
| **Reproducible** | Same input = same output |

---

## Implementation

### Bottle Template

Generated ONCE with DALL-E (no text needed):
- Prompt: "blank whiskey bottle with NO label, NO text"
- Location: `src/test-data/sample-labels/bottle-template.png`

### Compositing Script

```bash
# Generate all bottle photos (72 images)
node scripts/composite-labels.js

# Generate for specific label
node scripts/composite-labels.js path/to/label.png
```

### Output Structure

Location: `src/test-data/sample-labels/real/`

| Scenario | Effect | Tests |
|----------|--------|-------|
| `clean` | No modification | Baseline accuracy |
| `bright` | +15% brightness | Overexposed photos |
| `dim` | -30% brightness | Underexposed photos |
| `warm` | Increased saturation | Color cast |

---

## Test Image Summary

| Location | Count | Text Accuracy | Purpose |
|----------|-------|---------------|---------|
| `automated/basic/` | 6 | 100% (source) | Core verification |
| `automated/intermediate/` | 4 | 100% (source) | Unit conversion |
| `automated/stress/` | 8 | 100% (source) | Edge cases |
| `real/` | 72 | 100% (composited) | Realistic bottles |

**Total: 90 test images with 100% text accuracy**

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/composite-labels.js` | Main compositing (labels → bottles) |
| `scripts/degrade-labels.js` | Add blur/glare/angle to flat labels |
| `scripts/generate-bottle-photos.js` | (Legacy) AI generation - not recommended |

---

## Key Learning

**Never rely on AI image generation for text-critical testing.**

AI models are trained on visual patterns, not character sequences. Even "text-preserving" features like Ideogram Remix or high-strength settings will introduce errors. For testing systems that verify exact text (like TTB label verification), use:

1. **Synthetic labels** with known text (our `automated/` folder)
2. **Programmatic compositing** for realistic contexts
3. **Programmatic degradation** (blur, brightness) for OCR stress testing

This approach guarantees text accuracy while still producing realistic test images.
