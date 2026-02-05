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
- **Batch Processing** — Verify up to 300 labels in parallel at `/batch` (50 labels in ~12s)
- **Smart Matching** — Strict brand matching, fuzzy class/address matching, unit conversion for ABV/volume
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
| [Azure Deployment](docs/AZURE_DEPLOYMENT.md) | Production deployment configuration | App Service setup, environment variables |
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

### Batch Processing → SSE Streaming with Parallel Processing
**Changed from:** Sequential API calls (50 labels = 125s)
**Changed to:** Parallel processing with concurrency limit of 10, SSE streaming

**Performance:**
- 3 labels: ~3s (parallel)
- 50 labels: ~12s (10 concurrent workers)

**Tradeoff:** Higher server resource usage, but 10x throughput improvement.

See: `src/app/api/batch-verify/route.ts`

### Edge Case Coverage
**Added:** 57 edge case tests covering:
- All beverage types (spirits, wine, beer, seltzers, sake, cider, hard kombucha)
- All container sizes (50mL shooters to 15.5gal kegs)
- ABV ranges (0.5% NA beer to 75.5% overproof rum)
- Decimal proof, European formats, dual labeling

**Result:** 56/57 passing (98.2%). The one "failure" (dual labeling "750 mL (25.4 FL OZ)") is handled by 0.5% volume tolerance.

See: `scripts/test-edge-cases.js`

## License

Built for Treasury TTB Compliance Division.
