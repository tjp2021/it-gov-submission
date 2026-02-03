# Decision: Test Image Generation Strategy (2026-02-03)

## Context

We need test images that simulate real-world conditions (glare, angles, blur, low light) while maintaining control over the exact text content for verification testing.

## Options Evaluated

### Option 1: Pure DALL-E Generation
**Approach**: Generate complete bottle+label images using DALL-E 3 text-to-image.

**Pros**:
- Single API call
- Highly realistic results
- Good variety of conditions

**Cons**:
- DALL-E cannot reliably reproduce specific text
- Generated text differs from our test expectations
- Tests fail on content mismatch, not image quality
- No control over exact label content

**Verdict**: Useful for stress testing Claude Vision's robustness, but not for ground-truth verification tests.

### Option 2: Image Compositing (CHOSEN)
**Approach**: Overlay our HTML-generated label PNGs onto bottle template photos using Sharp/ImageMagick.

**Pros**:
- Exact text control (from our HTML labels)
- Realistic bottle context
- Can add post-processing effects (glare, blur, noise)
- Deterministic and reproducible
- No external API costs after initial setup

**Cons**:
- Requires bottle template images
- Compositing may look less natural than pure generation
- More implementation work

**Verdict**: Best balance of control and realism for verification testing.

### Option 3: DALL-E Edit API (Inpainting)
**Approach**: Take bottle photos, mask label area, have DALL-E fill in based on prompt.

**Pros**:
- Natural blending of label into bottle
- Can use our text in prompt

**Cons**:
- Still no guarantee of exact text reproduction
- Requires mask creation for each bottle
- More complex workflow

**Verdict**: Interesting but doesn't solve the text accuracy problem.

### Option 4: Stable Diffusion img2img
**Approach**: Use SD with ControlNet to transform our flat labels into bottle-context images.

**Pros**:
- More control than DALL-E
- Can run locally (no API costs)
- ControlNet preserves structure

**Cons**:
- Requires local GPU or cloud setup
- More complex pipeline
- Still may distort text

**Verdict**: Overkill for our needs; compositing is simpler.

## Decision

**Use Option 2: Image Compositing** with the following approach:

1. **Ground Truth Tests (Groups 1-2)**: Continue using HTML-rendered PNG labels
   - Exact text control
   - Clean, reproducible conditions

2. **Stress Tests (Group 3)**: Use composited images
   - Overlay HTML labels onto bottle templates
   - Apply post-processing for challenging conditions:
     - Gaussian blur (simulates focus issues)
     - Glare overlay (simulates flash photography)
     - Perspective transform (simulates angles)
     - Brightness/contrast adjustment (simulates lighting)

3. **Robustness Tests (Group 4, future)**: Keep pure DALL-E images
   - Test Claude Vision on truly unknown images
   - Expected to have mismatches; tests extraction capability, not verification

## Implementation Plan

1. Create `scripts/composite-labels.js` using Sharp library
2. Acquire/create bottle template images (front-facing, various types)
3. Implement perspective transform and effect overlays
4. Generate Group 3 test images with controlled degradation
5. Update test scenarios with appropriate expected results

## Files Affected

- `scripts/composite-labels.js` (new)
- `src/test-data/bottle-templates/` (new directory)
- `src/test-data/sample-applications.json` (update Group 3)
- `package.json` (add sharp dependency, new script)

## Lessons Learned

1. **Generative AI text limitations**: DALL-E and similar models cannot reliably reproduce specific text; plan test strategies around this constraint.

2. **Separate test purposes**: Ground-truth tests (verify matching logic) need different images than stress tests (verify extraction robustness).

3. **Control vs realism tradeoff**: For verification testing, control over content is more valuable than photorealism.
