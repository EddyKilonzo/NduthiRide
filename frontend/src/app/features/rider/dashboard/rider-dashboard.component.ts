import { Component, inject, signal, computed, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { RideService } from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { RidersApi, type RiderProfile } from '../../../core/api/riders.api';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import {
  DashboardActivityChartsComponent,
  type ActivityChartsCopy,
} from '../../../shared/components/dashboard-activity-charts/dashboard-activity-charts.component';
import { ToastService } from '../../../core/services/toast.service';
import {
  activityPointFromParcel,
  activityPointFromRide,
  buildWeeklyChartBuckets,
  dateKeyFromDate,
  localDayKey,
  ridesAndParcelsToActivityPoints,
  type DayBucket,
} from '../../../shared/utils/activity-buckets.util';

const RIDER_CHART_COPY: ActivityChartsCopy = {
  amount7d: '7-day earnings',
  jobsLabel: 'Jobs completed',
  avgLabel: 'Avg. per job',
  rideShareLabel: 'Ride share',
  dailyAmountTitle: 'Daily earnings',
  dailyAmountHint: 'M-Pesa jobs use settled payment amounts and dates; cash uses trip completion.',
};

@Component({
  selector: 'app-rider-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule, DashboardActivityChartsComponent],
  template: `
    <div class="dashboard-container app-page">
      <header class="dashboard-header">
        <div class="welcome-text">
          <h1>Welcome back, {{ auth.user()?.fullName?.split(' ')?.[0] ?? 'Rider' }}!</h1>
          <p>You have <span class="text-highlight">{{ pendingRequests().length }}</span> new requests nearby.</p>
        </div>
        
        <div class="header-actions">
          <div class="status-indicator" [class.online]="isOnline()">
            <span class="pulse-dot"></span>
            <span class="status-text">{{ isOnline() ? 'Accepting Requests' : 'Currently Offline' }}</span>
          </div>
          <button 
            class="toggle-switch" 
            [class.active]="isOnline()"
            (click)="toggleOnline()"
            [title]="isOnline() ? 'Go Offline' : 'Go Online'"
          >
            <div class="switch-handle">
              <lucide-icon [name]="isOnline() ? 'zap' : 'zap-off'" [size]="14"></lucide-icon>
            </div>
          </button>
        </div>
      </header>

      <div class="stats-row">
        <div class="stat-card stat-card--earnings">
          <div class="stat-icon earnings"><lucide-icon name="wallet" [size]="20"></lucide-icon></div>
          <div class="stat-content">
            <span class="stat-label">Today's Earnings</span>
            <h3 class="stat-value">KES {{ todayEarnings() | number:'1.0-0' }}</h3>
            @if (earningsInsight(); as ins) {
              <span class="stat-trend" [class.positive]="ins.up" [class.negative]="!ins.up">
                <lucide-icon [name]="ins.up ? 'trending-up' : 'trending-down'" [size]="12"></lucide-icon>
                {{ ins.pct > 0 ? '+' : '' }}{{ ins.pct }}% vs prior week
              </span>
            } @else {
              <span class="stat-trend neutral">
                <lucide-icon name="minus" [size]="12"></lucide-icon> No prior-week data
              </span>
            }
          </div>
        </div>
        <div class="stat-card stat-card--rides">
          <div class="stat-icon rides"><lucide-icon name="bike" [size]="20"></lucide-icon></div>
          <div class="stat-content">
            <span class="stat-label">Completed Trips</span>
            <h3 class="stat-value">{{ completedCount() }}</h3>
            <span class="stat-trend positive">
              <lucide-icon name="check-circle" [size]="12"></lucide-icon> Good progress
            </span>
          </div>
        </div>
        <div class="stat-card stat-card--rating">
          <div class="stat-icon rating"><lucide-icon name="star" [size]="20"></lucide-icon></div>
          <div class="stat-content">
            <span class="stat-label">Rider Rating</span>
            <h3 class="stat-value">{{ riderRating() | number:'1.1-1' }}</h3>
            @if (riderRating() > 0) {
              <span class="stat-trend neutral">
                <lucide-icon name="award" [size]="12"></lucide-icon> Live from profile
              </span>
            } @else {
              <span class="stat-trend neutral">
                <lucide-icon name="minus" [size]="12"></lucide-icon> No ratings yet
              </span>
            }
          </div>
        </div>
      </div>

      <div class="main-grid">
        <div class="content-column">
          <section class="dashboard-section">
            <h2 class="section-title">
              <lucide-icon name="activity" [size]="18"></lucide-icon> 
              Current Task
            </h2>
            
            @if (loadingActive()) {
              <div class="card loader-card"><app-spinner /></div>
            } @else if (!activeJob()) {
              <div class="card empty-task-card modern-shadow">
                <div class="empty-illustration">
                  <lucide-icon name="navigation" [size]="48"></lucide-icon>
                </div>
                <h3>No active tasks</h3>
                <p>You are online — waiting for new requests to appear in your area.</p>
                <button class="btn btn--secondary btn--sm mt-16" (click)="toggleOnline()" *ngIf="!isOnline()">Go Online Now</button>
              </div>
            } @else {
              <div class="active-task-card modern-shadow" [routerLink]="['/rider/active']">
                <div class="task-header">
                  <span class="task-type-badge" [class.ride]="activeJob()?.type === 'RIDE'">
                    <lucide-icon [name]="activeJob()?.type === 'RIDE' ? 'bike' : 'package'" [size]="14"></lucide-icon>
                    {{ activeJob()?.type }}
                  </span>
                  <span class="task-price">KES {{ activeJob()?.price | number }}</span>
                </div>
                <div class="task-body">
                  <div class="route-display">
                    <div class="route-stop">
                      <div class="stop-icon start"></div>
                      <div class="stop-info">
                        <label>Pickup</label>
                        <p>{{ activeJob()?.pickupAddress }}</p>
                      </div>
                    </div>
                    <div class="route-line"></div>
                    <div class="route-stop">
                      <div class="stop-icon end"></div>
                      <div class="stop-info">
                        <label>Drop-off</label>
                        <p>{{ activeJob()?.dropoffAddress }}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="task-footer">
                  <div class="customer-info">
                    <div class="avatar-small">{{ activeJob()?.userName?.charAt(0) }}</div>
                    <span>{{ activeJob()?.userName }}</span>
                  </div>
                  <button class="btn btn--primary btn--pill">
                    Continue <lucide-icon name="arrow-right" [size]="14"></lucide-icon>
                  </button>
                </div>
              </div>
            }
          </section>

        </div>

        <div class="sidebar-column">
          <section class="dashboard-section">
            <div class="section-header-flex">
              <h2 class="section-title">
                <lucide-icon name="zap" [size]="18"></lucide-icon> 
                Nearby Requests
              </h2>
              @if (pendingRequests().length > 0) {
                <span class="count-badge pulse">{{ pendingRequests().length }}</span>
              }
            </div>

            <div class="requests-list">
              @if (!isOnline()) {
                <div class="card offline-card modern-shadow">
                  <lucide-icon name="eye-off" [size]="32" class="muted-icon"></lucide-icon>
                  <p>You are currently offline</p>
                  <small>Go online to see real-time requests from customers nearby.</small>
                </div>
              } @else if (pendingRequests().length === 0) {
                <div class="card waiting-card modern-shadow">
                  <div class="sonar-wrapper">
                    <div class="sonar-wave"></div>
                    <div class="sonar-wave"></div>
                    <lucide-icon name="search" [size]="24"></lucide-icon>
                  </div>
                  <p>Searching for requests...</p>
                  <small>Make sure you're in a busy area for faster pickups.</small>
                </div>
              } @else {
                @for (req of pendingRequests(); track req.id) {
                  <div class="request-item modern-shadow" [style.--delay]="$index * 0.1 + 's'">
                    <div class="req-header">
                      <div class="req-type">
                        <lucide-icon [name]="req.type === 'RIDE' ? 'bike' : 'package'" [size]="16"></lucide-icon>
                        <span>{{ req.type }}</span>
                      </div>
                      <span class="req-time">{{ relativeTime(req.arrivedAt) }}</span>
                    </div>
                    <div class="req-body">
                      <div class="req-user">
                        <div class="req-user-avatar">{{ req.user?.fullName?.charAt(0) ?? '?' }}</div>
                        <span class="req-user-name">{{ req.user?.fullName }}</span>
                        @if ((req.user?.passengerRatingAverage ?? 0) > 0) {
                          <span class="req-user-rating">
                            <lucide-icon name="star" [size]="11"></lucide-icon>
                            {{ req.user?.passengerRatingAverage | number:'1.1-1' }}
                          </span>
                        } @else {
                          <span class="req-user-rating req-user-rating--new">New</span>
                        }
                      </div>
                      <div class="req-loc">
                        <lucide-icon name="map-pin" [size]="12"></lucide-icon>
                        <p>{{ req.pickupAddress }}</p>
                      </div>
                      <div class="req-dist">
                        <lucide-icon name="route" [size]="12"></lucide-icon>
                        <span>{{ req.distanceKm != null ? (req.distanceKm | number:'1.1-1') + ' km away' : 'Calculating...' }}</span>
                      </div>
                    </div>
                    <div class="req-actions">
                      <div class="req-price">KES {{ req.price | number }}</div>
                      <button class="btn btn--primary btn--sm btn--pill" (click)="acceptRequest(req)">
                        Accept
                      </button>
                    </div>
                  </div>
                }
              }
            </div>
          </section>
        </div>

        <app-dashboard-activity-charts
          class="rider-charts-block"
          [chartSeries]="chartSeries()"
          [chartsLoading]="chartsLoading()"
          gradientId="riderEarnArea"
          [copy]="riderChartCopy"
        />
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { animation: fadeIn 0.6s ease-out; }
    .dashboard-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
    .welcome-text h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; color: var(--clr-text); }
    .welcome-text p { color: var(--clr-text-muted); font-size: 15px; margin-top: 4px; }
    .text-highlight { color: var(--clr-primary); font-weight: 700; }
    .header-actions { display: flex; align-items: center; gap: 20px; }
    .status-indicator { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 20px; background: var(--clr-bg-elevated); border: 1px solid var(--clr-border); transition: all 0.3s ease; }
    .status-text { font-size: 12px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--clr-text-dim); }
    .status-indicator.online { background: color-mix(in srgb, var(--clr-primary) 14%, transparent); border-color: color-mix(in srgb, var(--clr-primary) 26%, transparent); }
    .status-indicator.online .status-text { color: var(--clr-primary); }
    .status-indicator.online .pulse-dot { background: var(--clr-primary); box-shadow: 0 0 10px var(--clr-primary); animation: pulse 2s infinite; }
    .toggle-switch { width: 56px; height: 32px; background: var(--clr-bg-elevated); border-radius: 16px; position: relative; cursor: pointer; border: 1px solid var(--clr-border); transition: all 0.3s ease; }
    .switch-handle { position: absolute; left: 4px; top: 4px; width: 22px; height: 22px; background: var(--clr-bg-card); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--clr-text-dim); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .toggle-switch.active { background: var(--clr-primary); border-color: var(--clr-primary); }
    .toggle-switch.active .switch-handle { transform: translateX(24px); color: var(--clr-primary); box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
    .modern-shadow { box-shadow: var(--shadow-card); }
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px; }
    .stat-card {
      background: var(--clr-bg-card);
      border-radius: var(--radius-lg);
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      border: 1px solid var(--clr-border);
      border-left-width: 4px;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      box-shadow: var(--shadow-card);
    }
    .stat-card:hover { transform: translateY(-4px); }
    .stat-card--earnings { border-color: rgba(64, 138, 113, 0.45); background: linear-gradient(180deg, rgba(64,138,113,0.08), transparent 40%); }
    .stat-card--rides { border-color: rgba(64, 138, 113, 0.45); background: linear-gradient(180deg, rgba(64,138,113,0.08), transparent 40%); }
    .stat-card--rating { border-color: rgba(64, 138, 113, 0.45); background: linear-gradient(180deg, rgba(64,138,113,0.08), transparent 40%); }
    .stat-icon {
      width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
      background: var(--clr-bg-card); border: 1px solid var(--clr-border); box-shadow: var(--shadow-card), inset 0 1px 0 color-mix(in srgb, var(--clr-primary-light) 30%, transparent);
    }
    .stat-icon.earnings { color: var(--clr-primary); border-color: rgba(64, 138, 113, 0.35); }
    .stat-icon.rides { color: var(--clr-primary); border-color: rgba(64, 138, 113, 0.35); }
    .stat-icon.rating { color: var(--clr-primary-dark); border-color: rgba(64, 138, 113, 0.35); }
    .stat-label { font-size: 13px; color: var(--clr-text-muted); font-weight: 500; }
    .stat-value { font-size: 24px; font-weight: 800; margin: 4px 0; color: var(--clr-text); font-family: var(--font-display); }
    .stat-trend { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; }
    .stat-trend.positive { color: var(--clr-primary); }
    .stat-trend.neutral { color: var(--clr-primary-dark); }
    .stat-trend.negative { color: var(--clr-primary-dark); }
    .main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 32px; }
    .section-title { font-size: 16px; font-weight: 700; color: var(--clr-text); margin-bottom: 20px; display: flex; align-items: center; gap: 10px; opacity: 0.9; }
    .section-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .card { background: var(--clr-bg-card); border-radius: var(--radius-lg); border: 1px solid var(--clr-border); }
    .active-task-card { background: var(--clr-bg-card); border-radius: var(--radius-lg); padding: 28px; border: 1px solid var(--clr-primary); position: relative; overflow: hidden; box-shadow: var(--shadow-card); cursor: pointer; transition: transform 0.2s ease; }
    .active-task-card:hover { transform: translateY(-2px); }
    .active-task-card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--clr-primary); }
    .task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .task-type-badge { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: color-mix(in srgb, var(--clr-primary-light) 28%, transparent); color: var(--clr-primary-dark); }
    .task-type-badge.ride { background: color-mix(in srgb, var(--clr-primary) 18%, transparent); color: var(--clr-primary); }
    .task-price { font-size: 20px; font-weight: 800; color: var(--clr-primary); font-family: var(--font-display); }
    .route-display { position: relative; padding-left: 24px; }
    .route-stop { display: flex; gap: 16px; margin-bottom: 24px; }
    .route-stop:last-child { margin-bottom: 0; }
    .stop-icon { width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid var(--clr-bg-card); position: absolute; left: 0; margin-top: 4px; z-index: 2; }
    .stop-icon.start { background: var(--clr-primary); }
    .stop-icon.end { background: var(--clr-primary-dark); }
    .route-line { position: absolute; left: 5px; top: 16px; bottom: 16px; width: 2px; background: repeating-linear-gradient(to bottom, var(--clr-border) 0, var(--clr-border) 4px, transparent 4px, transparent 8px); }
    .stop-info label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--clr-text-muted); display: block; margin-bottom: 2px; }
    .stop-info p { font-size: 14px; font-weight: 500; color: var(--clr-text); line-height: 1.4; }
    .task-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--clr-border); }
    .customer-info { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; }
    .avatar-small { width: 32px; height: 32px; border-radius: 50%; background: var(--clr-bg-elevated); display: flex; align-items: center; justify-content: center; border: 1px solid var(--clr-border); }
    .rider-charts-block { display: block; grid-column: 1 / -1; margin-top: 4px; }
    .requests-list { display: flex; flex-direction: column; gap: 16px; }
    .request-item { background: var(--clr-bg-card); border-radius: var(--radius-md); padding: 16px; border: 1px solid var(--clr-border); box-shadow: var(--shadow-card); animation: slideIn 0.4s ease-out backwards; animation-delay: var(--delay); }
    .request-item:hover { border-color: var(--clr-primary); }
    .req-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .req-type { display: flex; align-items: center; gap: 6px; color: var(--clr-primary); font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .req-time { font-size: 11px; color: var(--clr-primary); font-weight: 600; }
    .req-body { margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
    .req-user { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--clr-border-subtle); }
    .req-user-avatar { width: 24px; height: 24px; border-radius: 50%; background: rgba(var(--clr-primary-rgb), 0.15); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--clr-primary); flex-shrink: 0; }
    .req-user-name { font-size: 12px; font-weight: 600; color: var(--clr-text); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .req-user-rating { display: flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; color: var(--clr-warning, #f59e0b); flex-shrink: 0; background: rgba(245, 158, 11, 0.12); padding: 2px 6px; border-radius: 10px; }
    .req-user-rating--new { color: var(--clr-text-muted); background: var(--clr-bg-elevated); font-size: 10px; }
    .req-loc { display: flex; gap: 8px; }
    .req-loc p { font-size: 13px; color: var(--clr-text); line-height: 1.4; }
    .req-loc lucide-icon { margin-top: 2px; color: var(--clr-text-muted); }
    .req-dist { display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--clr-text-muted); }
    .req-actions { display: flex; justify-content: space-between; align-items: center; }
    .req-price { font-size: 16px; font-weight: 700; color: var(--clr-text); }
    .empty-task-card, .offline-card, .waiting-card { padding: 40px 24px; text-align: center; }
    .empty-task-card h3, .offline-card h3, .waiting-card h3 { font-size: 16px; margin: 16px 0 8px; }
    .empty-task-card p, .offline-card p, .waiting-card p { font-size: 13px; color: var(--clr-text-muted); margin-bottom: 20px; }
    .empty-task-card small, .offline-card small, .waiting-card small { font-size: 12px; color: var(--clr-text-dim); }
    .muted-icon { color: var(--clr-text-dim); opacity: 0.5; margin-bottom: 16px; }
    .sonar-wrapper { width: 60px; height: 60px; margin: 0 auto 20px; position: relative; display: flex; align-items: center; justify-content: center; color: var(--clr-primary); }
    .sonar-wave { position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 2px solid var(--clr-primary); animation: sonar 2s infinite ease-out; opacity: 0; }
    .sonar-wave:nth-child(2) { animation-delay: 1s; }
    @keyframes sonar { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--clr-primary) 40%, transparent); } 70% { box-shadow: 0 0 0 10px color-mix(in srgb, var(--clr-primary) 0%, transparent); } 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--clr-primary) 0%, transparent); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    .mt-16 { margin-top: 16px; }
    .mt-32 { margin-top: 32px; }
    .count-badge { background: var(--clr-primary-dark); color: var(--clr-text); font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px; }
    .pulse { animation: pulse-red 2s infinite; }
    @keyframes pulse-red { 0% { transform: scale(0.95); } 50% { transform: scale(1.05); } 100% { transform: scale(0.95); } }

    @media (max-width: 1100px) {
      .main-grid { grid-template-columns: 1fr; }
      .sidebar-column { order: -1; }
    }
    @media (max-width: 768px) {
      .stats-row { grid-template-columns: 1fr; gap: 16px; margin-bottom: 28px; }
      .dashboard-header { flex-direction: column; align-items: stretch; gap: 20px; }
      .header-actions { justify-content: space-between; }
      .welcome-text h1 { font-size: 22px; }
    }
    @media (max-width: 480px) {
      .stats-row { gap: 12px; }
      .stat-card { padding: 18px; }
    }
  `],
})
export class RiderDashboardComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly rideSvc = inject(RideService);
  private readonly parcelSvc = inject(ParcelService);
  private readonly trackingSvc = inject(TrackingService);
  private readonly ridersApi = inject(RidersApi);
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);

  private riderLat: number | null = null;
  private riderLng: number | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private nearbyTimer: ReturnType<typeof setInterval> | null = null;
  /** Ticks every 30 s to refresh relative timestamps in the template */
  protected readonly clockTick = signal(Date.now());

  protected readonly isOnline = signal(true);
  protected readonly loadingActive = signal(true);
  protected readonly activeJob = signal<any | null>(null);
  protected readonly pendingRequests = signal<any[]>([]);

  protected readonly completedCount = signal(0);
  protected readonly todayEarnings = signal(0);
  protected readonly riderRating = signal(0);
  protected readonly chartSeries = signal<DayBucket[]>([]);
  protected readonly prevWeekEarnings = signal(0);
  protected readonly chartsLoading = signal(true);
  private loadStatsAttempt = 0;

  protected readonly riderChartCopy = RIDER_CHART_COPY;

  protected readonly earningsInsight = computed(() => {
    const cur = this.chartSeries().reduce((sum, d) => sum + d.amount, 0);
    const prev = this.prevWeekEarnings();
    if (prev <= 0) return null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { pct, up: pct >= 0 };
  });

  async ngOnInit() {
    this.trackingSvc.connect();
    this.clockTimer = setInterval(() => this.zone.run(() => this.clockTick.set(Date.now())), 30_000);
    this.nearbyTimer = setInterval(() => void this.loadNearbyRequests(), 60_000);
    await Promise.all([
      this.loadActiveJob(),
      this.loadStats(),
      this.loadRiderProfile(),
    ]);
    this.setupListeners();
    // Default to online — broadcast availability and share location on load
    this.trackingSvc.toggleAvailability(true);
    this.reportLocation();
  }

  private async loadNearbyRequests() {
    if (!this.isOnline()) return;

    try {
      const [rides, parcels] = await Promise.all([
        this.rideSvc.getNearby(this.riderLat ?? undefined, this.riderLng ?? undefined, 500),
        this.parcelSvc.getNearby(this.riderLat ?? undefined, this.riderLng ?? undefined, 500)
      ]);

      const formattedRides = rides.map(r => ({
        ...r,
        type: 'RIDE',
        price: r.estimatedFare,
        arrivedAt: new Date(r.createdAt).getTime(),
        distanceKm: this.calcDistance(r.pickupLat, r.pickupLng)
      }));

      const formattedParcels = parcels.map(p => ({
        ...p,
        type: 'PARCEL',
        price: p.deliveryFee,
        arrivedAt: new Date(p.createdAt).getTime(),
        distanceKm: this.calcDistance(p.pickupLat, p.pickupLng)
      }));

      // Combine and sort by distance
      const combined = [...formattedRides, ...formattedParcels].sort((a, b) => 
        (a.distanceKm ?? 999) - (b.distanceKm ?? 999)
      );

      this.pendingRequests.set(combined);
    } catch (error) {
      console.error('Error loading nearby requests', error);
    }
  }

  private setupListeners() {
    this.trackingSvc.onNewRideRequest((ride: any) => {
      if (this.isOnline()) {
        const distanceKm = this.calcDistance(ride.pickupLat, ride.pickupLng);
        this.pendingRequests.update(prev => [
          { ...ride, type: 'RIDE', price: ride.estimatedFare, arrivedAt: Date.now(), distanceKm },
          ...prev,
        ]);
        this.toast.info('New ride request nearby!');
      }
    });

    this.trackingSvc.onNewParcelRequest((parcel: any) => {
      if (this.isOnline()) {
        const distanceKm = this.calcDistance(parcel.pickupLat, parcel.pickupLng);
        this.pendingRequests.update(prev => [
          { ...parcel, type: 'PARCEL', price: parcel.deliveryFee, arrivedAt: Date.now(), distanceKm },
          ...prev,
        ]);
        this.toast.info('New parcel delivery nearby!');
      }
    });
  }

  /** Haversine distance in km from rider's current position to a point. */
  private calcDistance(lat: number, lng: number): number | null {
    if (this.riderLat == null || this.riderLng == null) return null;
    const R = 6371;
    const dLat = ((lat - this.riderLat) * Math.PI) / 180;
    const dLng = ((lng - this.riderLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((this.riderLat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Human-readable relative time. Depends on clockTick so it re-evaluates every 30 s. */
  protected relativeTime(ts: number): string {
    this.clockTick(); // reactive dependency
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    return `${Math.floor(mins / 60)} hr ago`;
  }

  private async loadActiveJob() {
    try {
      const [ride, parcel] = await Promise.all([
        this.rideSvc.getActive(),
        this.parcelSvc.getActive()
      ]);

      if (ride) {
        this.activeJob.set({ ...ride, type: 'RIDE', price: ride.estimatedFare, userName: ride.user.fullName });
      } else if (parcel) {
        this.activeJob.set({ ...parcel, type: 'PARCEL', price: parcel.deliveryFee, userName: parcel.user.fullName });
      } else {
        this.activeJob.set(null);
      }
    } catch (err) {
      console.error('Error loading active job', err);
    } finally {
      this.loadingActive.set(false);
    }
  }

  private async loadStats() {
    this.loadStatsAttempt++;
    this.chartsLoading.set(true);
    let hadError = false;
    try {
      const [rideRes, parcelRes] = await Promise.all([
        this.rideSvc.getRiderHistory(1, 50, 'COMPLETED'),
        this.parcelSvc.getRiderHistory(1, 50, 'DELIVERED'),
      ]);

      this.completedCount.set(rideRes.total + parcelRes.total);

      const todayKey = dateKeyFromDate(new Date());
      const earnings =
        rideRes.data.reduce((s, r) => {
          const pt = activityPointFromRide(r);
          return localDayKey(pt.dateIso) === todayKey ? s + pt.amount : s;
        }, 0) +
        parcelRes.data.reduce((s, p) => {
          const pt = activityPointFromParcel(p);
          return localDayKey(pt.dateIso) === todayKey ? s + pt.amount : s;
        }, 0);
      this.todayEarnings.set(earnings);

      const points = ridesAndParcelsToActivityPoints(rideRes.data, parcelRes.data);
      const { current, prevWeekTotal } = buildWeeklyChartBuckets(points);
      this.chartSeries.set(current);
      this.prevWeekEarnings.set(prevWeekTotal);
    } catch (err) {
      hadError = true;
      console.error('Error loading rider dashboard stats', err);
    } finally {
      this.chartsLoading.set(false);
      // Some first-load issues (e.g., token refresh timing) can leave chart data empty.
      // Retry once so landing on the page always renders the charts.
      if (hadError && this.loadStatsAttempt < 2) {
        setTimeout(() => void this.loadStats(), 400);
      }
    }
  }

  private async loadRiderProfile() {
    try {
      const profile: RiderProfile = await this.ridersApi.getMyProfile();
      this.riderRating.set(profile.ratingAverage ?? 0);
    } catch {
      this.riderRating.set(0);
    }
  }

  protected toggleOnline() {
    const newState = !this.isOnline();
    this.isOnline.set(newState);
    this.trackingSvc.toggleAvailability(newState);
    
    if (newState) {
      this.toast.success('You are now online');
      this.reportLocation();
      void this.loadNearbyRequests();
    } else {
      this.pendingRequests.set([]);
      this.toast.info('You are now offline');
    }
  }

  private reportLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(pos => {
        this.riderLat = pos.coords.latitude;
        this.riderLng = pos.coords.longitude;
        this.trackingSvc.sendLocation(pos.coords.latitude, pos.coords.longitude);
        void this.loadNearbyRequests();
      });
    }
  }

  protected async acceptRequest(req: any) {
    try {
      if (req.type === 'RIDE') {
        await this.rideSvc.accept(req.id);
      } else {
        await this.parcelSvc.accept(req.id);
      }
      this.toast.success('Request accepted!');
      await this.loadActiveJob();
      this.pendingRequests.update(prev => prev.filter(r => r.id !== req.id));
    } catch (error) {
      // Error handled by interceptor
    }
  }

  ngOnDestroy() {
    this.trackingSvc.disconnect();
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.nearbyTimer) clearInterval(this.nearbyTimer);
  }
}
