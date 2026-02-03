# Decision: Test Failure Fixes (2026-02-03)

## Context

After implementing the automated test runner, 4 of 10 tests failed:
- B6-imported: Country of Origin FAIL
- I2-ml-to-floz: Address WARNING (71% match)
- I3-address-abbrev: Address WARNING (80% match)
- I4-punctuation: Address WARNING (72% match)

## Root Cause Analysis

### B6-imported: Country of Origin
- **Expected**: "Scotland"
- **Extracted**: "Product of Scotland"
- **Issue**: `strictMatch()` doesn't normalize "Product of X" format
- **Real-world context**: Labels commonly show "Product of [Country]" while applications just list the country name

### I2-I4: Address Matching
Multiple issues compounded:

1. **Production phrase prefixes**: Claude extracts full text like "Distilled and Bottled by Maker's Mark Distillery..." but application data only has "Maker's Mark Distillery..."

2. **State abbreviations**: "KY" wasn't expanding to "Kentucky"

3. **Apostrophe handling**: "Maker's" vs "Makers" weren't matching because apostrophes weren't stripped

## Solution Approaches Considered

### Approach A: Lower the bar (REJECTED)
Change test runner to accept Address WARNING as passing.

**Why rejected**: This hides bad matching logic. If expected=PASS but actual=REVIEW, either:
- The expected result is wrong, OR
- The matching logic needs improvement

Changing the test runner to accept poor matches is "teaching to the test" - it masks real issues.

### Approach B: Fix the normalization (CHOSEN)
Improve normalization so addresses actually match at high confidence.

## Implementation

### Country of Origin (comparison.ts, utils.ts)
- Added `normalizeCountryOfOrigin()` to strip "Product of" prefix
- Created `countryMatch()` function with semantic equivalence checking
- Changed FIELD_CONFIG to use "country" matchType

### Address Normalization (utils.ts, constants.ts)
- Added `ADDRESS_PREFIXES_TO_STRIP` list:
  - "distilled and bottled by"
  - "bottled by"
  - "vinted and bottled by"
  - "brewed by"
  - etc.
- Added all 50 US state abbreviations
- **Key fix**: Strip apostrophes in `normalizeAddress()` so "Maker's" matches "Makers"

## Results

Before fix:
- 6/10 tests passing (60%)
- Address matches at 71-80% confidence (WARNING)

After fix:
- 10/10 tests passing (100%)
- Address matches at 100% confidence (PASS)

## Lessons Learned

1. **Don't lower the bar**: When tests fail, fix the underlying issue, don't relax pass criteria
2. **Normalization matters**: Small differences (apostrophes, prefixes) compound to large similarity drops
3. **Document the reasoning**: Future maintainers need to understand WHY normalization choices were made

## Files Changed

- `src/lib/constants.ts` - Added state abbreviations, production prefixes, country matchType
- `src/lib/utils.ts` - Added `normalizeCountryOfOrigin()`, enhanced `normalizeAddress()`
- `src/lib/comparison.ts` - Added `countryMatch()` function
- `scripts/run-tests.js` - Reverted to strict pass criteria (only bold warning acceptable)
