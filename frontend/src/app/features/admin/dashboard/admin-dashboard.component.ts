import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { DashboardStats } from '../../../core/models/admin.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div><h1>Admin Dashboard</h1><p>NduthiRide platform overview</p></div>
        <button class="btn btn--ghost btn--sm" type="button" (click)="load()" [disabled]="loading()">
          <lucide-icon name="rotate-cw" [size]="16"></lucide-icon> Refresh
        </button>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (stats(); as s) {
        <div class="stats-grid">
          <div class="card stat-card">
            <p class="stat-label">Total users</p>
            <p class="stat-value">{{ s.totalUsers | number }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Total riders</p>
            <p class="stat-value">{{ s.totalRiders | number }}</p>
            <p class="stat-sub">{{ pendingVerification(s) }} pending verification</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Active rides</p>
            <p class="stat-value primary">{{ s.activeRides | number }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Completed trips</p>
            <p class="stat-value">{{ completedTrips(s) | number }}</p>
            <p class="stat-sub muted">Rides + parcels delivered</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Total revenue</p>
            <p class="stat-value success">KES {{ s.totalRevenue | number:'1.0-0' }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Verified riders</p>
            <p class="stat-value">{{ (s.verifiedRiders ?? 0) | number }}</p>
            <p class="stat-sub muted">{{ s.availableRiders ?? 0 }} available now</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">All-time trips</p>
            <p class="stat-value">{{ (s.totalRides + s.totalParcels) | number }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Completion rate</p>
            <p class="stat-value">{{ completionRatePct(s) | number:'1.0-1' }}%</p>
            <p class="stat-sub muted">Finished vs total bookings</p>
          </div>
        </div>

        <section class="analysis-section">
          <h2 class="section-title">
            <lucide-icon name="pie-chart" [size]="18"></lucide-icon>
            Platform analysis
          </h2>
          <div class="analysis-grid">
            <div class="card analysis-card">
              <lucide-icon name="check-circle" [size]="20" class="analysis-icon"></lucide-icon>
              <span class="analysis-label">Finished bookings</span>
              <strong class="analysis-value">{{ completedTrips(s) | number }}</strong>
            </div>
            <div class="card analysis-card">
              <lucide-icon name="banknote" [size]="20" class="analysis-icon"></lucide-icon>
              <span class="analysis-label">Avg. revenue / completion</span>
              <strong class="analysis-value">KES {{ avgRevenuePerCompletion(s) | number:'1.0-0' }}</strong>
            </div>
            <div class="card analysis-card">
              <lucide-icon name="shield-check" [size]="20" class="analysis-icon"></lucide-icon>
              <span class="analysis-label">Rider verification</span>
              <strong class="analysis-value">{{ riderVerifiedPct(s) | number:'1.0-0' }}%</strong>
              <div class="mix-bar" aria-hidden="true">
                <div class="mix-bar__fill" [style.width.%]="riderVerifiedPct(s)"></div>
              </div>
            </div>
            <div class="card analysis-card">
              <lucide-icon name="users" [size]="20" class="analysis-icon"></lucide-icon>
              <span class="analysis-label">Riders vs customers</span>
              <strong class="analysis-value">{{ riderCustomerRatio(s) }}</strong>
            </div>
          </div>
        </section>

        <div class="platform-charts">
          <div class="card chart-panel modern-shadow">
            <h3 class="chart-panel__title">Operations volume</h3>
            <p class="chart-panel__sub">Relative scale — completed vs in-flight</p>
            @for (b of platformVolumeBars(); track b.key) {
              <div class="hbar-row">
                <div class="hbar-top">
                  <span class="hbar-label">{{ b.key }}</span>
                  <span class="hbar-val">{{ b.val | number }}</span>
                </div>
                <div class="hbar-track"><div class="hbar-fill hbar-fill--ops" [style.width.%]="b.pct"></div></div>
              </div>
            }
          </div>
          <div class="card chart-panel modern-shadow">
            <h3 class="chart-panel__title">Account base</h3>
            <p class="chart-panel__sub">Customers and riders on the platform</p>
            @for (b of accountsBars(); track b.key) {
              <div class="hbar-row">
                <div class="hbar-top">
                  <span class="hbar-label">{{ b.key }}</span>
                  <span class="hbar-val">{{ b.val | number }}</span>
                </div>
                <div class="hbar-track"><div class="hbar-fill hbar-fill--acct" [style.width.%]="b.pct"></div></div>
              </div>
            }
          </div>
        </div>

        <div class="quick-links">
          <a [routerLink]="['/admin/accounts']" class="card quick-card">
            <span class="quick-icon" aria-hidden="true"><lucide-icon name="users" [size]="28"></lucide-icon></span>
            <div>
              <p class="quick-title">Manage Accounts</p>
              <p class="quick-sub">View and moderate users and riders</p>
            </div>
          </a>
          <a [routerLink]="['/admin/rides']" class="card quick-card">
            <span class="quick-icon" aria-hidden="true"><lucide-icon name="bike" [size]="28"></lucide-icon></span>
            <div>
              <p class="quick-title">View Rides</p>
              <p class="quick-sub">Monitor all ride activity</p>
            </div>
          </a>
          <a [routerLink]="['/admin/payments']" class="card quick-card">
            <span class="quick-icon" aria-hidden="true"><lucide-icon name="credit-card" [size]="28"></lucide-icon></span>
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
    .stats-grid  { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
    .stat-card   { text-align: center; padding: 20px 12px; box-shadow: var(--shadow-card); }
    .stat-label  { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
    .stat-value  { font-size: 26px; font-weight: 700; }
    .stat-value.primary { color: var(--clr-primary); }
    .stat-value.success { color: var(--clr-success); }
    .stat-sub    { font-size: 11px; color: var(--clr-warning); margin-top: 4px; }
    .stat-sub.muted { color: var(--clr-text-muted); }
    .section-title {
      font-size: 16px; font-weight: 700; color: var(--clr-text);
      margin: 0 0 16px; display: flex; align-items: center; gap: 10px;
    }
    .analysis-section { margin-bottom: 28px; }
    .analysis-grid {
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;
    }
    .analysis-card {
      padding: 18px 16px; text-align: left; box-shadow: var(--shadow-card);
      display: flex; flex-direction: column; gap: 6px;
    }
    .analysis-icon { color: var(--clr-primary); }
    .analysis-label {
      font-size: 11px; font-weight: 600; color: var(--clr-text-muted);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .analysis-value { font-size: 20px; font-weight: 800; font-family: var(--font-display); color: var(--clr-text); }
    .mix-bar { height: 6px; border-radius: 3px; background: var(--clr-bg-elevated); overflow: hidden; margin-top: 4px; }
    .mix-bar__fill { height: 100%; background: linear-gradient(90deg, var(--clr-primary), #285a48); border-radius: 3px; transition: width 0.4s ease; }
    .platform-charts {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-bottom: 28px;
    }
    .chart-panel { padding: 22px 20px; box-shadow: var(--shadow-card); }
    .chart-panel__title { font-size: 15px; font-weight: 700; margin: 0 0 4px; color: var(--clr-text); }
    .chart-panel__sub { font-size: 12px; color: var(--clr-text-muted); margin: 0 0 18px; }
    .hbar-row { margin-bottom: 14px; }
    .hbar-row:last-child { margin-bottom: 0; }
    .hbar-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .hbar-label { font-size: 12px; font-weight: 600; color: var(--clr-text); }
    .hbar-val { font-size: 13px; font-weight: 700; color: var(--clr-text-muted); }
    .hbar-track { height: 10px; border-radius: 5px; background: var(--clr-bg-elevated); overflow: hidden; }
    .hbar-fill { height: 100%; border-radius: 5px; transition: width 0.45s ease; min-width: 0; }
    .hbar-fill--ops { background: linear-gradient(90deg, var(--clr-primary), #3b82f6); }
    .hbar-fill--acct { background: linear-gradient(90deg, #6366f1, var(--clr-primary)); }
    .modern-shadow { box-shadow: var(--shadow-card); }
    .quick-links { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .quick-card  { display: flex; align-items: center; gap: 16px; text-decoration: none; color: var(--clr-text); transition: transform var(--transition); box-shadow: var(--shadow-card); &:hover { transform: translateY(-2px); } }
    .quick-icon  { display: flex; align-items: center; justify-content: center; color: var(--clr-primary); flex-shrink: 0; }
    @media (max-width: 1100px) {
      .analysis-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .platform-charts { grid-template-columns: 1fr; }
      .quick-links { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
      .analysis-grid { grid-template-columns: 1fr; }
    }
    .quick-title { font-weight: 600; }
    .quick-sub   { font-size: 13px; color: var(--clr-text-muted); margin-top: 2px; }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly loading = signal(true);

  protected readonly platformVolumeBars = computed(() => {
    const s = this.stats();
    if (!s) return [] as { key: string; val: number; pct: number }[];
    const cr = s.completedRides ?? 0;
    const cp = s.completedParcels ?? 0;
    const ar = s.activeRides ?? 0;
    const max = Math.max(cr, cp, ar, 1);
    return [
      { key: 'Completed rides', val: cr, pct: (cr / max) * 100 },
      { key: 'Delivered parcels', val: cp, pct: (cp / max) * 100 },
      { key: 'Active rides', val: ar, pct: (ar / max) * 100 },
    ];
  });

  protected readonly accountsBars = computed(() => {
    const s = this.stats();
    if (!s) return [] as { key: string; val: number; pct: number }[];
    const u = s.totalUsers;
    const r = s.totalRiders;
    const max = Math.max(u, r, 1);
    return [
      { key: 'Customers', val: u, pct: (u / max) * 100 },
      { key: 'Riders', val: r, pct: (r / max) * 100 },
    ];
  });

  completedTrips(s: DashboardStats): number {
    return (s.completedRides ?? 0) + (s.completedParcels ?? 0);
  }

  pendingVerification(s: DashboardStats): number {
    if (s.verifiedRiders !== undefined) {
      return Math.max(0, s.totalRiders - s.verifiedRiders);
    }
    return s.pendingRiders ?? 0;
  }

  completionRatePct(s: DashboardStats): number {
    const done = this.completedTrips(s);
    const total = s.totalRides + s.totalParcels;
    return total > 0 ? (100 * done) / total : 0;
  }

  avgRevenuePerCompletion(s: DashboardStats): number {
    const n = this.completedTrips(s);
    return n > 0 ? s.totalRevenue / n : 0;
  }

  riderVerifiedPct(s: DashboardStats): number {
    const v = s.verifiedRiders ?? 0;
    return s.totalRiders > 0 ? (100 * v) / s.totalRiders : 0;
  }

  riderCustomerRatio(s: DashboardStats): string {
    if (s.totalUsers <= 0) return '—';
    const r = s.totalRiders / s.totalUsers;
    return `${r.toFixed(2)} riders / user`;
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.stats.set(await this.adminService.getStats());
    } catch {
      /* silent */
    } finally {
      this.loading.set(false);
    }
  }
}
