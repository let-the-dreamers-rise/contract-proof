# API Requirements & Setup Guide

## Overview

ContractProof uses IBM Bob AI for intelligent code analysis and automated fix generation. This document explains what APIs are needed, how to obtain them, and how to configure the application.

---

## Required APIs

### 1. IBM Bob API (Primary)

**What it does:**
- Analyzes implementation code to detect drift
- Generates intelligent fix suggestions
- Provides natural language explanations
- Predicts breaking changes using ML

**Required for:**
- Auto-fix generation
- AI-powered drift detection
- Predictive analytics
- Code intent analysis

**Cost:**
- Free tier available for development and testing
- Paid tiers for production use

---

## Getting IBM Bob API Access

### Step 1: Sign Up for IBM Bob

1. Visit the IBM Bob website: [https://ibm.com/bob](https://ibm.com/bob) *(example URL)*
2. Click "Get Started" or "Sign Up"
3. Create an account with your email
4. Verify your email address

### Step 2: Create an API Key

1. Log in to your IBM Bob dashboard
2. Navigate to "API Keys" or "Developer Settings"
3. Click "Create New API Key"
4. Give it a descriptive name (e.g., "ContractProof Development")
5. Copy the API key immediately (it won't be shown again)
6. Store it securely (use a password manager)

### Step 3: Choose Your Plan

**Free Tier (Recommended for Development):**
- 1,000 API calls per month
- Basic features
- Community support
- Perfect for: Testing, development, small projects

**Pro Tier ($49/month):**
- 10,000 API calls per month
- Advanced features
- Priority support
- Perfect for: Small teams, production use

**Enterprise Tier (Custom pricing):**
- Unlimited API calls
- All features
- Dedicated support
- SLA guarantees
- Perfect for: Large organizations

### Step 4: Verify Your API Key

Test your API key using curl:

```bash
curl -X POST https://api.ibm.com/bob/v1/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code": "function test() { return true; }"}'
```

Expected response:
```json
{
  "status": "success",
  "analysis": { ... }
}
```

---

## Configuration

### Environment Variables

Create a `.env.local` file in the root of your project:

```bash
# IBM Bob API Configuration
BOB_API_KEY=your_api_key_here
BOB_API_URL=https://api.ibm.com/bob/v1

# Optional: Enable/Disable Features
ENABLE_BOB_FIXES=true
ENABLE_PREDICTIONS=true
ENABLE_AUTO_APPLY=false

# Optional: Rate Limiting
BOB_MAX_REQUESTS_PER_MINUTE=60
BOB_TIMEOUT_MS=30000

# Optional: Caching
ENABLE_CACHE=true
CACHE_TTL_SECONDS=3600
```

### Configuration File

Alternatively, create a `contractproof.config.js` file:

```javascript
module.exports = {
  bob: {
    apiKey: process.env.BOB_API_KEY,
    apiUrl: process.env.BOB_API_URL || 'https://api.ibm.com/bob/v1',
    timeout: 30000,
    maxRetries: 3,
    features: {
      autoFix: true,
      predictions: true,
      autoApply: false,
    },
    rateLimit: {
      maxRequestsPerMinute: 60,
      maxConcurrent: 5,
    },
  },
  cache: {
    enabled: true,
    ttl: 3600,
    maxSize: 100,
  },
};
```

---

## Setup Instructions

### For Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/contract-proof.git
   cd contract-proof
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Copy the example environment file:**
   ```bash
   cp .env.example .env.local
   ```

4. **Add your IBM Bob API key:**
   ```bash
   # Edit .env.local
   BOB_API_KEY=your_actual_api_key_here
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   ```
   http://localhost:3000
   ```

### For Production

1. **Set environment variables in your hosting platform:**

   **Vercel:**
   ```bash
   vercel env add BOB_API_KEY
   # Paste your API key when prompted
   ```

   **Netlify:**
   ```bash
   netlify env:set BOB_API_KEY your_api_key_here
   ```

   **AWS/Docker:**
   ```bash
   export BOB_API_KEY=your_api_key_here
   ```

2. **Build and deploy:**
   ```bash
   npm run build
   npm start
   ```

### For CI/CD

Add your API key as a secret in your CI/CD platform:

**GitHub Actions:**
```yaml
# .github/workflows/test.yml
env:
  BOB_API_KEY: ${{ secrets.BOB_API_KEY }}
```

**GitLab CI:**
```yaml
# .gitlab-ci.yml
variables:
  BOB_API_KEY: $BOB_API_KEY
```

**CircleCI:**
```yaml
# .circleci/config.yml
environment:
  BOB_API_KEY: ${BOB_API_KEY}
```

---

## Demo Mode (No API Key Required)

ContractProof includes a **demo mode** that works without any API keys. This is perfect for:
- Trying out the application
- Hackathon submissions
- Presentations and demos
- Development without API access

### How Demo Mode Works

When no API key is configured, ContractProof automatically:
1. Uses mock data for drift detection
2. Simulates IBM Bob responses
3. Shows example fix suggestions
4. Demonstrates all features with sample data

### Enabling Demo Mode

Demo mode is **automatically enabled** when `BOB_API_KEY` is not set.

To explicitly enable demo mode:

```bash
# .env.local
DEMO_MODE=true
```

### Demo Mode Features

**Available in Demo Mode:**
- ✅ Upload and validate OpenAPI specs
- ✅ View sample drift detection results
- ✅ See example fix suggestions
- ✅ Explore the dashboard and UI
- ✅ Test CI/CD integration (dry-run)
- ✅ View sample analytics and graphs

**Not Available in Demo Mode:**
- ❌ Real code analysis
- ❌ Actual IBM Bob AI integration
- ❌ Live predictions
- ❌ Auto-apply fixes to real code

### Sample Data

Demo mode includes realistic sample data:
- 3 sample API projects
- 47 example drift issues
- 12 critical issues
- 23 warning issues
- 16 fixed issues
- Example fix suggestions for each issue

---

## Troubleshooting

### Common Issues

**Issue: "Invalid API Key" Error**

**Solution:**
1. Verify your API key is correct (no extra spaces)
2. Check if the key has expired
3. Ensure you're using the correct environment variable name
4. Try regenerating the API key

**Issue: "Rate Limit Exceeded" Error**

**Solution:**
1. Reduce the number of concurrent requests
2. Implement request throttling
3. Upgrade to a higher tier plan
4. Enable caching to reduce API calls

**Issue: "Timeout" Error**

**Solution:**
1. Increase the timeout value in configuration
2. Check your internet connection
3. Verify IBM Bob API status
4. Try again during off-peak hours

**Issue: "API Key Not Found" Error**

**Solution:**
1. Ensure `.env.local` file exists
2. Restart the development server
3. Check environment variable is loaded: `console.log(process.env.BOB_API_KEY)`
4. Verify file is not in `.gitignore`

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
# .env.local
DEBUG=contractproof:*
LOG_LEVEL=debug
```

This will output detailed logs:
```
[ContractProof] Loading configuration...
[ContractProof] Bob API Key: bob_***************xyz
[ContractProof] Connecting to IBM Bob API...
[ContractProof] API call successful (234ms)
```

### Testing API Connection

Use the built-in health check endpoint:

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "bob": {
    "connected": true,
    "latency": 234,
    "rateLimit": {
      "remaining": 950,
      "limit": 1000
    }
  }
}
```

---

## API Usage & Best Practices

### Rate Limiting

**Free Tier Limits:**
- 1,000 requests per month
- ~33 requests per day
- ~1.4 requests per hour

**Best Practices:**
1. **Cache results** - Store analysis results for 1 hour
2. **Batch requests** - Analyze multiple files in one request
3. **Incremental analysis** - Only analyze changed files
4. **Use webhooks** - Get notified instead of polling

### Caching Strategy

Implement caching to reduce API calls:

```javascript
// lib/cache.ts
const cache = new Map();

export async function getCachedAnalysis(fileHash: string) {
  const cached = cache.get(fileHash);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.data;
  }
  return null;
}

export function setCachedAnalysis(fileHash: string, data: any) {
  cache.set(fileHash, {
    data,
    timestamp: Date.now(),
  });
}
```

### Error Handling

Implement robust error handling:

```javascript
// lib/bob-client.ts
async function callBobAPI(code: string) {
  try {
    const response = await fetch(BOB_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BOB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
      timeout: 30000,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your configuration.');
      }
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Bob API error:', error);
    // Fall back to demo mode
    return getDemoResponse(code);
  }
}
```

### Monitoring Usage

Track your API usage:

```javascript
// lib/usage-tracker.ts
export class UsageTracker {
  private requests = 0;
  private startTime = Date.now();

  track() {
    this.requests++;
  }

  getStats() {
    const elapsed = Date.now() - this.startTime;
    const requestsPerHour = (this.requests / elapsed) * 3600000;
    return {
      totalRequests: this.requests,
      requestsPerHour,
      estimatedMonthly: requestsPerHour * 24 * 30,
    };
  }
}
```

---

## Security Best Practices

### Protecting Your API Key

**DO:**
- ✅ Store API keys in environment variables
- ✅ Use `.env.local` for local development
- ✅ Add `.env.local` to `.gitignore`
- ✅ Use secrets management in production
- ✅ Rotate keys regularly (every 90 days)
- ✅ Use different keys for dev/staging/prod

**DON'T:**
- ❌ Commit API keys to version control
- ❌ Share API keys in chat/email
- ❌ Use production keys in development
- ❌ Hardcode keys in source code
- ❌ Log API keys in console/files
- ❌ Expose keys in client-side code

### Key Rotation

Rotate your API keys regularly:

1. Generate a new API key
2. Update environment variables
3. Deploy with new key
4. Verify everything works
5. Revoke old key after 24 hours

### Access Control

Restrict API key permissions:
- Limit to specific IP addresses
- Set expiration dates
- Use read-only keys when possible
- Enable audit logging

---

## Alternative Options

### Without IBM Bob API

If you don't have access to IBM Bob API, ContractProof can still provide value:

**Available Features:**
- ✅ OpenAPI spec validation
- ✅ Basic drift detection (spec vs. code)
- ✅ Manual fix suggestions
- ✅ CI/CD integration
- ✅ Dashboard and reporting

**Limited Features:**
- ⚠️ No AI-powered analysis
- ⚠️ No auto-fix generation
- ⚠️ No predictive analytics
- ⚠️ Basic code analysis only

### Using Alternative AI Providers

ContractProof can be configured to use alternative AI providers:

**OpenAI GPT-4:**
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
```

**Anthropic Claude:**
```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_key
```

**Local Models:**
```bash
AI_PROVIDER=local
LOCAL_MODEL_PATH=/path/to/model
```

---

## Support & Resources

### Getting Help

**Documentation:**
- Full documentation: [docs.contractproof.io](https://docs.contractproof.io)
- API reference: [api.contractproof.io](https://api.contractproof.io)
- Video tutorials: [YouTube channel](https://youtube.com/@contractproof)

**Community:**
- Discord: [discord.gg/contractproof](https://discord.gg/contractproof)
- GitHub Discussions: [github.com/contractproof/discussions](https://github.com/contractproof/discussions)
- Stack Overflow: Tag `contractproof`

**Support:**
- Email: support@contractproof.io
- Twitter: [@contractproof](https://twitter.com/contractproof)
- Status page: [status.contractproof.io](https://status.contractproof.io)

### IBM Bob Resources

**Official Documentation:**
- IBM Bob Docs: [ibm.com/bob/docs](https://ibm.com/bob/docs)
- API Reference: [ibm.com/bob/api](https://ibm.com/bob/api)
- Community Forum: [community.ibm.com/bob](https://community.ibm.com/bob)

**Tutorials:**
- Getting Started Guide
- Best Practices
- Advanced Features
- Integration Examples

---

## FAQ

**Q: Do I need an IBM Bob API key to use ContractProof?**
A: No, ContractProof works in demo mode without an API key. However, you'll need an API key for production use and to access AI-powered features.

**Q: Is the IBM Bob API free?**
A: Yes, IBM Bob offers a free tier with 1,000 API calls per month, which is sufficient for development and small projects.

**Q: Can I use ContractProof without any API keys?**
A: Yes, demo mode provides full UI functionality with sample data. Perfect for testing and presentations.

**Q: How do I get more API calls?**
A: Upgrade to a paid tier or implement caching to reduce API usage.

**Q: Is my code sent to IBM Bob?**
A: Yes, code is sent to IBM Bob for analysis. Use on-premise deployment if you have security concerns.

**Q: Can I use my own AI model?**
A: Yes, ContractProof supports alternative AI providers and local models.

**Q: What happens if I exceed my rate limit?**
A: The application will fall back to demo mode or queue requests for later processing.

**Q: How secure is my API key?**
A: API keys are stored as environment variables and never exposed to the client. Follow security best practices for maximum protection.

---

## Quick Start Checklist

- [ ] Sign up for IBM Bob account
- [ ] Generate API key
- [ ] Copy `.env.example` to `.env.local`
- [ ] Add API key to `.env.local`
- [ ] Install dependencies (`npm install`)
- [ ] Start development server (`npm run dev`)
- [ ] Test API connection (`/api/health`)
- [ ] Upload sample OpenAPI spec
- [ ] Verify drift detection works
- [ ] Try auto-fix generation
- [ ] Configure CI/CD integration

---

## Next Steps

Once you have your API key configured:

1. **Upload your first OpenAPI spec** - Try the demo page
2. **Connect your repository** - Enable automatic code analysis
3. **Set up CI/CD** - Integrate with GitHub Actions
4. **Configure notifications** - Get alerts for drift issues
5. **Explore advanced features** - Predictive analytics, auto-apply fixes

---

*For more information, visit our [documentation](https://docs.contractproof.io) or join our [Discord community](https://discord.gg/contractproof).*