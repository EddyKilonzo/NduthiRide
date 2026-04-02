import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride } from '../../../core/models/ride.models';

const RIDE_STATUSES = ['PENDING','ACCEPTED','EN_ROUTE_TO_PICKUP','ARRIVED_AT_PICKUP','IN_PROGRESS','COMPLETED','CANCELLED'];

@Component({
  selector: 'app-admin-rides',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon"><lucide-icon name="bike" [size]="24"></lucide-icon></div>
          <div><h1>Rides</h1><p>All ride bookings on the platform</p></div>
        </div>
        <button class="btn btn--ghost btn--sm" (click)="load()" [disabled]="loading()">
          <lucide-icon name="rotate-cw" [size]="15"></lucide-icon> Refresh
        </button>
      </div>

      <div class="filters card">
        <div class="filter-group">
          <label>Status</label>
          <div class="select-wrapper">
            <lucide-icon name="filter" [size]="15" class="select-icon"></lucide-icon>
            <select [(ngModel)]="statusFilter" (change)="load()">
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
        <span class="filter-count">{{ rides().length }} rides</span>
      </div>

      @if (loading()) {
        <div class="rides-grid">
          @for (n of [1,2,3,4,5,6]; track n) {
            <div class="ride-card card sk-card">
              <div class="card-head"><div class="sk-line sk-line--id sk-pulse"></div><div class="sk-badge sk-pulse"></div></div>
              <div class="route"><div class="sk-line sk-pulse"></div><div class="sk-line sk-line--sm sk-pulse" style="margin:6px 0"></div><div class="sk-line sk-pulse"></div></div>
              <div class="card-foot" style="border-top:1px solid var(--clr-border);padding-top:10px"><div class="sk-line sk-line--sm sk-pulse"></div><div class="sk-line sk-line--id sk-pulse"></div></div>
            </div>
          }
        </div>
      } @else if (loadError()) {
        <div class="empty-state card">
          <lucide-icon name="wifi-off" [size]="40"></lucide-icon>
          <h3>Failed to load rides</h3>
          <p>There was a problem fetching data. Please try again.</p>
          <button class="btn btn--primary btn--sm" (click)="load()">Retry</button>
        </div>
      } @else if (rides().length === 0) {
        <div class="empty-state card">
          <lucide-icon name="bike" [size]="40"></lucide-icon>
          <h3>No rides found</h3>
          <p>No ride records match your current filters.</p>
          <button class="btn btn--secondary btn--sm" (click)="statusFilter = ''; load()">Clear Filters</button>
        </div>
      } @else {
        <div class="rides-grid">
          @for (r of rides(); track r.id) {
            <div class="ride-card card" (click)="openDetail(r.id)" role="button" tabindex="0"
              (keydown.enter)="openDetail(r.id)" (keydown.space)="openDetail(r.id)">
              <div class="card-head">
                <span class="item-id">{{ r.id.slice(0,8) }}</span>
                <span class="badge badge--{{ badge(r.status) }}">{{ r.status | titlecase }}</span>
              </div>
              <div class="route">
                <div class="route-row">
                  <span class="dot dot--pickup"></span>
                  <span class="route-addr">{{ r.pickupAddress }}</span>
                </div>
                <div class="route-line"></div>
                <div class="route-row">
                  <span class="dot dot--dropoff"></span>
                  <span class="route-addr">{{ r.dropoffAddress }}</span>
                </div>
              </div>
              <div class="card-foot">
                <strong class="fare">KES {{ r.estimatedFare | number:'1.0-0' }}</strong>
                <span class="date">{{ r.createdAt | date:'dd MMM, HH:mm' }}</span>
              </div>
              <div class="card-view-hint">
                <lucide-icon name="eye" [size]="13"></lucide-icon> View details
              </div>
            </div>
          }
        </div>
        @if (totalPages() > 1) {
          <div class="pagination">
            <button class="btn btn--secondary btn--sm" (click)="prevPage()" [disabled]="page() === 1">
              <lucide-icon name="chevron-left" [size]="15"></lucide-icon> Prev
            </button>
            <span class="page-info">Page <strong>{{ page() }}</strong> of {{ totalPages() }}</span>
            <button class="btn btn--secondary btn--sm" (click)="nextPage()" [disabled]="page() === totalPages()">
              Next <lucide-icon name="chevron-right" [size]="15"></lucide-icon>
            </button>
          </div>
        }
      }
    </div>

    <!-- Detail / Edit drawer -->
    @if (drawerOpen()) {
      <div class="drawer-backdrop" (click)="closeDrawer()"></div>
      <aside class="drawer">
        <div class="drawer-header">
          <h2 class="drawer-title">Ride Details</h2>
          <button class="btn btn--ghost btn--icon" (click)="closeDrawer()" aria-label="Close">
            <lucide-icon name="x" [size]="20"></lucide-icon>
          </button>
        </div>

        @if (detailLoading()) {
          <div class="drawer-body drawer-loading"><app-spinner /></div>
        } @else if (selected(); as r) {
          <div class="drawer-body">

            <!-- Status badge -->
            <div class="detail-meta">
              <span class="badge badge--{{ badge(r.status) }} badge--lg">{{ r.status }}</span>
              <span class="detail-id">{{ r.id }}</span>
            </div>

            <!-- Route -->
            <section class="detail-section">
              <h4 class="detail-heading">Route</h4>
              <div class="detail-route">
                <div class="route-row"><span class="dot dot--pickup"></span><span>{{ r.pickupAddress }}</span></div>
                <div class="route-line-v"></div>
                <div class="route-row"><span class="dot dot--dropoff"></span><span>{{ r.dropoffAddress }}</span></div>
              </div>
            </section>

            <!-- Fare -->
            <section class="detail-section">
              <h4 class="detail-heading">Fare</h4>
              <div class="detail-row"><span>Estimated</span><strong>KES {{ r.estimatedFare | number:'1.0-0' }}</strong></div>
              @if (r.finalFare) {
                <div class="detail-row"><span>Final</span><strong>KES {{ r.finalFare | number:'1.0-0' }}</strong></div>
              }
              <div class="detail-row"><span>Distance</span><strong>{{ r.distanceKm | number:'1.1-1' }} km</strong></div>
              <div class="detail-row"><span>Payment</span><strong>{{ r.paymentMethod }}</strong></div>
            </section>

            <!-- People -->
            <section class="detail-section">
              <h4 class="detail-heading">Passenger</h4>
              @if (r.user) {
                <div class="detail-row"><span>Name</span><strong>{{ r.user.fullName }}</strong></div>
                <div class="detail-row"><span>Phone</span><strong>{{ r.user.phone }}</strong></div>
              }
            </section>

            @if (r.rider) {
              <section class="detail-section">
                <h4 class="detail-heading">Rider</h4>
                <div class="detail-row"><span>Name</span><strong>{{ r.rider.account.fullName }}</strong></div>
                <div class="detail-row"><span>Phone</span><strong>{{ r.rider.account.phone }}</strong></div>
              </section>
            }

            @if (r.payment) {
              <section class="detail-section">
                <h4 class="detail-heading">Payment</h4>
                <div class="detail-row"><span>Status</span>
                  <span class="badge badge--{{ r.payment.status === 'COMPLETED' ? 'active' : r.payment.status === 'FAILED' ? 'closed' : 'pending' }}">{{ r.payment.status }}</span>
                </div>
                <div class="detail-row"><span>Method</span><strong>{{ r.payment.method }}</strong></div>
                @if (r.payment.mpesaReceiptNumber) {
                  <div class="detail-row"><span>Receipt</span><strong>{{ r.payment.mpesaReceiptNumber }}</strong></div>
                }
              </section>
            }

            <!-- Edit form -->
            <section class="detail-section edit-section">
              <h4 class="detail-heading">Edit Ride</h4>
              <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="edit-form">
                <div class="form-group">
                  <label>Estimated Fare (KES)</label>
                  <input type="number" formControlName="estimatedFare" min="0" />
                </div>
                <div class="form-group">
                  <label>Final Fare (KES)</label>
                  <input type="number" formControlName="finalFare" min="0" placeholder="Leave blank if not finalised" />
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select formControlName="status">
                    @for (s of rideStatuses; track s) {
                      <option [value]="s">{{ s }}</option>
                    }
                  </select>
                </div>
                <button type="submit" class="btn btn--primary btn--full" [disabled]="saving()">
                  @if (saving()) { <app-spinner [size]="16" /> Saving... }
                  @else { <lucide-icon name="save" [size]="16"></lucide-icon> Save Changes }
                </button>
              </form>
            </section>
          </div>
        }
      </aside>
    }
  `,
  styles: [`
    .header-content { display: flex; align-items: center; gap: 14px; }
    .header-icon {
      width: 44px; height: 44px; border-radius: var(--radius-md);
      background: var(--clr-bg-elevated); color: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      box-shadow: var(--shadow-sm);
    }
    .filters {
      display: flex; align-items: flex-end; gap: 20px; flex-wrap: wrap;
      margin-bottom: 24px; padding: 16px 20px; box-shadow: var(--shadow-card);
    }
    .filter-group { display: flex; flex-direction: column; gap: 5px; }
    .filter-group label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--clr-text-muted); }
    .select-wrapper { position: relative; min-width: 180px; }
    .select-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--clr-text-muted); pointer-events: none; }
    .select-wrapper select {
      width: 100%; padding: 9px 12px 9px 34px;
      border: 1px solid var(--clr-border); border-radius: var(--radius-md);
      background: var(--clr-bg-elevated); color: var(--clr-text);
      font-size: 14px; cursor: pointer; appearance: none;
    }
    .filter-count { margin-left: auto; font-size: 13px; color: var(--clr-text-muted); padding-bottom: 2px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 60px 24px; text-align: center; color: var(--clr-text-muted);
      box-shadow: var(--shadow-card);
    }
    .empty-state h3 { margin: 0; font-size: 18px; color: var(--clr-text); }
    .empty-state p { margin: 0; font-size: 14px; }
    .rides-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .ride-card {
      padding: 16px; display: flex; flex-direction: column; gap: 14px;
      box-shadow: var(--shadow-card); transition: transform 0.15s, box-shadow 0.15s;
      cursor: pointer;
    }
    .ride-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg, var(--shadow-card)); }
    .card-head { display: flex; align-items: center; justify-content: space-between; }
    .item-id { font-size: 11px; font-family: var(--font-mono, monospace); color: var(--clr-text-muted); }
    .route { display: flex; flex-direction: column; gap: 0; }
    .route-row { display: flex; align-items: center; gap: 8px; }
    .route-addr { font-size: 13px; color: var(--clr-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .route-line { width: 2px; height: 14px; background: var(--clr-border); margin-left: 5px; }
    .card-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--clr-border); }
    .fare { font-size: 15px; font-weight: 700; color: var(--clr-text); }
    .date { font-size: 12px; color: var(--clr-text-muted); }
    .card-view-hint {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; color: var(--clr-primary-light);
      font-weight: 600; letter-spacing: .02em;
    }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 8px; }
    .page-info { font-size: 14px; color: var(--clr-text-muted); }
    .page-info strong { color: var(--clr-text); }
    .sk-card { pointer-events: none; gap: 12px; }
    @keyframes sk-shimmer { 0%{opacity:1}50%{opacity:.4}100%{opacity:1} }
    .sk-pulse { animation: sk-shimmer 1.4s ease-in-out infinite; background: var(--clr-bg-elevated); border-radius: 6px; }
    .sk-line { height: 12px; border-radius: 4px; width: 80%; }
    .sk-line--id { width: 40%; }
    .sk-line--sm { width: 50%; }
    .sk-badge { width: 60px; height: 22px; border-radius: 99px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot--pickup { background: var(--clr-primary); }
    .dot--dropoff { background: var(--clr-error, #ef4444); }

    /* Drawer */
    .drawer-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200;
      animation: fade-in 0.18s ease;
    }
    @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(480px, 100vw);
      background: var(--clr-bg-card);
      border-left: 1px solid var(--clr-border);
      z-index: 201;
      display: flex; flex-direction: column;
      overflow: hidden;
      animation: slide-in 0.22s cubic-bezier(.4,0,.2,1);
      box-shadow: -8px 0 32px rgba(0,0,0,0.18);
    }
    @keyframes slide-in { from { transform: translateX(100%) } to { transform: translateX(0) } }
    .drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 24px; border-bottom: 1px solid var(--clr-border);
      flex-shrink: 0;
    }
    .drawer-title { font-size: 17px; font-weight: 700; margin: 0; }
    .btn--icon { padding: 6px; border-radius: var(--radius-sm); }
    .drawer-body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 0; }
    .drawer-loading { display: flex; align-items: center; justify-content: center; }
    .detail-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .detail-id { font-size: 11px; font-family: monospace; color: var(--clr-text-muted); }
    .badge--lg { padding: 5px 14px; font-size: 12px; }
    .detail-section { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--clr-border); }
    .detail-section:last-child { border-bottom: none; margin-bottom: 0; }
    .detail-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--clr-text-muted); margin: 0 0 10px; }
    .detail-row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; font-size: 14px; color: var(--clr-text-muted); border-bottom: 1px solid var(--clr-border-subtle, var(--clr-border)); }
    .detail-row:last-child { border-bottom: none; }
    .detail-row strong { color: var(--clr-text); font-weight: 600; }
    .detail-route { display: flex; flex-direction: column; gap: 0; }
    .detail-route .route-row { display: flex; align-items: flex-start; gap: 10px; padding: 4px 0; font-size: 13px; }
    .route-line-v { width: 2px; height: 16px; background: var(--clr-border); margin-left: 4px; }
    .edit-section { background: color-mix(in srgb, var(--clr-primary) 5%, var(--clr-bg-elevated)); border-radius: var(--radius-md); padding: 16px; border: 1px solid color-mix(in srgb, var(--clr-primary) 20%, var(--clr-border)); }
    .edit-form { display: flex; flex-direction: column; gap: 14px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group label { font-size: 12px; font-weight: 600; color: var(--clr-text-muted); }
    .form-group input, .form-group select {
      padding: 9px 12px; border-radius: var(--radius-md);
      border: 1px solid var(--clr-border); background: var(--clr-bg-card);
      color: var(--clr-text); font-size: 14px;
    }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--clr-primary); }
  `],
})
export class AdminRidesComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly rides      = signal<Ride[]>([]);
  protected readonly loading    = signal(true);
  protected readonly loadError  = signal(false);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);
  protected statusFilter = '';

  protected readonly drawerOpen    = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly selected      = signal<Ride | null>(null);
  protected readonly saving        = signal(false);
  protected readonly rideStatuses  = RIDE_STATUSES;

  protected readonly editForm = this.fb.group({
    estimatedFare: [0, [Validators.required, Validators.min(0)]],
    finalFare: [null as number | null],
    status: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const res = await this.adminService.listRides(this.page(), 20, this.statusFilter || undefined);
      this.rides.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  protected async openDetail(id: string): Promise<void> {
    this.drawerOpen.set(true);
    this.selected.set(null);
    this.detailLoading.set(true);
    try {
      const ride = await this.adminService.getRide(id);
      this.selected.set(ride);
      this.editForm.patchValue({
        estimatedFare: ride.estimatedFare,
        finalFare: ride.finalFare ?? null,
        status: ride.status,
      });
    } catch {
      this.toast.error('Could not load ride details');
      this.drawerOpen.set(false);
    } finally {
      this.detailLoading.set(false);
    }
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selected.set(null);
  }

  protected async saveEdit(): Promise<void> {
    const r = this.selected();
    if (!r || this.editForm.invalid) return;
    this.saving.set(true);
    const v = this.editForm.getRawValue();
    try {
      const updated = await this.adminService.updateRide(r.id, {
        estimatedFare: v.estimatedFare ?? undefined,
        finalFare: v.finalFare ?? undefined,
        status: v.status ?? undefined,
      });
      this.selected.set(updated);
      // Refresh list card in place
      this.rides.update((list) => list.map((item) => item.id === updated.id ? { ...item, estimatedFare: updated.estimatedFare, status: updated.status } : item));
      this.toast.success('Ride updated');
    } catch {
      this.toast.error('Failed to save changes');
    } finally {
      this.saving.set(false);
    }
  }

  protected badge(status: string): string {
    const m: Record<string, string> = { COMPLETED: 'active', CANCELLED: 'closed', IN_PROGRESS: 'info', PENDING: 'pending', ACCEPTED: 'info' };
    return m[status] ?? 'info';
  }
}
