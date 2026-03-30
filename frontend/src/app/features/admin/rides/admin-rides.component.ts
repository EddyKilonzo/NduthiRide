import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import type { Ride } from '../../../core/models/ride.models';

@Component({
  selector: 'app-admin-rides',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
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
            <div class="ride-card card">
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
    .loader-wrap { display: flex; justify-content: center; padding: 80px; }
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
    }
    .ride-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg, var(--shadow-card)); }
    .card-head { display: flex; align-items: center; justify-content: space-between; }
    .item-id { font-size: 11px; font-family: var(--font-mono, monospace); color: var(--clr-text-muted); }
    .route { display: flex; flex-direction: column; gap: 0; }
    .route-row { display: flex; align-items: center; gap: 8px; }
    .route-addr { font-size: 13px; color: var(--clr-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .route-line { width: 2px; height: 14px; background: var(--clr-border); margin-left: 5px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot--pickup { background: var(--clr-primary); }
    .dot--dropoff { background: var(--clr-error, #ef4444); }
    .card-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--clr-border); }
    .fare { font-size: 15px; font-weight: 700; color: var(--clr-text); }
    .date { font-size: 12px; color: var(--clr-text-muted); }

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
  `],
})
export class AdminRidesComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  protected readonly rides      = signal<Ride[]>([]);
  protected readonly loading    = signal(true);
  protected readonly loadError  = signal(false);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);
  protected statusFilter = '';

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

  protected badge(status: string): string {
    const m: Record<string, string> = { COMPLETED: 'active', CANCELLED: 'closed', IN_PROGRESS: 'info', PENDING: 'pending', ACCEPTED: 'info' };
    return m[status] ?? 'info';
  }
}
