# Manual Testing Checklist

**Deployed URL:** https://gov-submission.vercel.app

**Test Images Location:** `src/test-data/manual-test-images/`

All 18 test images are numbered to match the checklist. Open the folder in Finder and drag/drop directly to the browser.

## Important: About These Test Images

These are **bottle composite images** — realistic photos with labels rendered on bottles. Due to the small text size on the bottle labels:

- **Gov Warning — Text Accuracy** may FAIL (Gemini Vision can struggle with small/distant text)
- **Gov Warning — Header Bold** will show WARNING (expected — always needs human verification)

This is **realistic behavior** for real-world bottle photos. The automated e2e tests use raw label PNGs with clear text for reliable pass/fail validation.

**Note:** We use Gemini Flash Vision (a VLM), not traditional OCR.

**Standard Government Warning** (copy/paste for all tests):
```
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.
```

---

## Pre-Flight Checks

- [ ] Application loads without errors
- [ ] Form displays all 7 fields (Brand Name, Class/Type, Alcohol Content, Net Contents, Name/Address, Country of Origin, Government Warning)
- [ ] File upload accepts images (PNG, JPG)
- [ ] "Verify Label" button is present and enabled when form is filled

---

## 1. Happy Path - Perfect Match

**Image:** `01-perfect-match.png`
**Expected:** REVIEW or FAIL (due to small text on bottle image)

| Field | Value |
|-------|-------|
| Brand Name | Old Tom Distillery |
| Class/Type | Kentucky Straight Bourbon Whiskey |
| Alcohol Content | 45% Alc./Vol. (90 Proof) |
| Net Contents | 750 mL |
| Name/Address | Old Tom Distillery, Louisville, Kentucky |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Brand Name, Class/Type, Alcohol Content, Net Contents, Name & Address show ✅
- [ ] Country of Origin shows ❓ (not found on label — correct for domestic)
- [ ] Gov Warning — Present shows ✅
- [ ] Gov Warning — Header Caps shows ✅
- [ ] Gov Warning — Header Bold shows ⚠️ WARNING (expected — needs human verification)
- [ ] Gov Warning — Text Accuracy may show ❌ FAIL (small text small text extraction limitation)
- [ ] Processing completes in < 5 seconds

---

## 2. Case Mismatch (Fuzzy Matching)

**Image:** `02-case-mismatch.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify brand matching works**

| Field | Value |
|-------|-------|
| Brand Name | Stone's Throw |
| Class/Type | Small Batch Bourbon Whiskey |
| Alcohol Content | 46% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Stone's Throw Distillery, Frankfort, Kentucky |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Brand Name shows ✅ (label has "STONE'S THROW" — fuzzy match handles case)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## 3. ABV Mismatch - Should FAIL

**Image:** `03-abv-mismatch-FAIL.png`
**Expected:** FAIL — **verify ABV mismatch is detected**

| Field | Value |
|-------|-------|
| Brand Name | Chateau Margaux |
| Class/Type | Cabernet Sauvignon |
| Alcohol Content | 13.5% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Chateau Margaux Winery, Napa, California |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Alcohol Content shows ❌ (label has 14.5%, app has 13.5%)
- [ ] Overall status shows FAIL (ABV mismatch is the key failure here)

---

## 4. Imported Product with Country of Origin

**Image:** `04-imported-product.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify country of origin works**

| Field | Value |
|-------|-------|
| Brand Name | Glenfiddich |
| Class/Type | Single Malt Scotch Whisky |
| Alcohol Content | 40% Alc./Vol. (80 Proof) |
| Net Contents | 750 mL |
| Name/Address | William Grant & Sons, Dufftown, Banffshire, Scotland |
| Country of Origin | Scotland |
| Government Warning | *(standard warning)* |

- [ ] Country of Origin shows ✅ (Scotland detected on label)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## 5. Volume Conversion: mL to fl oz

**Image:** `05-volume-ml-to-floz.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify volume conversion works**

| Field | Value |
|-------|-------|
| Brand Name | Verde |
| Class/Type | London Dry Gin |
| Alcohol Content | 47% Alc./Vol. |
| Net Contents | **25.4 fl oz** |
| Name/Address | Verde Spirits Co., Portland, Oregon |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Net Contents shows ✅ (label shows 750 mL, converts to ~25.4 fl oz)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## 6. Volume Conversion: fl oz to mL

**Image:** `06-volume-floz-to-ml.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify volume conversion works**

| Field | Value |
|-------|-------|
| Brand Name | Sierra Cerveza |
| Class/Type | Mexican Lager |
| Alcohol Content | 4.5% Alc./Vol. |
| Net Contents | **355 mL** |
| Name/Address | Sierra Brewing Co., Tucson, Arizona |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Net Contents shows ✅ (label shows 12 FL OZ, converts to ~355 mL)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## 7. Volume Conversion: Liters to mL

**Image:** `07-volume-liters-to-ml.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify volume conversion works**

| Field | Value |
|-------|-------|
| Brand Name | Costco Select |
| Class/Type | Blended Scotch Whisky |
| Alcohol Content | 40% Alc./Vol. |
| Net Contents | **1750 mL** |
| Name/Address | Bottled by Costco Wholesale, Issaquah, Washington |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Net Contents shows ✅ (label shows 1.75 L = 1750 mL)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## 8. Volume Mismatch - Should FAIL

**Image:** `08-volume-mismatch-FAIL.png`
**Expected:** FAIL — **verify volume mismatch is detected**

| Field | Value |
|-------|-------|
| Brand Name | Old Tom Distillery |
| Class/Type | Kentucky Straight Bourbon Whiskey |
| Alcohol Content | 45% Alc./Vol. (90 Proof) |
| Net Contents | **1.75 L** |
| Name/Address | Old Tom Distillery, Louisville, Kentucky |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Net Contents shows ❌ (label has 750 mL, app has 1750 mL)
- [ ] Overall status shows FAIL (volume mismatch is the key failure here)

---

## 9. Proof to ABV Conversion

**Image:** `09-proof-to-abv.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify proof-to-ABV conversion works**

| Field | Value |
|-------|-------|
| Brand Name | Copper Still |
| Class/Type | Tennessee Whiskey |
| Alcohol Content | **45%** |
| Net Contents | 750 mL |
| Name/Address | Copper Still Distillery, Lynchburg, Tennessee |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Alcohol Content shows ✅ (label shows 90 Proof = 45% ABV)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## 10. Address Abbreviations

**Image:** `10-address-abbrev.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify address normalization works**

| Field | Value |
|-------|-------|
| Brand Name | Midnight Reserve |
| Class/Type | Small Batch Bourbon |
| Alcohol Content | 46% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Midnight Reserve Distillery, 456 Oak Street, Suite 100, Lexington, Kentucky 40507 |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Name & Address shows ✅ (label has St., Ste., KY — normalization handles abbreviations)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## 11. Missing Government Warning - Should FAIL

**Image:** `11-missing-warning-FAIL.png`
**Expected:** FAIL — **verify missing warning is detected**

| Field | Value |
|-------|-------|
| Brand Name | Blue Fjord |
| Class/Type | Premium Vodka |
| Alcohol Content | 40% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Nordic Spirits, Inc., Minneapolis, Minnesota |
| Country of Origin | USA |
| Government Warning | *(standard warning)* |

- [ ] Gov Warning — Present shows ❌ (warning not found on label)
- [ ] Overall status shows FAIL (missing warning is the key failure here)

---

## 12. Warning Header in Title Case - Should FAIL

**Image:** `12-warning-titlecase-FAIL.png`
**Expected:** FAIL — **verify header caps check works**

| Field | Value |
|-------|-------|
| Brand Name | HopMaster |
| Class/Type | India Pale Ale |
| Alcohol Content | 6.5% |
| Net Contents | 12 FL. OZ. |
| Name/Address | HopMaster Brewing Co., Portland, Oregon |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Gov Warning — Header Caps shows ❌ (label has "Government Warning" not "GOVERNMENT WARNING")
- [ ] Overall status shows FAIL (header format is the key failure here)

---

## 13. High ABV (Overproof)

**Image:** `13-high-abv.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify high ABV parsing works**

| Field | Value |
|-------|-------|
| Brand Name | Navy Strength |
| Class/Type | Overproof Rum |
| Alcohol Content | 75.5% Alc./Vol. (151 Proof) |
| Net Contents | 750 mL |
| Name/Address | Navy Strength Distillers, Charleston, South Carolina |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Alcohol Content shows ✅ (75.5% / 151 Proof parsed correctly)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## 14. Low ABV

**Image:** `14-low-abv.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify low ABV parsing works**

| Field | Value |
|-------|-------|
| Brand Name | Lite Fizz |
| Class/Type | Low Alcohol Sparkling Wine |
| Alcohol Content | 0.5% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Lite Fizz Winery, Modesto, California |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Alcohol Content shows ✅ (0.5% parsed correctly)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## 15. Unicode Brand Name

**Image:** `15-unicode-brand.png`
**Expected:** REVIEW or FAIL (gov warning text extraction) — **verify unicode handling works**

| Field | Value |
|-------|-------|
| Brand Name | Chateau Elegance |
| Class/Type | Bordeaux Rouge |
| Alcohol Content | 13.5% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Chateau Elegance, Margaux, France |
| Country of Origin | France |
| Government Warning | *(standard warning)* |

- [ ] Brand Name shows ✅ (accented characters handled)
- [ ] Gov Warning — Text Accuracy may show ❌ (small text extraction limitation)

---

## Multi-Image Processing Tests

### 16. Multi-Image Upload (Front + Back + Neck)

**Purpose:** Test merged extraction from multiple images of the same product

**Test Setup:**
1. Generate test images from HTML labels:
   ```bash
   node scripts/composite-labels.js src/test-data/labels/label-oldtom-front.html
   node scripts/composite-labels.js src/test-data/labels/label-oldtom-back.html
   node scripts/composite-labels.js src/test-data/labels/label-oldtom-neck.html
   ```
2. Or create screenshots from the HTML files directly

**Application Data:**

| Field | Value |
|-------|-------|
| Brand Name | Old Tom Distillery |
| Class/Type | Kentucky Straight Bourbon Whiskey |
| Alcohol Content | 45% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Old Tom Distillery, 123 Bourbon Lane, Louisville, Kentucky 40202 |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

**Steps:**
- [ ] Upload all 3 images at once (drag & drop or click to multi-select)
- [ ] Verify grid shows all 3 images with label selectors (Front/Back/Neck)
- [ ] Change labels using dropdown if needed
- [ ] Click "Verify Labels (3)"
- [ ] Observe progress showing each image being analyzed

**Expected Results:**
- [ ] Brand Name shows "Found on: [F] [N]" (confirmed on 2 images)
- [ ] ABV shows "Found on: [F] [N]" (confirmed on 2 images)
- [ ] Address shows "Found on: [B]" (back label only)
- [ ] Government Warning shows "Found on: [B]" (back label only)
- [ ] Overall result shows "Based on 3 images"
- [ ] Field cards display "2 images agree" badge where applicable

### 17. Conflict Resolution

**Purpose:** Test conflict detection and human resolution workflow

**Test Setup:**
1. Generate test images with intentional ABV conflict:
   ```bash
   node scripts/composite-labels.js src/test-data/labels/label-conflict-front.html
   node scripts/composite-labels.js src/test-data/labels/label-conflict-neck.html
   ```

**Application Data:**

| Field | Value |
|-------|-------|
| Brand Name | Green Valley Spirits |
| Class/Type | Premium Vodka |
| Alcohol Content | 45% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Green Valley Spirits, Portland, Oregon |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

**Steps:**
- [ ] Upload front label (45% ABV) and neck label (46% ABV)
- [ ] Assign "Front" and "Neck" labels
- [ ] Click "Verify Labels (2)"
- [ ] After extraction, conflict panel appears

**Expected Results:**
- [ ] Conflict panel shows: "Conflicting Values Detected"
- [ ] Alcohol Content field shows two options: "45%" and "46%"
- [ ] Each option shows source image thumbnail
- [ ] Progress shows "0 of 1 conflicts resolved"
- [ ] "Continue to Results" button is disabled
- [ ] Select "45%" option (matches application data)
- [ ] Progress updates to "1 of 1 resolved"
- [ ] "Continue to Results" button becomes enabled
- [ ] Click continue, verify ABV shows as PASS with "Resolved conflict" badge

### 18. Multi-Image Export

**Purpose:** Verify JSON export includes multi-image metadata

**Steps:**
- [ ] Complete a multi-image verification (use scenario 16)
- [ ] Click "Export Results"
- [ ] Open downloaded JSON file

**Expected Export Contents:**
- [ ] `version: "2.0"`
- [ ] `imageCount: 3`
- [ ] `images` array with id, label, fileName for each
- [ ] `mergedExtraction.fieldSources` showing which images found each field
- [ ] `fieldResults` with `sources`, `confirmedOnImages` for each field

### 19. Image Limit (6 max)

**Purpose:** Test upload limit enforcement

**Steps:**
- [ ] Try to upload 7 images at once
- [ ] Expected: Only 6 accepted with message

**Expected Results:**
- [ ] Clear error message about 6-image limit
- [ ] Can still remove images and add new ones

---

## UI/UX Checks

- [ ] Results display clearly with color-coded status (green/yellow/red)
- [ ] Field-by-field breakdown shows extracted vs. expected values
- [ ] Error messages are helpful and actionable
- [ ] Mobile responsive (test on phone or narrow browser)
- [ ] "Start Over" / "New Verification" button works

---

## Performance Checks

- [ ] Single label verification < 5 seconds
- [ ] No browser freezing during processing
- [ ] Large images (5MB+) handled gracefully

---

## Sign-Off

| Tester | Date | All Checks Pass? |
|--------|------|------------------|
| | | [ ] Yes / [ ] No |

**Notes:**
