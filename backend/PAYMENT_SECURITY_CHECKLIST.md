# Lipana Payment Integration - Security & Functionality Verification

## ✅ Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] `.env` file contains valid Lipana credentials
- [ ] `LIPANA_SECRET_KEY` starts with `lip_sk_test_` (sandbox) or `lip_sk_live_` (production)
- [ ] `LIPANA_WEBHOOK_SECRET` is set and matches Lipana dashboard
- [ ] `LIPANA_API_URL` is set to `https://api.lipana.dev/v1`
- [ ] Environment variables are NOT committed to version control

### 2. Lipana Dashboard Configuration
- [ ] Account created and verified at [lipana.dev](https://lipana.dev)
- [ ] API keys generated (publishable + secret)
- [ ] Webhook URL configured: `https://your-domain.com/api/v1/payments/lipana/webhook`
- [ ] Webhook secret copied to `.env`
- [ ] Test mode enabled for sandbox testing

### 3. Database Setup
- [ ] PostgreSQL database running
- [ ] Prisma schema migrated (`npx prisma migrate dev`)
- [ ] Payment model includes: `checkoutRequestId`, `mpesaReceiptNumber`, `status`
- [ ] Indexes created for payment lookup queries

---

## 🔒 Security Verification Tests

### Authentication & Authorization

| Test | Expected Result | Status |
|------|-----------------|--------|
| Payment without JWT token | 401 Unauthorized | ⬜ |
| User paying for another's ride | 400 BadRequest | ⬜ |
| Rider initiating user payment | 403 Forbidden | ⬜ |

### Input Validation

| Test | Expected Result | Status |
|------|-----------------|--------|
| Invalid phone number format | 400 BadRequest | ⬜ |
| Payment amount < KES 10 | 400 BadRequest | ⬜ |
| Payment amount > KES 150,000 | 400 BadRequest | ⬜ |
| Missing rideId AND parcelId | 400 BadRequest | ⬜ |
| Non-existent ride ID | 404 NotFound | ⬜ |

### Fraud Detection

| Test | Expected Result | Status |
|------|-----------------|--------|
| 5 failed payments in 15min | 403 Forbidden (blocked) | ⬜ |
| Duplicate request within 30s | 400 BadRequest | ⬜ |
| Existing pending payment | Returns existing (no duplicate STK) | ⬜ |

### Circuit Breaker

| Test | Expected Result | Status |
|------|-----------------|--------|
| 5 consecutive Lipana failures | Circuit opens | ⬜ |
| Request during OPEN state | 503 Service Unavailable | ⬜ |
| After 1 minute timeout | Circuit HALF_OPEN, allows retry | ⬜ |

### Webhook Security

| Test | Expected Result | Status |
|------|-----------------|--------|
| Missing X-Lipana-Signature | Logged, returns 200 | ⬜ |
| Invalid signature | Logged, returns 200 | ⬜ |
| Timestamp > 5 minutes old | Rejected, returns 200 | ⬜ |
| Duplicate webhook (replay) | Skipped, returns 200 | ⬜ |
| Already completed payment | Skipped, returns 200 | ⬜ |

---

## 🧪 Functional Testing

### STK Push Flow

```bash
# 1. Initiate Payment
curl -X POST http://localhost:3000/api/v1/payments/initiate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rideId": "ride-123",
    "method": "MPESA",
    "mpesaPhone": "0712345678"
  }'

# Expected Response:
{
  "success": true,
  "data": {
    "paymentId": "pay-123",
    "transactionId": "TXN123456",
    "checkoutRequestId": "ws_CO_123",
    "message": "Check your phone for the M-Pesa prompt"
  }
}
```

**Verify:**
- [ ] STK push received on phone
- [ ] Transaction ID stored in database
- [ ] Checkout Request ID stored in database
- [ ] Payment status = PROCESSING

### Payment Status Polling

```bash
# 2. Poll Payment Status
curl -X GET http://localhost:3000/api/v1/payments/status/ws_CO_123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Expected Response (pending):
{
  "success": true,
  "data": {
    "id": "pay-123",
    "status": "PROCESSING",
    "amount": 500,
    "mpesaReceiptNumber": "TXN123456",
    "completedAt": null
  }
}
```

**Verify:**
- [ ] Status updates to COMPLETED after user enters PIN
- [ ] Receipt number populated
- [ ] completedAt timestamp set

### Webhook Callback

**Simulate Lipana Webhook:**

```bash
curl -X POST http://localhost:3000/api/v1/payments/lipana/webhook \
  -H "Content-Type: application/json" \
  -H "X-Lipana-Signature: COMPUTED_HMAC_SIGNATURE" \
  -d '{
    "event": "payment.success",
    "data": {
      "transactionId": "TXN123456",
      "amount": 500,
      "status": "success",
      "phone": "+254712345678",
      "checkoutRequestID": "ws_CO_123",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }'
```

**Verify:**
- [ ] Signature verified
- [ ] Timestamp validated (< 5 min old)
- [ ] Payment status → COMPLETED
- [ ] Audit log created

---

## 📊 Monitoring & Alerting

### Logs to Monitor

| Log Message | Severity | Action |
|-------------|----------|--------|
| `Fraud alert: User exceeded max failed payment attempts` | WARN | Review user activity |
| `Circuit breaker: OPEN` | ERROR | Check Lipana API status |
| `Webhook signature verification failed` | WARN | Investigate potential attack |
| `Replay attack detected` | CRITICAL | Security incident response |
| `initiatePayment failed` | ERROR | Debug payment flow |

### Metrics to Track

- [ ] Payment success rate (target: > 95%)
- [ ] Average payment completion time (target: < 2 minutes)
- [ ] Failed payment attempts per user (alert if > 5/15min)
- [ ] Circuit breaker trips (alert on any trip)
- [ ] Webhook signature failures (alert on spike)

---

## 🔐 Security Audit

### Code Review Checklist

- [x] All functions have try-catch blocks
- [x] Sensitive data (phone numbers) validated before use
- [x] Webhook signature uses constant-time comparison
- [x] Idempotency prevents duplicate charges
- [x] Fraud detection blocks brute-force attempts
- [x] Circuit breaker protects against cascade failures
- [x] Audit logging for all payment operations
- [x] Error messages don't leak sensitive information

### Penetration Testing

| Test | Method | Expected Result |
|------|--------|-----------------|
| Signature tampering | Modify webhook payload, keep signature | Rejected |
| Replay attack | Resend old webhook | Rejected (24h cache) |
| Timestamp manipulation | Send timestamp from 1 hour ago | Rejected |
| Amount manipulation | Modify amount in webhook | Ignored (uses DB amount) |
| Race condition | Send 2 payment requests simultaneously | One succeeds |

---

## 🚀 Production Deployment

### Pre-Launch

- [ ] Switch to production Lipana keys (`lip_sk_live_*`)
- [ ] Update webhook URL to production domain
- [ ] Enable HTTPS (required for webhooks)
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS for production frontend URL
- [ ] Test with real M-Pesa transactions (small amounts)

### Post-Launch Monitoring

- [ ] Monitor first 100 transactions closely
- [ ] Verify webhook delivery rate (target: 100%)
- [ ] Check error logs for unexpected issues
- [ ] Confirm payment reconciliation matches Lipana dashboard

---

## 📝 Test Results Summary

### Integration Tests

```bash
cd backend
npm test -- payments.integration.spec.ts
```

**Results:**
- Total Tests: _____
- Passed: _____
- Failed: _____
- Coverage: _____%

### Security Tests

| Category | Tests Run | Passed | Failed |
|----------|-----------|--------|--------|
| Authentication | ___ | ___ | ___ |
| Input Validation | ___ | ___ | ___ |
| Fraud Detection | ___ | ___ | ___ |
| Webhook Security | ___ | ___ | ___ |
| Circuit Breaker | ___ | ___ | ___ |

### Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Security Review | | | |
| QA Engineer | | | |
| Product Owner | | | |

---

## 🆘 Troubleshooting

### Common Issues

**Issue: STK push not received**
- Check phone number format (+2547XX...)
- Verify Lipana API key is valid
- Check Lipana dashboard for failed requests
- Review logs for Lipana API errors

**Issue: Webhook not received**
- Verify webhook URL is publicly accessible
- Check firewall allows POST requests
- Verify SSL certificate is valid
- Check Lipana dashboard for delivery status

**Issue: Signature verification fails**
- Confirm `LIPANA_WEBHOOK_SECRET` matches dashboard
- Ensure raw body is being read (not parsed JSON)
- Check `X-Lipana-Signature` header is present

**Issue: Duplicate charges**
- Verify idempotency cache is working
- Check for multiple frontend button clicks
- Review payment status before initiating
- Enable pending payment detection

---

## 📚 References

- [Lipana Documentation](https://lipana.dev/docs)
- [Lipana Dashboard](https://lipana.dev/dashboard)
- [M-Pesa STK Push Guide](https://developer.safaricom.co.ke/APIs)
- [NestJS Security Best Practices](https://docs.nestjs.com/security)
