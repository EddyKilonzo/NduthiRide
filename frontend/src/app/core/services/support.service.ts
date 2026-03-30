import { Injectable, inject } from '@angular/core';
import { SupportApi, SupportTicket } from '../api/support.api';

@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly api = inject(SupportApi);

  async createTicket(subject: string, message: string, priority?: string): Promise<SupportTicket> {
    return this.api.createTicket({ subject, message, priority });
  }

  async getMyTickets(): Promise<SupportTicket[]> {
    return this.api.getMyTickets();
  }

  async getTicket(id: string): Promise<SupportTicket> {
    return this.api.getTicket(id);
  }
}
