# Azure App Service Deployment Guide

This guide covers deploying the TTB Label Verification Tool to Azure App Service.

## Prerequisites

- Azure subscription with App Service plan
- Node.js 20+ App Service
- Azure CLI or Azure Portal access

## Option 1: Deploy via Azure Portal (Manual)

### 1. Build the Application

```bash
# On your local machine
npm install
npm run build
```

This creates a standalone deployment in `.next/standalone/`.

### 2. Create a ZIP Archive

```bash
# Create deployment package
cd .next/standalone
zip -r ../../deploy.zip .
cd ../..
```

### 3. Deploy via Azure Portal

1. Go to Azure Portal → App Services → Your App
2. Navigate to Deployment Center → Manual Deploy
3. Upload `deploy.zip`
4. Set startup command: `node server.js`

### 4. Configure Environment Variables

In Azure Portal → Configuration → Application settings:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `PORT` | 8080 |
| `NODE_ENV` | production |

## Option 2: Deploy via Azure CLI

```bash
# Login to Azure
az login

# Build the app
npm run build

# Create resource group (if needed)
az group create --name ttb-rg --location eastus

# Create App Service plan
az appservice plan create \
  --name ttb-plan \
  --resource-group ttb-rg \
  --sku B1 \
  --is-linux

# Create the web app
az webapp create \
  --name ttb-label-verification \
  --resource-group ttb-rg \
  --plan ttb-plan \
  --runtime "NODE:20-lts"

# Configure environment variables
az webapp config appsettings set \
  --name ttb-label-verification \
  --resource-group ttb-rg \
  --settings ANTHROPIC_API_KEY=sk-ant-... NODE_ENV=production

# Deploy the standalone build
cd .next/standalone
zip -r ../../deploy.zip .
cd ../..

az webapp deploy \
  --name ttb-label-verification \
  --resource-group ttb-rg \
  --src-path deploy.zip
```

## Option 3: GitHub Actions CI/CD

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Create deployment package
        run: |
          cd .next/standalone
          zip -r ../../deploy.zip .

      - name: Deploy to Azure
        uses: azure/webapps-deploy@v3
        with:
          app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: deploy.zip
```

Add these secrets in GitHub:
- `AZURE_WEBAPP_NAME`: Your app service name
- `AZURE_PUBLISH_PROFILE`: Download from Azure Portal → Your App → Get publish profile

## Startup Command

The app uses Next.js standalone output. Set the startup command to:

```
node server.js
```

## Health Check

Configure a health check in Azure Portal:

1. Go to Health check under Monitoring
2. Set path to `/`
3. The app returns 200 when healthy

## Troubleshooting

### App not starting

Check logs:
```bash
az webapp log tail --name ttb-label-verification --resource-group ttb-rg
```

### API key not working

Verify the environment variable is set:
```bash
az webapp config appsettings list \
  --name ttb-label-verification \
  --resource-group ttb-rg
```

### Image upload failing

Ensure the App Service has enough memory. Upgrade to at least B1 or S1 tier if using Basic/Free.

## Recommended Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Node version | 20 LTS | Required for Next.js 16 |
| App Service plan | B1 or higher | Free tier may timeout on API calls |
| Always On | Enabled | Prevents cold starts |
| HTTPS Only | Enabled | Security best practice |
