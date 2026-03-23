import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RideService }   from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride }   from '../../../core/models/ride.models';
import type { Parcel } from '../../../core/models/parcel.models';

type TabType = 'rides' | 'parcels';

@Component({
  selector: 'app-rider-history',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>History</h1><p>Your completed rides and deliveries</p></div>
      </div>

      <!-- Tab switcher -->
      <div class="tabs">
        <button class="tab" [class.tab--active]="tab() === 'rides'" (click)="switchTab('rides')">
          🏍 Rides
        </button>
        <button class="tab" [class.tab--active]="tab() === 'parcels'" (click)="switchTab('parcels')">
          📦 Deliveries
        </button>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (tab() === 'rides') {
        @if (rides().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">🏍</div>
            <h3>No completed rides yet</h3>
          </div>
        } @else {
          <div class="card table-wrapper">
            <table>
              <thead>
                <tr><th>Pickup</th><th>Drop-off</th><th>Status</th><th>Fare</th><th>Date</th></tr>
              </thead>
              <tbody>
                @for (r of rides(); track r.id) {
                  <tr>
                    <td class="addr">{{ r.pickupAddress }}</td>
                    <td class="addr">{{ r.dropoffAddress }}</td>
                    <td><span class="badge badge--{{ rideBadge(r.status) }}">{{ r.status }}</span></td>
                    <td>KES {{ r.estimatedFare | number:'1.0-0' }}</td>
                    <td>{{ r.createdAt | date:'dd MMM, HH:mm' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (rideTotalPages() > 1) {
            <div class="pagination">
              <button class="btn btn--secondary btn--sm" (click)="prevRidePage()" [disabled]="ridePage() === 1">← Prev</button>
              <span class="text-muted">Page {{ ridePage() }} of {{ rideTotalPages() }}</span>
              <button class="btn btn--secondary btn--sm" (click)="nextRidePage()" [disabled]="ridePage() === rideTotalPages()">Next →</button>
            </div>
          }
        }
      } @else {
        @if (parcels().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <h3>No completed deliveries yet</h3>
          </div>
        } @else {
          <div class="card table-wrapper">
            <table>
              <thead>
                <tr><th>Item</th><th>Recipient</th><th>Status</th><th>Fee</th><th>Date</th></tr>
              </thead>
              <tbody>
                @for (p of parcels(); track p.id) {
                  <tr>
                    <td class="addr">{{ p.itemDescription }}</td>
                    <td>{{ p.recipientName }}</td>
                    <td><span class="badge badge--{{ parcelBadge(p.status) }}">{{ p.status }}</span></td>
                    <td>KES {{ p.deliveryFee | number:'1.0-0' }}</td>
                    <td>{{ p.createdAt | date:'dd MMM, HH:mm' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (parcelTotalPages() > 1) {
            <div class="pagination">
              <button class="btn btn--secondary btn--sm" (click)="prevParcelPage()" [disabled]="parcelPage() === 1">← Prev</button>
              <span class="text-muted">Page {{ parcelPage() }} of {{ parcelTotalPages() }}</span>
              <button class="btn btn--secondary btn--sm" (click)="nextParcelPage()" [disabled]="parcelPage() === parcelTotalPages()">Next →</button>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
    .tab { padding: 8px 20px; border: 1px solid var(--clr-border); border-radius: var(--radius-md); background: none; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--clr-text-muted); transition: all var(--transition); }
    .tab--active { background: var(--clr-primary); color: #fff; border-color: var(--clr-primary); }
    .addr { max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
  `],
})
export class RiderHistoryComponent implements OnInit {
  private readonly rideService   = inject(RideService);
  private readonly parcelService = inject(ParcelService);

  protected readonly tab   = signal<TabType>('rides');
  protected readonly loading = signal(true);

  protected readonly rides          = signal<Ride[]>([]);
  protected readonly ridePage       = signal(1);
  protected readonly rideTotalPages = signal(1);

  protected readonly parcels          = signal<Parcel[]>([]);
  protected readonly parcelPage       = signal(1);
  protected readonly parcelTotalPages = signal(1);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadRides(), this.loadParcels()]);
    this.loading.set(false);
  }

  protected switchTab(t: TabType): void { this.tab.set(t); }

  private async loadRides(): Promise<void> {
    try {
      const res = await this.rideService.getMyRides(this.ridePage(), 15, 'COMPLETED');
      this.rides.set(res.data);
      this.rideTotalPages.set(res.totalPages);
    } catch { /* silent */ }
  }

  private async loadParcels(): Promise<void> {
    try {
      const res = await this.parcelService.getMyParcels(this.parcelPage(), 15, 'DELIVERED');
      this.parcels.set(res.data);
      this.parcelTotalPages.set(res.totalPages);
    } catch { /* silent */ }
  }

  protected prevRidePage(): void { this.ridePage.update((p) => p - 1); void this.loadRides(); }
  protected nextRidePage(): void { this.ridePage.update((p) => p + 1); void this.loadRides(); }
  protected prevParcelPage(): void { this.parcelPage.update((p) => p - 1); void this.loadParcels(); }
  protected nextParcelPage(): void { this.parcelPage.update((p) => p + 1); void this.loadParcels(); }

  protected rideBadge(status: string): string {
    return status === 'COMPLETED' ? 'active' : status === 'CANCELLED' ? 'closed' : 'pending';
  }

  protected parcelBadge(status: string): string {
    return status === 'DELIVERED' ? 'active' : status === 'CANCELLED' ? 'closed' : 'info';
  }
}
