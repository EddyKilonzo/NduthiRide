# Payments Integration — NduthiRide × Lipana (M-Pesa)

## What's Already Built

The payment backend is **fully scaffolded** and production-ready. Here's what exists:

| Area | Status |
|------|--------|
| STK Push initiation via Lipana SDK | ✅ Done |
| Webhook handler (`POST /api/v1/payments/lipana/webhook`) | ✅ Done |
| HMAC-SHA256 signature verification | ✅ Done |
| Replay attack prevention (24h window) | ✅ Done |
| Timestamp validation (5-min window) | ✅ Done |
| WebSocket notification on payment success/fail | ✅ Done |
| Payment status polling endpoint | ✅ Done |
| Idempotency (30s duplicate-request guard) | ✅ Done |
| Fraud detection (5 failed attempts → 15-min block) | ✅ Done |
| Circuit breaker for Lipana API failures | ✅ Done |
| Phone number normalisation (07XX / 2547XX / +2547XX) | ✅ Done |
| Cash payment recording (no STK push) | ✅ Done |
| PDF receipt generation | ✅ Done |
| Admin analytics, reconciliation, audit logs | ✅ Done |
| Raw body preserved in NestJS for signature check | ✅ Done (`rawBody: true` in main.ts) |
| Ride payment gate (rider can't complete until paid) | ✅ Done |
| **Parcel payment gate** | ⏳ Pending (next task) |

---

## What I Need From You

### 1. Lipana Credentials

Add these two values to `backend/.env`:

```env
# Lipana SDK key — get this from your Lipana dashboard → API Keys
LIPANA_SECRET_KEY=your_lipana_secret_key_here

# Webhook signing secret — get this from Lipana dashboard → Webhooks → Signing Secret
LIPANA_WEBHOOK_SECRET=your_lipana_webhook_secret_here
```

> **Where to find them:**
> - Log in to [lipana.dev](https://lipana.dev)
> - `LIPANA_SECRET_KEY` → Dashboard → **API Keys** → Secret Key (use the **test** key for sandbox, **live** key for production)
> - `LIPANA_WEBHOOK_SECRET` → Dashboard → **Webhooks** → the signing secret shown next to your webhook endpoint

---

### 2. Register the Webhook URL in Lipana

In your Lipana dashboard under **Webhooks**, add this URL:

```
https://YOUR_DOMAIN/api/v1/payments/lipana/webhook
```

For local development use **ngrok** or **Expose** to tunnel your local server:

```bash
ngrok http 3000
# → Use the https://xxxx.ngrok.io/api/v1/payments/lipana/webhook URL in Lipana
```

Lipana will POST to this endpoint with the following events:
- `payment.success` — marks payment COMPLETED, notifies client via WebSocket
- `payment.failed` — marks payment FAILED, notifies client via WebSocket
- `payment.pending` — no status change, WebSocket ping only

---

### 3. Environment (Sandbox vs Production)

The SDK environment is set automatically from `NODE_ENV`:

```
NODE_ENV=development  →  Lipana sandbox
NODE_ENV=production   →  Lipana production (live M-Pesa)
```

Make sure you use **test credentials** during development and switch to **live credentials** only when deploying to production.

---

## Payment Flow (How It Works End-to-End)

```
User taps "Pay via M-Pesa"
        │
        ▼
Frontend → POST /api/v1/payments/ride/:rideId  { method: MPESA, mpesaPhone }
        │
        ▼
Backend creates Payment record (status: PROCESSING)
Backend calls Lipana STK push → user's phone rings
        │
        ▼
Frontend subscribes to WebSocket room for this paymentId
Frontend shows "Check your phone for the M-Pesa prompt"
        │
        ▼
User approves on phone
        │
        ▼
Lipana hits POST /api/v1/payments/lipana/webhook  { event: "payment.success", ... }
Backend verifies HMAC signature
Backend updates Payment → status: COMPLETED
Backend emits WebSocket event → frontend badge turns green
        │
        ▼
Rider's "Complete Ride" button becomes enabled
Rider taps Complete → backend confirms payment exists → marks ride COMPLETED
```

---

## What's Left To Build

### Parcel Payment Gate (next task)
Same gate we added for rides — the rider cannot mark a parcel `DELIVERED` unless the MPESA payment is confirmed. Two-line backend check + frontend button disable.

### Minor Items
- `MPESA_CALLBACK_URL` in `.env` is currently unused (it's a legacy Daraja field). It can stay set to the webhook URL for reference but Lipana doesn't use it.
- The existing `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY` config keys are **Daraja (Safaricom direct) leftovers** — they are not used by the Lipana SDK and can be removed from `.env` to avoid confusion.

---

## Quick Checklist

- [ ] Add `LIPANA_SECRET_KEY` to `backend/.env`
- [ ] Add `LIPANA_WEBHOOK_SECRET` to `backend/.env`
- [ ] Register webhook URL in Lipana dashboard
- [ ] Test STK push in sandbox (use Lipana test phone numbers)
- [ ] Verify webhook arrives and payment status updates in DB
- [ ] Parcel payment gate (I can do this — just say go)
- [ ] Switch to live keys when deploying to production
