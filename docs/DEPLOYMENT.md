# Vercel Deployment Guide

This guide covers deploying the TTB Label Verification Tool to Vercel.

## Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli) installed (`npm i -g vercel`)
- Vercel account with project linked

## Deploy

```bash
# Production deploy
vercel --prod

# Preview deploy (for testing)
vercel
```

Vercel auto-detects Next.js and handles the build.

## Environment Variables

Configure in Vercel Dashboard → Settings → Environment Variables:

| Name | Required | Notes |
|------|----------|-------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for vision extraction |

## Project Configuration

No `vercel.json` is needed — the default Next.js settings work. The project uses:

- **Framework**: Next.js (auto-detected)
- **Node.js**: 20.x
- **Build command**: `next build`
- **Output**: Standalone (configured in `next.config.ts`)

## Troubleshooting

### Build failing

Run `npm run build` locally first to catch TypeScript or build errors before deploying.

### API routes timing out

Vercel serverless functions have a 10-second default timeout (60s on Pro). The Gemini extraction takes ~2.5s per image, so single-image verification fits comfortably. Batch mode with many images may need a Pro plan for longer timeouts.

### Environment variable not found

Verify in Vercel Dashboard → Settings → Environment Variables that `GEMINI_API_KEY` is set for the Production environment.
