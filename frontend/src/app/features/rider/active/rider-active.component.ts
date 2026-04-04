import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { RideService }     from '../../../core/services/ride.service';
import { ParcelService }   from '../../../core/services/parcel.service';
import { MediaService }    from '../../../core/services/media.service';
import { ToastService }    from '../../../core/services/toast.service';
import { TrackingService, type TripPaymentPayload } from '../../../core/services/tracking.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride, RideStatus } from '../../../core/models/ride.models';
import type { Parcel, ParcelStatus } from '../../../core/models/parcel.models';

const RIDE_NEXT: Partial<Record<RideStatus, { status: RideStatus; label: string; icon: string }>> = {
  ACCEPTED:           { status: 'EN_ROUTE_TO_PICKUP',  label: 'Head to Pickup', icon: 'navigation' },
  EN_ROUTE_TO_PICKUP: { status: 'ARRIVED_AT_PICKUP',   label: 'I\'ve Arrived',  icon: 'map-pin' },
  ARRIVED_AT_PICKUP:  { status: 'IN_PROGRESS',         label: 'Start Ride',     icon: 'play' },
  IN_PROGRESS:        { status: 'COMPLETED',           label: 'Complete Ride',   icon: 'check-circle' },
};

const PARCEL_NEXT: Partial<Record<ParcelStatus, { status: ParcelStatus; label: string; icon: string }>> = {
  ACCEPTED:  { status: 'PICKED_UP',  label: 'Mark as Picked Up', icon: 'package-check' },
  PICKED_UP: { status: 'IN_TRANSIT', label: 'Start Delivery',    icon: 'truck' },
  IN_TRANSIT:{ status: 'DELIVERED',  label: 'Mark Delivered',    icon: 'check-circle' },
};

@Component({
  selector: 'app-rider-active',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="active-trip-page app-page">
      <div class="page-header">
        <div class="header-text">
          <h1>Active Trip</h1>
          <p>Real-time management for your current assignment</p>
        </div>
        <div class="header-actions">
          <button class="btn btn--secondary btn--sm btn--pill" (click)="refresh()" [disabled]="loading()">
            <lucide-icon name="rotate-cw" [size]="14" [class.spinning]="loading()"></lucide-icon> Refresh
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loader-wrap"><app-spinner /></div>
      } @else if (!activeRide() && !activeParcel()) {
        <div class="card empty-state-card modern-shadow">
          <div class="empty-icon-wrap">
            <lucide-icon name="bike" [size]="48"></lucide-icon>
          </div>
          <h3>No active trip at the moment</h3>
          <p>Your current tasks will appear here. Head to the dashboard and go online to receive new requests.</p>
          <a [routerLink]="['/rider']" class="btn btn--primary btn--pill mt-24">Go to Dashboard</a>
        </div>
      } @else {
        <div class="trip-grid">
          <!-- Main Trip Card -->
          <div class="trip-main-content">
            @if (activeRide(); as ride) {
              <div class="card trip-card modern-shadow">
                <div class="card-header">
                  <div class="trip-badge ride">
                    <lucide-icon name="bike" [size]="14"></lucide-icon> Ride Request
                  </div>
                  <div class="header-actions">
                    <a [routerLink]="['/rider/chat/ride', ride.id]" class="btn btn--secondary btn--sm btn--pill">
                      <lucide-icon name="message-square" [size]="14"></lucide-icon> Chat
                    </a>
                    <div class="status-pill" [class]="ride.status.toLowerCase()">{{ ride.status | titlecase }}</div>
                  </div>
                </div>

                <div class="trip-body">
                  <div class="fare-section">
                    <span class="label">Estimated Fare</span>
                    <h2 class="fare-value">KES {{ ride.estimatedFare | number:'1.0-0' }}</h2>
                  </div>

                  <div class="route-display">
                    <div class="route-stop">
                      <div class="stop-marker start"></div>
                      <div class="stop-content">
                        <label>Pickup Location</label>
                        <p>{{ ride.pickupAddress }}</p>
                      </div>
                    </div>
                    <div class="route-connector"></div>
                    <div class="route-stop">
                      <div class="stop-marker end"></div>
                      <div class="stop-content">
                        <label>Drop-off Location</label>
                        <p>{{ ride.dropoffAddress }}</p>
                      </div>
                    </div>
                  </div>

                  <div class="details-section">
                    <div class="detail-item">
                      <div class="item-icon"><lucide-icon name="user" [size]="18"></lucide-icon></div>
                      <div class="item-text">
                        <label>Passenger</label>
                        <p>{{ ride.user.fullName }}</p>
                      </div>
                    </div>
                    <div class="detail-item">
                      <div class="item-icon"><lucide-icon name="phone" [size]="18"></lucide-icon></div>
                      <div class="item-text">
                        <label>Contact</label>
                        <a [href]="'tel:' + ride.user.phone" class="contact-link">{{ ride.user.phone }}</a>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="card-footer">
                  @if (rideNext(ride.status); as next) {
                    <button
                      class="btn btn--primary btn--full btn--lg btn--pill action-btn"
                      (click)="advanceRide(ride.id, next.status)"
                      [disabled]="updating() || (next.status === 'COMPLETED' && ridePaymentPending(ride))">
                      <lucide-icon [name]="next.icon" [size]="20" *ngIf="!updating()"></lucide-icon>
                      <app-spinner *ngIf="updating()"></app-spinner>
                      <span>{{ updating() ? 'Processing...' : next.label }}</span>
                    </button>
                    @if (next.status === 'COMPLETED' && ridePaymentPending(ride)) {
                      <p class="error-hint">
                        <lucide-icon name="alert-circle" [size]="14"></lucide-icon>
                        Waiting for M-Pesa payment confirmation before completing the ride.
                      </p>
                    }
                  } @else {
                    <div class="completion-message">
                      <lucide-icon name="check-circle" [size]="24"></lucide-icon>
                      <span>Trip Completed</span>
                    </div>
                  }
                </div>
              </div>
            }

            @if (activeParcel(); as parcel) {
              <div class="card trip-card modern-shadow">
                <div class="card-header">
                  <div class="trip-badge parcel">
                    <lucide-icon name="package" [size]="14"></lucide-icon> Parcel Delivery
                  </div>
                  <div class="header-actions">
                    <a [routerLink]="['/rider/chat/parcel', parcel.id]" class="btn btn--secondary btn--sm btn--pill">
                      <lucide-icon name="message-square" [size]="14"></lucide-icon> Chat
                    </a>
                    <div class="status-pill" [class]="parcel.status.toLowerCase()">{{ parcel.status | titlecase }}</div>
                  </div>
                </div>

                <div class="trip-body">
                  <div class="fare-section">
                    <span class="label">Delivery Fee</span>
                    <h2 class="fare-value">KES {{ parcel.deliveryFee | number:'1.0-0' }}</h2>
                  </div>

                  <div class="route-display">
                    <div class="route-stop">
                      <div class="stop-marker start"></div>
                      <div class="stop-content">
                        <label>Pickup Location</label>
                        <p>{{ parcel.pickupAddress }}</p>
                      </div>
                    </div>
                    <div class="route-connector"></div>
                    <div class="route-stop">
                      <div class="stop-marker end"></div>
                      <div class="stop-content">
                        <label>Drop-off Location</label>
                        <p>{{ parcel.dropoffAddress }}</p>
                      </div>
                    </div>
                  </div>

                  <div class="details-grid">
                    <div class="detail-item">
                      <div class="item-icon"><lucide-icon name="box" [size]="18"></lucide-icon></div>
                      <div class="item-text">
                        <label>Item Details</label>
                        <p>{{ parcel.itemDescription }} ({{ parcel.weightKg }}kg)</p>
                      </div>
                    </div>
                    <div class="detail-item">
                      <div class="item-icon"><lucide-icon name="user" [size]="18"></lucide-icon></div>
                      <div class="item-text">
                        <label>Recipient</label>
                        <p>{{ parcel.recipientName }}</p>
                      </div>
                    </div>
                    <div class="detail-item">
                      <div class="item-icon"><lucide-icon name="phone" [size]="18"></lucide-icon></div>
                      <div class="item-text">
                        <label>Contact</label>
                        <a [href]="'tel:' + parcel.recipientPhone" class="contact-link">{{ parcel.recipientPhone }}</a>
                      </div>
                    </div>
                  </div>

                  @if (parcel.status === 'IN_TRANSIT') {
                    <div class="proof-upload-section mt-24">
                      <label class="upload-box" [class.uploaded]="proofUploaded()">
                        <input type="file" accept="image/*" class="hidden" (change)="onProofSelected($event, parcel.id)" />
                        <lucide-icon [name]="proofUploaded() ? 'check-circle' : 'camera'" [size]="24"></lucide-icon>
                        <span *ngIf="!proofUploading() && !proofUploaded()">Upload Proof of Delivery</span>
                        <span *ngIf="proofUploading()">Uploading...</span>
                        <span *ngIf="proofUploaded()" class="text-success">Proof Uploaded Successfully</span>
                      </label>
                    </div>
                  }
                </div>

                <div class="card-footer">
                  @if (parcelNext(parcel.status); as next) {
                    <button
                      class="btn btn--primary btn--full btn--lg btn--pill action-btn"
                      (click)="advanceParcel(parcel.id, next.status, parcel.status)"
                      [disabled]="updating() || (next.status === 'DELIVERED' && (!proofUploaded() || parcelPaymentPending(parcel)))">
                      <lucide-icon [name]="next.icon" [size]="20" *ngIf="!updating()"></lucide-icon>
                      <app-spinner *ngIf="updating()"></app-spinner>
                      <span>{{ updating() ? 'Processing...' : next.label }}</span>
                    </button>
                    <p class="error-hint" *ngIf="next.status === 'DELIVERED' && !proofUploaded()">
                      * Please upload proof of delivery to complete
                    </p>
                    @if (next.status === 'DELIVERED' && parcelPaymentPending(parcel)) {
                      <p class="error-hint">
                        <lucide-icon name="alert-circle" [size]="14"></lucide-icon>
                        Waiting for M-Pesa payment confirmation before marking delivered.
                      </p>
                    }
                  }
                </div>
              </div>
            }
          </div>

          <!-- Side Information / Stepper -->
          <div class="trip-sidebar">
            <div class="card stepper-card modern-shadow">
              <h3>Trip Progress</h3>
              <div class="stepper">
                @if (activeRide(); as ride) {
                  <div class="step" [class.active]="ride.status === 'ACCEPTED'" [class.completed]="['EN_ROUTE_TO_PICKUP','ARRIVED_AT_PICKUP','IN_PROGRESS','COMPLETED'].includes(ride.status)">
                    <div class="step-line"></div>
                    <div class="step-circle">
                      @if (['EN_ROUTE_TO_PICKUP','ARRIVED_AT_PICKUP','IN_PROGRESS','COMPLETED'].includes(ride.status)) {
                        <lucide-icon name="check" [size]="12"></lucide-icon>
                      } @else if (ride.status === 'ACCEPTED') {
                        <span class="step-active-dot"></span>
                      }
                    </div>
                    <span class="step-label">Accepted</span>
                  </div>
                  <div class="step" [class.active]="ride.status === 'EN_ROUTE_TO_PICKUP'" [class.completed]="['ARRIVED_AT_PICKUP','IN_PROGRESS','COMPLETED'].includes(ride.status)">
                    <div class="step-line"></div>
                    <div class="step-circle">
                      @if (['ARRIVED_AT_PICKUP','IN_PROGRESS','COMPLETED'].includes(ride.status)) {
                        <lucide-icon name="check" [size]="12"></lucide-icon>
                      } @else if (ride.status === 'EN_ROUTE_TO_PICKUP') {
                        <span class="step-active-dot"></span>
                      }
                    </div>
                    <span class="step-label">En-route</span>
                  </div>
                  <div class="step" [class.active]="ride.status === 'ARRIVED_AT_PICKUP'" [class.completed]="['IN_PROGRESS','COMPLETED'].includes(ride.status)">
                    <div class="step-line"></div>
                    <div class="step-circle">
                      @if (['IN_PROGRESS','COMPLETED'].includes(ride.status)) {
                        <lucide-icon name="check" [size]="12"></lucide-icon>
                      } @else if (ride.status === 'ARRIVED_AT_PICKUP') {
                        <span class="step-active-dot"></span>
                      }
                    </div>
                    <span class="step-label">At Pickup</span>
                  </div>
                  <div class="step" [class.active]="ride.status === 'IN_PROGRESS'" [class.completed]="ride.status === 'COMPLETED'">
                    <div class="step-line"></div>
                    <div class="step-circle">
                      @if (ride.status === 'COMPLETED') {
                        <lucide-icon name="check" [size]="12"></lucide-icon>
                      } @else if (ride.status === 'IN_PROGRESS') {
                        <span class="step-active-dot"></span>
                      }
                    </div>
                    <span class="step-label">In Transit</span>
                  </div>
                }
                @if (activeParcel(); as parcel) {
                  <div class="step" [class.active]="parcel.status === 'ACCEPTED'" [class.completed]="['PICKED_UP','IN_TRANSIT','DELIVERED'].includes(parcel.status)">
                    <div class="step-line"></div>
                    <div class="step-circle">
                      @if (['PICKED_UP','IN_TRANSIT','DELIVERED'].includes(parcel.status)) {
                        <lucide-icon name="check" [size]="12"></lucide-icon>
                      } @else if (parcel.status === 'ACCEPTED') {
                        <span class="step-active-dot"></span>
                      }
                    </div>
                    <span class="step-label">Accepted</span>
                  </div>
                  <div class="step" [class.active]="parcel.status === 'PICKED_UP'" [class.completed]="['IN_TRANSIT','DELIVERED'].includes(parcel.status)">
                    <div class="step-line"></div>
                    <div class="step-circle">
                      @if (['IN_TRANSIT','DELIVERED'].includes(parcel.status)) {
                        <lucide-icon name="check" [size]="12"></lucide-icon>
                      } @else if (parcel.status === 'PICKED_UP') {
                        <span class="step-active-dot"></span>
                      }
                    </div>
                    <span class="step-label">Picked Up</span>
                  </div>
                  <div class="step" [class.active]="parcel.status === 'IN_TRANSIT'" [class.completed]="parcel.status === 'DELIVERED'">
                    <div class="step-line"></div>
                    <div class="step-circle">
                      @if (parcel.status === 'DELIVERED') {
                        <lucide-icon name="check" [size]="12"></lucide-icon>
                      } @else if (parcel.status === 'IN_TRANSIT') {
                        <span class="step-active-dot"></span>
                      }
                    </div>
                    <span class="step-label">In Transit</span>
                  </div>
                }
              </div>
            </div>
            
            <div class="support-card modern-shadow">
              <lucide-icon name="shield-check" [size]="32"></lucide-icon>
              <h4>Safe Ride Support</h4>
              <p>Having trouble? Our support team is available 24/7 to assist you.</p>
              <a [routerLink]="['/rider/support']" 
                 [queryParams]="{ subject: 'Issue with Active ' + (activeRide() ? 'Ride ' + activeRide()!.id.slice(0,8) : 'Parcel ' + activeParcel()!.id.slice(0,8)) }" 
                 class="btn btn--secondary btn--sm btn--pill mt-12">
                Report an Issue
              </a>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .active-trip-page { animation: fadeIn 0.6s ease-out; }
    .loader-wrap { padding: 100px; display: flex; justify-content: center; }
    
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 32px;
    }
    .page-header h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; color: var(--clr-text); }
    .page-header p { color: var(--clr-text-muted); font-size: 15px; margin-top: 4px; }

    .modern-shadow { box-shadow: var(--shadow-card); }
    .mt-24 { margin-top: 24px; }
    .mt-12 { margin-top: 12px; }

    .empty-state-card {
      padding: 80px 40px; text-align: center; max-width: 600px; margin: 0 auto;
    }
    .empty-icon-wrap { width: 100px; height: 100px; background: rgba(64, 138, 113, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 32px; color: var(--clr-primary); }
    .empty-state-card h3 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
    .empty-state-card p { color: var(--clr-text-muted); line-height: 1.6; }

    .trip-grid { display: grid; grid-template-columns: 1fr 300px; gap: 32px; align-items: start; }

    .trip-card { padding: 0; overflow: hidden; }
    .card-header { padding: 20px 24px; border-bottom: 1px solid var(--clr-border); display: flex; justify-content: space-between; align-items: center; }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .trip-badge {
      display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase;
      padding: 6px 12px; border-radius: 20px;
    }
    .trip-badge.ride { background: rgba(59, 130, 246, 0.12); color: var(--clr-info); }
    .trip-badge.parcel { background: rgba(64, 138, 113, 0.12); color: var(--clr-primary); }
    
    .status-pill {
      font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 6px;
      background: var(--clr-bg-elevated); color: var(--clr-text-muted);
    }
    .status-pill.accepted { background: rgba(245, 158, 11, 0.15); color: var(--clr-warning); }
    .status-pill.in_progress, .status-pill.in_transit { background: rgba(34, 197, 94, 0.15); color: var(--clr-success); }

    .trip-body { padding: 24px; }
    .fare-section { margin-bottom: 32px; }
    .fare-section .label { font-size: 13px; color: var(--clr-text-muted); font-weight: 600; }
    .fare-section .fare-value { font-size: 32px; font-weight: 800; color: var(--clr-primary); font-family: var(--font-display); margin-top: 4px; }

    .route-display {
      background: var(--clr-bg-elevated); border-radius: var(--radius-lg); padding: 20px;
      margin-bottom: 32px; position: relative; border: 1px solid var(--clr-border);
    }
    .route-stop { display: flex; gap: 16px; position: relative; z-index: 2; }
    .stop-marker {
      width: 14px; height: 14px; border-radius: 50%; border: 3px solid #fff; margin-top: 4px; flex-shrink: 0;
    }
    .stop-marker.start { background: var(--clr-primary); }
    .stop-marker.end { background: var(--clr-info); }
    
    .route-connector {
      position: absolute; left: 26px; top: 38px; bottom: 38px; width: 2px;
      background: repeating-linear-gradient(to bottom, var(--clr-border) 0, var(--clr-border) 6px, transparent 6px, transparent 12px);
    }
    .stop-content label { font-size: 11px; font-weight: 700; color: var(--clr-text-muted); text-transform: uppercase; display: block; margin-bottom: 4px; }
    .stop-content p { font-size: 15px; font-weight: 500; color: var(--clr-text); line-height: 1.4; }
    
    .route-stop:first-child { margin-bottom: 32px; }

    .details-section, .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .detail-item { display: flex; gap: 12px; }
    .detail-item .item-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--clr-bg-elevated); display: flex; align-items: center; justify-content: center; color: var(--clr-text-muted); flex-shrink: 0; }
    .detail-item label { font-size: 11px; font-weight: 700; color: var(--clr-text-muted); text-transform: uppercase; display: block; }
    .detail-item p, .detail-item .contact-link { font-size: 14px; font-weight: 600; color: var(--clr-text); }
    .detail-item .contact-link { color: var(--clr-primary); }

    .upload-box {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
      padding: 32px; border: 2px dashed var(--clr-border); border-radius: var(--radius-lg);
      cursor: pointer; transition: all 0.3s; color: var(--clr-text-muted);
    }
    .upload-box:hover { border-color: var(--clr-primary); color: var(--clr-primary); background: rgba(64, 138, 113, 0.05); }
    .upload-box.uploaded { border-style: solid; border-color: var(--clr-success); background: rgba(34, 197, 94, 0.05); color: var(--clr-success); }
    .upload-box span { font-size: 14px; font-weight: 600; }

    .card-footer { padding: 24px; border-top: 1px solid var(--clr-border); background: var(--clr-bg-elevated); }
    .action-btn { gap: 12px; height: 60px; font-size: 18px; }
    .error-hint { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: var(--clr-error); text-align: center; margin-top: 12px; font-weight: 600; }
    .completion-message { display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--clr-success); font-weight: 700; font-size: 18px; }

    .stepper-card { padding: 24px; margin-bottom: 24px; }
    .stepper-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 24px; }
    .stepper { display: flex; flex-direction: column; gap: 32px; padding-left: 8px; }
    .step {
      display: flex; align-items: center; gap: 16px; position: relative;
    }
    .step .step-line { position: absolute; left: 13px; top: 28px; width: 2px; height: 32px; background: var(--clr-border); }
    .step:last-child .step-line { display: none; }
    .step .step-circle { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--clr-border); display: flex; align-items: center; justify-content: center; background: var(--clr-bg-card); transition: all 0.3s; z-index: 2; }
    .step-active-dot { width: 8px; height: 8px; background: var(--clr-primary); border-radius: 50%; }
    .step .step-label { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); transition: all 0.3s; }
    
    .step.completed .step-circle { background: var(--clr-primary); border-color: var(--clr-primary); color: #fff; }
    .step.completed .step-label { color: var(--clr-text); }
    .step.completed .step-line { background: var(--clr-primary); }
    .step.active .step-circle { border-color: var(--clr-primary); background: rgba(64, 138, 113, 0.1); }
    .step.active .step-label { color: var(--clr-primary); font-weight: 700; }

    .support-card { padding: 24px; background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); text-align: center; }
    .support-card lucide-icon { color: var(--clr-primary); margin-bottom: 16px; }
    .support-card h4 { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
    .support-card p { font-size: 12px; color: var(--clr-text-muted); line-height: 1.5; }

    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .hidden { display: none; }

    @media (max-width: 960px) {
      .trip-grid { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; align-items: stretch; gap: 16px; }
      .details-section, .details-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .trip-body { padding: 16px; }
      .card-header { flex-wrap: wrap; gap: 10px; }
      .fare-section .fare-value { font-size: 26px; }
    }
  `],
})
export class RiderActiveComponent implements OnInit, OnDestroy {
  private readonly rideService     = inject(RideService);
  private readonly parcelService   = inject(ParcelService);
  private readonly mediaService    = inject(MediaService);
  private readonly toast           = inject(ToastService);
  private readonly trackingService = inject(TrackingService);

  protected readonly activeRide   = signal<Ride | null>(null);
  protected readonly activeParcel = signal<Parcel | null>(null);
  protected readonly loading      = signal(true);
  protected readonly updating     = signal(false);
  protected readonly proofUploading = signal(false);
  protected readonly proofUploaded  = signal(false);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private geoWatchId: number | null = null;
  private initialLoaded = false;
  private readonly tripPaymentCb = (d: TripPaymentPayload) => {
    const ride = this.activeRide();
    const parcel = this.activeParcel();
    const hit =
      (d.kind === 'ride' && ride?.id === d.entityId) ||
      (d.kind === 'parcel' && parcel?.id === d.entityId);
    if (!hit) return;
    void this.silentRefresh();
    if (d.status === 'COMPLETED') {
      this.toast.success(
        d.kind === 'ride'
          ? 'Passenger paid via M-Pesa. You can complete the ride after drop-off.'
          : 'Sender paid via M-Pesa. You can mark delivered after proof upload.',
      );
    } else if (d.status === 'FAILED') {
      this.toast.error(
        d.kind === 'ride'
          ? 'Passenger M-Pesa payment failed — they can resend the prompt.'
          : 'Sender M-Pesa payment failed — they can resend the prompt.',
      );
    }
  };

  async ngOnInit(): Promise<void> {
    this.trackingService.connect();
    this.trackingService.onTripPayment(this.tripPaymentCb);
    await this.refresh();
    this.pollTimer = setInterval(() => void this.silentRefresh(), 30_000);
    this.startLocationBroadcast();
  }

  ngOnDestroy(): void {
    this.trackingService.offTripPayment(this.tripPaymentCb);
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.geoWatchId !== null) navigator.geolocation?.clearWatch(this.geoWatchId);
    this.trackingService.disconnect();
  }

  /** Watch GPS and forward position to the server every time it changes (browser debounces ~5 s). */
  private startLocationBroadcast(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    this.geoWatchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (this.activeRide() || this.activeParcel()) {
          this.trackingService.sendLocation(
            coords.latitude,
            coords.longitude,
            coords.speed ?? undefined,
          );
        }
      },
      () => { /* silently ignore — user may have denied location */ },
      { enableHighAccuracy: true, maximumAge: 5_000 },
    );
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
      if (!parcel || parcel.status !== 'IN_TRANSIT') {
        this.proofUploaded.set(false);
      }
      this.initialLoaded = true;
    } catch {
      this.toast.error('Could not load active trip');
    } finally {
      this.loading.set(false);
    }
  }

  /** Background refresh used by the poll timer — does not trigger the full-page spinner. */
  private async silentRefresh(): Promise<void> {
    if (!this.initialLoaded) return;
    try {
      const [ride, parcel] = await Promise.all([
        this.rideService.getActive(),
        this.parcelService.getActive(),
      ]);
      this.activeRide.set(ride);
      this.activeParcel.set(parcel);
      if (!parcel || parcel.status !== 'IN_TRANSIT') {
        this.proofUploaded.set(false);
      }
    } catch { /* silently ignore poll errors */ }
  }

  async advanceRide(rideId: string, newStatus: RideStatus): Promise<void> {
    this.updating.set(true);
    try {
      const updated = await this.rideService.updateStatus(rideId, newStatus);
      this.activeRide.set(updated.status === 'COMPLETED' ? null : updated);
      if (updated.status === 'COMPLETED') {
        this.toast.success('Ride completed!');
      }
    } catch {
      this.toast.error('Status update failed');
    } finally {
      this.updating.set(false);
    }
  }

  async advanceParcel(parcelId: string, newStatus: ParcelStatus, currentStatus: ParcelStatus): Promise<void> {
    if (newStatus === 'DELIVERED' && !this.proofUploaded()) {
      this.toast.error('Upload delivery proof first');
      return;
    }
    this.updating.set(true);
    try {
      const updated = await this.parcelService.updateStatus(parcelId, newStatus);
      this.activeParcel.set(updated.status === 'DELIVERED' ? null : updated);
      if (updated.status === 'DELIVERED') {
        this.toast.success('Delivery completed!');
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

    this.proofUploading.set(true);
    try {
      this.toast.info('Uploading delivery proof...');
      const imageUrl = await this.mediaService.uploadImage(file);
      await this.parcelService.uploadProof(parcelId, imageUrl);
      this.proofUploaded.set(true);
      this.toast.success('Proof uploaded!');
    } catch (error) {
      console.error('Proof upload failed:', error);
      this.toast.error('Upload failed. Please try again.');
    } finally {
      this.proofUploading.set(false);
    }
  }

  protected rideNext(status: RideStatus) { return RIDE_NEXT[status] ?? null; }
  protected parcelNext(status: ParcelStatus) { return PARCEL_NEXT[status] ?? null; }

  /** True when the ride is MPESA and payment hasn't been confirmed yet. */
  protected ridePaymentPending(ride: Ride): boolean {
    if (ride.paymentMethod !== 'MPESA') return false;
    return ride.payment?.status !== 'COMPLETED';
  }

  /** True when the parcel is MPESA and payment hasn't been confirmed yet. */
  protected parcelPaymentPending(parcel: Parcel): boolean {
    if (parcel.paymentMethod !== 'MPESA') return false;
    return parcel.payment?.status !== 'COMPLETED';
  }
}
