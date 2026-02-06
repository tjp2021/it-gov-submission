# Test Batch CSV Files

These CSV files are for manually testing the batch upload workflow. Upload demo images from `/public/demos/` alongside these CSVs.

## Files

### batch-pass.csv
All 3 rows have correct application data matching the demo images. Expected: 3 PASS results.

**Images to upload:** `label-perfect.png`, `label-case-mismatch.png`, `label-imported.png`

### batch-mismatch.csv
Filenames (`photo-001.jpg`, etc.) do not match any uploaded demo image filenames. Expected: filename matching error shown in UI.

**Images to upload:** any demo images (none will match)

### batch-wrong-data.csv
Correct filenames but deliberately wrong field data (wrong brand, ABV, class). Expected: 3 FAIL results.

**Images to upload:** `label-perfect.png`, `label-case-mismatch.png`, `label-imported.png`
