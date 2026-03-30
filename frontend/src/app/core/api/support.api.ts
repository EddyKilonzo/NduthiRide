import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';

export interface SupportTicket {
  id: string;
  accountId: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SupportApi extends BaseApiService {
  private readonly path = '/support/tickets';

  async createTicket(dto: { subject: string; message: string; priority?: string }): Promise<SupportTicket> {
    return this.post<SupportTicket>(this.path, dto);
  }

  async getMyTickets(): Promise<SupportTicket[]> {
    return this.get<SupportTicket[]>(this.path);
  }

  async getTicket(id: string): Promise<SupportTicket> {
    return this.get<SupportTicket>(`${this.path}/${id}`);
  }
}
