# Performance Optimization

**PRD Requirement:** Response time ≤5 seconds (Sarah's workflow requirement)

**Current State:** Average 5.8s, with 11/18 tests exceeding the 5s target

## Time Breakdown

| Component | Time | % of Total |
|-----------|------|------------|
| Claude API (Sonnet) | 4-6s | ~85% |
| Network round-trip | 0.3-0.5s | ~7% |
| Image preprocessing | 0.1-0.2s | ~3% |
| Comparison logic | <10ms | <1% |
| Response rendering | <50ms | <1% |

**The API call dominates.** All other optimizations combined can't get us under 5s if the API takes 5s+.

## Optimization Options

### Option 1: Use Claude Haiku (Recommended for Testing)

**Change:** Switch from `claude-sonnet-4-20250514` to `claude-haiku-3-5-20241022`

| Metric | Sonnet | Haiku | Change |
|--------|--------|-------|--------|
| Latency | 4-6s | 1.5-2.5s | **-60%** |
| Cost | $3/$15 per 1M tokens | $0.25/$1.25 | **-90%** |
| Accuracy | Highest | Good | TBD |

**Trade-off:** Haiku may miss subtle details or make more extraction errors. Need to run test suite to validate.

**Implementation:** Change model in `src/lib/extraction.ts`

### Option 2: Reduce Image Resolution

**Change:** Lower MAX_DIMENSION from 1568px to 1024px

| Metric | 1568px | 1024px | Change |
|--------|--------|--------|--------|
| Payload size | ~500KB | ~250KB | -50% |
| Upload time | ~300ms | ~150ms | -150ms |
| API processing | Baseline | -5-10% | -200-400ms |

**Trade-off:** May reduce OCR accuracy on small text (government warning fine print). Need to test.

**Implementation:** Change `MAX_DIMENSION` in `src/components/LabelUploader.tsx`

### Option 3: Streaming Response

**Change:** Use Claude streaming API and display results progressively

| Metric | Current | Streaming | Change |
|--------|---------|-----------|--------|
| Time to first byte | 4-6s | 0.5-1s | **-80%** |
| Total time | 4-6s | 4-6s | Same |
| Perceived speed | Slow | Fast | Better UX |

**Trade-off:** Same total time, but user sees activity immediately. Doesn't actually meet the 5s requirement but improves UX while we work on real solutions.

**Implementation:** Modify API route to use `stream: true` and update frontend

### Option 4: Field-Specific Extraction (Not Recommended)

**Change:** Make separate API calls for each field type

**Trade-off:** Would actually be SLOWER due to multiple round-trips. Claude already extracts all fields in one pass efficiently.

### Option 5: Caching (Limited Benefit)

**Change:** Cache extraction results by image hash

**Trade-off:** Only helps re-verification of same image. Labels are typically verified once. Limited real-world benefit.

### Option 6: On-Premise Model (Future)

**Change:** Deploy smaller model locally or use Azure OpenAI

**Trade-off:** Requires infrastructure, maintenance, may not match Claude accuracy. Better for production but not prototype scope.

## Recommended Strategy

### Phase 1: Validate Haiku Accuracy (Now)
1. Add model configuration option
2. Run full test suite with Haiku
3. If accuracy holds (>95% same results), make it default
4. Expected result: 1.5-2.5s response time

### Phase 2: Reduce Resolution (If Needed)
1. Test 1024px resolution with both models
2. Verify government warning text still readable
3. Expected additional savings: 200-400ms

### Phase 3: Streaming UX (Polish)
1. Implement streaming for perceived performance
2. Show extraction progress in UI
3. User sees activity within 500ms

## Metrics to Track

| Metric | Target | Current | After Haiku |
|--------|--------|---------|-------------|
| P50 latency | <4s | ~5.5s | TBD |
| P95 latency | <5s | ~8s | TBD |
| Pass rate | 100% | 100% | TBD |
| Accuracy parity | >95% | Baseline | TBD |

## Testing Protocol

Before changing models in production:

```bash
# Run tests with Sonnet (current)
npm test -- basic intermediate stress
# Record: pass rate, latency stats

# Run tests with Haiku (new)
CLAUDE_MODEL=haiku npm test -- basic intermediate stress
# Record: pass rate, latency stats

# Compare results
# - Same pass/fail outcomes?
# - Any extraction differences?
# - Latency improvement?
```

## Test Results

### Haiku vs Sonnet (2026-02-03)

| Metric | Sonnet | Haiku |
|--------|--------|-------|
| Pass Rate | 18/18 (100%) | 17/18 (94.4%) |
| Avg Latency | 5.8s | 5.5s |
| P95 Latency | 8.5s | 6.9s |
| Min Latency | 4.6s | 4.6s |

**Haiku Failure Analysis:**
- Test S5 (multiline-address) failed on government warning text
- Haiku extracted "problems" instead of "problems." (missing period)
- Strict text matching catches this minor punctuation error

**Key Finding:** Latency improvement with Haiku is minimal (~5%). The bottleneck appears to be:
1. Network round-trip to Anthropic API
2. Test harness overhead (sequential execution)
3. Server processing (Next.js API route)

**Conclusion:** Model swap alone won't hit <5s target. Need to investigate:
1. Direct API latency (bypass test harness)
2. Image size impact
3. Streaming for perceived performance

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-03 | Document options | PRD requires <5s, current avg 5.8s |
| 2026-02-03 | Tested Haiku | 94.4% accuracy, only 5% latency improvement — not sufficient |
| TBD | Try reduced resolution | Test if smaller images improve API response time |
| TBD | Measure direct API | Isolate API latency from test harness overhead |
