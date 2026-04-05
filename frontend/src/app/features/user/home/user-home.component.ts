import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { RideService } from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { DashboardActivityChartsComponent } from '../../../shared/components/dashboard-activity-charts/dashboard-activity-charts.component';
import {
  buildWeeklyChartBuckets,
  ridesAndParcelsToActivityPoints,
  type DayBucket,
} from '../../../shared/utils/activity-buckets.util';
import type { Ride } from '../../../core/models/ride.models';
import type { Parcel } from '../../../core/models/parcel.models';

const USER_CHART_COPY = {
  amount7d: '7-day spend',
  jobsLabel: 'Bookings completed',
  avgLabel: 'Avg. per booking',
  rideShareLabel: 'Ride share',
  dailyAmountTitle: 'Daily spend',
  dailyAmountHint: 'M-Pesa trips use the paid amount and payment date; cash uses trip completion.',
} as const;

@Component({
  selector: 'app-user-home',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule, DashboardActivityChartsComponent],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div>
          <h1 class="welcome-title">
            Welcome back, {{ firstName() }}
            <lucide-icon name="sun" [size]="22" class="welcome-icon" aria-hidden="true"></lucide-icon>
          </h1>
          <p>Where do you want to go today?</p>
        </div>
      </div>

      <app-dashboard-activity-charts
        class="user-home-charts"
        [chartSeries]="chartSeries()"
        [chartsLoading]="chartsLoading()"
        gradientId="userSpendArea"
        sectionTitle="Your activity and spend"
        [copy]="userChartCopy"
      />

      <!-- Quick actions — below charts -->
      <div class="action-grid">
        <a [routerLink]="['/user/book-ride']" class="action-card">
          <div class="action-icon" aria-hidden="true"><lucide-icon name="bike" [size]="28"></lucide-icon></div>
          <h3>Book a Ride</h3>
          <p>Fast, affordable boda boda rides</p>
        </a>
        <a [routerLink]="['/user/book-parcel']" class="action-card">
          <div class="action-icon" aria-hidden="true"><lucide-icon name="package" [size]="28"></lucide-icon></div>
          <h3>Send a Parcel</h3>
          <p>Reliable same-day delivery</p>
        </a>
      </div>

      <!-- Recent rides -->
      <section class="section">
        <div class="section-header">
          <h2>Recent Rides</h2>
          <a [routerLink]="['/user/rides']">View all →</a>
        </div>

        @if (loadingRides()) {
          <app-spinner />
        } @else if (recentRides().length === 0) {
          <div class="empty-state">
            <div class="empty-icon" aria-hidden="true"><lucide-icon name="bike" [size]="40"></lucide-icon></div>
            <h3>No rides yet</h3>
            <p>Book your first ride to get started</p>
          </div>
        } @else {
          <div class="item-grid">
            @for (ride of recentRides(); track ride.id) {
              <a [routerLink]="['/user/rides', ride.id]" class="item-card">
                <div class="item-card__head">
                  <span class="badge badge--{{ statusBadge(ride.status) }}">{{ ride.status | titlecase }}</span>
                  <span class="item-fare">KES {{ ride.estimatedFare | number:'1.0-0' }}</span>
                </div>
                <div class="item-route">
                  <div class="route-row">
                    <span class="route-dot route-dot--pickup"></span>
                    <span class="route-addr">{{ ride.pickupAddress }}</span>
                  </div>
                  <div class="route-connector"></div>
                  <div class="route-row">
                    <span class="route-dot route-dot--drop"></span>
                    <span class="route-addr">{{ ride.dropoffAddress }}</span>
                  </div>
                </div>
                <div class="item-card__foot">
                  <lucide-icon name="bike" [size]="13" class="item-type-icon"></lucide-icon>
                  <span>Ride · {{ ride.distanceKm | number:'1.1-1' }} km</span>
                  <lucide-icon name="chevron-right" [size]="14" class="item-arrow"></lucide-icon>
                </div>
              </a>
            }
          </div>
        }
      </section>

      <!-- Recent parcels -->
      <section class="section">
        <div class="section-header">
          <h2>Recent Deliveries</h2>
          <a [routerLink]="['/user/parcels']">View all →</a>
        </div>

        @if (loadingParcels()) {
          <app-spinner />
        } @else if (recentParcels().length === 0) {
          <div class="empty-state">
            <div class="empty-icon" aria-hidden="true"><lucide-icon name="package" [size]="40"></lucide-icon></div>
            <h3>No deliveries yet</h3>
            <p>Send your first parcel to get started</p>
          </div>
        } @else {
          <div class="item-grid">
            @for (parcel of recentParcels(); track parcel.id) {
              <a [routerLink]="['/user/parcels', parcel.id]" class="item-card">
                <div class="item-card__head">
                  <span class="badge badge--{{ statusBadge(parcel.status) }}">{{ parcel.status | titlecase }}</span>
                  <span class="item-fare">KES {{ parcel.deliveryFee | number:'1.0-0' }}</span>
                </div>
                <div class="item-route">
                  <div class="route-row">
                    <span class="route-dot route-dot--pickup"></span>
                    <span class="route-addr">{{ parcel.pickupAddress }}</span>
                  </div>
                  <div class="route-connector"></div>
                  <div class="route-row">
                    <span class="route-dot route-dot--drop"></span>
                    <span class="route-addr">{{ parcel.dropoffAddress }}</span>
                  </div>
                </div>
                <div class="item-card__foot">
                  <lucide-icon name="package" [size]="13" class="item-type-icon"></lucide-icon>
                  <span>{{ parcel.itemDescription }}</span>
                  <lucide-icon name="chevron-right" [size]="14" class="item-arrow"></lucide-icon>
                </div>
              </a>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .welcome-title { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .welcome-icon { color: var(--clr-primary); flex-shrink: 0; }
    .action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 32px; }
    @media (max-width: 560px) { .action-grid { grid-template-columns: 1fr; } }
    .action-card {
      background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg);
      padding: 28px 24px; text-decoration: none; transition: all var(--transition);
      display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-card);
    }
    .action-card:hover { border-color: var(--clr-primary); transform: translateY(-2px); }
    .action-icon {
      width: 52px; height: 52px; border-radius: var(--radius-md); background: var(--clr-bg-elevated);
      display: flex; align-items: center; justify-content: center; color: var(--clr-primary);
    }
    .action-card h3 { font-size: 17px; font-weight: 700; }
    .action-card p  { font-size: 13px; color: var(--clr-text-muted); }
    .section { margin-bottom: 32px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; h2 { font-size: 17px; font-weight: 700; } a { font-size: 13px; } }

    /* Item cards grid */
    .item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .item-card {
      background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg);
      padding: 16px; text-decoration: none; display: flex; flex-direction: column; gap: 12px;
      transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
      box-shadow: var(--shadow-card);
    }
    .item-card:hover {
      border-color: var(--clr-primary); transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(64,138,113,0.12);
    }
    .item-card__head { display: flex; justify-content: space-between; align-items: center; }
    .item-fare { font-size: 15px; font-weight: 700; color: var(--clr-text); }

    /* Route inside card */
    .item-route { position: relative; display: flex; flex-direction: column; gap: 0; }
    .route-row { display: flex; align-items: flex-start; gap: 10px; padding: 4px 0; }
    .route-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
    .route-dot--pickup { background: var(--clr-primary); }
    .route-dot--drop   { background: var(--clr-success); }
    .route-connector {
      width: 2px; height: 12px; background: var(--clr-border);
      margin-left: 4px;
    }
    .route-addr {
      font-size: 12px; color: var(--clr-text-muted); line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }

    /* Card footer */
    .item-card__foot {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: var(--clr-text-dim); border-top: 1px solid var(--clr-border-subtle); padding-top: 10px;
    }
    .item-type-icon { color: var(--clr-text-dim); flex-shrink: 0; }
    .item-arrow { margin-left: auto; color: var(--clr-text-dim); }

    .empty-icon { display: flex; justify-content: center; color: var(--clr-text-dim); opacity: 0.5; margin-bottom: 8px; }
    .user-home-charts { display: block; margin-bottom: 32px; }
  `],
})
export class UserHomeComponent implements OnInit {
  private readonly auth         = inject(AuthService);
  private readonly rideService  = inject(RideService);
  private readonly parcelService = inject(ParcelService);
  private chartsLoadAttempt = 0;

  protected readonly userChartCopy = USER_CHART_COPY;
  protected readonly recentRides   = signal<Ride[]>([]);
  protected readonly recentParcels = signal<Parcel[]>([]);
  protected readonly loadingRides   = signal(true);
  protected readonly loadingParcels = signal(true);
  protected readonly chartSeries = signal<DayBucket[]>([]);
  protected readonly chartsLoading = signal(true);

  protected firstName(): string {
    const fullName = this.auth.user()?.fullName?.trim();
    return (fullName ? fullName.split(' ')[0] : '') || 'there';
  }

  ngOnInit(): void {
    void this.rideService.getMyRides(1, 3).then(
      (res) => { this.recentRides.set(res.data); this.loadingRides.set(false); },
    ).catch((err) => { 
      console.error('Error loading recent rides', err);
      this.loadingRides.set(false); 
    });

    void this.parcelService.getMyParcels(1, 3).then(
      (res) => { this.recentParcels.set(res.data); this.loadingParcels.set(false); },
    ).catch((err) => {
      console.error('Error loading recent parcels', err);
      this.loadingParcels.set(false);
    });

    void this.loadChartsWithRetry();
  }

  private async loadChartsWithRetry(): Promise<void> {
    this.chartsLoadAttempt++;
    this.chartsLoading.set(true);
    let hadError = false;
    try {
      const [rideRes, parcelRes] = await Promise.all([
        this.rideService.getMyRides(1, 50, 'COMPLETED'),
        this.parcelService.getMyParcels(1, 50, 'DELIVERED'),
      ]);
      const points = ridesAndParcelsToActivityPoints(rideRes.data, parcelRes.data);
      const { current } = buildWeeklyChartBuckets(points);
      this.chartSeries.set(current);
    } catch (err) {
      hadError = true;
      console.error('Error loading user home charts', err);
      if (this.chartsLoadAttempt < 2) {
        setTimeout(() => void this.loadChartsWithRetry(), 400);
      }
    } finally {
      this.chartsLoading.set(false);
    }
  }

  protected statusBadge(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'pending', ACCEPTED: 'info', IN_PROGRESS: 'info',
      EN_ROUTE_TO_PICKUP: 'info', ARRIVED_AT_PICKUP: 'info',
      COMPLETED: 'active', DELIVERED: 'active', CANCELLED: 'closed',
    };
    return map[status] ?? 'closed';
  }
}
