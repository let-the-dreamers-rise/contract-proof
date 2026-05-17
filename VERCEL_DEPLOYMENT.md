# Vercel Deployment Guide for ContractProof

## 🚀 Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/contract-proof)

---

## 📋 Environment Variables

### Required Environment Variables

Set these in your Vercel project settings under **Settings → Environment Variables**:

#### 1. IBM Bob API Configuration

```bash
# IBM Bob API Key (Required for Bob integration)
BOB_API_KEY=your_bob_api_key_here

# IBM Bob API Endpoint (Optional - defaults to IBM's endpoint)
BOB_API_ENDPOINT=https://api.ibm.com/bob/v1

# IBM Bob Model (Optional - defaults to recommended model)
BOB_MODEL=ibm/granite-code-34b
```

**How to get BOB_API_KEY:**
1. Go to IBM Cloud Console
2. Navigate to IBM Bob service
3. Create or select your Bob instance
4. Copy the API key from credentials

#### 2. Application Configuration

```bash
# Next.js Environment
NODE_ENV=production

# Application URL (Set automatically by Vercel, but can override)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Enable/Disable Features
NEXT_PUBLIC_ENABLE_BOB_INTEGRATION=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

#### 3. Optional: GitHub Integration (Future Feature)

```bash
# GitHub App Configuration (Optional - for future GitHub integration)
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_PRIVATE_KEY=your_private_key
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

#### 4. Optional: Analytics & Monitoring

```bash
# Vercel Analytics (Optional)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id

# Sentry Error Tracking (Optional)
SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_token
```

---

## 🔧 Complete .env.local Template

Create a `.env.local` file for local development:

```bash
# ==============================================
# IBM Bob Configuration (REQUIRED)
# ==============================================
BOB_API_KEY=your_bob_api_key_here
BOB_API_ENDPOINT=https://api.ibm.com/bob/v1
BOB_MODEL=ibm/granite-code-34b

# ==============================================
# Application Configuration
# ==============================================
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_BOB_INTEGRATION=true

# ==============================================
# Optional: GitHub Integration (Future)
# ==============================================
# GITHUB_APP_ID=
# GITHUB_APP_PRIVATE_KEY=
# GITHUB_WEBHOOK_SECRET=

# ==============================================
# Optional: Analytics & Monitoring
# ==============================================
# NEXT_PUBLIC_VERCEL_ANALYTICS_ID=
# SENTRY_DSN=
# SENTRY_AUTH_TOKEN=
```

---

## 📝 Step-by-Step Deployment

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Select "contract-proof" repository

3. **Configure Project:**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

4. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add each variable from the list above
   - **IMPORTANT:** Add `BOB_API_KEY` at minimum
   - Select environments: Production, Preview, Development

5. **Deploy:**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Add Environment Variables:**
   ```bash
   vercel env add BOB_API_KEY
   # Enter your Bob API key when prompted
   
   vercel env add BOB_API_ENDPOINT
   # Enter the endpoint URL
   
   # Repeat for other variables
   ```

5. **Deploy to Production:**
   ```bash
   vercel --prod
   ```

---

## 🔐 Security Best Practices

### 1. Environment Variable Security

- ✅ **DO:** Store sensitive keys in Vercel environment variables
- ✅ **DO:** Use different keys for development and production
- ✅ **DO:** Rotate API keys regularly
- ❌ **DON'T:** Commit `.env.local` to Git
- ❌ **DON'T:** Share API keys in public channels
- ❌ **DON'T:** Use production keys in development

### 2. API Key Management

```bash
# .gitignore should include:
.env
.env.local
.env.*.local
.env.production
```

### 3. Rate Limiting

The app includes built-in rate limiting for Bob API calls:
- Maximum 10 requests per minute per user
- Automatic retry with exponential backoff
- Error handling for rate limit exceeded

---

## 🧪 Testing Deployment

### 1. Test Local Build

Before deploying, test the production build locally:

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start

# Open http://localhost:3000
```

### 2. Test Environment Variables

Create a test script to verify environment variables:

```bash
# Test Bob API connection
curl -X POST https://your-app.vercel.app/api/bob-fix \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 3. Verify Features

After deployment, test:
- ✅ Homepage loads correctly
- ✅ Demo page works
- ✅ Sample repository analysis runs
- ✅ Bob integration responds
- ✅ Drift detection displays results

---

## 🐛 Troubleshooting

### Issue: "BOB_API_KEY is not defined"

**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `BOB_API_KEY` with your actual API key
3. Redeploy: `vercel --prod` or trigger redeploy in dashboard

### Issue: "Build failed"

**Solution:**
1. Check build logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify TypeScript has no errors: `npm run build` locally
4. Check Node.js version compatibility

### Issue: "API routes return 500"

**Solution:**
1. Check Vercel Function logs
2. Verify environment variables are set correctly
3. Ensure Bob API endpoint is accessible
4. Check API key permissions

### Issue: "Bob integration not working"

**Solution:**
1. Verify `BOB_API_KEY` is set in production environment
2. Check Bob API endpoint is correct
3. Test API key with curl:
   ```bash
   curl -H "Authorization: Bearer YOUR_BOB_API_KEY" \
        https://api.ibm.com/bob/v1/health
   ```
4. Check Vercel function logs for detailed errors

---

## 📊 Monitoring & Analytics

### 1. Vercel Analytics

Enable in `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... other config
  experimental: {
    webVitalsAttribution: ['CLS', 'LCP']
  }
};

export default nextConfig;
```

### 2. Performance Monitoring

Vercel automatically tracks:
- Page load times
- API response times
- Build duration
- Deployment frequency

Access at: `https://vercel.com/your-username/contract-proof/analytics`

### 3. Error Tracking

View runtime errors:
- Vercel Dashboard → Your Project → Logs
- Filter by error level
- Set up alerts for critical errors

---

## 🔄 Continuous Deployment

### Automatic Deployments

Vercel automatically deploys:
- **Production:** Pushes to `main` branch
- **Preview:** Pull requests and other branches
- **Development:** Local development with `vercel dev`

### Deployment Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "Add new feature"

# 3. Push to GitHub
git push origin feature/new-feature

# 4. Vercel creates preview deployment automatically

# 5. Merge to main for production deployment
git checkout main
git merge feature/new-feature
git push origin main
```

---

## 🎯 Production Checklist

Before going live, ensure:

- [ ] All environment variables are set in Vercel
- [ ] Bob API key is valid and has sufficient quota
- [ ] Build completes successfully
- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles: `npm run build`
- [ ] Demo page works correctly
- [ ] Bob integration responds
- [ ] Error handling is in place
- [ ] Analytics are configured (optional)
- [ ] Custom domain is configured (optional)
- [ ] SSL certificate is active (automatic)

---

## 🌐 Custom Domain Setup

### Add Custom Domain

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Click "Add Domain"
3. Enter your domain: `contractproof.com`
4. Follow DNS configuration instructions
5. Wait for DNS propagation (5-60 minutes)

### DNS Configuration

Add these records to your DNS provider:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

---

## 📈 Scaling Considerations

### Vercel Limits (Hobby Plan)

- **Bandwidth:** 100 GB/month
- **Serverless Function Execution:** 100 GB-hours
- **Build Minutes:** 6,000 minutes/month
- **Concurrent Builds:** 1

### Upgrade to Pro if:

- You exceed hobby limits
- Need team collaboration
- Require advanced analytics
- Want priority support

---

## 🆘 Support Resources

- **Vercel Documentation:** https://vercel.com/docs
- **Next.js Documentation:** https://nextjs.org/docs
- **IBM Bob Documentation:** https://ibm.com/bob/docs
- **Project Issues:** https://github.com/YOUR_USERNAME/contract-proof/issues

---

## 📞 Contact

For deployment issues or questions:
- **Email:** your-email@example.com
- **GitHub:** @your-username
- **Twitter:** @your-handle

---

**Last Updated:** [Date]  
**Vercel Version:** Latest  
**Next.js Version:** 14.x