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

  async getSettings(): Promise<Record<string, string>> {
    return this.api.getSettings();
  }

  async updateSettings(settings: Record<string, string>): Promise<void> {
    return this.api.updateSettings(settings);
  }

  async listPayouts(page = 1, limit = 20): Promise<PaginatedResult<any>> {
    return this.api.listPayouts(page, limit);
  }

  async updatePayoutStatus(id: string, status: string, reference?: string): Promise<any> {
    return this.api.updatePayoutStatus(id, status, reference);
  }

  async listSupportTickets(page = 1, limit = 20): Promise<PaginatedResult<any>> {
    return this.api.listSupportTickets(page, limit);
  }

  async updateTicketStatus(id: string, status: string): Promise<any> {
    return this.api.updateTicketStatus(id, status);
  }

  async listAuditLogs(page = 1, limit = 20): Promise<PaginatedResult<any>> {
    return this.api.listAuditLogs(page, limit);
  }
}
