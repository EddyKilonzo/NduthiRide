import { Injectable, inject } from '@angular/core';
import { DashboardStats, PaginatedResult } from '../models/admin.models';
import { AuthUser } from '../models/auth.models';
import { Ride } from '../models/ride.models';
import { Parcel } from '../models/parcel.models';
import { Payment } from '../models/payment.models';
import { AdminApi } from '../api/admin.api';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(AdminApi);

  async getStats(): Promise<DashboardStats> {
    try {
      return await this.api.getStats();
    } catch (error) {
      throw error;
    }
  }

  async listAccounts(page = 1, limit = 20, filters: { role?: string; isActive?: boolean; search?: string } = {}): Promise<PaginatedResult<AuthUser>> {
    try {
      return await this.api.listAccounts(page, limit, filters);
    } catch (error) {
      throw error;
    }
  }

  async setAccountStatus(accountId: string, isActive: boolean): Promise<AuthUser> {
    try {
      return await this.api.setAccountStatus(accountId, isActive);
    } catch (error) {
      throw error;
    }
  }

  async setRiderVerification(riderId: string, isVerified: boolean): Promise<unknown> {
    try {
      return await this.api.setRiderVerification(riderId, isVerified);
    } catch (error) {
      throw error;
    }
  }

  async listRides(page = 1, limit = 20, status?: string): Promise<PaginatedResult<Ride>> {
    try {
      return await this.api.listRides(page, limit, status);
    } catch (error) {
      throw error;
    }
  }

  async listParcels(page = 1, limit = 20, status?: string): Promise<PaginatedResult<Parcel>> {
    try {
      return await this.api.listParcels(page, limit, status);
    } catch (error) {
      throw error;
    }
  }

  async listPayments(page = 1, limit = 20, status?: string, method?: string): Promise<PaginatedResult<Payment>> {
    try {
      return await this.api.listPayments(page, limit, status, method);
    } catch (error) {
      throw error;
    }
  }
}
