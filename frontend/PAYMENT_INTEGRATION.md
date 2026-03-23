# Frontend Payment Integration Guide

## Overview

The NduthiRide frontend payment integration uses the **Lipana M-Pesa API** for secure payment processing. All payment operations include comprehensive error handling with try-catch blocks.

---

## Files Modified/Created

| File | Purpose |
|------|---------|
| `src/app/core/api/payments.api.ts` | API endpoints with type safety |
| `src/app/core/services/payment.service.ts` | Business logic with error handling |
| `src/app/core/models/payment-audit.models.ts` | TypeScript types for audit/analytics |
| `src/types/aos.d.ts` | Type declaration for AOS library |

---

## Payment Service API Reference

### Core Payment Methods

#### 1. Initiate Payment
```typescript
try {
  const result = await paymentService.initiate({
    rideId: 'ride-123', // or parcelId
    method: 'MPESA',
    mpesaPhone: '0712345678',
  });
  
  console.log('Payment ID:', result.paymentId);
  console.log('Transaction ID:', result.transactionId);
} catch (error) {
  // Error handled by GlobalErrorInterceptor
  // Show user-friendly message
  this.toastService.showError('Payment initiation failed', error);
}
```

#### 2. Initiate for Ride
```typescript
try {
  const result = await paymentService.initiateForRide(
    'ride-123',
    '0712345678',
    'MPESA'
  );
} catch (error) {
  this.toastService.showError('Failed to initiate ride payment', error);
}
```

#### 3. Initiate for Parcel
```typescript
try {
  const result = await paymentService.initiateForParcel(
    'parcel-123',
    '0712345678',
    'MPESA'
  );
} catch (error) {
  this.toastService.showError('Failed to initiate parcel payment', error);
}
```

#### 4. Poll Payment Status
```typescript
try {
  const result = await paymentService.pollStatus('ws_CO_123');
  
  if (result.status === 'COMPLETED') {
    this.toastService.showSuccess('Payment completed!');
  } else if (result.status === 'FAILED') {
    this.toastService.showError('Payment failed', null);
  }
} catch (error) {
  // Timeout after 80 seconds
  this.toastService.showError('Payment verification timed out', error);
}
```

---

### Audit Log Methods (Admin Only)

#### Get Payment Audit Logs
```typescript
try {
  const logs = await paymentService.getAuditLogsForPayment('pay-123');
  console.log('Audit logs:', logs);
} catch (error) {
  this.toastService.showError('Failed to load audit logs', error);
}
```

#### Get User Audit Logs
```typescript
try {
  const logs = await paymentService.getAuditLogsForUser('user-123', 50);
  console.log('User audit logs:', logs);
} catch (error) {
  this.toastService.showError('Failed to load user logs', error);
}
```

#### Get Suspicious Activity
```typescript
try {
  const reports = await paymentService.getSuspiciousActivity(24);
  console.log('Suspicious activity:', reports);
} catch (error) {
  this.toastService.showError('Failed to load suspicious activity', error);
}
```

---

### Reconciliation Methods (Admin Only)

#### Reconcile Payments
```typescript
try {
  const result = await paymentService.reconcilePayments('2024-01-15');
  console.log('Matched:', result.matched);
  console.log('Discrepancies:', result.discrepancies);
} catch (error) {
  this.toastService.showError('Reconciliation failed', error);
}
```

---

### Analytics Methods (Admin Only)

#### Get Payment Analytics
```typescript
try {
  const analytics = await paymentService.getAnalytics('7d');
  console.log('Total revenue:', analytics.totalRevenue);
  console.log('Success rate:', analytics.successRate);
  console.log('Peak hours:', analytics.peakHours);
} catch (error) {
  this.toastService.showError('Failed to load analytics', error);
}
```

---

### Receipt Methods

#### Download Receipt PDF
```typescript
try {
  const pdfBlob = await paymentService.downloadReceipt('pay-123');
  
  // Create download link
  const url = window.URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${paymentId}.pdf`;
  link.click();
  window.URL.revokeObjectURL(url);
} catch (error) {
  this.toastService.showError('Failed to download receipt', error);
}
```

#### Get Receipt Data
```typescript
try {
  const receipt = await paymentService.getReceipt('pay-123');
  console.log('Receipt:', receipt);
} catch (error) {
  this.toastService.showError('Failed to load receipt', error);
}
```

---

## Error Handling

All payment service methods use try-catch blocks for secure error handling:

### Error Flow
```
Component → PaymentService (try-catch) → PaymentsApi → BaseApiService (try-catch)
                                              ↓
                                    GlobalErrorInterceptor
                                              ↓
                                    ToastService (user message)
```

### Best Practices

1. **Always use try-catch** when calling payment methods
2. **Show user-friendly messages** - don't expose technical errors
3. **Log errors for debugging** - but don't log sensitive data
4. **Handle timeout scenarios** - payment polling has 80s timeout

### Example Component Usage

```typescript
@Component({ ... })
export class PaymentComponent {
  private readonly paymentService = inject(PaymentService);
  private readonly toastService = inject(ToastService);

  async onPayButtonClick(rideId: string, phone: string) {
    try {
      // Show loading state
      this.isLoading = true;

      // Initiate payment
      const result = await this.paymentService.initiateForRide(rideId, phone);

      // Show success message
      this.toastService.showSuccess('STK push sent! Check your phone.');

      // Poll for completion
      const finalStatus = await this.paymentService.pollStatus(result.checkoutRequestId);

      if (finalStatus.status === 'COMPLETED') {
        this.toastService.showSuccess('Payment successful!');
        this.router.navigate(['/rides']);
      } else {
        this.toastService.showError('Payment failed. Please try again.', null);
      }

    } catch (error) {
      // Error already shown by GlobalErrorInterceptor
      console.error('Payment error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
```

---

## Security Features

### Input Validation
```typescript
// Payment initiation validates:
- rideId XOR parcelId must be provided
- mpesaPhone required for MPESA payments
- Phone number format validated server-side
- Amount limits enforced (KES 10 - 150,000)
```

### Error Message Security
```typescript
// ❌ Don't do this - exposes technical details
console.error('API Error:', error.message);

// ✅ Do this - generic user message
this.toastService.showError('Payment failed. Please try again.', null);
```

### Polling Timeout Protection
```typescript
// Prevents infinite loops
const maxAttempts = 20; // 80 seconds total
const pollInterval = 4000; // 4 seconds
```

---

## TypeScript Types

### Payment Status
```typescript
type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
```

### Audit Log
```typescript
interface PaymentAuditLog {
  id: string;
  paymentId: string;
  userId: string;
  action: AuditAction;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
```

### Analytics
```typescript
interface PaymentAnalytics {
  period: string;
  totalRevenue: number;
  totalTransactions: number;
  successRate: number;
  averagePaymentTime: number;
  failedPayments: number;
  peakHours: Array<{ hour: number; count: number; amount: number }>;
  // ... more fields
}
```

---

## API Endpoints Summary

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/payments/initiate` | ✅ JWT | USER | Initiate new payment |
| POST | `/payments/ride/:id` | ✅ JWT | USER | Pay for ride |
| POST | `/payments/parcel/:id` | ✅ JWT | USER | Pay for parcel |
| GET | `/payments/status/:id` | ✅ JWT | USER | Get payment status |
| GET | `/payments/audit/payment/:id` | ✅ JWT | ADMIN | Get audit logs |
| GET | `/payments/audit/user/:id` | ✅ JWT | ADMIN | Get user logs |
| GET | `/payments/audit/suspicious` | ✅ JWT | ADMIN | Suspicious activity |
| GET | `/payments/reconcile` | ✅ JWT | ADMIN | Reconcile payments |
| GET | `/payments/analytics/summary` | ✅ JWT | ADMIN | Get analytics |
| GET | `/payments/:id/receipt` | ✅ JWT | USER | Get receipt PDF |

---

## Testing

### Unit Test Example
```typescript
describe('PaymentService', () => {
  it('should initiate payment successfully', async () => {
    const mockResult = {
      paymentId: 'pay-123',
      transactionId: 'TXN123',
      checkoutRequestId: 'ws_CO_123',
      message: 'STK push sent',
    };

    const result = await service.initiate({
      rideId: 'ride-123',
      method: 'MPESA',
      mpesaPhone: '0712345678',
    });

    expect(result.paymentId).toBe('pay-123');
  });

  it('should throw error when rideId is missing', async () => {
    await expect(service.initiate({
      method: 'MPESA',
      mpesaPhone: '0712345678',
    })).rejects.toThrow('Either rideId or parcelId must be provided');
  });
});
```

---

## Troubleshooting

### Common Issues

**Issue: "Payment polling timed out"**
- User didn't enter PIN on phone
- M-Pesa service is down
- Network connectivity issues
- **Solution:** Retry or use cash payment

**Issue: "Invalid phone number format"**
- Phone must be Kenyan format (07XX, +2547XX, 2547XX)
- **Solution:** Validate before calling service

**Issue: "Receipt download failed"**
- Payment not yet completed
- PDF generation service unavailable
- **Solution:** Try again after payment completes

---

## Related Documentation

- [Backend Payment Security](../../backend/PAYMENT_SECURITY_CHECKLIST.md)
- [Backend Implementation Summary](../../backend/IMPLEMENTATION_SUMMARY.md)
- [Lipana API Documentation](https://lipana.dev/docs)

---

**Last Updated:** 2026-03-23
**Version:** 1.0.0
