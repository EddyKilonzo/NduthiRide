import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { RideService }   from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { RidersApi } from '../../../core/api/riders.api';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride }   from '../../../core/models/ride.models';
import type { Parcel } from '../../../core/models/parcel.models';

@Component({
  selector: 'app-rider-earnings',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent, LucideAngularModule],
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
          <div class="stat-card stat-card--rides">
            <div class="stat-icon rides"><lucide-icon name="bike" [size]="20"></lucide-icon></div>
            <div class="stat-info">
              <span class="label">Total Rides</span>
              <h3 class="value">{{ rideTotalCount() }}</h3>
            </div>
          </div>
          <div class="stat-card stat-card--parcels">
            <div class="stat-icon parcels"><lucide-icon name="package" [size]="20"></lucide-icon></div>
            <div class="stat-info">
              <span class="label">Deliveries</span>
              <h3 class="value">{{ parcelTotalCount() }}</h3>
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
              <span class="label">Available balance</span>
              <h3 class="value">KES {{ availableBalance() | number:'1.0-0' }}</h3>
            </div>
          </div>
        </div>

        <!-- Self-service M-Pesa withdrawal -->
        <div class="withdraw-card card modern-shadow">
          <div class="withdraw-header">
            <lucide-icon name="smartphone" [size]="22"></lucide-icon>
            <div>
              <h3>Withdraw to M-Pesa</h3>
              <p class="withdraw-sub">We pay you from our business M-Pesa (Lipana). Riders don’t sign up for Lipana — only a valid M-Pesa number. Minimum KES&nbsp;10.</p>
            </div>
          </div>
          <p class="available-line">
            Available balance: <strong>KES {{ availableBalance() | number:'1.0-0' }}</strong>
          </p>
          <div class="withdraw-form">
            <div class="field">
              <label for="wd-amount">Amount (KES)</label>
              <input id="wd-amount" type="number" [(ngModel)]="withdrawAmount" min="10"
                [attr.max]="availableBalance()" step="1" placeholder="e.g. 500" />
            </div>
            <div class="field">
              <label for="wd-phone">M-Pesa phone</label>
              <input id="wd-phone" type="text" [(ngModel)]="withdrawPhone"
                placeholder="07XX XXX XXX or +254…" autocomplete="tel" />
            </div>
            <button type="button" class="btn btn--primary btn--full withdraw-btn"
              (click)="withdrawToMpesa()" [disabled]="withdrawing() || availableBalance() < 10">
              @if (withdrawing()) { <app-spinner [size]="18" /> Sending… }
              @else { <lucide-icon name="banknote" [size]="16"></lucide-icon> Withdraw }
            </button>
          </div>
        </div>

        <!-- Commission Info -->
        <div class="info-banner modern-shadow">
          <lucide-icon name="info" [size]="18"></lucide-icon>
          <p>Platform commission is 15%. Your share is added to <strong>Available balance</strong> when rides and deliveries complete. Use the form above to cash out to M-Pesa anytime.</p>
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
      display: flex; align-items: center; gap: 16px; border: 1px solid var(--clr-border); border-left-width: 4px; box-shadow: var(--shadow-card);
    }
    .stat-icon {
      width: 44px; height: 44px; border-radius: 12px; display: flex;
      align-items: center; justify-content: center;
      background: #fff; border: 1px solid var(--clr-border); box-shadow: var(--shadow-card);
    }
    .stat-icon.rides, .stat-icon.parcels, .stat-icon.gross, .stat-icon.payout { color: var(--clr-primary); border-color: rgba(34, 197, 94, 0.35); }
    .stat-card .label { font-size: 12px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-card .value { font-size: 20px; font-weight: 800; color: var(--clr-text); font-family: var(--font-display); margin-top: 2px; }

    .stat-card.stat-card--rides, .stat-card.stat-card--parcels, .stat-card.highlight, .stat-card.success {
      border-color: rgba(34, 197, 94, 0.5);
      background: linear-gradient(180deg, rgba(34,197,94,0.06), transparent 40%);
    }

    .info-banner {
      background: rgba(64, 138, 113, 0.08); border: 1px solid var(--clr-primary);
      border-radius: var(--radius-md); padding: 16px 20px; display: flex; gap: 12px;
      align-items: center; margin-bottom: 32px;
    }
    .info-banner p { font-size: 13px; color: var(--clr-text-muted); line-height: 1.5; }
    .info-banner lucide-icon { color: var(--clr-primary); flex-shrink: 0; }

    .withdraw-card {
      padding: 22px 24px; margin-bottom: 24px; border: 1px solid var(--clr-border);
      border-radius: var(--radius-lg); background: var(--clr-bg-card);
    }
    .withdraw-header {
      display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px;
      h3 { font-size: 17px; font-weight: 700; margin: 0; }
      lucide-icon { color: var(--clr-primary); flex-shrink: 0; margin-top: 2px; }
    }
    .withdraw-sub { font-size: 12px; color: var(--clr-text-muted); margin: 4px 0 0; }
    .available-line { font-size: 14px; color: var(--clr-text-muted); margin-bottom: 16px; }
    .available-line strong { color: var(--clr-text); }
    .withdraw-form { display: grid; gap: 14px; max-width: 360px; }
    .withdraw-form .field label {
      display: block; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .04em; color: var(--clr-text-muted); margin-bottom: 6px;
    }
    .withdraw-form .field input {
      width: 100%; padding: 12px 14px; border-radius: var(--radius-md);
      border: 1px solid var(--clr-border); background: var(--clr-bg-elevated);
      color: var(--clr-text); font-size: 15px;
      &:focus { outline: none; border-color: var(--clr-primary); }
    }
    .withdraw-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; }

    .table-card { padding: 0; overflow: hidden; box-shadow: var(--shadow-card); }
    .table-header {
      padding: 24px; border-bottom: 1px solid var(--clr-border);
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;
      h3 { font-size: 16px; font-weight: 700; }
    }
    .filter-btns {
      display: flex; gap: 8px;
    }
    .filter-btn {
      padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
      color: var(--clr-text-muted); border: 1px solid var(--clr-border);
      cursor: pointer; transition: all 0.2s; background: none;
    }
    .filter-btn:hover { border-color: var(--clr-primary); color: var(--clr-primary); }
    .filter-btn.active { background: var(--clr-primary); color: #fff; border-color: var(--clr-primary); }

    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 16px 24px; text-align: left; font-size: 11px; font-weight: 700; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 0.5px; background: var(--clr-bg-elevated); }
    td { padding: 16px 24px; border-bottom: 1px solid var(--clr-border); font-size: 14px; }
    tr:last-child td { border-bottom: none; }

    .type-tag {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
      border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      background: rgba(64, 138, 113, 0.12); color: var(--clr-primary);
      &.ride { background: rgba(59, 130, 246, 0.12); color: var(--clr-info); }
    }

    .route-text { font-weight: 500; color: var(--clr-text); }
    .font-bold { font-weight: 700; }
    .text-success { color: var(--clr-success); }
    .status-pill {
      padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
      &.success { background: rgba(34, 197, 94, 0.15); color: var(--clr-success); }
    }

    .empty-state { padding: 60px; text-align: center; color: var(--clr-text-muted); }
    .empty-state p { margin-top: 16px; font-size: 14px; }
    .empty-state .muted { opacity: 0.3; }

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
  private readonly ridersApi     = inject(RidersApi);
  private readonly toast         = inject(ToastService);

  protected readonly loading  = signal(true);
  protected readonly rides    = signal<Ride[]>([]);
  protected readonly parcels  = signal<Parcel[]>([]);
  protected readonly rideTotalCount = signal(0);
  protected readonly parcelTotalCount = signal(0);
  protected readonly profileTotalEarnings = signal(0);
  protected readonly withdrawing = signal(false);

  withdrawAmount: number | null = null;
  withdrawPhone = '';

  protected readonly availableBalance = computed(() =>
    Math.floor(this.profileTotalEarnings()),
  );

  protected readonly combinedTransactions = computed(() => {
    const rideTx = this.rides().map(r => ({
      id: r.id,
      isRide: true,
      label: `${r.pickupAddress.split(',')[0]} → ${r.dropoffAddress.split(',')[0]}`,
      gross: r.finalFare ?? r.estimatedFare,
      net: (r.finalFare ?? r.estimatedFare) * 0.85,
      date: r.completedAt ?? r.createdAt
    }));

    const parcelTx = this.parcels().map(p => ({
      id: p.id,
      isRide: false,
      label: p.itemDescription,
      gross: p.deliveryFee,
      net: p.deliveryFee * 0.85,
      date: p.deliveredAt ?? p.createdAt
    }));

    return [...rideTx, ...parcelTx].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  });

  protected readonly grossEarnings   = computed(() =>
    this.rides().reduce((s, r) => s + (r.finalFare ?? r.estimatedFare), 0) +
    this.parcels().reduce((s, p) => s + p.deliveryFee, 0),
  );

  async ngOnInit(): Promise<void> {
    try {
      const [rides, parcels, profile] = await Promise.all([
        this.loadAllCompletedRides(),
        this.loadAllDeliveredParcels(),
        this.ridersApi.getMyProfile().catch(() => null),
      ]);
      this.rides.set(rides.items);
      this.parcels.set(parcels.items);
      this.rideTotalCount.set(rides.total);
      this.parcelTotalCount.set(parcels.total);
      if (profile) {
        this.profileTotalEarnings.set(profile.totalEarnings ?? 0);
        this.withdrawPhone = profile.account?.phone?.trim() ?? '';
      }
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }

  private async refreshBalance(): Promise<void> {
    try {
      const profile = await this.ridersApi.getMyProfile();
      this.profileTotalEarnings.set(profile.totalEarnings ?? 0);
    } catch { /* ignore */ }
  }

  async withdrawToMpesa(): Promise<void> {
    const bal = this.availableBalance();
    const amt = Math.ceil(Number(this.withdrawAmount));
    if (!Number.isFinite(amt) || amt < 10) {
      this.toast.error('Enter an amount of at least KES 10');
      return;
    }
    if (amt > bal) {
      this.toast.error('Amount exceeds your available balance');
      return;
    }
    const phone = (this.withdrawPhone || '').trim();
    if (!phone) {
      this.toast.error('Enter the M-Pesa number that should receive the money');
      return;
    }
    this.withdrawing.set(true);
    try {
      await this.ridersApi.requestPayout(amt, 'MPESA', phone);
      this.toast.success('Withdrawal sent. Check your M-Pesa shortly.');
      this.withdrawAmount = null;
      await this.refreshBalance();
    } catch {
      /* error toast from interceptor */
    } finally {
      this.withdrawing.set(false);
    }
  }

  private async loadAllCompletedRides(): Promise<{ items: Ride[]; total: number }> {
    const first = await this.rideService.getRiderHistory(1, 50, 'COMPLETED');
    const all = [...first.data];
    if (first.totalPages > 1) {
      for (let p = 2; p <= first.totalPages; p++) {
        const next = await this.rideService.getRiderHistory(p, 50, 'COMPLETED');
        all.push(...next.data);
      }
    }
    return { items: all, total: first.total };
  }

  private async loadAllDeliveredParcels(): Promise<{ items: Parcel[]; total: number }> {
    const first = await this.parcelService.getRiderHistory(1, 50, 'DELIVERED');
    const all = [...first.data];
    if (first.totalPages > 1) {
      for (let p = 2; p <= first.totalPages; p++) {
        const next = await this.parcelService.getRiderHistory(p, 50, 'DELIVERED');
        all.push(...next.data);
      }
    }
    return { items: all, total: first.total };
  }
}
