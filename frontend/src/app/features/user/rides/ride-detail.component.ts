import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { RideService } from '../../../core/services/ride.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride } from '../../../core/models/ride.models';

@Component({
  selector: 'app-ride-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="page app-page">
      @if (loading()) {
        <app-spinner [overlay]="true" />
      } @else if (!ride()) {
        <div class="empty-state"><h3>Ride not found</h3></div>
      } @else {
        <div class="page-header">
          <div>
            <h1>Ride Details</h1>
            <span class="badge badge--{{ badge(ride()!.status) }}">{{ ride()!.status }}</span>
          </div>
          <a [routerLink]="['/user/rides']" class="btn btn--ghost btn--sm">← Back</a>
        </div>

        <div class="detail-grid">
          <!-- Route card -->
          <div class="card">
            <h3 class="card-title">Route</h3>
            <div class="route-item">
              <div class="dot dot--pickup"></div>
              <div>
                <p class="route-label">Pickup</p>
                <p>{{ ride()!.pickupAddress }}</p>
              </div>
            </div>
            <div class="route-line"></div>
            <div class="route-item">
              <div class="dot dot--drop"></div>
              <div>
                <p class="route-label">Drop-off</p>
                <p>{{ ride()!.dropoffAddress }}</p>
              </div>
            </div>
          </div>

          <!-- Fare card -->
          <div class="card">
            <h3 class="card-title">Fare</h3>
            <div class="info-row">
              <span>Distance</span>
              <strong>{{ ride()!.distanceKm | number:'1.1-1' }} km</strong>
            </div>
            <div class="info-row">
              <span>Estimated</span>
              <strong>KES {{ ride()!.estimatedFare | number:'1.0-0' }}</strong>
            </div>
            @if (ride()!.finalFare) {
              <div class="info-row">
                <span>Final Fare</span>
                <strong class="text-primary">KES {{ ride()!.finalFare! | number:'1.0-0' }}</strong>
              </div>
            }
            <div class="info-row">
              <span>Payment</span>
              <strong>{{ ride()!.paymentMethod }}</strong>
            </div>
          </div>

          <!-- Rider card -->
          @if (ride()!.rider) {
            <div class="card">
              <h3 class="card-title">Your Rider</h3>
              <div class="rider-info">
                <div class="avatar">{{ ride()!.rider!.account.fullName.charAt(0) }}</div>
                <div>
                  <p class="rider-name">{{ ride()!.rider!.account.fullName }}</p>
                  <p class="rider-sub">{{ ride()!.rider!.account.phone }}</p>
                  <p class="rider-sub rider-rating">
                    <lucide-icon name="star" [size]="14" class="star-inline"></lucide-icon>
                    {{ ride()!.rider!.ratingAverage | number:'1.1-1' }}
                  </p>
                  <p class="rider-sub">{{ ride()!.rider!.bikeModel }} — {{ ride()!.rider!.bikeRegistration }}</p>
                </div>
              </div>
            </div>
          }

          <!-- Actions -->
          @if (['PENDING','ACCEPTED'].includes(ride()!.status)) {
            <div class="card actions-card">
              <h3 class="card-title">Actions</h3>
              <button class="btn btn--danger btn--full" (click)="cancel()" [disabled]="cancelling()">
                @if (cancelling()) { Cancelling... } @else { Cancel Ride }
              </button>
            </div>
          }

          <!-- Rate (completed, not yet rated) -->
          @if (ride()!.status === 'COMPLETED' && !rated()) {
            <div class="card">
              <h3 class="card-title">Rate Your Ride</h3>
              <div class="stars" role="group" aria-label="Rating">
                @for (star of [1,2,3,4,5]; track star) {
                  <button type="button" class="star-btn" [class.star-btn--active]="selectedRating() >= star"
                    (click)="selectedRating.set(star)" [attr.aria-pressed]="selectedRating() >= star">
                    <lucide-icon name="star" [size]="28"></lucide-icon>
                  </button>
                }
              </div>
              <button class="btn btn--primary btn--full" [disabled]="selectedRating() === 0"
                (click)="submitRating()">Submit Rating</button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; }
    .card-title { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 16px; }
    .route-item { display: flex; align-items: flex-start; gap: 12px; }
    .route-line { width: 2px; height: 20px; background: var(--clr-border); margin: 4px 6px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .dot--pickup { background: var(--clr-primary); }
    .dot--drop   { background: var(--clr-success); }
    .route-label { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; }
    .info-row { display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-bottom: 1px solid var(--clr-border); &:last-child { border: none; } color: var(--clr-text-muted); }
    .rider-info { display: flex; align-items: flex-start; gap: 12px; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--clr-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; }
    .rider-name { font-weight: 600; }
    .rider-sub  { font-size: 13px; color: var(--clr-text-muted); }
    .rider-rating { display: inline-flex; align-items: center; gap: 6px; }
    .star-inline { color: var(--clr-warning); flex-shrink: 0; }
    .detail-grid .card { box-shadow: var(--shadow-card); }
    .stars { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
    .star-btn {
      padding: 4px; color: var(--clr-text-dim); cursor: pointer; transition: color var(--transition), transform 0.15s ease;
      border-radius: 8px;
      &:hover { color: var(--clr-warning); transform: scale(1.06); }
    }
    .star-btn--active { color: var(--clr-warning); }
    @media (max-width: 640px) {
      .detail-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class RideDetailComponent implements OnInit {
  private readonly route       = inject(ActivatedRoute);
  private readonly rideService = inject(RideService);
  private readonly toast       = inject(ToastService);

  protected readonly ride           = signal<Ride | null>(null);
  protected readonly loading        = signal(true);
  protected readonly cancelling     = signal(false);
  protected readonly rated          = signal(false);
  protected readonly selectedRating = signal(0);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    void this.rideService.getById(id).then(
      (r) => { this.ride.set(r); this.loading.set(false); },
    ).catch(() => this.loading.set(false));
  }

  protected cancel(): void {
    const id = this.ride()?.id;
    if (!id) return;
    this.cancelling.set(true);
    void this.rideService.cancel(id).then((r) => {
      this.ride.set(r);
      this.cancelling.set(false);
      this.toast.success('Ride cancelled');
    }).catch(() => {
      this.toast.error('Could not cancel');
      this.cancelling.set(false);
    });
  }

  protected submitRating(): void {
    const id = this.ride()?.id;
    if (!id || this.selectedRating() === 0) return;
    void this.rideService.rate(id, this.selectedRating()).then(
      () => { this.rated.set(true); this.toast.success('Thank you for your feedback!'); },
    ).catch(() => this.toast.error('Rating failed'));
  }

  protected badge(status: string): string {
    const map: Record<string,string> = { PENDING:'pending', COMPLETED:'active', CANCELLED:'closed' };
    return map[status] ?? 'info';
  }
}
