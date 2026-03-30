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
          <div class="history-grid">
            @for (r of rides(); track r.id) {
              <div class="card history-card">
                <div class="card__header">
                  <span class="status-pill success">Completed</span>
                  <span class="card__date">{{ r.createdAt | date:'dd MMM, HH:mm' }}</span>
                </div>
                
                <div class="card__route">
                  <div class="route-item">
                    <div class="marker pickup"></div>
                    <div class="addr">{{ r.pickupAddress }}</div>
                  </div>
                  <div class="route-line"></div>
                  <div class="route-item">
                    <div class="marker dropoff"></div>
                    <div class="addr">{{ r.dropoffAddress }}</div>
                  </div>
                </div>

                <div class="card__footer">
                  <div class="card__earnings">
                    <span class="label">Earned:</span>
                    <span class="value">KES {{ r.estimatedFare | number:'1.0-0' }}</span>
                  </div>
                </div>
              </div>
            }
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
          <div class="history-grid">
            @for (p of parcels(); track p.id) {
              <div class="card history-card">
                <div class="card__header">
                  <span class="status-pill info">Delivered</span>
                  <span class="card__date">{{ p.createdAt | date:'dd MMM, HH:mm' }}</span>
                </div>
                
                <div class="card__content">
                  <div class="item-info">
                    <lucide-icon name="package" [size]="18" class="text-primary"></lucide-icon>
                    <span class="item-desc">{{ p.itemDescription }}</span>
                  </div>
                  <div class="recipient-info">
                    <lucide-icon name="user" [size]="16" class="text-dim"></lucide-icon>
                    <span>To: {{ p.recipientName }}</span>
                  </div>
                </div>

                <div class="card__footer">
                  <div class="card__earnings">
                    <span class="label">Earned:</span>
                    <span class="value">KES {{ p.deliveryFee | number:'1.0-0' }}</span>
                  </div>
                </div>
              </div>
            }
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
      margin-bottom: 32px;
      h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; color: var(--clr-text); }
      p { color: var(--clr-text-muted); font-size: 15px; margin-top: 4px; }
    }

    .tabs-container {
      display: flex; gap: 8px; background: var(--clr-bg-card); border: 1px solid var(--clr-border);
      border-radius: 12px; padding: 4px; margin-bottom: 32px; box-shadow: var(--shadow-card);
    }
    .tab-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px;
      border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--clr-text-muted);
      cursor: pointer; transition: all 0.2s; border: none; background: none;
    }
    .tab-btn:hover:not(.active) { color: var(--clr-text); background: var(--clr-bg-elevated); }
    .tab-btn.active { background: var(--clr-primary); color: #fff; }

    .history-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }
    .history-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      border: 1px solid var(--clr-border);
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: rgba(50, 50, 93, 0.25) 0px 50px 100px -20px, rgba(0, 0, 0, 0.3) 0px 30px 60px -30px, rgba(10, 37, 64, 0.35) 0px -2px 6px 0px inset;
    }
    .history-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }
    .card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card__date {
      font-size: 0.85rem;
      color: var(--clr-text-dim);
    }
    .card__route {
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
    }
    .route-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .marker {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;
    }
    .marker.pickup { background: #F59E0B; }
    .marker.dropoff { background: #22C55E; }
    .route-line {
      position: absolute;
      left: 4.5px;
      top: 15px;
      bottom: 15px;
      width: 1px;
      border-left: 1px dashed var(--clr-border);
    }
    .addr {
      font-size: 0.9rem;
      color: var(--clr-text);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card__content {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .item-info {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 500;
    }
    .item-desc {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .recipient-info {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.9rem;
      color: var(--clr-text-dim);
    }
    .card__footer {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid var(--clr-border-subtle);
    }
    .card__earnings {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card__earnings .label {
      font-size: 0.85rem;
      color: var(--clr-text-dim);
      font-weight: 500;
    }
    .card__earnings .value {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--clr-primary);
    }

    .status-pill {
      padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      &.success { background: rgba(34, 197, 94, 0.15); color: var(--clr-success); }
      &.info { background: rgba(59, 130, 246, 0.15); color: var(--clr-info); }
    }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: 32px; }
    .page-info { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); }

    .empty-card { padding: 80px 40px; text-align: center; }
    .empty-card lucide-icon { color: var(--clr-text-dim); opacity: 0.3; margin-bottom: 24px; }
    .empty-card h3 { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
    .empty-card p { color: var(--clr-text-muted); }

    .text-primary { color: var(--clr-primary); }
    .text-dim { color: var(--clr-text-dim); }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 640px) {
      .history-grid { grid-template-columns: 1fr; }
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
      const res = await this.rideService.getRiderHistory(this.ridePage(), 15, 'COMPLETED');
      this.rides.set(res.data);
      this.rideTotalPages.set(res.totalPages);
    } catch { /* silent */ }
  }

  private async loadParcels(): Promise<void> {
    try {
      const res = await this.parcelService.getRiderHistory(this.parcelPage(), 15, 'DELIVERED');
      this.parcels.set(res.data);
      this.parcelTotalPages.set(res.totalPages);
    } catch { /* silent */ }
  }

  protected prevRidePage(): void { this.ridePage.update((p) => p - 1); void this.loadRides(); }
  protected nextRidePage(): void { this.ridePage.update((p) => p + 1); void this.loadRides(); }
  protected prevParcelPage(): void { this.parcelPage.update((p) => p - 1); void this.loadParcels(); }
  protected nextParcelPage(): void { this.parcelPage.update((p) => p + 1); void this.loadParcels(); }
}
