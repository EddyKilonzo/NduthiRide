# Deployment Guide — Vercel (Frontend) + Render (Backend)

## Architecture

```
Users → Vercel (Angular PWA)
           ↕ REST + WebSocket
       Render (NestJS API)
           ↕
       Render PostgreSQL
```

---

## What Was Fixed Before Deploying

These were already corrected in the codebase:

- ✅ Added `fileReplacements` to `angular.json` — production build now swaps in `environment.prod.ts`
- ✅ Added `cloudinaryCloudName`, `cloudinaryPreset`, and `firebase` to `environment.prod.ts`
- ✅ Created `frontend/vercel.json` — Angular SPA routing works on Vercel (no 404 on refresh)

---

## Step 1 — Deploy the Backend on Render

### 1.1 Create a PostgreSQL database on Render

1. Go to [render.com](https://render.com) → **New** → **PostgreSQL**
2. Name it `nduthiride-db`
3. Choose the free tier (or paid for production)
4. Copy the **Internal Database URL** — you'll need it as `DATABASE_URL`

### 1.2 Create a Web Service on Render

1. **New** → **Web Service** → connect your GitHub repo
2. Set **Root Directory** to `backend`
3. Set these:

| Field | Value |
|-------|-------|
| **Runtime** | Node |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npm run start:prod` |
| **Instance Type** | Free (or Starter for production) |

### 1.3 Set Environment Variables on Render

Go to your Web Service → **Environment** → add each of these:

```
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://nduthiride.vercel.app      ← update to your actual Vercel URL

DATABASE_URL=postgresql://...                   ← from Render PostgreSQL (Internal URL)

JWT_ACCESS_SECRET=<generate a strong random string>
JWT_REFRESH_SECRET=<generate a different strong random string>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

LIPANA_SECRET_KEY=<from Lipana dashboard>
LIPANA_WEBHOOK_SECRET=<from Lipana dashboard>

CLOUDINARY_CLOUD_NAME=duymwzfhj
CLOUDINARY_API_KEY=<from Cloudinary dashboard>
CLOUDINARY_API_SECRET=<from Cloudinary dashboard>

MAIL_HOST=smtp.gmail.com                        ← or your SMTP provider
MAIL_PORT=587
MAIL_USER=your@email.com
MAIL_PASS=<app password>
MAIL_FROM_NAME=NduthiRide
MAIL_FROM_ADDRESS=no-reply@nduthiride.co.ke

FIREBASE_SERVICE_ACCOUNT=<base64-encoded service account JSON>  ← optional, for push notifications
```

> **JWT Secrets:** Generate these with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
> Run it twice for two different secrets.

### 1.4 Run Prisma Migrations

After first deploy, open the Render Shell tab for your service and run:

```bash
npx prisma migrate deploy
```

This applies your migrations to the production database. You only need to do this once — future deploys run `prisma generate` automatically but not migrations (run them manually after schema changes).

### 1.5 Note your Render URL

Render gives you a URL like `https://nduthiride-api.onrender.com`. Copy it.

> ⚠️ **Free tier caveat:** Render free services spin down after 15 minutes of inactivity and take ~30 seconds to cold-start on the next request. Upgrade to the Starter plan ($7/mo) to avoid this in production.

---

## Step 2 — Deploy the Frontend on Vercel

### 2.1 Update the API URL

Open `frontend/src/environments/environment.prod.ts` and replace the placeholder with your actual Render URL:

```ts
apiUrl: 'https://nduthiride-api.onrender.com/api/v1',
wsUrl: 'https://nduthiride-api.onrender.com',
```

Commit and push this change before deploying.

### 2.2 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Vercel auto-detects Angular. Override these if needed:

| Field | Value |
|-------|-------|
| **Framework Preset** | Angular |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist/frontend/browser` |
| **Install Command** | `npm install` |

4. Click **Deploy**

> The `vercel.json` at `frontend/vercel.json` handles SPA routing — all routes (e.g. `/user/rides/123`) redirect to `index.html` so Angular can handle them.

### 2.3 Note your Vercel URL

Vercel gives you a URL like `https://nduthiride.vercel.app`. Go back to Render and update `FRONTEND_URL` to this value (for CORS).

---

## Step 3 — Wire Up Lipana Webhook

Once both are live, register your webhook URL in the Lipana dashboard:

```
https://nduthiride-api.onrender.com/api/v1/payments/lipana/webhook
```

See `PAYMENTS.md` for the full payments setup checklist.

---

## Step 4 — Verify Everything Works

Run through this checklist after deploying:

- [ ] Frontend loads at Vercel URL
- [ ] Login / Register works
- [ ] Refresh on a deep route (e.g. `/user/rides`) doesn't 404
- [ ] Book a ride — fare estimate returns
- [ ] Backend logs show no CORS errors (check Render logs)
- [ ] WebSocket connects (chat badge loads, live tracking works)
- [ ] Initiate an M-Pesa test payment — STK push arrives on phone
- [ ] Lipana webhook fires — payment status updates in real time

---

## Custom Domain (Optional)

### Frontend — Vercel
Vercel → your project → **Settings** → **Domains** → add `nduthiride.co.ke`

### Backend — Render
Render → your service → **Settings** → **Custom Domain** → add `api.nduthiride.co.ke`

Once custom domains are set, update `environment.prod.ts` and `FRONTEND_URL` to use them, then update `PAYMENTS.md` webhook URL.

---

## What I Need From You

Before I can update `environment.prod.ts` with the final values, I need:

- [ ] Your actual Render service URL (or custom domain) for the API
- [ ] Your actual Vercel URL (or custom domain) for the frontend
- [ ] Firebase config values (from Firebase Console → Project Settings → Your Apps) — needed for push notifications
- [ ] Cloudinary API Key and Secret (Cloud Name `duymwzfhj` is already set)
- [ ] Mail/SMTP credentials for transactional emails
