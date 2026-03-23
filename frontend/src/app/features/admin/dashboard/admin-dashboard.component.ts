import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { DashboardStats } from '../../../core/models/admin.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>Admin Dashboard</h1><p>NduthiRide platform overview</p></div>
        <button class="btn btn--ghost btn--sm" (click)="load()" [disabled]="loading()">↻ Refresh</button>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (stats()) {
        <div class="stats-grid">
          <div class="card stat-card">
            <p class="stat-label">Total Users</p>
            <p class="stat-value">{{ stats()!.totalUsers | number }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Total Riders</p>
            <p class="stat-value">{{ stats()!.totalRiders | number }}</p>
            <p class="stat-sub">{{ stats()!.pendingRiders }} pending verification</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Active Rides</p>
            <p class="stat-value primary">{{ stats()!.activeRides | number }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Today's Rides</p>
            <p class="stat-value">{{ stats()!.todayRides | number }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Total Revenue</p>
            <p class="stat-value success">KES {{ stats()!.totalRevenue | number:'1.0-0' }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Today's Revenue</p>
            <p class="stat-value">KES {{ stats()!.todayRevenue | number:'1.0-0' }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Completion Rate</p>
            <p class="stat-value">{{ stats()!.completionRate | number:'1.0-1' }}%</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Total Trips</p>
            <p class="stat-value">{{ (stats()!.totalRides + stats()!.totalParcels) | number }}</p>
          </div>
        </div>

        <div class="quick-links">
          <a [routerLink]="['/admin/accounts']" class="card quick-card">
            <span class="quick-icon">👥</span>
            <div>
              <p class="quick-title">Manage Accounts</p>
              <p class="quick-sub">View and moderate users and riders</p>
            </div>
          </a>
          <a [routerLink]="['/admin/rides']" class="card quick-card">
            <span class="quick-icon">🏍</span>
            <div>
              <p class="quick-title">View Rides</p>
              <p class="quick-sub">Monitor all ride activity</p>
            </div>
          </a>
          <a [routerLink]="['/admin/payments']" class="card quick-card">
            <span class="quick-icon">💳</span>
            <div>
              <p class="quick-title">Payments</p>
              <p class="quick-sub">Track M-Pesa transactions</p>
            </div>
          </a>
        </div>
      }
    </div>
  `,
  styles: [`
    .stats-grid  { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card   { text-align: center; padding: 20px 12px; }
    .stat-label  { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
    .stat-value  { font-size: 26px; font-weight: 700; }
    .stat-value.primary { color: var(--clr-primary); }
    .stat-value.success { color: var(--clr-success); }
    .stat-sub    { font-size: 11px; color: var(--clr-warning); margin-top: 4px; }
    .quick-links { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
    .quick-card  { display: flex; align-items: center; gap: 16px; text-decoration: none; color: var(--clr-text); transition: transform var(--transition); &:hover { transform: translateY(-2px); } }
    .quick-icon  { font-size: 32px; }
    .quick-title { font-weight: 600; }
    .quick-sub   { font-size: 13px; color: var(--clr-text-muted); margin-top: 2px; }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  protected readonly stats   = signal<DashboardStats | null>(null);
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.stats.set(await this.adminService.getStats());
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }
}
