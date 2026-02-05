# Manual Testing Checklist

**Deployed URL:** https://gov-submission.vercel.app

**Test Images Location:** `src/test-data/sample-labels/real/`

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

**Image:** `label-perfect-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Old Tom Distillery |
| Class/Type | Kentucky Straight Bourbon Whiskey |
| Alcohol Content | 45% Alc./Vol. (90 Proof) |
| Net Contents | 750 mL |
| Name/Address | Old Tom Distillery, Louisville, Kentucky |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] All individual fields show green checkmarks
- [ ] Processing completes in < 5 seconds

---

## 2. Case Mismatch (Fuzzy Matching)

**Image:** `label-case-mismatch-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Stone's Throw |
| Class/Type | Small Batch Bourbon Whiskey |
| Alcohol Content | 46% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Stone's Throw Distillery, Frankfort, Kentucky |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS (label has "STONE'S THROW" in caps)
- [ ] Brand name field passes despite case difference

---

## 3. ABV Mismatch - Should FAIL

**Image:** `label-wrong-abv-clean.png`
**Expected:** FAIL

| Field | Value |
|-------|-------|
| Brand Name | Chateau Margaux |
| Class/Type | Cabernet Sauvignon |
| Alcohol Content | 13.5% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Chateau Margaux Winery, Napa, California |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows FAIL
- [ ] Alcohol Content field shows red X (label has 14.5%, app has 13.5%)

---

## 4. Imported Product with Country of Origin

**Image:** `label-imported-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Glenfiddich |
| Class/Type | Single Malt Scotch Whisky |
| Alcohol Content | 40% Alc./Vol. (80 Proof) |
| Net Contents | 750 mL |
| Name/Address | William Grant & Sons, Dufftown, Banffshire, Scotland |
| Country of Origin | Scotland |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] Country of Origin field validates correctly

---

## 5. Volume Conversion: mL to fl oz

**Image:** `label-ml-to-floz-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Verde |
| Class/Type | London Dry Gin |
| Alcohol Content | 47% Alc./Vol. |
| Net Contents | **25.4 fl oz** |
| Name/Address | Verde Spirits Co., Portland, Oregon |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] Net Contents passes (label shows 750 mL, converts to ~25.4 fl oz)

---

## 6. Volume Conversion: fl oz to mL

**Image:** `label-floz-to-ml-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Sierra Cerveza |
| Class/Type | Mexican Lager |
| Alcohol Content | 4.5% Alc./Vol. |
| Net Contents | **355 mL** |
| Name/Address | Sierra Brewing Co., Tucson, Arizona |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] Net Contents passes (label shows 12 FL OZ, converts to ~355 mL)

---

## 7. Volume Conversion: Liters to mL

**Image:** `label-liters-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Costco Select |
| Class/Type | Blended Scotch Whisky |
| Alcohol Content | 40% Alc./Vol. |
| Net Contents | **1750 mL** |
| Name/Address | Bottled by Costco Wholesale, Issaquah, Washington |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] Net Contents passes (label shows 1.75 L = 1750 mL)

---

## 8. Volume Mismatch - Should FAIL

**Image:** `label-perfect-clean.png`
**Expected:** FAIL

| Field | Value |
|-------|-------|
| Brand Name | Old Tom Distillery |
| Class/Type | Kentucky Straight Bourbon Whiskey |
| Alcohol Content | 45% Alc./Vol. (90 Proof) |
| Net Contents | **1.75 L** |
| Name/Address | Old Tom Distillery, Louisville, Kentucky |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows FAIL
- [ ] Net Contents field shows red X (label has 750 mL, app has 1750 mL)

---

## 9. Proof to ABV Conversion

**Image:** `label-proof-to-abv-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Copper Still |
| Class/Type | Tennessee Whiskey |
| Alcohol Content | **45%** |
| Net Contents | 750 mL |
| Name/Address | Copper Still Distillery, Lynchburg, Tennessee |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] Alcohol Content passes (label shows 90 Proof = 45% ABV)

---

## 10. Address Abbreviations

**Image:** `label-address-abbrev-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Midnight Reserve |
| Class/Type | Small Batch Bourbon |
| Alcohol Content | 46% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Midnight Reserve Distillery, 456 Oak Street, Suite 100, Lexington, Kentucky 40507 |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] Address passes despite abbreviations on label (St., Ste., KY)

---

## 11. Missing Government Warning - Should FAIL

**Image:** `label-no-warning-clean.png`
**Expected:** FAIL

| Field | Value |
|-------|-------|
| Brand Name | Blue Fjord |
| Class/Type | Premium Vodka |
| Alcohol Content | 40% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Nordic Spirits, Inc., Minneapolis, Minnesota |
| Country of Origin | USA |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows FAIL
- [ ] Government warning fields show errors (warning not present on label)

---

## 12. Warning Header in Title Case - Should FAIL

**Image:** `label-warning-titlecase-clean.png`
**Expected:** FAIL

| Field | Value |
|-------|-------|
| Brand Name | HopMaster |
| Class/Type | India Pale Ale |
| Alcohol Content | 6.5% |
| Net Contents | 12 FL. OZ. |
| Name/Address | HopMaster Brewing Co., Portland, Oregon |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows FAIL
- [ ] Header format field shows error (label has "Government Warning" not "GOVERNMENT WARNING")

---

## 13. High ABV (Overproof)

**Image:** `label-high-abv-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Navy Strength |
| Class/Type | Overproof Rum |
| Alcohol Content | 75.5% Alc./Vol. (151 Proof) |
| Net Contents | 750 mL |
| Name/Address | Navy Strength Distillers, Charleston, South Carolina |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] High ABV value parsed correctly

---

## 14. Low ABV

**Image:** `label-low-abv-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Lite Fizz |
| Class/Type | Low Alcohol Sparkling Wine |
| Alcohol Content | 0.5% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Lite Fizz Winery, Modesto, California |
| Country of Origin | *(leave empty)* |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] Low ABV value (0.5%) parsed correctly

---

## 15. Unicode Brand Name

**Image:** `label-unicode-brand-clean.png`
**Expected:** PASS

| Field | Value |
|-------|-------|
| Brand Name | Chateau Elegance |
| Class/Type | Bordeaux Rouge |
| Alcohol Content | 13.5% Alc./Vol. |
| Net Contents | 750 mL |
| Name/Address | Chateau Elegance, Margaux, France |
| Country of Origin | France |
| Government Warning | *(standard warning)* |

- [ ] Overall status shows PASS
- [ ] Accented characters handled (label may show "Chateau Elegance")

---

## Batch Processing Tests

### 16. Batch Upload (3 images)

**Images:** Upload 3 different label images from `real/` folder
**Expected:** All process successfully

- [ ] Navigate to Batch page
- [ ] Upload 3 images
- [ ] All 3 show individual results
- [ ] Summary dashboard displays

### 17. Batch Limit (10 max)

**Images:** Try to upload 12 images
**Expected:** Only 10 accepted

- [ ] Error message appears when exceeding 10
- [ ] First 10 images retained

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
