import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RideService } from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { Ride } from '../../../core/models/ride.models';
import { Parcel } from '../../../core/models/parcel.models';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-rider-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Rider Dashboard</h1>
          <p>Welcome back, {{ auth.user()?.fullName }}</p>
        </div>
        <div class="status-toggle">
          <span class="status-label">{{ isOnline() ? 'Online' : 'Offline' }}</span>
          <button 
            class="toggle-btn" 
            [class.toggle-btn--online]="isOnline()"
            (click)="toggleOnline()"
          >
            <div class="toggle-handle"></div>
          </button>
        </div>
      </header>

      <div class="rider-grid">
        <!-- Active Job Section -->
        <section class="rider-section">
          <div class="section-header">
            <h2>Current Task</h2>
          </div>

          @if (loadingActive()) {
            <div class="section-loader"><app-spinner /></div>
          } @else if (!activeJob()) {
            <div class="empty-card">
              <span class="empty-icon">🛵</span>
              <p>You have no active tasks</p>
              <small>Switch to Online to receive new requests</small>
            </div>
          } @else {
            <div class="active-job-card job-card--active" [routerLink]="activeJob()?.type === 'RIDE' ? ['/rider/rides', activeJob()?.id] : ['/rider/parcels', activeJob()?.id]">
              <div class="job-badge badge badge--active">{{ activeJob()?.type }}</div>
              <div class="job-main">
                <div class="job-locations">
                  <div class="loc-item">
                    <span class="dot dot--start"></span>
                    <p>{{ activeJob()?.pickupAddress }}</p>
                  </div>
                  <div class="loc-item">
                    <span class="dot dot--end"></span>
                    <p>{{ activeJob()?.dropoffAddress }}</p>
                  </div>
                </div>
                <div class="job-meta">
                  <div class="user-info">
                    <span class="user-avatar">{{ activeJob()?.userName?.charAt(0) }}</span>
                    <span>{{ activeJob()?.userName }}</span>
                  </div>
                  <div class="job-price">KES {{ activeJob()?.price }}</div>
                </div>
              </div>
              <button class="btn btn--primary btn--full">Continue Task</button>
            </div>
          }
        </section>

        <!-- New Requests Section (Real-time) -->
        <section class="rider-section">
          <div class="section-header">
            <h2>Nearby Requests</h2>
            <span class="badge badge--pending">{{ pendingRequests().length }} NEW</span>
          </div>

          @if (!isOnline()) {
            <div class="offline-overlay">
              <p>Go online to see requests</p>
            </div>
          }

          <div class="card-list">
            @for (req of pendingRequests(); track req.id) {
              <div class="job-card job-card--pending">
                <div class="job-header">
                  <span class="type-tag">{{ req.type }}</span>
                  <span class="time-tag">Just now</span>
                </div>
                <div class="job-info">
                  <p class="address"><strong>Pick:</strong> {{ req.pickupAddress }}</p>
                  <p class="address"><strong>Drop:</strong> {{ req.dropoffAddress }}</p>
                </div>
                <div class="job-actions">
                  <div class="price">KES {{ req.price }}</div>
                  <button class="btn btn--primary btn--sm" (click)="acceptRequest(req)">Accept</button>
                </div>
              </div>
            } @empty {
              @if (isOnline()) {
                <div class="waiting-state">
                  <div class="radar-ping"></div>
                  <p>Waiting for new requests...</p>
                </div>
              }
            }
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .status-toggle { display: flex; align-items: center; gap: 12px; }
    .status-label { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
    .toggle-btn {
      width: 52px; height: 28px; background: var(--clr-bg-elevated);
      border-radius: 20px; position: relative; cursor: pointer;
      transition: background var(--transition);
      &--online { background: var(--clr-success); .toggle-handle { transform: translateX(24px); } }
    }
    .toggle-handle {
      width: 20px; height: 20px; background: #fff; border-radius: 50%;
      position: absolute; left: 4px; top: 4px; transition: transform var(--transition);
    }

    .rider-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 32px; align-items: start; }
    
    .job-card--active {
      background: var(--clr-bg-card); border: 2px solid var(--clr-primary);
      padding: 24px; border-radius: var(--radius-lg);
      display: flex; flex-direction: column; gap: 20px;
    }
    .loc-item { display: flex; gap: 12px; align-items: flex-start; p { font-size: 14px; line-height: 1.4; } }
    .dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
    .dot--start { background: var(--clr-success); }
    .dot--end { background: var(--clr-primary); }
    
    .job-meta { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--clr-border); pt: 16px; }
    .user-avatar { width: 28px; height: 28px; background: var(--clr-bg-elevated); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
    .job-price { font-size: 18px; font-weight: 700; color: var(--clr-primary); }

    .job-card--pending {
      background: var(--clr-bg-card); border: 1px solid var(--clr-border);
      border-radius: var(--radius-md); padding: 16px;
    }
    .job-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .type-tag { font-size: 10px; font-weight: 700; padding: 2px 8px; background: rgba(255,107,0,.1); color: var(--clr-primary); border-radius: 4px; text-transform: uppercase; }
    .time-tag { font-size: 11px; color: var(--clr-success); }
    .job-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }

    .waiting-state {
      padding: 60px 20px; text-align: center; color: var(--clr-text-muted);
      display: flex; flex-direction: column; align-items: center; gap: 16px;
    }
    .radar-ping {
      width: 40px; height: 40px; background: var(--clr-primary); border-radius: 50%;
      animation: ping 1.5s infinite; opacity: 0.6;
    }
    @keyframes ping { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2.5); opacity: 0; } }

    .offline-overlay {
      padding: 40px; background: rgba(0,0,0,0.4); border-radius: var(--radius-md);
      text-align: center; color: var(--clr-text-muted); font-weight: 500;
    }
  `],
})
export class RiderDashboardComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly rideSvc = inject(RideService);
  private readonly parcelSvc = inject(ParcelService);
  private readonly trackingSvc = inject(TrackingService);
  private readonly toast = inject(ToastService);

  protected readonly isOnline = signal(false);
  protected readonly loadingActive = signal(true);
  protected readonly activeJob = signal<any | null>(null);
  protected readonly pendingRequests = signal<any[]>([]);

  async ngOnInit() {
    this.trackingSvc.connect();
    await this.loadActiveJob();
    this.setupListeners();
  }

  private setupListeners() {
    this.trackingSvc.onNewRideRequest((ride: any) => {
      if (this.isOnline()) {
        this.pendingRequests.update(prev => [{ ...ride, type: 'RIDE', price: ride.estimatedFare }, ...prev]);
        this.toast.info('New ride request nearby!');
      }
    });

    this.trackingSvc.onNewParcelRequest((parcel: any) => {
      if (this.isOnline()) {
        this.pendingRequests.update(prev => [{ ...parcel, type: 'PARCEL', price: parcel.deliveryFee }, ...prev]);
        this.toast.info('New parcel delivery nearby!');
      }
    });
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
    } finally {
      this.loadingActive.set(false);
    }
  }

  protected toggleOnline() {
    const newState = !this.isOnline();
    this.isOnline.set(newState);
    this.trackingSvc.toggleAvailability(newState);
    
    if (newState) {
      this.toast.success('You are now online');
    } else {
      this.pendingRequests.set([]);
      this.toast.info('You are now offline');
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
  }
}
