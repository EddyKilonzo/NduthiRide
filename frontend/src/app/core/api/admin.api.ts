import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { DashboardStats, PaginatedResult } from '../models/admin.models';
import { AuthUser } from '../models/auth.models';
import { Ride } from '../models/ride.models';
import { Parcel } from '../models/parcel.models';
import { Payment } from '../models/payment.models';

@Injectable({ providedIn: 'root' })
export class AdminApi extends BaseApiService {
  private readonly path = '/admin';

  async getStats(): Promise<DashboardStats> {
    return this.get<DashboardStats>(`${this.path}/stats`);
  }

  async listAccounts(page = 1, limit = 20, filters: { role?: string; isActive?: boolean; search?: string } = {}): Promise<PaginatedResult<AuthUser>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (filters.role) params = params.set('role', filters.role);
    if (filters.isActive !== undefined) params = params.set('isActive', filters.isActive);
    if (filters.search) params = params.set('search', filters.search);
    return this.get<PaginatedResult<AuthUser>>(`${this.path}/accounts`, params);
  }

  async setAccountStatus(accountId: string, isActive: boolean): Promise<AuthUser> {
    return this.patch<AuthUser>(`${this.path}/accounts/${accountId}/status`, { isActive });
  }

  async setRiderVerification(riderId: string, isVerified: boolean): Promise<unknown> {
    return this.patch<unknown>(`${this.path}/riders/${riderId}/verification`, { isVerified });
  }

  async listRides(page = 1, limit = 20, status?: string): Promise<PaginatedResult<Ride>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    return this.get<PaginatedResult<Ride>>(`${this.path}/rides`, params);
  }

  async listParcels(page = 1, limit = 20, status?: string): Promise<PaginatedResult<Parcel>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    return this.get<PaginatedResult<Parcel>>(`${this.path}/parcels`, params);
  }

  async listPayments(page = 1, limit = 20, status?: string, method?: string): Promise<PaginatedResult<Payment>> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    if (method) params = params.set('method', method);
    return this.get<PaginatedResult<Payment>>(`${this.path}/payments`, params);
  }

  // ─── Settings ───────────────────────────────────────────

  async getSettings(): Promise<Record<string, string>> {
    return this.get<Record<string, string>>(`${this.path}/settings`);
  }

  async updateSettings(settings: Record<string, string>): Promise<void> {
    return this.patch<void>(`${this.path}/settings`, settings);
  }

  // ─── Payouts ────────────────────────────────────────────

  async listPayouts(page = 1, limit = 20): Promise<PaginatedResult<any>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.get<PaginatedResult<any>>(`${this.path}/payouts`, params);
  }

  async updatePayoutStatus(id: string, status: string, reference?: string): Promise<any> {
    return this.patch<any>(`${this.path}/payouts/${id}`, { status, reference });
  }

  // ─── Support ────────────────────────────────────────────

  async listSupportTickets(page = 1, limit = 20): Promise<PaginatedResult<any>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.get<PaginatedResult<any>>(`${this.path}/support/tickets`, params);
  }

  async updateTicketStatus(id: string, status: string): Promise<any> {
    return this.patch<any>(`${this.path}/support/tickets/${id}`, { status });
  }

  // ─── Audit Logs ─────────────────────────────────────────

  async listAuditLogs(page = 1, limit = 20): Promise<PaginatedResult<any>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.get<PaginatedResult<any>>(`${this.path}/audit-logs`, params);
  }
}
