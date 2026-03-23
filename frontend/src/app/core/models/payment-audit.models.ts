/**
 * Payment Audit Log models for tracking and compliance
 */

export interface PaymentAuditLog {
  id: string;
  paymentId: string;
  userId: string;
  action: AuditAction;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string; // ISO 8601 date string
}

export type AuditAction =
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_INITIATION_FAILED'
  | 'STK_PUSH_SENT'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_PROCESSED'
  | 'RECONCILIATION_PERFORMED';

export interface SuspiciousActivityReport {
  userId: string;
  failedCount: number;
  lastAttempt: string; // ISO 8601 date string
}

export interface PaymentReconciliationResult {
  date: string;
  localPayments: number;
  lipanaPayments: number;
  matched: number;
  discrepancies: ReconciliationDiscrepancy[];
  totalAmount: {
    local: number;
    lipana: number;
    difference: number;
  };
}

export interface ReconciliationDiscrepancy {
  paymentId: string;
  type: 'MISSING_IN_LIPANA' | 'MISSING_IN_LOCAL' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH';
  localAmount?: number;
  lipanaAmount?: number;
  localStatus?: string;
  lipanaStatus?: string;
}

export interface PaymentAnalytics {
  period: string;
  totalRevenue: number;
  totalTransactions: number;
  successRate: number;
  averagePaymentTime: number; // in seconds
  failedPayments: number;
  peakHours: Array<{
    hour: number;
    count: number;
    amount: number;
  }>;
  paymentMethods: Array<{
    method: 'MPESA' | 'CASH';
    count: number;
    amount: number;
  }>;
  dailyStats: Array<{
    date: string;
    transactions: number;
    revenue: number;
    successRate: number;
  }>;
}

export interface PaymentReceipt {
  paymentId: string;
  transactionId: string;
  mpesaReceiptNumber: string | null;
  amount: number;
  status: string;
  paymentMethod: string;
  entityType: 'ride' | 'parcel';
  entityId: string;
  createdAt: string;
  completedAt: string | null;
  userId: string;
  userName: string;
  userPhone: string;
}
