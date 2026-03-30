import { Component, inject, computed, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { ChatService } from '../../../core/services/chat.service';

interface NavItem { label: string; route: string; icon: string; badge?: boolean; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <aside class="sidebar">
      <!-- Navigation -->
      <nav class="sidebar__nav">
        @for (item of navItems(); track item.route) {
          <a
            class="nav-item"
            [routerLink]="item.route"
            routerLinkActive="nav-item--active"
            [routerLinkActiveOptions]="{ exact: item.route.split('/').length === 2 }"
          >
            <lucide-icon class="nav-icon" [name]="item.icon" [size]="18" />
            <span>{{ item.label }}</span>
            @if (item.badge && unreadCount() > 0) {
              <span class="nav-badge">{{ unreadCount() > 99 ? '99+' : unreadCount() }}</span>
            }
          </a>
        }
      </nav>

      <!-- Footer -->
      <div class="sidebar__footer">
        <div class="user-info">
          <div class="avatar" [class.avatar--photo]="!!avatarSrc()">
            @if (avatarSrc(); as src) {
              <img [src]="src" alt="" />
            } @else {
              {{ initial() }}
            }
          </div>
          <div class="user-meta">
            <p class="name">{{ auth.user()?.fullName }}</p>
            <p class="role">{{ auth.role() }}</p>
          </div>
        </div>
        <button class="logout-btn" (click)="auth.logout()">
          <lucide-icon name="log-out" [size]="16" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 240px; height: calc(100vh - 90px); position: sticky; top: 90px;
      background: var(--clr-bg-card); border-right: 1px solid var(--clr-border);
      display: flex; flex-direction: column; flex-shrink: 0;
    }

    /* Nav */
    .sidebar__nav { flex: 1; padding: 20px 12px 12px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
    .nav-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border-radius: var(--radius-md); color: var(--clr-text-muted);
      font-size: 14px; font-weight: 500; transition: all var(--transition);
      text-decoration: none;
    }
    .nav-item:hover { background: var(--clr-bg-elevated); color: var(--clr-text); }
    .nav-item--active { background: rgba(64,138,113,.12); color: var(--clr-primary); font-weight: 600; }
    .nav-icon { flex-shrink: 0; }
    .nav-badge {
      margin-left: auto; min-width: 20px; height: 20px; padding: 0 5px;
      background: var(--clr-primary); color: #fff; border-radius: 10px;
      font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }

    /* Footer */
    .sidebar__footer {
      padding: 14px; border-top: 1px solid var(--clr-border);
      display: flex; flex-direction: column; gap: 10px;
    }
    .user-info { display: flex; align-items: center; gap: 10px; overflow: hidden; }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%; background: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0;
      overflow: hidden;
    }
    .avatar--photo {
      background: var(--clr-bg-elevated);
      padding: 0;
    }
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .user-meta { overflow: hidden; }
    .name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .role { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; }
    .logout-btn {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      border-radius: var(--radius-md); color: var(--clr-text-muted);
      font-size: 13px; font-weight: 500; cursor: pointer;
      transition: all var(--transition); width: 100%;
    }
    .logout-btn:hover { background: rgba(239,68,68,.1); color: var(--clr-error); }

    @media (max-width: 900px) {
      .sidebar {
        width: 100%;
        height: auto;
        position: relative;
        border-right: none;
        border-bottom: 1px solid var(--clr-border);
      }
      .sidebar__nav {
        flex-direction: row;
        flex-wrap: nowrap;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        padding: 12px;
        gap: 6px;
        scrollbar-width: thin;
      }
      .nav-item {
        flex-shrink: 0;
        white-space: nowrap;
      }
      .sidebar__footer {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .logout-btn { width: auto; }
    }
  `],
})
export class SidebarComponent implements OnInit {
  protected readonly auth        = inject(AuthService);
  private  readonly chatService  = inject(ChatService);

  protected readonly unreadCount = this.chatService.totalUnread;

  ngOnInit(): void {
    void this.chatService.loadUnreadCount();
  }

  /** Safe URL for sidebar thumbnail (https, http, data:image, or same-origin path). */
  protected readonly avatarSrc = computed(() => {
    const url = this.auth.user()?.avatarUrl?.trim();
    if (!url) return null;
    const u = url.toLowerCase();
    if (
      u.startsWith('https://') ||
      u.startsWith('http://') ||
      u.startsWith('data:image/') ||
      u.startsWith('/')
    ) {
      return url;
    }
    return null;
  });

  protected initial(): string {
    const name = this.auth.user()?.fullName?.trim();
    return (name ? name.charAt(0) : '?').toUpperCase();
  }

  protected navItems(): NavItem[] {
    const role = this.auth.role();
    if (role === 'ADMIN') return [
      { label: 'Dashboard', route: '/admin',          icon: 'layout-dashboard' },
      { label: 'Accounts',  route: '/admin/accounts', icon: 'users' },
      { label: 'Rides',     route: '/admin/rides',    icon: 'bike' },
      { label: 'Parcels',   route: '/admin/parcels',  icon: 'package' },
      { label: 'Payments',  route: '/admin/payments', icon: 'credit-card' },
      { label: 'Payouts',   route: '/admin/payouts',  icon: 'banknote' },
      { label: 'Audit Logs',route: '/admin/audit-logs', icon: 'shield-check' },
      { label: 'Settings',  route: '/admin/settings', icon: 'settings' },
      { label: 'Support',   route: '/admin/support',  icon: 'help-circle' },
      { label: 'Profile',   route: '/admin/profile',  icon: 'user' },
    ];
    if (role === 'RIDER') return [
      { label: 'Dashboard',  route: '/rider',          icon: 'house' },
      { label: 'Active Ride',route: '/rider/active',   icon: 'bike' },
      { label: 'History',    route: '/rider/history',  icon: 'history' },
      { label: 'Earnings',   route: '/rider/earnings', icon: 'wallet' },
      { label: 'Messages',   route: '/rider/chat',     icon: 'message-square', badge: true },
      { label: 'Support',    route: '/rider/support',  icon: 'help-circle' },
      { label: 'Profile',    route: '/rider/profile',  icon: 'user' },
    ];
    return [
      { label: 'Home',        route: '/user',            icon: 'house' },
      { label: 'Book Ride',   route: '/user/book-ride',  icon: 'bike' },
      { label: 'Send Parcel', route: '/user/book-parcel',icon: 'package' },
      { label: 'Rides',       route: '/user/rides',      icon: 'bike' },
      { label: 'Parcels',     route: '/user/parcels',    icon: 'package' },
      { label: 'Messages',    route: '/user/chat',       icon: 'message-square', badge: true },
      { label: 'Support',     route: '/user/support',    icon: 'help-circle' },

      { label: 'Profile',     route: '/user/profile',    icon: 'user' },
    ];
  }
}
