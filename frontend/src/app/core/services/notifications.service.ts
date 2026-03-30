import { Injectable, inject, signal, computed } from '@angular/core';
import { NotificationsApi, Notification } from '../api/notifications.api';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(NotificationsApi);

  protected readonly notifications = signal<Notification[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(false);

  readonly unreadCount = computed(() => 
    this.notifications().filter(n => !n.isRead).length
  );

  async fetchNotifications(page = 1, limit = 20): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.getNotifications(page, limit);
      this.notifications.set(res.data);
      this.totalCount.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }

  async markAsRead(id: string): Promise<void> {
    await this.api.markAsRead(id);
    this.notifications.update(list => 
      list.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }

  async markAllAsRead(): Promise<void> {
    await this.api.markAllAsRead();
    this.notifications.update(list => 
      list.map(n => ({ ...n, isRead: true }))
    );
  }

  get allNotifications() {
    return this.notifications.asReadonly();
  }

  get isFetching() {
    return this.loading.asReadonly();
  }
}
