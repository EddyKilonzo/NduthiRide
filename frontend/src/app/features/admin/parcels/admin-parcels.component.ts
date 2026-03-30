import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import type { Parcel } from '../../../core/models/parcel.models';

@Component({
  selector: 'app-admin-parcels',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon"><lucide-icon name="package" [size]="24"></lucide-icon></div>
          <div><h1>Parcels</h1><p>All delivery bookings on the platform</p></div>
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
              <option value="PICKED_UP">Picked Up</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
        <span class="filter-count">{{ parcels().length }} parcels</span>
      </div>

      @if (loading()) {
        <div class="parcels-grid">
          @for (n of [1,2,3,4,5,6]; track n) {
            <div class="parcel-card card sk-card">
              <div class="card-head"><div class="sk-line sk-line--id sk-pulse"></div><div class="sk-badge sk-pulse"></div></div>
              <div class="parcel-details"><div class="sk-line sk-pulse"></div><div class="sk-line sk-line--sm sk-pulse"></div><div class="sk-line sk-pulse"></div></div>
              <div class="card-foot" style="border-top:1px solid var(--clr-border);padding-top:10px"><div class="sk-line sk-line--sm sk-pulse"></div><div class="sk-line sk-line--id sk-pulse"></div></div>
            </div>
          }
        </div>
      } @else if (loadError()) {
        <div class="empty-state card">
          <lucide-icon name="wifi-off" [size]="40"></lucide-icon>
          <h3>Failed to load parcels</h3>
          <p>There was a problem fetching data. Please try again.</p>
          <button class="btn btn--primary btn--sm" (click)="load()">Retry</button>
        </div>
      } @else if (parcels().length === 0) {
        <div class="empty-state card">
          <lucide-icon name="package" [size]="40"></lucide-icon>
          <h3>No parcels found</h3>
          <p>No delivery records match your current filters.</p>
          <button class="btn btn--secondary btn--sm" (click)="statusFilter = ''; load()">Clear Filters</button>
        </div>
      } @else {
        <div class="parcels-grid">
          @for (p of parcels(); track p.id) {
            <div class="parcel-card card">
              <div class="card-head">
                <span class="item-id">{{ p.id.slice(0,8) }}</span>
                <span class="badge badge--{{ badge(p.status) }}">{{ p.status | titlecase }}</span>
              </div>
              <div class="parcel-details">
                <div class="detail-row">
                  <lucide-icon name="package" [size]="13" class="detail-icon"></lucide-icon>
                  <span class="detail-text">{{ p.itemDescription }}</span>
                </div>
                <div class="detail-row">
                  <lucide-icon name="user" [size]="13" class="detail-icon"></lucide-icon>
                  <span class="detail-text">{{ p.recipientName }}</span>
                </div>
                @if (p.recipientPhone) {
                  <div class="detail-row">
                    <lucide-icon name="phone" [size]="13" class="detail-icon"></lucide-icon>
                    <span class="detail-text">{{ p.recipientPhone }}</span>
                  </div>
                }
              </div>
              <div class="card-foot">
                <strong class="fare">KES {{ p.deliveryFee | number:'1.0-0' }}</strong>
                <span class="date">{{ p.createdAt | date:'dd MMM, HH:mm' }}</span>
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

    .parcels-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .parcel-card {
      padding: 16px; display: flex; flex-direction: column; gap: 12px;
      box-shadow: var(--shadow-card); transition: transform 0.15s, box-shadow 0.15s;
    }
    .parcel-card:hover { transform: translateY(-2px); }
    .card-head { display: flex; align-items: center; justify-content: space-between; }
    .item-id { font-size: 11px; font-family: var(--font-mono, monospace); color: var(--clr-text-muted); }
    .parcel-details { display: flex; flex-direction: column; gap: 6px; }
    .detail-row { display: flex; align-items: center; gap: 7px; }
    .detail-icon { color: var(--clr-text-muted); flex-shrink: 0; }
    .detail-text { font-size: 13px; color: var(--clr-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
    .sk-line--sm { width: 55%; }
    .sk-badge { width: 60px; height: 22px; border-radius: 99px; }
  `],
})
export class AdminParcelsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  protected readonly parcels    = signal<Parcel[]>([]);
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
      const res = await this.adminService.listParcels(this.page(), 20, this.statusFilter || undefined);
      this.parcels.set(res.data);
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
    const m: Record<string, string> = {
      DELIVERED: 'active', CANCELLED: 'closed', IN_TRANSIT: 'info',
      PENDING: 'pending', ACCEPTED: 'info', PICKED_UP: 'info',
    };
    return m[status] ?? 'info';
  }
}
