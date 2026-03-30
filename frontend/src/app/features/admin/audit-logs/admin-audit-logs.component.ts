import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <lucide-icon name="shield-check" [size]="24"></lucide-icon>
          </div>
          <div><h1>Audit Logs</h1><p>Platform security and transaction event history</p></div>
        </div>
        <button class="btn btn--ghost btn--sm" (click)="load()" [disabled]="loading()">
          <lucide-icon name="rotate-cw" [size]="15"></lucide-icon> Refresh
        </button>
      </div>

      @if (loading()) {
        <div class="logs-grid">
          @for (n of [1,2,3,4,5,6,7,8]; track n) {
            <div class="log-card card sk-card">
              <div class="lc-head"><div class="sk-icon sk-pulse"></div><div class="sk-line sk-line--event sk-pulse"></div><div class="sk-line sk-line--id sk-pulse"></div></div>
              <div class="lc-body"><div class="sk-line sk-pulse"></div><div class="sk-line sk-line--sm sk-pulse"></div></div>
              <div class="lc-foot"><div class="sk-line sk-line--id sk-pulse"></div><div class="sk-line sk-line--sm sk-pulse"></div></div>
            </div>
          }
        </div>
      } @else if (logs().length === 0) {
        <div class="empty-state card">
          <lucide-icon name="shield-check" [size]="40"></lucide-icon>
          <h3>No audit logs yet</h3>
          <p>Security and payment events will be logged here as they occur.</p>
        </div>
      } @else {
        <div class="logs-grid">
          @for (l of logs(); track l.id) {
            <div class="log-card card" [class.log-card--error]="isError(l.event)">
              <!-- Head: icon + event name + context ID -->
              <div class="lc-head">
                <div class="event-icon-wrap" [class.event-icon--error]="isError(l.event)" [class.event-icon--ok]="isOk(l.event)">
                  <lucide-icon [name]="eventIcon(l.event)" [size]="16"></lucide-icon>
                </div>
                <div class="lc-head-text">
                  <span class="event-name">{{ l.event }}</span>
                  @if (l.paymentId) {
                    <span class="context-id">Pmt: {{ l.paymentId.slice(0,8) }}</span>
                  }
                </div>
              </div>

              <!-- Body: details -->
              @if (l.details) {
                <div class="lc-body">
                  <lucide-icon name="info" [size]="12" class="body-icon"></lucide-icon>
                  <span class="lc-details">{{ l.details }}</span>
                </div>
              }

              <!-- Footer: IP + timestamp -->
              <div class="lc-foot">
                @if (l.ipAddress) {
                  <span class="lc-ip">
                    <lucide-icon name="globe" [size]="11"></lucide-icon>
                    {{ l.ipAddress }}
                  </span>
                }
                <span class="lc-date">{{ l.createdAt | date:'dd MMM, HH:mm' }}</span>
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
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 60px 24px; text-align: center; color: var(--clr-text-muted);
      box-shadow: var(--shadow-card);
    }
    .empty-state h3 { margin: 0; font-size: 18px; color: var(--clr-text); }
    .empty-state p { margin: 0; font-size: 14px; }

    /* Grid */
    .logs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .log-card {
      padding: 14px; display: flex; flex-direction: column; gap: 10px;
      box-shadow: var(--shadow-card); transition: transform 0.12s;
      border-left: 3px solid var(--clr-border);
    }
    .log-card:hover { transform: translateY(-1px); }
    .log-card--error { border-left-color: var(--clr-error); }

    /* Head */
    .lc-head { display: flex; align-items: flex-start; gap: 10px; }
    .event-icon-wrap {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--clr-bg-elevated); color: var(--clr-text-muted);
      border: 1px solid var(--clr-border);
    }
    .event-icon--error { background: rgba(239,68,68,.1); color: var(--clr-error); border-color: rgba(239,68,68,.2); }
    .event-icon--ok    { background: rgba(34,197,94,.1);  color: var(--clr-success); border-color: rgba(34,197,94,.2); }
    .lc-head-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .event-name {
      font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
      color: var(--clr-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .context-id { font-size: 10px; font-family: var(--font-mono, monospace); color: var(--clr-text-muted); }

    /* Body */
    .lc-body { display: flex; align-items: flex-start; gap: 6px; }
    .body-icon { color: var(--clr-text-muted); flex-shrink: 0; margin-top: 1px; }
    .lc-details {
      font-size: 12px; color: var(--clr-text-muted); line-height: 1.4;
      overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }

    /* Footer */
    .lc-foot { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--clr-border); padding-top: 8px; }
    .lc-ip { display: flex; align-items: center; gap: 4px; font-size: 11px; font-family: var(--font-mono, monospace); color: var(--clr-text-muted); }
    .lc-date { font-size: 11px; color: var(--clr-text-muted); }

    /* Skeleton */
    .sk-card { pointer-events: none; }
    @keyframes sk-shimmer { 0%{opacity:1}50%{opacity:.4}100%{opacity:1} }
    .sk-pulse { animation: sk-shimmer 1.4s ease-in-out infinite; background: var(--clr-bg-elevated); border-radius: 6px; }
    .sk-icon { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; }
    .sk-line { height: 11px; border-radius: 4px; width: 75%; }
    .sk-line--event { width: 55%; height: 13px; }
    .sk-line--id  { width: 35%; }
    .sk-line--sm  { width: 50%; }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 8px; }
    .page-info { font-size: 14px; color: var(--clr-text-muted); }
    .page-info strong { color: var(--clr-text); }
  `],
})
export class AdminAuditLogsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  protected readonly logs       = signal<any[]>([]);
  protected readonly loading    = signal(true);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.adminService.listAuditLogs(this.page(), 25);
      this.logs.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch { /* Silent */ } finally {
      this.loading.set(false);
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  protected isError(event: string): boolean {
    return /fail|error|suspicious|block|reject|unauthori/i.test(event);
  }

  protected isOk(event: string): boolean {
    return /success|complet|verif|approv|creat/i.test(event);
  }

  protected eventIcon(event: string): string {
    if (/payment|mpesa|cash/i.test(event))       return 'credit-card';
    if (/login|auth|token/i.test(event))          return 'log-in';
    if (/suspend|block|ban/i.test(event))         return 'user-x';
    if (/verif|approv/i.test(event))              return 'shield-check';
    if (/fail|error|reject/i.test(event))         return 'alert-circle';
    if (/suspicious/i.test(event))                return 'alert-triangle';
    if (/ride/i.test(event))                      return 'bike';
    if (/parcel|deliver/i.test(event))            return 'package';
    if (/user|account|register/i.test(event))     return 'user';
    return 'activity';
  }
}
