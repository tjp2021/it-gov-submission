# TTB Label Verification Tool

AI-powered alcohol beverage label verification for TTB compliance officers.

## Live Demo

**[gov-submission.vercel.app](https://gov-submission.vercel.app)** — click any demo scenario to see results in ~2.5 seconds.

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

- **Single Label Verification** — Upload 1-6 label images (front/back/neck) and compare against COLA application data with field merge and conflict detection
- **Batch Processing** — Verify up to 10 labels with per-label application data (CSV upload or manual entry) at `/batch`
- **5 Demo Scenarios** — Perfect match, case mismatch, wrong ABV, wrong warning format, imported spirit
- **Smart Matching** — Strict brand matching, fuzzy class/address matching, unit conversion for ABV/volume
- **Agent Override** — Accept warnings or confirm issues with one click
- **Export Results** — Download verification results as JSON or CSV
- **Multi-Image Merge** — Multiple views of the same product merge into one verification with conflict detection

## How It Works

1. **Upload** a label image (JPG, PNG, WebP, GIF)
2. **Enter** the COLA application data (or use Demo mode)
3. **Verify** — Gemini Flash extracts text and compares against application
4. **Review** — Each field shows PASS/FAIL/WARNING with confidence scores
5. **Override** if needed — Agent makes final compliance decision

## Development Journey

Started with Claude Vision (Sonnet) — accurate but ~5s per label. Tried OCR (failed at 33% accuracy). Switched to **Gemini 2.0 Flash** — same accuracy, 2.5s, 30x cheaper. Discovered the [bold detection paradox](docs/GOVERNMENT_WARNING_PARADOX.md) and solved it with field categories. Rebuilt batch from shared application data to per-label CSV + manual entry. See [APPROACH.md](docs/APPROACH.md) for the full journey.

## Test Suite

Run automated tests to verify matching logic:

```bash
# Start dev server in another terminal first
npm run dev

# Run basic + intermediate single-image tests
npm test

# Run multi-image merge tests
npm run test:multi

# Run input validation tests
npm run test:validation

# Run batch processing tests
npm run test:batch

# Run CSV parser + batch matcher unit tests (no server needed)
npm run test:csv

# Run Playwright E2E tests
npm run test:e2e
```

### Test Groups

| Group | Tests | Description |
|-------|-------|-------------|
| Basic | 10 | Core matching: perfect match, fuzzy match, ABV mismatch, warning violations |
| Intermediate | 4 | Unit conversions: proof↔ABV, mL↔fl oz, address abbreviations |
| Multi-Image | 5 | Two/three image merge, conflict detection, backward compat |
| Validation | 8 | Input validation: missing fields, bad images, size limits |
| Batch | 8 | Batch functional (3) + batch validation (5) |
| CSV Unit | 16 | CSV parser (8) + batch matcher (8), no server needed |
| E2E (Playwright) | 25 | Full-flow verification, batch processing, UI interactions |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Single verification mode (multi-image)
│   ├── batch/page.tsx              # Batch processing mode
│   └── api/
│       ├── verify-gemini/route.ts  # Single label verification
│       ├── verify-stream/route.ts  # SSE streaming (multi-image)
│       └── batch-verify/route.ts   # Batch processing with SSE
├── components/                     # 9 components
│   ├── MultiImageUploader.tsx      # Multi-image upload (1-6 images)
│   ├── ApplicationForm.tsx         # COLA data entry
│   ├── VerificationResults.tsx     # Results display with overrides
│   ├── FieldResultCard.tsx         # Individual field result card
│   ├── ConflictResolutionPanel.tsx # Multi-image conflict resolution
│   ├── DemoButton.tsx              # 5 demo scenarios
│   ├── LoadingState.tsx            # SSE streaming progress
│   ├── BatchUploader.tsx           # Batch upload with CSV support
│   └── BatchResults.tsx            # Batch results dashboard
├── lib/                            # 11 modules
│   ├── gemini-extraction.ts        # Gemini 2.0 Flash integration
│   ├── comparison.ts               # Field matching functions
│   ├── warning-check.ts            # Government warning sub-checks
│   ├── verify-single.ts            # Shared verification logic
│   ├── merge-extraction.ts         # Multi-image field merge
│   ├── csv-parser.ts               # CSV application data parser
│   ├── batch-matcher.ts            # Image-to-application matching
│   ├── image-preprocessing.ts      # Client-side image optimization
│   ├── constants.ts                # Standard warning text, thresholds
│   ├── utils.ts                    # Normalization, Jaro-Winkler
│   └── types.ts                    # TypeScript interfaces
└── test-data/
    ├── labels/                     # HTML test labels (ground truth)
    ├── sample-labels/              # PNG screenshots for testing
    └── sample-applications.json    # Test scenarios
```

## Matching Logic

| Field | Method | Notes |
|-------|--------|-------|
| Brand Name | **Strict** (exact after normalization) | Any difference → WARNING (legal identity) |
| Class/Type | Jaro-Winkler 0.85 | Tolerates abbreviations, word order |
| Alcohol Content | Numeric comparison | Converts proof↔ABV (90 Proof = 45%) |
| Net Contents | Numeric with 0.5% tolerance | Converts mL↔fl oz (750 mL ≈ 25.4 fl oz) |
| Name/Address | Jaro-Winkler 0.70/0.90 | ≥0.90=PASS, ≥0.70=WARNING, <0.70=FAIL |
| Country of Origin | ISO library + region mapping | Handles 7 languages, wine/spirit regions |
| Government Warning | Strict match + 4 sub-checks | Presence, caps, bold, text accuracy |

## Scripts

```bash
npm run dev              # Start development server
npm run build            # Production build
npm test                 # Run single-image verification tests (14)
npm run test:multi       # Run multi-image merge tests (5)
npm run test:validation  # Run input validation tests (8)
npm run test:batch       # Run batch processing tests (8)
npm run test:csv         # Run CSV parser unit tests (16)
npm run test:e2e         # Run Playwright E2E tests (25)
npm run test:screenshots # Generate PNGs from HTML labels
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for vision extraction |
| `OPENAI_API_KEY` | No | For generating DALL-E test images |

## Deployment

The app deploys to Vercel:

```bash
# Production deploy
vercel --prod

# Preview deploy
vercel
```

Set `GEMINI_API_KEY` in Vercel Dashboard → Settings → Environment Variables.

## Documentation

### Core Architecture
| Document | Purpose |
|----------|---------|
| [Technical Summary](docs/TECHNICAL_SUMMARY.md) | High-level architecture overview and system design |
| [Approach](docs/APPROACH.md) | Technical decisions and architecture patterns |
| [PRD](docs/TTB_LABEL_VERIFICATION_PRD.md) | Product requirements document with user personas |

### Matching Logic Analysis
| Document | Purpose | Key Tradeoffs |
|----------|---------|---------------|
| [Field Matching Analysis](docs/FIELD_MATCHING_ANALYSIS.md) | Comprehensive analysis of ALL field matchers with empirical test results | Documents why each threshold was chosen, edge cases handled, and failure modes |
| [Fuzzy Matching Analysis](docs/FUZZY_MATCHING_ANALYSIS.md) | Jaro-Winkler threshold testing for brand/class/address fields | Why 0.85 for brands (balances typo tolerance vs false matches), 0.70 for addresses (heavy abbreviation) |
| [Bold Detection Analysis](docs/BOLD_DETECTION_ANALYSIS.md) | Empirical testing of automated bold text detection | Proves 71% max accuracy insufficient for compliance; requires human review (WARNING status) |

### Testing Documentation
| Document | Purpose | Key Insights |
|----------|---------|--------------|
| [Testing Methodology](docs/TESTING-METHODOLOGY.md) | How test images are generated and validated | Uses HTML→PNG pipeline for ground truth labels |
| [Test Requirements Matrix](docs/TEST_REQUIREMENTS_MATRIX.md) | Maps PRD requirements to specific test cases | Every user story has corresponding test coverage |
| [Test Label Sources](docs/TEST_LABEL_SOURCES.md) | Origin and licensing of test images | Explains AI-generated vs synthetic approaches |
| [Test Image Generation](docs/TEST_IMAGE_GENERATION.md) | How composite and degraded test images are created | Documents blur, noise, and lighting simulation |

### Performance & Deployment
| Document | Purpose | Key Metrics |
|----------|---------|-------------|
| [Performance](docs/PERFORMANCE.md) | Latency optimization journey from Claude to Gemini | Achieved 2.5s avg (50% under PRD requirement) |
| [Deployment](docs/DEPLOYMENT.md) | Production deployment configuration | Vercel setup, environment variables |
| [OCR Approach](docs/OCR_APPROACH.md) | Evaluation of dedicated OCR vs vision models | Why Gemini Flash vision outperforms Tesseract+preprocessing |

### Decision Records
- [Reflections](reflections/) — Decision logs, error analysis, and lessons learned

---

## Recent Updates (Tradeoffs Documented)

### Brand Name Matching → Strict
**Changed from:** Fuzzy match at 0.90 threshold
**Changed to:** Exact match only; any difference = WARNING for human review

**Tradeoff:** More human review required, but zero false auto-approvals for brand names. Brands are legal identities — "Absolut" ≠ "Absolute" even at 97.8% similarity.

See: [Field Matching Analysis](docs/FIELD_MATCHING_ANALYSIS.md#1-brand-name-matching)

### Country of Origin → ISO Library + Region Mapping
**Changed from:** Hardcoded country aliases
**Changed to:** `i18n-iso-countries` library with 7 language locales + wine/spirit region mapping

**Why:** Wine labels show "Champagne" not "France", whisky shows "Speyside" not "Scotland". Now handles:
- 7 languages (EN, DE, ES, IT, FR, PT, HU)
- Wine regions (Champagne→France, Rioja→Spain, Tuscany→Italy)
- Spirit regions (Speyside→Scotland, Cognac→France, Kentucky→USA)
- TTB-specific regions (Scotland kept as-is for Scotch labeling compliance)

See: [Field Matching Analysis](docs/FIELD_MATCHING_ANALYSIS.md#6-country-of-origin-matching)

### Batch Processing → Per-Label CSV + Manual Entry
**Changed from:** Shared application data for all labels
**Changed to:** Per-label application data via CSV upload or manual entry, with filename matching

**Architecture:**
- CSV parser with validation (`src/lib/csv-parser.ts`, 16 unit tests)
- Image-to-application filename matching (`src/lib/batch-matcher.ts`)
- Parallel processing with concurrency limit of 5, SSE streaming
- 10 label maximum (prototype scope)

**Performance:**
- 3 labels: ~3s (parallel)
- 10 labels: ~5s (5 concurrent workers)

**Tradeoff:** Higher server resource usage, but 10x throughput improvement. Production would need a job queue for 200+ labels.

See: `src/app/api/batch-verify/route.ts`

### Edge Case Coverage
**Added:** 57 edge case tests covering:
- All beverage types (spirits, wine, beer, seltzers, sake, cider, hard kombucha)
- All container sizes (50mL shooters to 15.5gal kegs)
- ABV ranges (0.5% NA beer to 75.5% overproof rum)
- Decimal proof, European formats, dual labeling

**Result:** 56/57 passing (98.2%). The one "failure" (dual labeling "750 mL (25.4 FL OZ)") is handled by 0.5% volume tolerance.

See: `scripts/test-edge-cases.js`

### Batch Rewrite → Per-Label Application Data
**Changed from:** All labels verified against a single shared application
**Changed to:** Each label has its own application data, entered via CSV upload or manual form

**Why:** Real batch workflows involve different products, each with unique application data. CSV upload with filename matching (`image_filename` column) lets agents prepare data in spreadsheets and upload alongside label images.

**New components:** CSV parser with 16 unit tests, filename matcher, per-label manual entry forms.

See: [APPROACH.md](docs/APPROACH.md#batch-processing-shared-data--per-label-csv--manual-entry)

## License

Built for Treasury TTB Compliance Division.
