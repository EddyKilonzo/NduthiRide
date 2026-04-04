import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { Payment, PaymentStatus } from '../models/payment.models';
import {
  PaymentAuditLog,
  SuspiciousActivityReport,
  PaymentReconciliationResult,
  PaymentAnalytics,
  PaymentReceipt,
} from '../models/payment-audit.models';

@Injectable({ providedIn: 'root' })
export class PaymentsApi extends BaseApiService {
  private readonly path = '/payments';

  /**
   * Initiate a new payment via Lipana STK push
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
    return this.post(`${this.path}/initiate`, dto);
  }

  /**
   * Initiate payment for a specific ride
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
    return this.post(`${this.path}/ride/${rideId}`, { mpesaPhone: phone, method });
  }

  /**
   * Initiate payment for a specific parcel
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
    return this.post(`${this.path}/parcel/${parcelId}`, { mpesaPhone: phone, method });
  }

  /**
   * Resend STK push for an existing PROCESSING or FAILED payment.
   * Marks the old payment FAILED and initiates a fresh STK push.
   */
  async resend(paymentId: string): Promise<{
    paymentId: string;
    transactionId?: string;
    checkoutRequestId?: string;
    message: string;
  }> {
    return this.post(`${this.path}/${paymentId}/resend`, {});
  }

  /**
   * Get payment status by checkoutRequestId
   */
  async getStatus(checkoutRequestId: string): Promise<{
    id: string;
    status: PaymentStatus;
    amount: number;
    mpesaReceiptNumber: string | null;
    completedAt: string | null;
  }> {
    return this.get(`${this.path}/status/${checkoutRequestId}`);
  }

  // ────────────────────────────────────────────────────────────
  // Audit Log Endpoints (Admin Only)
  // ────────────────────────────────────────────────────────────

  /**
   * Get audit logs for a specific payment
   */
  async getAuditLogsForPayment(paymentId: string): Promise<PaymentAuditLog[]> {
    return this.get(`${this.path}/audit/payment/${paymentId}`);
  }

  /**
   * Get audit logs for a specific user
   */
  async getAuditLogsForUser(
    userId: string,
    limit: number = 50
  ): Promise<PaymentAuditLog[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.get(`${this.path}/audit/user/${userId}`, params);
  }

  /**
   * Get suspicious activity report (users with 5+ failed attempts)
   */
  async getSuspiciousActivity(
    windowHours: number = 24
  ): Promise<SuspiciousActivityReport[]> {
    const params = new HttpParams().set('windowHours', windowHours.toString());
    return this.get(`${this.path}/audit/suspicious`, params);
  }

  // ────────────────────────────────────────────────────────────
  // Reconciliation Endpoints (Admin Only)
  // ────────────────────────────────────────────────────────────

  /**
   * Reconcile local payments with Lipana records for a specific date
   */
  async reconcilePayments(date: string): Promise<PaymentReconciliationResult> {
    const params = new HttpParams().set('date', date);
    return this.get(`${this.path}/reconcile`, params);
  }

  // ────────────────────────────────────────────────────────────
  // Analytics Endpoints (Admin Only)
  // ────────────────────────────────────────────────────────────

  /**
   * Get payment analytics dashboard data
   */
  async getAnalytics(period: string = '7d'): Promise<PaymentAnalytics> {
    const params = new HttpParams().set('period', period);
    return this.get(`${this.path}/analytics/summary`, params);
  }

  // ────────────────────────────────────────────────────────────
  // Receipt Endpoints
  // ────────────────────────────────────────────────────────────

  /**
   * Generate and download payment receipt as PDF
   */
  async downloadReceipt(paymentId: string): Promise<Blob> {
    const blob = await this.http
      .get(`${this.apiUrl}${this.path}/${paymentId}/receipt`, {
        responseType: 'blob',
      })
      .toPromise();
    
    if (!blob) {
      throw new Error('Receipt download failed - no response');
    }
    
    return blob;
  }

  /**
   * Get payment receipt data (JSON)
   */
  async getReceipt(paymentId: string): Promise<PaymentReceipt> {
    return this.get(`${this.path}/${paymentId}/receipt`);
  }
}
