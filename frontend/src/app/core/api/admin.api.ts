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
}
