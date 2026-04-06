import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { DashboardActivityChartsComponent } from '../../../shared/components/dashboard-activity-charts/dashboard-activity-charts.component';
import {
  buildWeeklyChartBuckets,
  ridesAndParcelsToActivityPoints,
  type DayBucket,
} from '../../../shared/utils/activity-buckets.util';
import type { DashboardStats } from '../../../core/models/admin.models';

const ADMIN_CHART_COPY = {
  amount7d: '7-day platform revenue',
  jobsLabel: 'Trips completed',
  avgLabel: 'Avg. per trip',
  rideShareLabel: 'Ride vs Parcel',
  dailyAmountTitle: 'Daily revenue',
  dailyAmountHint: 'From completed payments (Cash and M-Pesa) where recorded; otherwise booked fare on completion.',
} as const;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule, DashboardActivityChartsComponent],
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
        <app-dashboard-activity-charts
          class="admin-charts-block"
          [chartSeries]="chartSeries()"
          [chartsLoading]="chartsLoading()"
          gradientId="adminRevenueArea"
          sectionTitle="Revenue & Growth"
          [copy]="adminChartCopy"
        />

        <div class="stats-grid stats-grid--focused">
          <div class="card stat-card">
            <p class="stat-label">Live Operations</p>
            <p class="stat-value primary">{{ s.activeRides | number }}</p>
            <p class="stat-sub">{{ s.availableRiders ?? 0 }} riders ready</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">System Health</p>
            <p class="stat-value success">{{ completedTrips(s) | number }}</p>
            <p class="stat-sub muted">Successful completions</p>
          </div>
          <div class="card stat-card" [class.danger-glow]="(s.suspiciousCount ?? 0) > 0">
            <p class="stat-label">Security Alerts</p>
            <p class="stat-value" [class.error]="(s.suspiciousCount ?? 0) > 0">{{ s.suspiciousCount ?? 0 }}</p>
            <p class="stat-sub muted">Suspicious flags (24h)</p>
          </div>
        </div>

        <section class="analysis-section">
          <h2 class="section-title">
            <lucide-icon name="pie-chart" [size]="18"></lucide-icon>
            Platform analysis
          </h2>
          <div class="analysis-grid">
            <div class="card analysis-card analysis-card--a">
              <div class="analysis-icon-wrap">
                <lucide-icon name="check-circle" [size]="18" class="analysis-icon"></lucide-icon>
              </div>
              <span class="analysis-label">Finished bookings</span>
              <strong class="analysis-value">{{ completedTrips(s) | number }}</strong>
            </div>
            <div class="card analysis-card analysis-card--b">
              <div class="analysis-icon-wrap">
                <lucide-icon name="banknote" [size]="18" class="analysis-icon"></lucide-icon>
              </div>
              <span class="analysis-label">Avg. revenue / completion</span>
              <strong class="analysis-value">KES {{ avgRevenuePerCompletion(s) | number:'1.0-0' }}</strong>
            </div>
            <div class="card analysis-card analysis-card--c">
              <div class="analysis-icon-wrap">
                <lucide-icon name="shield-check" [size]="18" class="analysis-icon"></lucide-icon>
              </div>
              <span class="analysis-label">Rider verification</span>
              <strong class="analysis-value">{{ riderVerifiedPct(s) | number:'1.0-0' }}%</strong>
              <div class="mix-bar" aria-hidden="true">
                <div class="mix-bar__fill" [style.width.%]="riderVerifiedPct(s)"></div>
              </div>
            </div>
            <div class="card analysis-card analysis-card--d">
              <div class="analysis-icon-wrap">
                <lucide-icon name="users" [size]="18" class="analysis-icon"></lucide-icon>
              </div>
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
          <a [routerLink]="['/admin/parcels']" class="card quick-card">
            <span class="quick-icon" aria-hidden="true"><lucide-icon name="package" [size]="28"></lucide-icon></span>
            <div>
              <p class="quick-title">View Parcels</p>
              <p class="quick-sub">Monitor all delivery activity</p>
            </div>
          </a>
          <a [routerLink]="['/admin/payments']" class="card quick-card">
            <span class="quick-icon" aria-hidden="true"><lucide-icon name="credit-card" [size]="28"></lucide-icon></span>
            <div>
              <p class="quick-title">Payments</p>
              <p class="quick-sub">Cash and M-Pesa transaction log</p>
            </div>
          </a>
          <a [routerLink]="['/admin/payouts']" class="card quick-card">
            <span class="quick-icon" aria-hidden="true"><lucide-icon name="banknote" [size]="28"></lucide-icon></span>
            <div>
              <p class="quick-title">Payouts</p>
              <p class="quick-sub">Process rider withdrawal requests</p>
            </div>
          </a>
          <a [routerLink]="['/admin/settings']" class="card quick-card">
            <span class="quick-icon" aria-hidden="true"><lucide-icon name="settings" [size]="28"></lucide-icon></span>
            <div>
              <p class="quick-title">System Settings</p>
              <p class="quick-sub">Configure platform fees and limits</p>
            </div>
          </a>
          <a [routerLink]="['/admin/audit-logs']" class="card quick-card">
            <span class="quick-icon" aria-hidden="true"><lucide-icon name="shield-check" [size]="28"></lucide-icon></span>
            <div>
              <p class="quick-title">Audit Logs</p>
              <p class="quick-sub">Review security and payment events</p>
            </div>
          </a>
        </div>
      }
    </div>
  `,
  styles: [`
    .stats-grid  { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
    .stats-grid--focused { grid-template-columns: repeat(3, 1fr); }
    .stat-card   { text-align: center; padding: 20px 12px; box-shadow: var(--shadow-card); }
    .stat-label  { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
    .stat-value  { font-size: 26px; font-weight: 700; }
    .stat-value.primary { color: var(--clr-primary); }
    .stat-value.success { color: var(--clr-success); }
    .stat-value.error { color: var(--clr-error); }
    .danger-glow { border-color: rgba(239, 68, 68, 0.3) !important; box-shadow: 0 0 15px rgba(239, 68, 68, 0.1), var(--shadow-card) !important; }
    .stat-sub    { font-size: 11px; color: var(--clr-text-muted); margin-top: 4px; }
    .stat-sub.muted { color: var(--clr-text-dim); }
    .section-title {
      font-size: 16px; font-weight: 700; color: var(--clr-text);
      margin: 0 0 16px; display: flex; align-items: center; gap: 10px;
    }
    .analysis-section { margin-bottom: 28px; }
    .admin-charts-block { display: block; margin-bottom: 28px; }
    .analysis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .analysis-card {
      padding: 18px 16px; box-shadow: var(--shadow-card);
      display: flex; flex-direction: column; gap: 8px;
      border-left-width: 3px;
    }
    .analysis-card--a { border-left-color: var(--clr-primary); }
    .analysis-card--b { border-left-color: var(--clr-primary-dark); }
    .analysis-card--c { border-left-color: color-mix(in srgb, var(--clr-primary) 60%, var(--clr-primary-light)); }
    .analysis-card--d { border-left-color: color-mix(in srgb, var(--clr-primary-light) 70%, var(--clr-border)); }
    .analysis-icon-wrap {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--clr-bg-elevated); border: 1px solid var(--clr-border);
      display: flex; align-items: center; justify-content: center;
    }
    .analysis-icon { color: var(--clr-primary); }
    .analysis-label {
      font-size: 11px; font-weight: 600; color: var(--clr-text-muted);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .analysis-value { font-size: 18px; font-weight: 800; font-family: var(--font-display); color: var(--clr-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mix-bar { height: 6px; border-radius: 3px; background: var(--clr-bg-elevated); overflow: hidden; margin-top: 2px; }
    .mix-bar__fill { height: 100%; background: linear-gradient(90deg, var(--clr-primary), var(--clr-primary-dark)); border-radius: 3px; transition: width 0.4s ease; }
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
    .hbar-fill--ops { background: linear-gradient(90deg, var(--clr-primary-dark), var(--clr-primary)); }
    .hbar-fill--acct { background: linear-gradient(90deg, var(--clr-primary), var(--clr-primary-light)); }
    .modern-shadow { box-shadow: var(--shadow-card); }
    .quick-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .quick-card  { display: flex; align-items: center; gap: 16px; text-decoration: none; color: var(--clr-text); transition: all 0.3s ease; box-shadow: var(--shadow-card); padding: 20px; }
    .quick-card:hover { transform: translateY(-2px); border-color: var(--clr-primary); background: var(--clr-bg-elevated); }
    .quick-icon  { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; color: var(--clr-primary); flex-shrink: 0; background: var(--clr-bg-elevated); border-radius: var(--radius-md); }
    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .platform-charts { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .quick-links { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
    }
    .quick-title { font-weight: 600; }
    .quick-sub   { font-size: 13px; color: var(--clr-text-muted); margin-top: 2px; }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly loading = signal(true);

  protected readonly adminChartCopy = ADMIN_CHART_COPY;
  protected readonly chartSeries = signal<DayBucket[]>([]);
  protected readonly chartsLoading = signal(true);

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
    return `1 : ${(1 / r).toFixed(1)}`;
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.chartsLoading.set(true);
    try {
      // Load main stats independently
      const s = await this.adminService.getStats();
      this.stats.set(s);
    } catch (err) {
      console.error('Error loading admin stats', err);
    } finally {
      this.loading.set(false);
    }

    try {
      // Load chart data separately so it doesn't block or break main stats
      const [rideRes, parcelRes] = await Promise.all([
        this.adminService.listRides(1, 100, 'COMPLETED'),
        this.adminService.listParcels(1, 100, 'DELIVERED'),
      ]);
      const points = ridesAndParcelsToActivityPoints(rideRes.data, parcelRes.data);
      const { current } = buildWeeklyChartBuckets(points);
      this.chartSeries.set(current);
    } catch (err) {
      console.error('Error loading admin chart data', err);
    } finally {
      this.chartsLoading.set(false);
    }
  }
}
