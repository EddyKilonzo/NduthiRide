import { Injectable, inject } from '@angular/core';
import { PaymentStatus } from '../models/payment.models';
import { PaymentsApi } from '../api/payments.api';
import { timer, lastValueFrom } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import {
  PaymentAuditLog,
  SuspiciousActivityReport,
  PaymentReconciliationResult,
  PaymentAnalytics,
  PaymentReceipt,
} from '../models/payment-audit.models';

/**
 * Payment Service - Handles all payment-related operations
 * 
 * Security Features:
 * - All methods use try-catch blocks for error handling
 * - Errors are logged and re-thrown for global error handler
 * - Sensitive data is not logged to console
 * - Payment polling has timeout protection
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly api = inject(PaymentsApi);

  /**
   * Initiates payment via Lipana STK push.
   * 
   * @param dto - Payment initiation data
   * @returns Payment details including transactionId for polling
   * @throws Error if payment initiation fails
   */
  async initiate(dto: {
    rideId?: string;
    parcelId?: string;
    method: 'MPESA' | 'CASH';
    mpesaPhone?: string;
  }): Promise<{
    paymentId: string;
    transactionId?: string;
    checkoutRequestId?: string;
    message: string;
  }> {
    try {
      if (!dto.rideId && !dto.parcelId) {
        throw new Error('Either rideId or parcelId must be provided');
      }

      if (dto.method === 'MPESA' && !dto.mpesaPhone) {
        throw new Error('mpesaPhone is required for MPESA payments');
      }

      const result = await this.api.initiate(dto);
      
      if (!result.paymentId) {
        throw new Error('Payment initiation failed - no paymentId returned');
      }

      return result;
    } catch (error) {
      // Error is already handled by GlobalErrorInterceptor
      // Re-throw for component-level handling
      throw error;
    }
  }

  /**
   * Initiates STK push payment for a ride via Lipana.
   * 
   * @param rideId - The ride ID to pay for
   * @param phone - M-Pesa phone number
   * @param method - Payment method (default: MPESA)
   * @returns Payment details for polling
   * @throws Error if payment initiation fails
   */
  async initiateForRide(
    rideId: string,
    phone: string,
    method: 'MPESA' | 'CASH' = 'MPESA'
  ): Promise<{
    paymentId: string;
    transactionId?: string;
    checkoutRequestId?: string;
    message: string;
  }> {
    try {
      if (!rideId) {
        throw new Error('rideId is required');
      }

      if (!phone) {
        throw new Error('phone number is required');
      }

      const result = await this.api.initiateForRide(rideId, phone, method);

      if (!result.paymentId) {
        throw new Error('Payment initiation failed - no paymentId returned');
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Initiates STK push payment for a parcel via Lipana.
   * 
   * @param parcelId - The parcel ID to pay for
   * @param phone - M-Pesa phone number
   * @param method - Payment method (default: MPESA)
   * @returns Payment details for polling
   * @throws Error if payment initiation fails
   */
  async initiateForParcel(
    parcelId: string,
    phone: string,
    method: 'MPESA' | 'CASH' = 'MPESA'
  ): Promise<{
    paymentId: string;
    transactionId?: string;
    checkoutRequestId?: string;
    message: string;
  }> {
    try {
      if (!parcelId) {
        throw new Error('parcelId is required');
      }

      if (!phone) {
        throw new Error('phone number is required');
      }

      const result = await this.api.initiateForParcel(parcelId, phone, method);

      if (!result.paymentId) {
        throw new Error('Payment initiation failed - no paymentId returned');
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resends the STK push for a PROCESSING or FAILED payment.
   * The backend marks the old payment FAILED, then creates a new one —
   * so this works even when the old payment is still PROCESSING.
   *
   * @param paymentId - The existing payment ID to resend
   * @returns New payment details for UI + socket subscription
   */
  async resend(paymentId: string): Promise<{
    paymentId: string;
    transactionId?: string;
    checkoutRequestId?: string;
    message: string;
  }> {
    if (!paymentId) throw new Error('paymentId is required');
    const result = await this.api.resend(paymentId);
    if (!result.paymentId) throw new Error('Resend failed — no paymentId returned');
    return result;
  }

  /**
   * Gets the current payment status by checkoutRequestId.
   * 
   * @param checkoutRequestId - The checkout request ID from payment initiation
   * @returns Current payment status and details
   * @throws Error if payment not found or API error occurs
   */
  async getStatus(checkoutRequestId: string): Promise<{
    id: string;
    status: PaymentStatus;
    amount: number;
    mpesaReceiptNumber: string | null;
    completedAt: string | null;
  }> {
    try {
      if (!checkoutRequestId) {
        throw new Error('checkoutRequestId is required');
      }

      const result = await this.api.getStatus(checkoutRequestId);

      if (!result.id) {
        throw new Error('Invalid payment status response');
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Polls the payment status until COMPLETED or FAILED.
   * 
   * Security Features:
   * - Maximum 20 attempts (80 seconds) to prevent infinite loops
   * - 4-second intervals between polls
   * - Errors are logged but don't stop polling
   * - Timeout protection with clear error message
   * 
   * @param checkoutRequestId - The checkout request ID to poll
   * @returns Final payment status
   * @throws Error if polling times out
   */
  async pollStatus(checkoutRequestId: string): Promise<{
    id: string;
    status: PaymentStatus;
    mpesaReceiptNumber: string | null;
  }> {
    try {
      if (!checkoutRequestId) {
        throw new Error('checkoutRequestId is required for polling');
      }

      let attempts = 0;
      const maxAttempts = 20; // ~80 seconds (20 * 4s)
      const pollIntervalMs = 4000; // 4 seconds

      while (attempts < maxAttempts) {
        try {
          const result = await this.getStatus(checkoutRequestId);

          // Check for terminal states
          if (result.status === 'COMPLETED' || result.status === 'FAILED') {
            return {
              id: result.id,
              status: result.status,
              mpesaReceiptNumber: result.mpesaReceiptNumber,
            };
          }

          // Continue polling for PROCESSING or PENDING
          attempts++;
          
          // Wait before next poll (except on last attempt)
          if (attempts < maxAttempts) {
            await lastValueFrom(timer(pollIntervalMs));
          }
        } catch (error) {
          // Log but continue polling - transient errors are expected
          console.warn(`Payment poll attempt ${attempts + 1} failed, retrying...`, error);
          attempts++;
          
          if (attempts < maxAttempts) {
            await lastValueFrom(timer(pollIntervalMs));
          }
        }
      }

      // Polling exhausted without terminal state
      throw new Error(
        'Payment polling timed out after 80 seconds. Please check your M-Pesa messages or contact support.'
      );
    } catch (error) {
      // Re-throw for component handling
      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Audit Log Methods (Admin Only)
  // ────────────────────────────────────────────────────────────

  /**
   * Get audit logs for a specific payment
   * 
   * @param paymentId - The payment ID to get logs for
   * @returns Array of audit log entries
   * @throws Error if API call fails
   */
  async getAuditLogsForPayment(paymentId: string): Promise<PaymentAuditLog[]> {
    try {
      if (!paymentId) {
        throw new Error('paymentId is required');
      }

      return await this.api.getAuditLogsForPayment(paymentId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   * 
   * @param userId - The user ID to get logs for
   * @param limit - Maximum number of logs to return (default: 50)
   * @returns Array of audit log entries
   * @throws Error if API call fails
   */
  async getAuditLogsForUser(
    userId: string,
    limit: number = 50
  ): Promise<PaymentAuditLog[]> {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

      if (limit <= 0 || limit > 1000) {
        throw new Error('limit must be between 1 and 1000');
      }

      return await this.api.getAuditLogsForUser(userId, limit);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get suspicious activity report
   * 
   * @param windowHours - Time window in hours (default: 24)
   * @returns Array of suspicious activity reports
   * @throws Error if API call fails
   */
  async getSuspiciousActivity(
    windowHours: number = 24
  ): Promise<SuspiciousActivityReport[]> {
    try {
      if (windowHours <= 0 || windowHours > 168) {
        throw new Error('windowHours must be between 1 and 168 (1 week)');
      }

      return await this.api.getSuspiciousActivity(windowHours);
    } catch (error) {
      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Reconciliation Methods (Admin Only)
  // ────────────────────────────────────────────────────────────

  /**
   * Reconcile local payments with Lipana records
   * 
   * @param date - Date to reconcile (YYYY-MM-DD format)
   * @returns Reconciliation result with discrepancies
   * @throws Error if API call fails or invalid date format
   */
  async reconcilePayments(date: string): Promise<PaymentReconciliationResult> {
    try {
      if (!date) {
        throw new Error('date is required');
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new Error('date must be in YYYY-MM-DD format');
      }

      return await this.api.reconcilePayments(date);
    } catch (error) {
      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Analytics Methods (Admin Only)
  // ────────────────────────────────────────────────────────────

  /**
   * Get payment analytics dashboard data
   * 
   * @param period - Time period (e.g., '7d', '30d', '90d')
   * @returns Payment analytics data
   * @throws Error if API call fails or invalid period
   */
  async getAnalytics(period: string = '7d'): Promise<PaymentAnalytics> {
    try {
      // Validate period format
      const periodRegex = /^(\d+)(d|w|m)$/;
      if (!periodRegex.test(period)) {
        throw new Error('period must be in format: 7d, 30d, 3w, 1m, etc.');
      }

      return await this.api.getAnalytics(period);
    } catch (error) {
      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Receipt Methods
  // ────────────────────────────────────────────────────────────

  /**
   * Download payment receipt as PDF
   * 
   * @param paymentId - The payment ID to get receipt for
   * @returns PDF blob for download
   * @throws Error if API call fails
   */
  async downloadReceipt(paymentId: string): Promise<Blob> {
    try {
      if (!paymentId) {
        throw new Error('paymentId is required');
      }

      const blob = await this.api.downloadReceipt(paymentId);

      if (!blob || blob.size === 0) {
        throw new Error('Receipt download failed - empty response');
      }

      return blob;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment receipt data as JSON
   * 
   * @param paymentId - The payment ID to get receipt for
   * @returns Payment receipt data
   * @throws Error if API call fails
   */
  async getReceipt(paymentId: string): Promise<PaymentReceipt> {
    try {
      if (!paymentId) {
        throw new Error('paymentId is required');
      }

      return await this.api.getReceipt(paymentId);
    } catch (error) {
      throw error;
    }
  }
}
