import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { RideService }   from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride }   from '../../../core/models/ride.models';
import type { Parcel } from '../../../core/models/parcel.models';

@Component({
  selector: 'app-rider-earnings',
  standalone: true,
  imports: [CommonModule, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="earnings-page app-page">
      <div class="page-header">
        <div class="header-text">
          <h1>Earnings</h1>
          <p>Track your revenue and performance analytics</p>
        </div>
        <div class="header-actions">
          <button class="btn btn--secondary btn--sm btn--pill">
            <lucide-icon name="upload-cloud" [size]="14"></lucide-icon> Export CSV
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loader-wrap"><app-spinner /></div>
      } @else {
        <!-- Summary cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon rides"><lucide-icon name="bike" [size]="20"></lucide-icon></div>
            <div class="stat-info">
              <span class="label">Total Rides</span>
              <h3 class="value">{{ rides().length }}</h3>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon parcels"><lucide-icon name="package" [size]="20"></lucide-icon></div>
            <div class="stat-info">
              <span class="label">Deliveries</span>
              <h3 class="value">{{ parcels().length }}</h3>
            </div>
          </div>
          <div class="stat-card highlight">
            <div class="stat-icon gross"><lucide-icon name="dollar-sign" [size]="20"></lucide-icon></div>
            <div class="stat-info">
              <span class="label">Gross Revenue</span>
              <h3 class="value">KES {{ grossEarnings() | number:'1.0-0' }}</h3>
            </div>
          </div>
          <div class="stat-card success">
            <div class="stat-icon payout"><lucide-icon name="wallet" [size]="20"></lucide-icon></div>
            <div class="stat-info">
              <span class="label">Est. Payout (85%)</span>
              <h3 class="value">KES {{ estimatedPayout() | number:'1.0-0' }}</h3>
            </div>
          </div>
        </div>

        <!-- Commission Info -->
        <div class="info-banner modern-shadow">
          <lucide-icon name="info" [size]="18"></lucide-icon>
          <p>Platform commission is 15%. Payouts are automatically processed to your registered M-Pesa account after each trip completion.</p>
        </div>

        <!-- Transactions Table -->
        <div class="card table-card modern-shadow">
          <div class="table-header">
            <h3>Recent Transactions</h3>
            <div class="filter-btns">
              <button class="filter-btn active">All</button>
              <button class="filter-btn">Rides</button>
              <button class="filter-btn">Parcels</button>
            </div>
          </div>

          @if (rides().length === 0 && parcels().length === 0) {
            <div class="empty-state">
              <lucide-icon name="history" [size]="48" class="muted"></lucide-icon>
              <p>No transactions found for the selected period.</p>
            </div>
          } @else {
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reference / Route</th>
                    <th>Gross</th>
                    <th>Net (85%)</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of combinedTransactions(); track r.id) {
                    <tr>
                      <td>
                        <span class="type-tag" [class.ride]="r.isRide">
                          <lucide-icon [name]="r.isRide ? 'bike' : 'package'" [size]="12"></lucide-icon>
                          {{ r.isRide ? 'Ride' : 'Parcel' }}
                        </span>
                      </td>
                      <td>
                        <div class="route-info">
                          <span class="route-text">{{ r.label }}</span>
                        </div>
                      </td>
                      <td class="font-bold">KES {{ r.gross | number:'1.0-0' }}</td>
                      <td class="text-success font-bold">KES {{ r.net | number:'1.0-0' }}</td>
                      <td class="text-muted">{{ r.date | date:'dd MMM, HH:mm' }}</td>
                      <td><span class="status-pill success">Paid</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .earnings-page { animation: fadeIn 0.6s ease-out; }
    .loader-wrap { padding: 100px; display: flex; justify-content: center; }
    
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 32px;
      h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; color: var(--clr-text); }
      p { color: var(--clr-text-muted); font-size: 15px; margin-top: 4px; }
    }

    .modern-shadow { box-shadow: var(--shadow-card); }

    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px; }
    .stat-card {
      background: var(--clr-bg-card); border-radius: var(--radius-lg); padding: 20px;
      display: flex; align-items: center; gap: 16px; border: 1px solid var(--clr-border); box-shadow: var(--shadow-card);
      .stat-icon {
        width: 44px; height: 44px; border-radius: 12px; display: flex;
        align-items: center; justify-content: center; color: #fff;
        background: var(--clr-bg-elevated); color: var(--clr-text-muted);
        &.rides { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        &.parcels { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
        &.gross { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        &.payout { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
      }
      .label { font-size: 12px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
      .value { font-size: 20px; font-weight: 800; color: var(--clr-text); font-family: var(--font-display); margin-top: 2px; }
      
      &.highlight { border-color: var(--clr-warning); }
      &.success { border-color: var(--clr-success); }
    }

    .info-banner {
      background: rgba(64, 138, 113, 0.08); border: 1px solid var(--clr-primary);
      border-radius: var(--radius-md); padding: 16px 20px; display: flex; gap: 12px;
      align-items: center; margin-bottom: 32px;
      p { font-size: 13px; color: var(--clr-text-muted); line-height: 1.5; }
      lucide-icon { color: var(--clr-primary); flex-shrink: 0; }
    }

    .table-card { padding: 0; overflow: hidden; box-shadow: var(--shadow-card); }
    .table-header {
      padding: 24px; border-bottom: 1px solid var(--clr-border);
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;
      h3 { font-size: 16px; font-weight: 700; }
    }
    .filter-btns {
      display: flex; gap: 8px;
      .filter-btn {
        padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
        color: var(--clr-text-muted); border: 1px solid var(--clr-border);
        cursor: pointer; transition: all 0.2s;
        &:hover { border-color: var(--clr-primary); color: var(--clr-primary); }
        &.active { background: var(--clr-primary); color: #fff; border-color: var(--clr-primary); }
      }
    }

    .table-wrapper { overflow-x: auto; }
    table {
      width: 100%; border-collapse: collapse;
      th { padding: 16px 24px; text-align: left; font-size: 11px; font-weight: 700; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 0.5px; background: var(--clr-bg-elevated); }
      td { padding: 16px 24px; border-bottom: 1px solid var(--clr-border); font-size: 14px; }
      tr:last-child td { border-bottom: none; }
    }

    .type-tag {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
      border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      background: rgba(168, 85, 247, 0.12); color: #a855f7;
      &.ride { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
    }

    .route-text { font-weight: 500; color: var(--clr-text); }
    .font-bold { font-weight: 700; }
    .text-success { color: var(--clr-success); }
    .status-pill {
      padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
      &.success { background: rgba(34, 197, 94, 0.15); color: var(--clr-success); }
    }

    .empty-state { padding: 60px; text-align: center; color: var(--clr-text-muted); p { margin-top: 16px; font-size: 14px; } .muted { opacity: 0.3; } }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 1100px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .stats-grid { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; align-items: stretch; gap: 16px; }
      .header-actions { align-self: flex-start; }
    }
  `],
})
export class RiderEarningsComponent implements OnInit {
  private readonly rideService   = inject(RideService);
  private readonly parcelService = inject(ParcelService);

  protected readonly loading  = signal(true);
  protected readonly rides    = signal<Ride[]>([]);
  protected readonly parcels  = signal<Parcel[]>([]);

  protected readonly combinedTransactions = computed(() => {
    const rideTx = this.rides().map(r => ({
      id: r.id,
      isRide: true,
      label: `${r.pickupAddress.split(',')[0]} → ${r.dropoffAddress.split(',')[0]}`,
      gross: r.estimatedFare,
      net: r.estimatedFare * 0.85,
      date: r.createdAt
    }));

    const parcelTx = this.parcels().map(p => ({
      id: p.id,
      isRide: false,
      label: p.itemDescription,
      gross: p.deliveryFee,
      net: p.deliveryFee * 0.85,
      date: p.createdAt
    }));

    return [...rideTx, ...parcelTx].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  });

  protected readonly grossEarnings   = computed(() =>
    this.rides().reduce((s, r) => s + r.estimatedFare, 0) +
    this.parcels().reduce((s, p) => s + p.deliveryFee, 0),
  );
  protected readonly estimatedPayout = computed(() => this.grossEarnings() * 0.85);

  async ngOnInit(): Promise<void> {
    try {
      const [rideRes, parcelRes] = await Promise.all([
        this.rideService.getMyRides(1, 50, 'COMPLETED'),
        this.parcelService.getMyParcels(1, 50, 'DELIVERED'),
      ]);
      this.rides.set(rideRes.data);
      this.parcels.set(parcelRes.data);
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }
}
