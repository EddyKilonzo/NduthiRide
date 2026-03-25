import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { RideService } from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { Ride } from '../../../core/models/ride.models';
import { Parcel } from '../../../core/models/parcel.models';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="page app-page">
      <header class="page-header">
        <div>
          <h1>Hello, {{ auth.user()?.fullName }}!</h1>
          <p>Where are we going today?</p>
        </div>
      </header>

      <div class="quick-actions">
        <a [routerLink]="['/user/book-ride']" class="action-card action-card--primary">
          <span class="action-icon" aria-hidden="true"><lucide-icon name="bike" [size]="26"></lucide-icon></span>
          <div class="action-text">
            <h3>Book a Ride</h3>
            <p>Fast boda boda at your doorstep</p>
          </div>
        </a>
        <a [routerLink]="['/user/book-parcel']" class="action-card action-card--secondary">
          <span class="action-icon" aria-hidden="true"><lucide-icon name="package" [size]="26"></lucide-icon></span>
          <div class="action-text">
            <h3>Send a Parcel</h3>
            <p>Reliable delivery across the city</p>
          </div>
        </a>
      </div>

      <div class="dashboard-grid">
        <!-- Active Rides Section -->
        <section class="dashboard-section">
          <div class="section-header">
            <h2>Active Rides</h2>
            <a [routerLink]="['/user/rides']" class="btn btn--ghost btn--sm">View History</a>
          </div>

          @if (loadingRides()) {
            <div class="section-loader"><app-spinner /></div>
          } @else if (activeRides().length === 0) {
            <div class="empty-card">
              <span class="empty-icon" aria-hidden="true"><lucide-icon name="bike" [size]="36"></lucide-icon></span>
              <p>No active rides at the moment</p>
            </div>
          } @else {
            <div class="card-list">
              @for (ride of activeRides(); track ride.id) {
                <div class="job-card" [routerLink]="['/user/rides', ride.id]">
                  <div class="job-status badge" [className]="'badge--' + ride.status.toLowerCase()">
                    {{ ride.status }}
                  </div>
                  <div class="job-info">
                    <p class="address"><strong>From:</strong> {{ ride.pickupAddress }}</p>
                    <p class="address"><strong>To:</strong> {{ ride.dropoffAddress }}</p>
                  </div>
                  <div class="job-footer">
                    <span class="price">KES {{ ride.estimatedFare }}</span>
                    <span class="date">{{ ride.createdAt | date:'shortTime' }}</span>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Active Parcels Section -->
        <section class="dashboard-section">
          <div class="section-header">
            <h2>Active Deliveries</h2>
            <a [routerLink]="['/user/parcels']" class="btn btn--ghost btn--sm">View History</a>
          </div>

          @if (loadingParcels()) {
            <div class="section-loader"><app-spinner /></div>
          } @else if (activeParcels().length === 0) {
            <div class="empty-card">
              <span class="empty-icon" aria-hidden="true"><lucide-icon name="package" [size]="36"></lucide-icon></span>
              <p>No active deliveries at the moment</p>
            </div>
          } @else {
            <div class="card-list">
              @for (parcel of activeParcels(); track parcel.id) {
                <div class="job-card" [routerLink]="['/user/parcels', parcel.id]">
                  <div class="job-status badge" [className]="'badge--' + parcel.status.toLowerCase()">
                    {{ parcel.status }}
                  </div>
                  <div class="job-info">
                    <p class="item">{{ parcel.itemDescription }}</p>
                    <p class="address"><strong>To:</strong> {{ parcel.dropoffAddress }}</p>
                  </div>
                  <div class="job-footer">
                    <span class="price">KES {{ parcel.deliveryFee }}</span>
                    <span class="date">{{ parcel.createdAt | date:'shortTime' }}</span>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .quick-actions {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px; margin-bottom: 40px;
    }
    .action-card {
      display: flex; align-items: center; gap: 20px; padding: 24px;
      border-radius: var(--radius-lg); border: 1px solid var(--clr-border);
      transition: all var(--transition); text-decoration: none; box-shadow: var(--shadow-card);
      &:hover { transform: translateY(-4px); border-color: var(--clr-primary); }
      
      &--primary { background: linear-gradient(135deg, rgba(255,107,0,.1) 0%, rgba(255,107,0,.05) 100%); }
      &--secondary { background: linear-gradient(135deg, rgba(59,130,246,.1) 0%, rgba(59,130,246,.05) 100%); }
    }
    .action-icon {
      width: 64px; height: 64px; flex-shrink: 0;
      background: var(--clr-bg-card); border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      color: var(--clr-primary);
    }
    .action-text {
      h3 { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: var(--clr-text); }
      p { font-size: 14px; color: var(--clr-text-muted); }
    }

    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 32px; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; h2 { font-size: 18px; font-weight: 600; } }
    
    .card-list { display: flex; flex-direction: column; gap: 12px; }
    .job-card {
      background: var(--clr-bg-card); border: 1px solid var(--clr-border);
      border-radius: var(--radius-md); padding: 16px; cursor: pointer;
      transition: background var(--transition), transform 0.2s ease;
      box-shadow: var(--shadow-card);
      &:hover { background: var(--clr-bg-elevated); transform: translateY(-2px); }
    }
    .job-info { margin: 12px 0; }
    .address { font-size: 13px; color: var(--clr-text); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .job-footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--clr-border); padding-top: 12px; margin-top: 12px; }
    .price { font-weight: 700; color: var(--clr-primary); }
    .date { font-size: 12px; color: var(--clr-text-muted); }

    .empty-card {
      background: var(--clr-bg-card); border: 1px dashed var(--clr-border);
      border-radius: var(--radius-md); padding: 40px; text-align: center; color: var(--clr-text-muted);
      box-shadow: var(--shadow-card);
      .empty-icon { margin-bottom: 12px; opacity: .35; display: flex; justify-content: center; color: var(--clr-text-dim); }
    }
    .section-loader { padding: 40px; display: flex; justify-content: center; }
  `],
})
export class UserDashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly rideSvc = inject(RideService);
  private readonly parcelSvc = inject(ParcelService);

  protected readonly activeRides = signal<Ride[]>([]);
  protected readonly activeParcels = signal<Parcel[]>([]);
  protected readonly loadingRides = signal(true);
  protected readonly loadingParcels = signal(true);

  async ngOnInit() {
    await Promise.all([this.loadRides(), this.loadParcels()]);
  }

  private async loadRides() {
    try {
      // Fetch rides and filter for non-final statuses in frontend for simplicity in dashboard
      const res = await this.rideSvc.getMyRides(1, 5);
      this.activeRides.set(res.data.filter(r => !['COMPLETED', 'CANCELLED'].includes(r.status)));
    } finally {
      this.loadingRides.set(false);
    }
  }

  private async loadParcels() {
    try {
      const res = await this.parcelSvc.getMyParcels(1, 5);
      this.activeParcels.set(res.data.filter(p => !['DELIVERED', 'CANCELLED'].includes(p.status)));
    } finally {
      this.loadingParcels.set(false);
    }
  }
}
