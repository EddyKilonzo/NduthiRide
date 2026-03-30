import { Component, inject, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { RideService }     from '../../../core/services/ride.service';
import { PaymentService }  from '../../../core/services/payment.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { ToastService }    from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { RoutePickerMapComponent, RouteMapPoint } from '../../../shared/components/route-picker-map/route-picker-map.component';
import type { Ride, RidePayment } from '../../../core/models/ride.models';

const ACTIVE_STATUSES: Ride['status'][] = [
  'ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PICKUP', 'IN_PROGRESS',
];

@Component({
  selector: 'app-ride-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule, RoutePickerMapComponent],
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
          <!-- Map card (Full width) — shows live rider dot when active -->
          <div class="card map-card grid-full">
            <div class="card-header-with-action">
              <h3 class="card-title">Route Map</h3>
              @if (isActive() && riderOnline()) {
                <span class="live-badge">
                  <span class="live-dot"></span> Live
                </span>
              }
            </div>
            <div class="map-container">
              <app-route-picker-map
                [pickup]="pickupPoint()"
                [dropoff]="dropoffPoint()"
                [riderPosition]="riderPosition()"
              />
            </div>
          </div>

          <!-- Route info card -->
          <div class="card">
            <h3 class="card-title">Addresses</h3>
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
            <h3 class="card-title">Fare & Distance</h3>
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
              <div class="card-header-with-action">
                <h3 class="card-title">Your Rider</h3>
                <a [routerLink]="['/user/chat/ride', ride()!.id]" class="btn btn--secondary btn--sm">
                  <lucide-icon name="message-square" [size]="14"></lucide-icon> Chat
                </a>
              </div>
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

          <!-- Payment card -->
          @if (ride()!.paymentMethod === 'MPESA') {
            <div class="card payment-card">
              <h3 class="card-title">Payment</h3>
              @if (payment(); as p) {
                <div class="payment-status payment-status--{{ p.status.toLowerCase() }}">
                  <lucide-icon [name]="paymentIcon(p.status)" [size]="20"></lucide-icon>
                  <div>
                    <p class="payment-status-label">{{ paymentLabel(p.status) }}</p>
                    @if (p.mpesaReceiptNumber) {
                      <p class="payment-receipt">Receipt: {{ p.mpesaReceiptNumber }}</p>
                    }
                    @if (p.status === 'PROCESSING') {
                      <p class="payment-hint">Check your phone for the M-Pesa prompt.</p>
                    }
                  </div>
                </div>
              } @else if (canPay()) {
                <p class="payment-hint">Pay via M-Pesa STK push to {{ ride()!.mpesaPhone }}.</p>
                <button class="btn btn--primary btn--full" (click)="initiatePayment()" [disabled]="payingNow()">
                  @if (payingNow()) { <app-spinner [size]="16" /> Sending prompt... }
                  @else { Pay KES {{ ride()!.estimatedFare | number:'1.0-0' }} via M-Pesa }
                </button>
              }
            </div>
          }

          <!-- Actions -->
          @if (['PENDING','ACCEPTED','EN_ROUTE_TO_PICKUP','ARRIVED_AT_PICKUP'].includes(ride()!.status)) {
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

          <!-- Support action -->
          <div class="card support-box">
            <h3 class="card-title">Need Help?</h3>
            <p class="support-text">Having trouble with this ride? Our support team is here to help.</p>
            <a [routerLink]="['/user/support']" [queryParams]="{ subject: 'Issue with Ride ' + ride()!.id.slice(0,8) }" class="btn btn--secondary btn--full">
              <lucide-icon name="help-circle" [size]="18"></lucide-icon> Report an Issue
            </a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 20px; }
    .grid-full { grid-column: 1 / -1; }
    .card-title { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 16px; }
    .card-header-with-action { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-header-with-action .card-title { margin-bottom: 0; }
    .route-item { display: flex; align-items: flex-start; gap: 12px; }
    .route-line { width: 2px; height: 20px; background: var(--clr-border); margin: 4px 6px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .dot--pickup { background: #F59E0B; }
    .dot--drop   { background: #22C55E; }
    .route-label { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; }
    .info-row { display: flex; justify-content: space-between; font-size: 14px; padding: 10px 0; border-bottom: 1px solid var(--clr-border-subtle); color: var(--clr-text-muted); }
    .info-row:last-child { border: none; }
    .rider-info { display: flex; align-items: flex-start; gap: 12px; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--clr-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; color: #fff; }
    .rider-name { font-weight: 600; }
    .rider-sub  { font-size: 13px; color: var(--clr-text-muted); }
    .rider-rating { display: inline-flex; align-items: center; gap: 6px; }
    .star-inline { color: var(--clr-warning); flex-shrink: 0; }
    .detail-grid .card { 
      box-shadow: rgba(50, 50, 93, 0.25) 0px 50px 100px -20px, rgba(0, 0, 0, 0.3) 0px 30px 60px -30px, rgba(10, 37, 64, 0.35) 0px -2px 6px 0px inset;
      border: 1px solid var(--clr-border);
      padding: 20px;
    }
    .map-card { padding: 0 !important; overflow: hidden; height: 320px; }
    .map-container { height: 100%; width: 100%; }
    .stars { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
    .star-btn {
      padding: 4px; color: var(--clr-text-dim); cursor: pointer; transition: color var(--transition), transform 0.15s ease;
      border-radius: 8px;
    }
    .star-btn:hover { color: var(--clr-warning); transform: scale(1.06); }
    .star-btn--active { color: var(--clr-warning); }
    .support-box { background: rgba(var(--clr-primary-rgb), 0.03); border-style: dashed; }
    .support-text { font-size: 13px; color: var(--clr-text-muted); margin-bottom: 16px; }

    /* Live badge */
    .live-badge {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; color: var(--clr-success);
      background: rgba(34,197,94,0.12); padding: 4px 10px; border-radius: 20px;
    }
    .live-dot {
      width: 8px; height: 8px; background: var(--clr-success); border-radius: 50%;
      animation: pulse-dot 1.4s infinite;
    }
    @keyframes pulse-dot {
      0%,100% { opacity: 1; } 50% { opacity: 0.3; }
    }

    /* Payment card */
    .payment-hint { font-size: 13px; color: var(--clr-text-muted); margin-bottom: 14px; }
    .payment-status {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px; border-radius: var(--radius-md); margin-bottom: 4px;
      border: 1px solid var(--clr-border);
    }
    .payment-status--completed { background: rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.25); color: var(--clr-success); }
    .payment-status--failed    { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.25);  color: var(--clr-error); }
    .payment-status--processing,.payment-status--pending {
      background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.25); color: var(--clr-warning);
    }
    .payment-status-label { font-weight: 700; font-size: 14px; }
    .payment-receipt { font-size: 12px; margin-top: 4px; opacity: 0.85; }

    @media (max-width: 640px) {
      .detail-grid { grid-template-columns: 1fr; }
      .map-card { height: 240px; }
    }
  `],
})
export class RideDetailComponent implements OnInit, OnDestroy {
  private readonly route           = inject(ActivatedRoute);
  private readonly rideService     = inject(RideService);
  private readonly paymentService  = inject(PaymentService);
  private readonly trackingService = inject(TrackingService);
  private readonly toast           = inject(ToastService);

  protected readonly ride           = signal<Ride | null>(null);
  protected readonly loading        = signal(true);
  protected readonly cancelling     = signal(false);
  protected readonly rated          = signal(false);
  protected readonly selectedRating = signal(0);

  // Payment
  protected readonly payment    = signal<RidePayment | null>(null);
  protected readonly payingNow  = signal(false);

  // Live tracking
  protected readonly riderPosition = signal<RouteMapPoint | null>(null);
  protected readonly riderOnline   = signal(false);

  private subscribedPaymentId: string | null = null;
  private paymentUpdateCb: ((d: unknown) => void) | null = null;
  private locationCb: (() => void) | null = null;

  protected readonly pickupPoint = computed<RouteMapPoint | null>(() => {
    const r = this.ride();
    return r ? { lat: r.pickupLat, lng: r.pickupLng } : null;
  });

  protected readonly dropoffPoint = computed<RouteMapPoint | null>(() => {
    const r = this.ride();
    return r ? { lat: r.dropoffLat, lng: r.dropoffLng } : null;
  });

  protected readonly isActive = computed(() =>
    ACTIVE_STATUSES.includes(this.ride()?.status as Ride['status']),
  );

  protected readonly canPay = computed(() => {
    const r = this.ride();
    return r?.paymentMethod === 'MPESA' && !this.payment()
      && ACTIVE_STATUSES.includes(r.status as Ride['status']);
  });

  constructor() {
    // Mirror TrackingService riderLocation signal → local riderPosition
    effect(() => {
      const loc = this.trackingService.riderLocation();
      if (loc) {
        this.riderPosition.set({ lat: loc.lat, lng: loc.lng });
        this.riderOnline.set(true);
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    void this.rideService.getById(id).then((r) => {
      this.ride.set(r);
      if (r.payment) this.payment.set(r.payment as RidePayment);
      this.loading.set(false);

      // Start live tracking for active rides
      if (ACTIVE_STATUSES.includes(r.status as Ride['status'])) {
        this.trackingService.connect();
        this.trackingService.watchRiderLocation();
      }

      // Subscribe to existing payment WebSocket room
      if (r.payment?.checkoutRequestId && r.payment.status === 'PROCESSING') {
        this.subscribePaymentSocket(r.payment.id);
      }
    }).catch(() => this.loading.set(false));
  }

  ngOnDestroy(): void {
    if (this.subscribedPaymentId) {
      this.trackingService.unsubscribeFromPayment(this.subscribedPaymentId);
    }
    if (this.paymentUpdateCb) {
      this.trackingService.offPaymentUpdate(this.paymentUpdateCb as (d: unknown) => void);
    }
    // Disconnect tracking if we connected it
    if (this.isActive()) {
      this.trackingService.disconnect();
    }
  }

  protected async initiatePayment(): Promise<void> {
    const r = this.ride();
    if (!r || !r.mpesaPhone) return;
    this.payingNow.set(true);
    try {
      const result = await this.paymentService.initiateForRide(r.id, r.mpesaPhone, 'MPESA');
      this.payment.set({
        id: result.paymentId,
        status: 'PROCESSING',
        amount: r.estimatedFare,
        mpesaReceiptNumber: null,
        completedAt: null,
        checkoutRequestId: result.checkoutRequestId ?? null,
      });
      this.toast.info('Check your phone for the M-Pesa prompt.');
      this.trackingService.connect();
      this.subscribePaymentSocket(result.paymentId);
    } catch {
      this.toast.error('Could not initiate payment. Try again.');
    } finally {
      this.payingNow.set(false);
    }
  }

  private subscribePaymentSocket(paymentId: string): void {
    this.subscribedPaymentId = paymentId;
    this.trackingService.subscribeToPayment(paymentId);

    this.paymentUpdateCb = (data: unknown) => {
      const d = data as { status: string; mpesaReceiptNumber?: string | null; completedAt?: string };
      this.payment.update((p) => p
        ? { ...p, status: d.status as RidePayment['status'], mpesaReceiptNumber: d.mpesaReceiptNumber ?? p.mpesaReceiptNumber, completedAt: d.completedAt ?? p.completedAt }
        : p,
      );
      if (d.status === 'COMPLETED') this.toast.success('Payment confirmed!');
      if (d.status === 'FAILED') this.toast.error('Payment failed. Please try again.');
    };
    this.trackingService.onPaymentUpdate(this.paymentUpdateCb as (d: { status: string; amount?: number; mpesaReceiptNumber?: string | null; completedAt?: string }) => void);
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
    const map: Record<string, string> = { PENDING: 'pending', COMPLETED: 'active', CANCELLED: 'closed' };
    return map[status] ?? 'info';
  }

  protected paymentIcon(status: string): string {
    const icons: Record<string, string> = { COMPLETED: 'check-circle', FAILED: 'x-circle', PROCESSING: 'loader', PENDING: 'clock' };
    return icons[status] ?? 'credit-card';
  }

  protected paymentLabel(status: string): string {
    const labels: Record<string, string> = { COMPLETED: 'Payment confirmed', FAILED: 'Payment failed', PROCESSING: 'Awaiting M-Pesa confirmation', PENDING: 'Payment pending' };
    return labels[status] ?? status;
  }
}
