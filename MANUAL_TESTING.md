# Manual Testing Guide

## Setup

```bash
npm run dev
# Open http://localhost:3000
```

## Test Data Location

- **Sample labels**: `src/test-data/sample-labels/`
- **Degraded labels**: `src/test-data/sample-labels/degraded/`
- **Real labels**: `src/test-data/sample-labels/real/`
- **Application data**: `src/test-data/sample-applications.json`

---

## Creating Test Labels from Real Photos

### Step 1: Find Real Labels Online
Search Google Images for:
- "bourbon whiskey bottle label"
- "wine label close up photo"
- "craft beer can label"
- "vodka bottle photo"

### Step 2: Download the Image
```bash
# Right-click image → Copy Image Address, then:
node scripts/download-label.js "https://example.com/label.jpg" my-bourbon
```

### Step 3: Create Degraded Versions
```bash
node scripts/degrade-labels.js src/test-data/sample-labels/real/my-bourbon.jpg
```

This creates 6 versions simulating bad photos:
- `my-bourbon-blur.jpg` - Out of focus
- `my-bourbon-lowlight.jpg` - Dim bar lighting
- `my-bourbon-glare.jpg` - Flash reflection
- `my-bourbon-angled.jpg` - Tilted phone angle
- `my-bourbon-noise.jpg` - Heavy compression
- `my-bourbon-combined.jpg` - Multiple issues

### Step 4: Test in the App
1. Upload the degraded image
2. Enter the real label's info as application data
3. Verify the tool can still extract and match

---

## Single Verification Tests

### Test 1: Happy Path (PASS)
1. Go to `/`
2. Click "Try Demo" button
3. Click "Verify Label"
4. **Expected**: Overall status PASS, ~2-3 seconds

### Test 2: ABV Mismatch (FAIL)
1. Upload: `src/test-data/sample-labels/label-case-mismatch.png`
2. Enter application data:
   - Brand Name: `Stone's Throw`
   - Class/Type: `Small Batch Bourbon Whiskey`
   - Alcohol Content: `40%` (wrong - label says 46%)
   - Net Contents: `750 mL`
3. Click "Verify Label"
4. **Expected**: FAIL on Alcohol Content field

### Test 3: Fuzzy Match (PASS with case difference)
1. Upload: `src/test-data/sample-labels/label-case-mismatch.png`
2. Enter application data:
   - Brand Name: `stone's throw` (lowercase)
   - Class/Type: `Small Batch Bourbon Whiskey`
   - Alcohol Content: `46% Alc./Vol.`
   - Net Contents: `750 mL`
3. **Expected**: PASS - fuzzy matching handles case

### Test 4: Unit Conversion (PASS)
1. Upload: `src/test-data/sample-labels/label-ml-to-floz.png`
2. Enter Net Contents: `25.4 fl oz`
3. **Expected**: PASS - converts 750 mL to 25.4 fl oz

### Test 5: Large Image Preprocessing
1. Find a large image (>2MB, >3000px)
2. Upload it
3. **Expected**: Image processes without error, resized automatically

---

## Batch Verification Tests

### Test 6: Small Batch (3 labels)
1. Go to `/batch`
2. Upload 3 copies of `public/demo-label.png`
3. Fill form with demo data
4. Click "Verify 3 Labels"
5. **Expected**:
   - Progress bar shows streaming
   - All 3 complete in ~3 seconds
   - Summary shows 3 total

### Test 7: Medium Batch (20 labels)
1. Upload 20 copies of demo label
2. Verify
3. **Expected**:
   - Streaming progress visible
   - Completes in ~6-8 seconds
   - All results shown

### Test 8: Large Batch (50 labels)
1. Upload 50 copies of demo label
2. Verify
3. **Expected**:
   - Completes in ~14 seconds
   - No errors
   - Summary accurate

### Test 9: Mixed Results Batch
1. Upload these labels:
   - `label-case-mismatch.png` (will PASS with correct data)
   - `label-high-abv.png`
   - `label-imported.png`
2. Use application data from `sample-applications.json` for one of them
3. **Expected**: Mix of PASS/FAIL/REVIEW results

### Test 10: 10 Label Limit
1. Try to upload 15 files
2. **Expected**:
   - Only 10 accepted
   - Error message shown: "Maximum 10 labels per batch"

---

## UI/UX Tests

### Test 11: Navigation
1. From `/`, click "Batch Mode →"
2. Verify subtitle shows "Verify up to 10 labels at once"
3. From `/batch`, click "← Single Mode"
4. **Expected**: Clean navigation both ways

### Test 12: Agent Override
1. Complete a verification with WARNING status
2. Click override button (Accept/Confirm)
3. **Expected**: Status updates, decision recorded

### Test 13: Export Results
1. Complete a batch verification
2. Click "Export JSON"
3. Click "Export CSV"
4. **Expected**: Both files download with correct data

### Test 14: Reset Flow
1. Complete verification
2. Click "New Verification" or "New Batch"
3. **Expected**: Form clears, ready for new input

---

## Edge Cases

### Test 15: Invalid File Type
1. Try to upload a .txt or .pdf file
2. **Expected**: Rejected with error message

### Test 16: Empty Form Submission
1. Upload image but leave form empty
2. Click Verify
3. **Expected**: Validation error shown

### Test 17: Network Error Handling
1. Start verification
2. Disconnect network mid-process
3. **Expected**: Graceful error message

---

## Performance Checklist

| Scenario | Target | Actual |
|----------|--------|--------|
| Single label | < 5s | _____ |
| Batch of 10 | < 5s | _____ |
| Batch of 50 | < 20s | _____ |
| Image preprocessing | < 1s | _____ |

---

## Browser Testing

Test in:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## Notes

Record any issues found:

1. _______________
2. _______________
3. _______________
