import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { NotificationsService } from '../../core/services/notifications.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, SpinnerComponent, RouterLink],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <lucide-icon name="bell" [size]="28"></lucide-icon>
          </div>
          <div>
            <h1>Notifications</h1>
            <p>Stay updated with your rides and account activity</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn--ghost btn--sm" (click)="markAllRead()" [disabled]="notificationsSvc.unreadCount() === 0">
            Mark all as read
          </button>
        </div>
      </div>

      @if (notificationsSvc.isFetching()) {
        <div class="loader-wrap"><app-spinner /></div>
      } @else if (notificationsSvc.allNotifications().length === 0) {
        <div class="empty-state card">
          <div class="empty-icon-circle">
            <lucide-icon name="bell-off" [size]="48"></lucide-icon>
          </div>
          <h3>No notifications yet</h3>
          <p>You're all caught up! New updates will appear here.</p>
        </div>
      } @else {
        <div class="notifications-list">
          @for (n of notificationsSvc.allNotifications(); track n.id) {
            <div class="notification-item card modern-shadow" [class.unread]="!n.isRead" (click)="markRead(n)">
              <div class="notif-icon" [class]="n.type.toLowerCase()">
                <lucide-icon [name]="getIcon(n.type)" [size]="20"></lucide-icon>
              </div>
              <div class="notif-content">
                <div class="notif-header">
                  <h3 class="notif-title">{{ n.title }}</h3>
                  <span class="notif-time">{{ n.createdAt | date:'short' }}</span>
                </div>
                <p class="notif-body">{{ n.body }}</p>
                @if (n.data?.rideId || n.data?.parcelId) {
                  <a [routerLink]="getLink(n)" class="notif-action">
                    View Details <lucide-icon name="arrow-right" [size]="14"></lucide-icon>
                  </a>
                }
              </div>
              @if (!n.isRead) {
                <div class="unread-dot"></div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .header-content { display: flex; align-items: center; gap: 16px; }
    .header-icon {
      width: 48px; height: 48px; border-radius: var(--radius-md);
      background: var(--clr-bg-elevated); color: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      box-shadow: var(--shadow-sm);
    }
    .loader-wrap { display: flex; justify-content: center; padding: 80px; }
    .notifications-list { display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }
    .notification-item {
      display: flex; gap: 16px; padding: 20px; cursor: pointer; transition: all 0.3s ease;
      position: relative; border-left: 4px solid transparent;
      &:hover { transform: translateY(-2px); border-color: var(--clr-primary-light); }
      &.unread { background: color-mix(in srgb, var(--clr-primary) 5%, var(--clr-bg-card)); border-left-color: var(--clr-primary); }
    }
    .notif-icon {
      width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
      background: var(--clr-bg-elevated); color: var(--clr-text-muted); flex-shrink: 0;
      &.ride_update { color: var(--clr-primary); background: rgba(64, 138, 113, 0.1); }
      &.payment { color: var(--clr-success); background: rgba(34, 197, 94, 0.1); }
      &.system { color: var(--clr-info); background: rgba(59, 130, 246, 0.1); }
    }
    .notif-content { flex: 1; min-width: 0; }
    .notif-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; gap: 12px; }
    .notif-title { font-size: 15px; font-weight: 700; color: var(--clr-text); margin: 0; }
    .notif-time { font-size: 12px; color: var(--clr-text-dim); white-space: nowrap; }
    .notif-body { font-size: 14px; color: var(--clr-text-muted); line-height: 1.5; margin: 0; }
    .notif-action {
      display: inline-flex; align-items: center; gap: 6px; margin-top: 12px;
      font-size: 13px; font-weight: 600; color: var(--clr-primary); text-decoration: none;
      &:hover { text-decoration: underline; }
    }
    .unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--clr-primary); position: absolute; right: 20px; bottom: 20px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px 40px; text-align: center; gap: 16px; margin-top: 24px;
    }
    .empty-icon-circle {
      width: 80px; height: 80px; border-radius: 50%; background: var(--clr-bg-elevated);
      display: flex; align-items: center; justify-content: center; color: var(--clr-text-dim);
      opacity: 0.5;
    }
  `],
})
export class NotificationsComponent implements OnInit {
  protected readonly notificationsSvc = inject(NotificationsService);

  async ngOnInit() {
    await this.notificationsSvc.fetchNotifications();
  }

  async markRead(n: any) {
    if (!n.isRead) {
      await this.notificationsSvc.markAsRead(n.id);
    }
  }

  async markAllRead() {
    await this.notificationsSvc.markAllAsRead();
  }

  getIcon(type: string): string {
    switch (type.toUpperCase()) {
      case 'RIDE_UPDATE': return 'bike';
      case 'PARCEL_UPDATE': return 'package';
      case 'PAYMENT': return 'credit-card';
      case 'SYSTEM': return 'info';
      default: return 'bell';
    }
  }

  getLink(n: any): string[] {
    if (n.data?.rideId) return ['/user/rides', n.data.rideId];
    if (n.data?.parcelId) return ['/user/parcels', n.data.parcelId];
    return ['/'];
  }
}
