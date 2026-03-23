import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { RideService } from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride } from '../../../core/models/ride.models';
import type { Parcel } from '../../../core/models/parcel.models';

@Component({
  selector: 'app-user-home',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Welcome back, {{ firstName() }} 👋</h1>
          <p>Where do you want to go today?</p>
        </div>
      </div>

      <!-- Quick action cards -->
      <div class="action-grid">
        <a [routerLink]="['/user/book-ride']" class="action-card">
          <div class="action-icon">🏍</div>
          <h3>Book a Ride</h3>
          <p>Fast, affordable boda boda rides</p>
        </a>
        <a [routerLink]="['/user/book-parcel']" class="action-card">
          <div class="action-icon">📦</div>
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
            <div class="empty-icon">🏍</div>
            <h3>No rides yet</h3>
            <p>Book your first ride to get started</p>
          </div>
        } @else {
          <div class="ride-list">
            @for (ride of recentRides(); track ride.id) {
              <a [routerLink]="['/user/rides', ride.id]" class="ride-item">
                <div class="ride-route">
                  <span class="dot dot--pickup"></span>
                  <span class="address">{{ ride.pickupAddress }}</span>
                </div>
                <div class="ride-route">
                  <span class="dot dot--drop"></span>
                  <span class="address">{{ ride.dropoffAddress }}</span>
                </div>
                <div class="ride-meta">
                  <span class="badge badge--{{ statusBadge(ride.status) }}">{{ ride.status }}</span>
                  <span class="fare">KES {{ ride.estimatedFare | number:'1.0-0' }}</span>
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
            <div class="empty-icon">📦</div>
            <h3>No deliveries yet</h3>
            <p>Send your first parcel to get started</p>
          </div>
        } @else {
          <div class="ride-list">
            @for (parcel of recentParcels(); track parcel.id) {
              <a [routerLink]="['/user/parcels', parcel.id]" class="ride-item">
                <p class="parcel-desc">{{ parcel.itemDescription }}</p>
                <div class="ride-meta">
                  <span class="badge badge--{{ statusBadge(parcel.status) }}">{{ parcel.status }}</span>
                  <span class="fare">KES {{ parcel.deliveryFee | number:'1.0-0' }}</span>
                </div>
              </a>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .action-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; margin-bottom: 32px; }
    .action-card {
      background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg);
      padding: 28px 24px; text-decoration: none; transition: all var(--transition);
      display: flex; flex-direction: column; gap: 8px;
      &:hover { border-color: var(--clr-primary); transform: translateY(-2px); box-shadow: var(--shadow-md); }
    }
    .action-icon { font-size: 36px; }
    .action-card h3 { font-size: 17px; font-weight: 700; }
    .action-card p  { font-size: 13px; color: var(--clr-text-muted); }
    .section { margin-bottom: 32px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; h2 { font-size: 17px; font-weight: 700; } a { font-size: 13px; } }
    .ride-list { display: flex; flex-direction: column; gap: 1px; background: var(--clr-border); border-radius: var(--radius-lg); overflow: hidden; }
    .ride-item {
      background: var(--clr-bg-card); padding: 14px 16px; text-decoration: none;
      display: flex; flex-direction: column; gap: 6px; transition: background var(--transition);
      &:hover { background: var(--clr-bg-elevated); }
    }
    .ride-route { display: flex; align-items: center; gap: 8px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot--pickup { background: var(--clr-primary); }
    .dot--drop   { background: var(--clr-success); }
    .address { font-size: 13px; color: var(--clr-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ride-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .fare { font-size: 14px; font-weight: 600; }
    .parcel-desc { font-size: 13px; font-weight: 500; }
  `],
})
export class UserHomeComponent implements OnInit {
  private readonly auth         = inject(AuthService);
  private readonly rideService  = inject(RideService);
  private readonly parcelService = inject(ParcelService);

  protected readonly recentRides   = signal<Ride[]>([]);
  protected readonly recentParcels = signal<Parcel[]>([]);
  protected readonly loadingRides   = signal(true);
  protected readonly loadingParcels = signal(true);

  protected firstName(): string {
    return this.auth.user()?.fullName?.split(' ')[0] ?? 'there';
  }

  ngOnInit(): void {
    void this.rideService.getMyRides(1, 3).then(
      (res) => { this.recentRides.set(res.data); this.loadingRides.set(false); },
    ).catch(() => this.loadingRides.set(false));

    void this.parcelService.getMyParcels(1, 3).then(
      (res) => { this.recentParcels.set(res.data); this.loadingParcels.set(false); },
    ).catch(() => this.loadingParcels.set(false));
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
