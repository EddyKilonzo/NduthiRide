import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ParcelService } from '../../../core/services/parcel.service';
import { ToastService }  from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Parcel } from '../../../core/models/parcel.models';

@Component({
  selector: 'app-parcel-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="page app-page">
      @if (loading()) {
        <app-spinner [overlay]="true" />
      } @else if (!parcel()) {
        <div class="empty-state"><h3>Parcel not found</h3></div>
      } @else {
        <div class="page-header">
          <div>
            <h1>Parcel Details</h1>
            <span class="badge badge--{{ badge(parcel()!.status) }}">{{ parcel()!.status }}</span>
          </div>
          <a [routerLink]="['/user/parcels']" class="btn btn--ghost btn--sm"><lucide-icon name="arrow-left" [size]="16"></lucide-icon> Back</a>
        </div>

        <div class="detail-grid">
          <!-- Route card -->
          <div class="card">
            <h3 class="card-title">Route</h3>
            <div class="route-item">
              <div class="dot dot--pickup"></div>
              <div>
                <p class="route-label">Pickup</p>
                <p>{{ parcel()!.pickupAddress }}</p>
              </div>
            </div>
            <div class="route-line"></div>
            <div class="route-item">
              <div class="dot dot--drop"></div>
              <div>
                <p class="route-label">Drop-off</p>
                <p>{{ parcel()!.dropoffAddress }}</p>
              </div>
            </div>
          </div>

          <!-- Item card -->
          <div class="card">
            <h3 class="card-title">Item Details</h3>
            <div class="info-row"><span>Description</span><strong>{{ parcel()!.itemDescription }}</strong></div>
            <div class="info-row"><span>Weight</span><strong>{{ parcel()!.weightKg }} kg</strong></div>
            <div class="info-row"><span>Distance</span><strong>{{ parcel()!.distanceKm | number:'1.1-1' }} km</strong></div>
            <div class="info-row"><span>Delivery Fee</span><strong class="text-primary">KES {{ parcel()!.deliveryFee | number:'1.0-0' }}</strong></div>
            <div class="info-row"><span>Payment</span><strong>{{ parcel()!.paymentMethod }}</strong></div>
          </div>

          <!-- Recipient card -->
          <div class="card">
            <h3 class="card-title">Recipient</h3>
            <div class="info-row"><span>Name</span><strong>{{ parcel()!.recipientName }}</strong></div>
            <div class="info-row"><span>Phone</span><strong>{{ parcel()!.recipientPhone }}</strong></div>
            @if (parcel()!.deliveredAt) {
              <div class="info-row"><span>Delivered</span><strong>{{ parcel()!.deliveredAt | date:'dd MMM yyyy, HH:mm' }}</strong></div>
            }
          </div>

          <!-- Rider card -->
          @if (parcel()!.rider) {
            <div class="card">
              <h3 class="card-title">Your Rider</h3>
              <div class="rider-info">
                <div class="avatar">{{ parcel()!.rider!.account.fullName.charAt(0) }}</div>
                <div>
                  <p class="rider-name">{{ parcel()!.rider!.account.fullName }}</p>
                  <p class="rider-sub">{{ parcel()!.rider!.account.phone }}</p>
                  <p class="rider-sub rider-rating">
                    <lucide-icon name="star" [size]="14" class="star-inline"></lucide-icon>
                    {{ parcel()!.rider!.ratingAverage | number:'1.1-1' }}
                  </p>
                  <p class="rider-sub">{{ parcel()!.rider!.bikeModel }} — {{ parcel()!.rider!.bikeRegistration }}</p>
                </div>
              </div>
            </div>
          }

          <!-- Proof of delivery -->
          @if (parcel()!.proofImageUrl) {
            <div class="card">
              <h3 class="card-title">Proof of Delivery</h3>
              <img [src]="parcel()!.proofImageUrl!" alt="Delivery proof" class="proof-img" />
            </div>
          }

          <!-- Cancel action -->
          @if (['PENDING', 'ACCEPTED'].includes(parcel()!.status)) {
            <div class="card actions-card">
              <h3 class="card-title">Actions</h3>
              <button class="btn btn--danger btn--full" (click)="cancel()" [disabled]="cancelling()">
                @if (cancelling()) { Cancelling... } @else { Cancel Delivery }
              </button>
            </div>
          }

          <!-- Rate (delivered, not yet rated) -->
          @if (parcel()!.status === 'DELIVERED' && !rated()) {
            <div class="card">
              <h3 class="card-title">Rate Your Delivery</h3>
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
    .proof-img  { width: 100%; border-radius: var(--radius-md); max-height: 300px; object-fit: cover; }
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
export class ParcelDetailComponent implements OnInit {
  private readonly route         = inject(ActivatedRoute);
  private readonly parcelService = inject(ParcelService);
  private readonly toast         = inject(ToastService);

  protected readonly parcel         = signal<Parcel | null>(null);
  protected readonly loading        = signal(true);
  protected readonly cancelling     = signal(false);
  protected readonly rated          = signal(false);
  protected readonly selectedRating = signal(0);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const p = await this.parcelService.getById(id);
      this.parcel.set(p);
    } catch {
      this.toast.error('Could not load parcel');
    } finally {
      this.loading.set(false);
    }
  }

  protected async cancel(): Promise<void> {
    const id = this.parcel()?.id;
    if (!id) return;
    this.cancelling.set(true);
    try {
      const updated = await this.parcelService.updateStatus(id, 'CANCELLED');
      this.parcel.set(updated);
      this.toast.success('Delivery cancelled');
    } catch {
      this.toast.error('Could not cancel delivery');
    } finally {
      this.cancelling.set(false);
    }
  }

  protected async submitRating(): Promise<void> {
    const id = this.parcel()?.id;
    if (!id || this.selectedRating() === 0) return;
    try {
      await this.parcelService.rate(id, this.selectedRating());
      this.rated.set(true);
      this.toast.success('Thank you for your feedback!');
    } catch {
      this.toast.error('Rating failed');
    }
  }

  protected badge(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'pending', DELIVERED: 'active', CANCELLED: 'closed', IN_TRANSIT: 'info',
    };
    return map[status] ?? 'info';
  }
}
