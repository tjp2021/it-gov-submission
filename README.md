# TTB Label Verification Tool

AI-powered alcohol beverage label verification for TTB compliance officers.

## Quick Start

```bash
# Install dependencies
npm install

# Set your Gemini API key
export GEMINI_API_KEY=your-api-key

# Start the development server
npm run dev

# Open http://localhost:3000
```

## Features

- **Single Label Verification** — Upload a label image and compare against COLA application data
- **Batch Processing** — Verify up to 300 labels in parallel at `/batch` (~78s for full batch)
- **Smart Matching** — Fuzzy matching for brand names, unit conversion for ABV/volume, strict matching for government warning
- **Agent Override** — Accept warnings or confirm issues with one click
- **Export Results** — Download verification results as JSON or CSV
- **Demo Mode** — Try the tool instantly with pre-loaded example data

## How It Works

1. **Upload** a label image (JPG, PNG, WebP, GIF)
2. **Enter** the COLA application data (or use Demo mode)
3. **Verify** — Gemini Flash extracts text and compares against application
4. **Review** — Each field shows PASS/FAIL/WARNING with confidence scores
5. **Override** if needed — Agent makes final compliance decision

## Test Suite

Run automated tests to verify matching logic:

```bash
# Start dev server in another terminal first
npm run dev

# Run basic + intermediate tests (ground truth HTML labels)
npm test

# Run all tests including stress tests
npm test -- basic intermediate stress

# Run all groups including DALL-E generated
npm test -- --all
```

### Test Groups

| Group | Tests | Description |
|-------|-------|-------------|
| Basic | 6 | Core matching: perfect match, fuzzy match, ABV mismatch, warning violations |
| Intermediate | 4 | Unit conversions: proof↔ABV, mL↔fl oz, address abbreviations |
| Stress | 8 | Edge cases: extreme ABV, unicode, truncated warnings, complex addresses |
| Composite | 4 | HTML labels on bottle templates with blur/noise effects |
| Advanced | 5 | DALL-E generated images (requires OpenAI API key) |

## Project Structure

```
src/
├── app/
│   ├── page.tsx           # Single verification mode
│   ├── batch/page.tsx     # Batch processing mode
│   └── api/verify/        # Verification API endpoint
├── components/
│   ├── LabelUploader.tsx  # Image upload with preprocessing
│   ├── ApplicationForm.tsx # COLA data entry
│   ├── VerificationResults.tsx # Results display with overrides
│   ├── BatchUploader.tsx  # Multi-file upload
│   └── BatchResults.tsx   # Batch results display
├── lib/
│   ├── extraction.ts      # Vision API integration (Claude/Gemini)
│   ├── comparison.ts      # Field matching functions
│   ├── utils.ts           # Normalization helpers
│   └── types.ts           # TypeScript interfaces
└── test-data/
    ├── labels/            # HTML test labels (ground truth)
    ├── sample-labels/     # PNG screenshots for testing
    └── sample-applications.json  # Test scenarios
```

## Matching Logic

| Field | Method | Notes |
|-------|--------|-------|
| Brand Name | Jaro-Winkler 0.85 | Tolerates case/punctuation differences |
| Class/Type | Jaro-Winkler 0.85 | Same as brand name |
| Alcohol Content | Numeric comparison | Converts proof↔ABV (90 Proof = 45%) |
| Net Contents | Numeric with 0.5% tolerance | Converts mL↔fl oz (750 mL ≈ 25.4 fl oz) |
| Name/Address | Jaro-Winkler 0.70 | Lower threshold, expands abbreviations |
| Country of Origin | Strict after normalization | Strips "Product of" prefix |
| Government Warning | Strict match + 4 sub-checks | Presence, caps, bold, text accuracy |

## Scripts

```bash
npm run dev              # Start development server
npm run build            # Production build
npm test                 # Run verification tests
npm run test:screenshots # Generate PNGs from HTML labels
npm run test:generate    # Generate DALL-E test images (requires API key)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for vision extraction |
| `OPENAI_API_KEY` | No | For generating DALL-E test images |

## Azure Deployment

The app is configured for Azure App Service deployment:

```bash
# Build for production
npm run build

# The standalone output is in .next/standalone
# Deploy to Azure App Service with:
# - Runtime: Node.js 20
# - Startup command: node server.js
```

## Documentation

- [Approach](docs/APPROACH.md) — Technical decisions and architecture
- [PRD](docs/TTB_LABEL_VERIFICATION_PRD.md) — Product requirements
- [Reflections](reflections/) — Decision logs and error analysis

## License

Built for Treasury TTB Compliance Division.
