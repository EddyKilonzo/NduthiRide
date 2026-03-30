import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { PaginatedResult } from '../models/admin.models';

export interface Notification {
  id: string;
  accountId: string;
  title: string;
  body: string;
  type: string;
  data: any;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApi extends BaseApiService {
  private readonly path = '/notifications';

  async getNotifications(page = 1, limit = 20): Promise<PaginatedResult<Notification>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.get<PaginatedResult<Notification>>(this.path, params);
  }

  async markAsRead(id: string): Promise<void> {
    return this.patch<void>(`${this.path}/${id}/read`, {});
  }

  async markAllAsRead(): Promise<void> {
    return this.patch<void>(`${this.path}/mark-all-read`, {});
  }
}
