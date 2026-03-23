import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RideService }   from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { ToastService }  from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride, RideStatus } from '../../../core/models/ride.models';
import type { Parcel, ParcelStatus } from '../../../core/models/parcel.models';

/** Ride status transitions available to the rider. */
const RIDE_NEXT: Partial<Record<RideStatus, { status: RideStatus; label: string }>> = {
  ACCEPTED:           { status: 'EN_ROUTE_TO_PICKUP',  label: '🛵 Head to Pickup' },
  EN_ROUTE_TO_PICKUP: { status: 'ARRIVED_AT_PICKUP',   label: '📍 I\'ve Arrived'  },
  ARRIVED_AT_PICKUP:  { status: 'IN_PROGRESS',         label: '▶️ Start Ride'     },
  IN_PROGRESS:        { status: 'COMPLETED',           label: '✅ Complete Ride'   },
};

/** Parcel status transitions available to the rider. */
const PARCEL_NEXT: Partial<Record<ParcelStatus, { status: ParcelStatus; label: string }>> = {
  ACCEPTED:  { status: 'PICKED_UP',  label: '📦 Parcel Picked Up' },
  PICKED_UP: { status: 'IN_TRANSIT', label: '🚀 In Transit'       },
  IN_TRANSIT:{ status: 'DELIVERED',  label: '✅ Mark Delivered'    },
};

@Component({
  selector: 'app-rider-active',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>Active Trip</h1><p>Manage your current ride or delivery</p></div>
        <button class="btn btn--ghost btn--sm" (click)="refresh()" [disabled]="loading()">↻ Refresh</button>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (!activeRide() && !activeParcel()) {

        <!-- No active trip -->
        <div class="empty-state">
          <div class="empty-icon">🛵</div>
          <h3>No active trip</h3>
          <p>Go online from the dashboard to start receiving requests.</p>
          <a [routerLink]="['/rider']" class="btn btn--primary btn--sm" style="margin-top:16px">Go to Dashboard</a>
        </div>

      } @else {

        <!-- Active RIDE -->
        @if (activeRide(); as ride) {
          <div class="card trip-card">
            <div class="trip-header">
              <div>
                <span class="trip-type">🏍 Ride Request</span>
                <span class="badge badge--{{ rideBadge(ride.status) }} ml-8">{{ ride.status | titlecase }}</span>
              </div>
              <strong class="fare">KES {{ ride.estimatedFare | number:'1.0-0' }}</strong>
            </div>

            <div class="route-block">
              <div class="route-row">
                <div class="dot dot--pickup"></div>
                <div><p class="route-label">Pickup</p><p>{{ ride.pickupAddress }}</p></div>
              </div>
              <div class="route-line"></div>
              <div class="route-row">
                <div class="dot dot--drop"></div>
                <div><p class="route-label">Drop-off</p><p>{{ ride.dropoffAddress }}</p></div>
              </div>
            </div>

            <div class="passenger-row">
              <span class="label">Passenger:</span>
              <strong>{{ ride.user.fullName }}</strong>
              <span class="sep">·</span>
              <a [href]="'tel:' + ride.user.phone" class="phone-link">{{ ride.user.phone }}</a>
            </div>

            @if (rideNext(ride.status); as next) {
              <button
                class="btn btn--primary btn--full status-btn"
                (click)="advanceRide(ride.id, next.status)"
                [disabled]="updating()">
                @if (updating()) { Updating... } @else { {{ next.label }} }
              </button>
            }
          </div>
        }

        <!-- Active PARCEL -->
        @if (activeParcel(); as parcel) {
          <div class="card trip-card">
            <div class="trip-header">
              <div>
                <span class="trip-type">📦 Parcel Delivery</span>
                <span class="badge badge--{{ parcelBadge(parcel.status) }} ml-8">{{ parcel.status | titlecase }}</span>
              </div>
              <strong class="fare">KES {{ parcel.deliveryFee | number:'1.0-0' }}</strong>
            </div>

            <div class="route-block">
              <div class="route-row">
                <div class="dot dot--pickup"></div>
                <div><p class="route-label">Pickup</p><p>{{ parcel.pickupAddress }}</p></div>
              </div>
              <div class="route-line"></div>
              <div class="route-row">
                <div class="dot dot--drop"></div>
                <div><p class="route-label">Drop-off</p><p>{{ parcel.dropoffAddress }}</p></div>
              </div>
            </div>

            <div class="passenger-row">
              <span class="label">Item:</span>
              <strong>{{ parcel.itemDescription }}</strong>
              <span class="sep">·</span>
              <span>{{ parcel.weightKg }} kg</span>
            </div>

            <div class="passenger-row">
              <span class="label">Recipient:</span>
              <strong>{{ parcel.recipientName }}</strong>
              <span class="sep">·</span>
              <a [href]="'tel:' + parcel.recipientPhone" class="phone-link">{{ parcel.recipientPhone }}</a>
            </div>

            @if (parcel.status === 'IN_TRANSIT') {
              <!-- Proof of delivery upload for final step -->
              <div class="proof-section">
                <label class="proof-label">
                  <input type="file" accept="image/*" class="proof-input" (change)="onProofSelected($event, parcel.id)" />
                  📷 Upload Delivery Proof
                </label>
                @if (proofUploading()) {
                  <p class="proof-hint">Uploading...</p>
                } @else if (proofUploaded()) {
                  <p class="proof-hint proof-ok">✅ Proof uploaded — tap "Mark Delivered" above</p>
                }
              </div>
            }

            @if (parcelNext(parcel.status); as next) {
              <button
                class="btn btn--primary btn--full status-btn"
                (click)="advanceParcel(parcel.id, next.status, parcel.status)"
                [disabled]="updating() || (next.status === 'DELIVERED' && !proofUploaded())">
                @if (updating()) { Updating... } @else { {{ next.label }} }
              </button>
              @if (next.status === 'DELIVERED' && !proofUploaded()) {
                <p class="hint">Upload delivery proof first</p>
              }
            }
          </div>
        }

      }
    </div>
  `,
  styles: [`
    .trip-card { display: flex; flex-direction: column; gap: 16px; max-width: 560px; }
    .trip-header { display: flex; justify-content: space-between; align-items: center; }
    .trip-type  { font-weight: 600; font-size: 15px; }
    .fare       { font-size: 20px; color: var(--clr-primary); }
    .ml-8       { margin-left: 8px; }
    .route-block { background: var(--clr-bg-elevated); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
    .route-row  { display: flex; align-items: flex-start; gap: 10px; }
    .route-line { width: 2px; height: 16px; background: var(--clr-border); margin: 2px 4px; }
    .route-label { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; margin-bottom: 2px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
    .dot--pickup { background: var(--clr-primary); }
    .dot--drop   { background: var(--clr-success); }
    .passenger-row { display: flex; align-items: center; gap: 6px; font-size: 14px; flex-wrap: wrap; }
    .label { color: var(--clr-text-muted); }
    .sep   { color: var(--clr-border); }
    .phone-link { color: var(--clr-primary); text-decoration: none; }
    .status-btn { margin-top: 4px; font-size: 16px; padding: 14px; }
    .hint { font-size: 12px; color: var(--clr-text-muted); text-align: center; }
    .proof-section { display: flex; flex-direction: column; gap: 6px; }
    .proof-label { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 14px; border: 2px dashed var(--clr-border); border-radius: var(--radius-md); font-size: 14px; color: var(--clr-text-muted); transition: border-color var(--transition); &:hover { border-color: var(--clr-primary); color: var(--clr-primary); } }
    .proof-input { display: none; }
    .proof-hint  { font-size: 13px; color: var(--clr-text-muted); }
    .proof-ok    { color: var(--clr-success); }
  `],
})
export class RiderActiveComponent implements OnInit, OnDestroy {
  private readonly rideService   = inject(RideService);
  private readonly parcelService = inject(ParcelService);
  private readonly toast         = inject(ToastService);

  protected readonly activeRide   = signal<Ride | null>(null);
  protected readonly activeParcel = signal<Parcel | null>(null);
  protected readonly loading      = signal(true);
  protected readonly updating     = signal(false);
  protected readonly proofUploading = signal(false);
  protected readonly proofUploaded  = signal(false);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    await this.refresh();
    // Poll every 30s for new assignments
    this.pollTimer = setInterval(() => void this.refresh(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [ride, parcel] = await Promise.all([
        this.rideService.getActive(),
        this.parcelService.getActive(),
      ]);
      this.activeRide.set(ride);
      this.activeParcel.set(parcel);
      // Reset proof state when parcel changes
      if (!parcel || parcel.status !== 'IN_TRANSIT') {
        this.proofUploaded.set(false);
      }
    } catch {
      this.toast.error('Could not load active trip');
    } finally {
      this.loading.set(false);
    }
  }

  async advanceRide(rideId: string, newStatus: RideStatus): Promise<void> {
    this.updating.set(true);
    try {
      const updated = await this.rideService.updateStatus(rideId, newStatus);
      this.activeRide.set(updated.status === 'COMPLETED' ? null : updated);
      if (updated.status === 'COMPLETED') {
        this.toast.success('Ride completed! Payment will be processed shortly.');
      }
    } catch {
      this.toast.error('Status update failed');
    } finally {
      this.updating.set(false);
    }
  }

  async advanceParcel(parcelId: string, newStatus: ParcelStatus, currentStatus: ParcelStatus): Promise<void> {
    if (newStatus === 'DELIVERED' && !this.proofUploaded()) {
      this.toast.error('Please upload delivery proof first');
      return;
    }
    this.updating.set(true);
    try {
      const updated = await this.parcelService.updateStatus(parcelId, newStatus);
      this.activeParcel.set(updated.status === 'DELIVERED' ? null : updated);
      if (updated.status === 'DELIVERED') {
        this.toast.success('Delivery completed! Payout will be sent to your M-Pesa.');
      }
    } catch {
      this.toast.error('Status update failed');
    } finally {
      this.updating.set(false);
    }
  }

  async onProofSelected(event: Event, parcelId: string): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Validate file type and size (max 5MB)
    if (!file.type.startsWith('image/')) {
      this.toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('Image must be smaller than 5MB');
      return;
    }

    this.proofUploading.set(true);
    try {
      // Convert to base64 data URL as a simple upload mechanism
      const dataUrl = await this.fileToDataUrl(file);
      await this.parcelService.uploadProof(parcelId, dataUrl);
      this.proofUploaded.set(true);
      this.toast.success('Proof uploaded — tap "Mark Delivered" to complete');
    } catch {
      this.toast.error('Proof upload failed');
    } finally {
      this.proofUploading.set(false);
    }
  }

  protected rideNext(status: RideStatus) {
    return RIDE_NEXT[status] ?? null;
  }

  protected parcelNext(status: ParcelStatus) {
    return PARCEL_NEXT[status] ?? null;
  }

  protected rideBadge(status: RideStatus): string {
    const m: Record<string, string> = { IN_PROGRESS: 'active', COMPLETED: 'active', CANCELLED: 'closed' };
    return m[status] ?? 'pending';
  }

  protected parcelBadge(status: ParcelStatus): string {
    const m: Record<string, string> = { DELIVERED: 'active', CANCELLED: 'closed', IN_TRANSIT: 'info' };
    return m[status] ?? 'pending';
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }
}
