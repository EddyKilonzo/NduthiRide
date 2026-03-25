import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { RideService }   from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride }   from '../../../core/models/ride.models';
import type { Parcel } from '../../../core/models/parcel.models';

type TabType = 'rides' | 'parcels';

@Component({
  selector: 'app-rider-history',
  standalone: true,
  imports: [CommonModule, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="history-page app-page">
      <div class="page-header">
        <div class="header-text">
          <h1>Trip History</h1>
          <p>Review your completed assignments and performance</p>
        </div>
      </div>

      <!-- Tab switcher -->
      <div class="tabs-container modern-shadow">
        <button class="tab-btn" [class.active]="tab() === 'rides'" (click)="switchTab('rides')">
          <lucide-icon name="bike" [size]="16"></lucide-icon>
          <span>Completed Rides</span>
        </button>
        <button class="tab-btn" [class.active]="tab() === 'parcels'" (click)="switchTab('parcels')">
          <lucide-icon name="package" [size]="16"></lucide-icon>
          <span>Deliveries</span>
        </button>
      </div>

      @if (loading()) {
        <div class="loader-wrap"><app-spinner /></div>
      } @else if (tab() === 'rides') {
        @if (rides().length === 0) {
          <div class="card empty-card modern-shadow">
            <lucide-icon name="history" [size]="48" class="muted-icon"></lucide-icon>
            <h3>No completed rides yet</h3>
            <p>Your finished trips will appear here once you complete them.</p>
          </div>
        } @else {
          <div class="card table-card modern-shadow">
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Pickup</th>
                    <th>Drop-off</th>
                    <th>Status</th>
                    <th>Fare</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of rides(); track r.id) {
                    <tr>
                      <td><div class="addr-cell" [title]="r.pickupAddress">{{ r.pickupAddress }}</div></td>
                      <td><div class="addr-cell" [title]="r.dropoffAddress">{{ r.dropoffAddress }}</div></td>
                      <td><span class="status-pill success">Completed</span></td>
                      <td class="font-bold">KES {{ r.estimatedFare | number:'1.0-0' }}</td>
                      <td class="text-muted">{{ r.createdAt | date:'dd MMM, HH:mm' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          @if (rideTotalPages() > 1) {
            <div class="pagination">
              <button class="btn btn--secondary btn--sm btn--pill" (click)="prevRidePage()" [disabled]="ridePage() === 1">
                <lucide-icon name="chevron-left" [size]="14"></lucide-icon> Prev
              </button>
              <span class="page-info">Page {{ ridePage() }} of {{ rideTotalPages() }}</span>
              <button class="btn btn--secondary btn--sm btn--pill" (click)="nextRidePage()" [disabled]="ridePage() === rideTotalPages()">
                Next <lucide-icon name="chevron-right" [size]="14"></lucide-icon>
              </button>
            </div>
          }
        }
      } @else {
        @if (parcels().length === 0) {
          <div class="card empty-card modern-shadow">
            <lucide-icon name="package" [size]="48" class="muted-icon"></lucide-icon>
            <h3>No completed deliveries yet</h3>
            <p>Your finished parcel deliveries will appear here.</p>
          </div>
        } @else {
          <div class="card table-card modern-shadow">
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Recipient</th>
                    <th>Status</th>
                    <th>Fee</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of parcels(); track p.id) {
                    <tr>
                      <td><div class="addr-cell">{{ p.itemDescription }}</div></td>
                      <td><div class="user-cell">{{ p.recipientName }}</div></td>
                      <td><span class="status-pill info">Delivered</span></td>
                      <td class="font-bold">KES {{ p.deliveryFee | number:'1.0-0' }}</td>
                      <td class="text-muted">{{ p.createdAt | date:'dd MMM, HH:mm' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          @if (parcelTotalPages() > 1) {
            <div class="pagination">
              <button class="btn btn--secondary btn--sm btn--pill" (click)="prevParcelPage()" [disabled]="parcelPage() === 1">
                <lucide-icon name="chevron-left" [size]="14"></lucide-icon> Prev
              </button>
              <span class="page-info">Page {{ parcelPage() }} of {{ parcelTotalPages() }}</span>
              <button class="btn btn--secondary btn--sm btn--pill" (click)="nextParcelPage()" [disabled]="parcelPage() === parcelTotalPages()">
                Next <lucide-icon name="chevron-right" [size]="14"></lucide-icon>
              </button>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .history-page { animation: fadeIn 0.6s ease-out; }
    .loader-wrap { padding: 100px; display: flex; justify-content: center; }
    
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 32px;
      h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; color: var(--clr-text); }
      p { color: var(--clr-text-muted); font-size: 15px; margin-top: 4px; }
    }

    .modern-shadow { box-shadow: var(--shadow-card); }

    .tabs-container {
      display: flex; flex-wrap: wrap; width: 100%; max-width: 100%;
      background: var(--clr-bg-card); border: 1px solid var(--clr-border);
      border-radius: 12px; padding: 4px; margin-bottom: 32px; box-shadow: var(--shadow-card);
    }
    .tab-btn {
      display: flex; align-items: center; gap: 8px; padding: 8px 20px;
      border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--clr-text-muted);
      cursor: pointer; transition: all 0.2s; border: none; background: none;
      &:hover:not(.active) { color: var(--clr-text); background: var(--clr-bg-elevated); }
      &.active { background: var(--clr-primary); color: #fff; }
    }

    .table-card { padding: 0; overflow: hidden; border: 1px solid var(--clr-border); box-shadow: var(--shadow-card); }
    .table-wrapper { overflow-x: auto; }
    table {
      width: 100%; border-collapse: collapse;
      th { padding: 16px 24px; text-align: left; font-size: 11px; font-weight: 700; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 0.5px; background: var(--clr-bg-elevated); border-bottom: 1px solid var(--clr-border); }
      td { padding: 16px 24px; border-bottom: 1px solid var(--clr-border); font-size: 14px; }
      tr:last-child td { border-bottom: none; }
    }

    .addr-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
    .user-cell { font-weight: 600; color: var(--clr-text); }
    .font-bold { font-weight: 700; color: var(--clr-primary); }
    
    .status-pill {
      padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      &.success { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
      &.info { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: 32px; }
    .page-info { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); }

    .empty-card { padding: 80px 40px; text-align: center; lucide-icon { color: var(--clr-text-dim); opacity: 0.3; margin-bottom: 24px; } h3 { font-size: 18px; font-weight: 700; margin-bottom: 12px; } p { color: var(--clr-text-muted); } }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 640px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 8px; }
      .tab-btn { flex: 1; justify-content: center; min-width: 0; padding: 10px 12px; font-size: 13px; }
      .addr-cell { max-width: 140px; }
      .pagination { flex-wrap: wrap; gap: 12px; }
    }
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
}
