import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

interface NavItem { label: string; route: string; icon: string; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <aside class="sidebar">
      <!-- Logo -->
      <div class="sidebar__logo">
        <a class="logo-wrap" [routerLink]="['/']">
          <div class="logo-mark">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8"  cy="22" r="4" stroke="currentColor" stroke-width="2.5"/>
              <circle cx="24" cy="22" r="4" stroke="currentColor" stroke-width="2.5"/>
              <path d="M12 22h8M16 8l-4 6 4 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="20" cy="8" r="2" fill="currentColor"/>
              <path d="M16 14h6l2 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="logo-text">
            <span class="logo-name">Nduthi</span><span class="logo-accent">Ride</span>
          </div>
        </a>
        <button
          class="theme-toggle"
          (click)="themeSvc.toggle()"
          [title]="'Switch to ' + (themeSvc.theme() === 'dark' ? 'light' : 'dark') + ' mode'"
        >
          <lucide-icon
            [name]="themeSvc.theme() === 'dark' ? 'sun' : 'moon'"
            [size]="16"
          />
        </button>
      </div>

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
          </a>
        }
      </nav>

      <!-- Footer -->
      <div class="sidebar__footer">
        <div class="user-info">
          <div class="avatar">{{ initial() }}</div>
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
      width: 240px; height: 100vh; position: sticky; top: 0;
      background: var(--clr-bg-card); border-right: 1px solid var(--clr-border);
      display: flex; flex-direction: column; flex-shrink: 0;
    }

    /* Logo */
    .sidebar__logo {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 16px; border-bottom: 1px solid var(--clr-border);
    }
    .logo-wrap {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none; color: var(--clr-primary);
    }
    .logo-mark {
      width: 36px; height: 36px; background: var(--clr-primary);
      border-radius: 10px; display: flex; align-items: center;
      justify-content: center; color: #fff; flex-shrink: 0;
      svg { width: 22px; height: 22px; }
    }
    .logo-text { display: flex; align-items: baseline; }
    .logo-name { font-size: 17px; font-weight: 800; color: var(--clr-text); font-family: var(--font-display); }
    .logo-accent { font-size: 17px; font-weight: 800; color: var(--clr-primary); font-family: var(--font-display); }

    /* Theme toggle */
    .theme-toggle {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--clr-bg-elevated); border: 1px solid var(--clr-border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--clr-text-muted); transition: all 0.2s;
      &:hover { border-color: var(--clr-primary); color: var(--clr-primary); transform: translateY(-1px); }
    }

    /* Nav */
    .sidebar__nav { flex: 1; padding: 12px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
    .nav-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border-radius: var(--radius-md); color: var(--clr-text-muted);
      font-size: 14px; font-weight: 500; transition: all var(--transition);
      text-decoration: none;
      &:hover { background: var(--clr-bg-elevated); color: var(--clr-text); }
      &--active { background: rgba(232,75,14,.12); color: var(--clr-primary); }
    }
    .nav-icon { flex-shrink: 0; }

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
    }
    .user-meta { overflow: hidden; }
    .name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .role { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; }
    .logout-btn {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      border-radius: var(--radius-md); color: var(--clr-text-muted);
      font-size: 13px; font-weight: 500; cursor: pointer;
      transition: all var(--transition); width: 100%;
      &:hover { background: rgba(239,68,68,.1); color: var(--clr-error); }
    }
  `],
})
export class SidebarComponent {
  protected readonly auth     = inject(AuthService);
  protected readonly themeSvc = inject(ThemeService);

  protected initial(): string {
    return this.auth.user()?.fullName?.charAt(0).toUpperCase() ?? '?';
  }

  protected navItems(): NavItem[] {
    const role = this.auth.role();
    if (role === 'ADMIN') return [
      { label: 'Dashboard', route: '/admin',          icon: 'layout-dashboard' },
      { label: 'Accounts',  route: '/admin/accounts', icon: 'users' },
      { label: 'Rides',     route: '/admin/rides',    icon: 'bike' },
      { label: 'Parcels',   route: '/admin/parcels',  icon: 'package' },
      { label: 'Payments',  route: '/admin/payments', icon: 'credit-card' },
    ];
    if (role === 'RIDER') return [
      { label: 'Dashboard',  route: '/rider',          icon: 'house' },
      { label: 'Active Ride',route: '/rider/active',   icon: 'bike' },
      { label: 'History',    route: '/rider/history',  icon: 'history' },
      { label: 'Earnings',   route: '/rider/earnings', icon: 'wallet' },
      { label: 'Profile',    route: '/rider/profile',  icon: 'user' },
    ];
    return [
      { label: 'Home',        route: '/user',            icon: 'house' },
      { label: 'Book Ride',   route: '/user/book-ride',  icon: 'bike' },
      { label: 'Send Parcel', route: '/user/book-parcel',icon: 'package' },
      { label: 'My Rides',    route: '/user/rides',      icon: 'list' },
      { label: 'My Parcels',  route: '/user/parcels',    icon: 'truck' },
      { label: 'Profile',     route: '/user/profile',    icon: 'user' },
    ];
  }
}
