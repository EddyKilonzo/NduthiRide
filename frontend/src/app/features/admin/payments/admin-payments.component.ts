import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import type { Payment } from '../../../core/models/payment.models';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <lucide-icon name="credit-card" [size]="24"></lucide-icon>
          </div>
          <div><h1>Payments</h1><p>M-Pesa and Cash transaction log</p></div>
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
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
        <div class="filter-group">
          <label>Method</label>
          <div class="select-wrapper">
            <lucide-icon name="wallet" [size]="15" class="select-icon"></lucide-icon>
            <select [(ngModel)]="methodFilter" (change)="load()">
              <option value="">All Methods</option>
              <option value="MPESA">M-Pesa</option>
              <option value="CASH">Cash</option>
            </select>
          </div>
        </div>
        <span class="filter-count">{{ loading() ? '…' : payments().length + ' payments' }}</span>
      </div>

      @if (loading()) {
        <div class="payments-grid">
          @for (n of [1,2,3,4,5,6]; track n) {
            <div class="payment-card card sk-card">
              <div class="pc-head"><div class="sk-method sk-pulse"></div><div class="sk-badge sk-pulse"></div></div>
              <div class="pc-amount"><div class="sk-line sk-line--amount sk-pulse"></div></div>
              <div class="pc-meta"><div class="sk-line sk-pulse"></div><div class="sk-line sk-line--sm sk-pulse"></div></div>
              <div class="pc-foot"><div class="sk-line sk-line--id sk-pulse"></div><div class="sk-line sk-line--sm sk-pulse"></div></div>
            </div>
          }
        </div>
      } @else if (payments().length === 0) {
        <div class="empty-state card">
          <lucide-icon name="credit-card" [size]="40"></lucide-icon>
          <h3>No payments found</h3>
          <p>No payment records match your current filters.</p>
          <button class="btn btn--secondary btn--sm" (click)="statusFilter = ''; methodFilter = ''; load()">Clear Filters</button>
        </div>
      } @else {
        <div class="payments-grid">
          @for (p of payments(); track p.id) {
            <div class="payment-card card">
              <!-- Head: method icon + status badge -->
              <div class="pc-head">
                <div class="method-icon-wrap" [class.method-mpesa]="p.method === 'MPESA'" [class.method-cash]="p.method === 'CASH'">
                  <lucide-icon [name]="p.method === 'MPESA' ? 'smartphone' : 'banknote'" [size]="18"></lucide-icon>
                  <span>{{ p.method === 'MPESA' ? 'M-Pesa' : 'Cash' }}</span>
                </div>
                <span class="badge badge--{{ badge(p.status) }}">{{ p.status | titlecase }}</span>
              </div>

              <!-- Amount -->
              <div class="pc-amount">
                <span class="amount-label">Amount</span>
                <strong class="amount-value">KES {{ p.amount | number:'1.0-0' }}</strong>
              </div>

              <!-- M-Pesa details (if applicable) -->
              @if (p.mpesaReceiptNumber || p.mpesaPhone) {
                <div class="pc-meta">
                  @if (p.mpesaReceiptNumber) {
                    <div class="meta-row">
                      <lucide-icon name="receipt" [size]="13"></lucide-icon>
                      <span class="mono">{{ p.mpesaReceiptNumber }}</span>
                    </div>
                  }
                  @if (p.mpesaPhone) {
                    <div class="meta-row">
                      <lucide-icon name="phone" [size]="13"></lucide-icon>
                      <span>{{ p.mpesaPhone }}</span>
                    </div>
                  }
                </div>
              }

              <!-- Footer: ID + date -->
              <div class="pc-foot">
                <span class="mono pc-id">{{ p.id.slice(0,8) }}</span>
                <span class="pc-date">{{ p.createdAt | date:'dd MMM, HH:mm' }}</span>
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
    .select-wrapper { position: relative; min-width: 160px; }
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

    /* Payments grid */
    .payments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .payment-card {
      padding: 16px; display: flex; flex-direction: column; gap: 12px;
      box-shadow: var(--shadow-card); transition: transform 0.15s;
    }
    .payment-card:hover { transform: translateY(-2px); }

    /* Head */
    .pc-head { display: flex; align-items: center; justify-content: space-between; }
    .method-icon-wrap {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 5px 10px; border-radius: var(--radius-md);
      font-size: 12px; font-weight: 700;
    }
    .method-mpesa { background: rgba(34,197,94,.1); color: var(--clr-success); }
    .method-cash  { background: rgba(64,138,113,.1); color: var(--clr-primary); }

    /* Amount */
    .pc-amount { display: flex; flex-direction: column; gap: 2px; }
    .amount-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--clr-text-muted); }
    .amount-value { font-size: 22px; font-weight: 800; color: var(--clr-text); }

    /* Meta */
    .pc-meta { display: flex; flex-direction: column; gap: 5px; padding: 8px 0; border-top: 1px solid var(--clr-border); border-bottom: 1px solid var(--clr-border); }
    .meta-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--clr-text-muted); }
    .meta-row lucide-icon { flex-shrink: 0; }
    .mono { font-family: var(--font-mono, monospace); font-size: 12px; }

    /* Footer */
    .pc-foot { display: flex; align-items: center; justify-content: space-between; }
    .pc-id { font-size: 11px; color: var(--clr-text-muted); }
    .pc-date { font-size: 12px; color: var(--clr-text-muted); }

    /* Skeleton */
    .sk-card { pointer-events: none; }
    @keyframes sk-shimmer { 0%{opacity:1}50%{opacity:.4}100%{opacity:1} }
    .sk-pulse { animation: sk-shimmer 1.4s ease-in-out infinite; background: var(--clr-bg-elevated); border-radius: 6px; }
    .sk-method { width: 90px; height: 28px; border-radius: var(--radius-md); }
    .sk-badge  { width: 70px; height: 22px; border-radius: 99px; }
    .sk-line { height: 12px; border-radius: 4px; width: 80%; }
    .sk-line--amount { height: 22px; width: 60%; }
    .sk-line--sm { width: 50%; }
    .sk-line--id { width: 38%; }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 8px; }
    .page-info { font-size: 14px; color: var(--clr-text-muted); }
    .page-info strong { color: var(--clr-text); }
  `],
})
export class AdminPaymentsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  protected readonly payments   = signal<Payment[]>([]);
  protected readonly loading    = signal(true);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);

  protected statusFilter = '';
  protected methodFilter = '';

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.adminService.listPayments(
        this.page(), 20,
        this.statusFilter || undefined,
        this.methodFilter || undefined,
      );
      this.payments.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  protected badge(status: string): string {
    const m: Record<string, string> = { COMPLETED: 'active', FAILED: 'closed', PROCESSING: 'info', PENDING: 'pending' };
    return m[status] ?? 'info';
  }
}
