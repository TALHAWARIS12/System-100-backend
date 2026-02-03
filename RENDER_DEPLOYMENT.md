# 🚀 Render Deployment Guide

Complete guide to deploy **System-100** to production on Render.

---

## 📋 **Prerequisites**

- ✅ **GitHub Account** - https://github.com
- ✅ **Render Account** - https://render.com (sign up with GitHub)
- ✅ **Neon Database** - Already configured
- ✅ **Twelve Data API** - Already have key: `49b9ee3cb4314401aa9d074eb381bb75`

---

## 🗄️ **Step 1: Prepare Git Repository**

### Create Two Repositories

You'll need separate repos for frontend and backend (Render limitation).

#### **Backend Repository**

```bash
cd d:\System-100
git init
git add server/ package.json package-lock.json .gitignore
git commit -m "Backend initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/system100-backend.git
git push -u origin main
```

#### **Frontend Repository**

```bash
cd d:\System-100\client
git init
git add .
git commit -m "Frontend initial commit"  
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/system100-frontend.git
git push -u origin main
```

---

## 🖥️ **Step 2: Deploy Backend to Render**

### Create Web Service

1. Go to https://dashboard.render.com
2. Click **New** → **Web Service**
3. Connect your GitHub account
4. Select `system100-backend` repository
5. Configure:

```yaml
Name: system100-backend
Region: Oregon (US West) or closest to you
Branch: main
Root Directory: (leave empty)
Runtime: Node
Build Command: npm install
Start Command: npm start
Instance Type: Free (or Starter $7/month for better performance)
```

### Add Environment Variables

In Render dashboard → **Environment** tab:

```bash
# Database
DATABASE_URL=postgresql://neondb_owner:npg_WTsa1ptUM3nh@ep-falling-salad-ahx8odim-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require

# JWT - GENERATE NEW ONE
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRE=7d

# Stripe (Test for now)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_ID=price_your_price_id

# Twelve Data
TWELVE_DATA_API_KEY=49b9ee3cb4314401aa9d074eb381bb75

# Admin
MASTER_ADMIN_EMAIL=admin@tradingplatform.com
MASTER_ADMIN_PASSWORD=ChangeThisPassword123!

# Frontend URL (will update after frontend deploy)
FRONTEND_URL=https://your-frontend.onrender.com

# Node
NODE_ENV=production
PORT=5000
```

### Deploy

1. Click **Create Web Service**
2. Wait 5-10 minutes for build
3. Copy your backend URL: `https://system100-backend.onrender.com`
4. Test health: `https://system100-backend.onrender.com/health`

---

## 🌐 **Step 3: Deploy Frontend to Render**

### Create Static Site

1. Render Dashboard → **New** → **Static Site**
2. Select `system100-frontend` repository
3. Configure:

```yaml
Name: system100-frontend
Branch: main
Root Directory: (leave empty)
Build Command: npm install && npm run build
Publish Directory: dist
Instance Type: Free
```

### Add Environment Variables

```bash
VITE_API_URL=https://system100-backend.onrender.com/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

### Deploy

1. Click **Create Static Site**
2. Wait 3-5 minutes for build
3. Copy frontend URL: `https://system100-frontend.onrender.com`

---

## 🔗 **Step 4: Update CORS**

### Update Backend Environment

1. Go to backend service → **Environment**
2. Update `FRONTEND_URL`:

```bash
FRONTEND_URL=https://system100-frontend.onrender.com
```

3. Click **Save Changes** (auto-redeploys)

### Update Backend Code (if needed)

If CORS errors persist, update `server/index.js`:

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://system100-frontend.onrender.com' // Your Render URL
];
```

Commit and push to trigger redeploy.

---

## 💳 **Step 5: Configure Stripe Webhook**

1. Stripe Dashboard → **Developers** → **Webhooks**
2. Add endpoint URL:

```
https://system100-backend.onrender.com/api/webhooks/stripe
```

3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

4. Copy webhook signing secret
5. Update backend env: `STRIPE_WEBHOOK_SECRET=whsec_...`

---

## ✅ **Step 6: Verify Deployment**

### Test Checklist

- [ ] Frontend loads: Visit your frontend URL
- [ ] Backend health: `https://your-backend.onrender.com/health`
- [ ] Login works: Use `admin@tradingplatform.com` / `ChangeThisPassword123!`
- [ ] Scanner shows signals
- [ ] TradingView charts load
- [ ] Performance metrics display
- [ ] Navigation works

---

## ⚙️ **Step 7: Production Optimizations**

### Auto-Deploy on Git Push

Both services auto-deploy when you push to `main` branch:

```bash
# Make changes
git add .
git commit -m "Update feature"
git push

# Render auto-detects and deploys
```

### Health Checks

Render pings `/health` every 30 seconds. Already implemented:

```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### Prevent Sleep (Free Tier)

Free tier sleeps after 15 min inactivity. Use cron-job.org:

1. Go to https://cron-job.org
2. Create free account
3. Add job: `https://your-backend.onrender.com/health`
4. Schedule: Every 10 minutes
5. This keeps your app awake

---

## 📊 **Step 8: Monitor Logs**

### View Logs

**Backend:**
- Render Dashboard → Your backend service → **Logs** tab
- Real-time stream of server logs

**Frontend:**
- Render Dashboard → Your static site → **Deploy Logs**
- Build-time logs only (no runtime logs for static sites)

### Common Issues

**Backend crashes:**
```bash
# Check logs for:
- Database connection errors → Check DATABASE_URL
- Missing env variables → Add in Environment tab
- Port binding → Ensure using process.env.PORT
```

**Frontend build fails:**
```bash
# Check deploy logs for:
- npm install errors → Check package.json
- Build command errors → Verify vite build works locally
- Missing env vars → Add VITE_API_URL
```

---

## 💰 **Pricing**

### Free Tier Limitations

**Backend (Web Service):**
- Free: 750 hours/month
- Sleeps after 15 min inactivity
- Limited CPU/RAM

**Frontend (Static Site):**
- Free: 100 GB bandwidth/month
- Always on (no sleep)
- Free SSL

### Upgrade to Paid ($7/month)

**Benefits:**
- No sleep
- More CPU/RAM
- Better performance
- Custom domains

---

## 🔒 **Security Hardening**

### Generate New Secrets

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update in Render Environment tab
```

### Change Default Password

```bash
# After first login, change admin password in app
# Or update env: MASTER_ADMIN_PASSWORD
```

### Enable HTTPS Only

Render provides free SSL automatically. Force HTTPS:

```javascript
// Add to server/index.js
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

---

## 🐛 **Troubleshooting**

### Database Connection Errors

**Symptom:** Backend crashes, logs show Postgres errors

**Fix:**
1. Verify DATABASE_URL in env
2. Check Neon dashboard → Database is running
3. Test connection: `psql <DATABASE_URL>`

### CORS Errors

**Symptom:** Frontend can't reach backend

**Fix:**
1. Check `FRONTEND_URL` matches exactly
2. Update `server/index.js` allowedOrigins array
3. Redeploy backend

### Stripe Webhook Not Working

**Symptom:** Subscriptions not updating

**Fix:**
1. Verify webhook URL is correct
2. Check webhook secret in env
3. View Stripe Dashboard → Webhooks → Attempts

### Scanner Not Running

**Symptom:** No new signals

**Fix:**
1. Check scanner configs in database (use Neon SQL editor)
2. Verify Twelve Data API key
3. Check rate limits (800 calls/day free tier)

---

## 🎉 **Deployment Complete!**

Your trading platform is now live:

**Frontend:** https://system100-frontend.onrender.com  
**Backend:** https://system100-backend.onrender.com  
**Status:** https://system100-backend.onrender.com/health

**Next Steps:**
1. Test all features end-to-end
2. Add more scanner configurations (see `ADD_SCANNER_CONFIGS.sql`)
3. Set up Stripe live mode (see `STRIPE_PRODUCTION.md`)
4. Share frontend URL with clients

---

**Last Updated:** February 2026  
**Version:** 1.0.0  
**Platform:** Render
