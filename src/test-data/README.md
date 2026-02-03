# Test Data

This folder contains test labels and matching application data for verifying the TTB Label Verification Tool.

## Test Cases

| ID | Description | Expected Result |
|----|-------------|-----------------|
| `perfect` | All fields match exactly | PASS |
| `case-mismatch` | Brand "STONE'S THROW" vs "Stone's Throw" | PASS (fuzzy match) |
| `wrong-abv` | Label shows 14.5%, app has 13.5% | FAIL |
| `warning-titlecase` | "Government Warning" not "GOVERNMENT WARNING" | FAIL |
| `no-warning` | Government warning missing entirely | FAIL |
| `imported` | Full fields including country of origin | PASS |

## How to Use

### Option 1: Screenshot HTML Labels

1. Open each HTML file in a browser
2. Take a screenshot (the label is centered on dark background)
3. Save as PNG in `labels/` folder
4. Use the matching application data from `sample-applications.json`

### Option 2: Use with Dev Server

1. Start the dev server: `npm run dev`
2. Open http://localhost:3000
3. Upload a label screenshot
4. Copy application data from `sample-applications.json`

## File Structure

```
test-data/
├── README.md
├── sample-applications.json    # Application data for each test case
└── labels/
    ├── label-perfect.html
    ├── label-case-mismatch.html
    ├── label-wrong-abv.html
    ├── label-warning-titlecase.html
    ├── label-no-warning.html
    └── label-imported.html
```

## Generating Screenshots

On macOS, you can screenshot HTML files using:

```bash
# Open in browser and screenshot
open labels/label-perfect.html
# Then Cmd+Shift+4 to capture

# Or use a headless browser
npx playwright screenshot labels/label-perfect.html label-perfect.png
```
