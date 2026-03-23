import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

interface NavItem { label: string; route: string; icon: string; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <div class="sidebar__logo">
        <div class="logo-wrap" [routerLink]="['/']">
          <span class="logo-icon">🏍</span>
          <span class="logo-text">NduthiRide</span>
        </div>
        <button class="theme-toggle" (click)="themeSvc.toggle()" [title]="'Switch to ' + (themeSvc.theme() === 'dark' ? 'light' : 'dark') + ' mode'">
          {{ themeSvc.theme() === 'dark' ? '☀️' : '🌙' }}
        </button>
      </div>

      <nav class="sidebar__nav">
        @for (item of navItems(); track item.route) {
          <a
            class="nav-item"
            [routerLink]="item.route"
            routerLinkActive="nav-item--active"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>

      <div class="sidebar__footer">
        <div class="user-info">
          <div class="avatar">{{ initial() }}</div>
          <div>
            <p class="name">{{ auth.user()?.fullName }}</p>
            <p class="role">{{ auth.role() }}</p>
          </div>
        </div>
        <button class="btn btn--ghost btn--sm" (click)="auth.logout()">Logout</button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 240px; height: 100vh; position: sticky; top: 0;
      background: var(--clr-bg-card); border-right: 1px solid var(--clr-border);
      display: flex; flex-direction: column;
    }
    .sidebar__logo {
      display: flex; align-items: center; justify-content: space-between;
      padding: 24px 20px; border-bottom: 1px solid var(--clr-border);
      .logo-wrap { display: flex; align-items: center; gap: 10px; cursor: pointer; }
      .logo-icon { font-size: 24px; }
      .logo-text { font-size: 18px; font-weight: 700; color: var(--clr-primary); }
    }
    .theme-toggle {
      background: var(--clr-bg-elevated); border: 1px solid var(--clr-border);
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; transition: all 0.2s;
      &:hover { border-color: var(--clr-primary); transform: translateY(-2px); }
    }
    .sidebar__nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; }
    .nav-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border-radius: var(--radius-md); color: var(--clr-text-muted);
      font-size: 14px; font-weight: 500; transition: all var(--transition);
      text-decoration: none;
      &:hover { background: var(--clr-bg-elevated); color: var(--clr-text); }
      &--active { background: rgba(255,107,0,.12); color: var(--clr-primary); }
    }
    .nav-icon { font-size: 18px; width: 24px; text-align: center; }
    .sidebar__footer {
      padding: 16px; border-top: 1px solid var(--clr-border);
      display: flex; flex-direction: column; gap: 12px;
    }
    .user-info { display: flex; align-items: center; gap: 10px; }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%; background: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0;
    }
    .name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .role { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; }
  `],
})
export class SidebarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly themeSvc = inject(ThemeService);

  protected initial(): string {
    return this.auth.user()?.fullName?.charAt(0).toUpperCase() ?? '?';
  }

  protected navItems(): NavItem[] {
    const role = this.auth.role();
    if (role === 'ADMIN') return [
      { label: 'Dashboard',  route: '/admin',           icon: '📊' },
      { label: 'Accounts',   route: '/admin/accounts',  icon: '👥' },
      { label: 'Rides',      route: '/admin/rides',     icon: '🏍' },
      { label: 'Parcels',    route: '/admin/parcels',   icon: '📦' },
      { label: 'Payments',   route: '/admin/payments',  icon: '💳' },
    ];
    if (role === 'RIDER') return [
      { label: 'Dashboard',  route: '/rider',           icon: '🏠' },
      { label: 'Active Ride',route: '/rider/active',    icon: '🛵' },
      { label: 'History',    route: '/rider/history',   icon: '📋' },
      { label: 'Earnings',   route: '/rider/earnings',  icon: '💰' },
      { label: 'Profile',    route: '/rider/profile',   icon: '👤' },
    ];
    return [
      { label: 'Home',       route: '/user',            icon: '🏠' },
      { label: 'Book Ride',  route: '/user/book-ride',  icon: '🏍' },
      { label: 'Send Parcel',route: '/user/book-parcel',icon: '📦' },
      { label: 'My Rides',   route: '/user/rides',      icon: '📋' },
      { label: 'My Parcels', route: '/user/parcels',    icon: '📬' },
      { label: 'Profile',    route: '/user/profile',    icon: '👤' },
    ];
  }
}
