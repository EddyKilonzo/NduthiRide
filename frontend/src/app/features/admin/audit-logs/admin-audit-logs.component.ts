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
          <div>
            <h1>Audit Logs</h1>
            <p>Platform security and transaction event history</p>
          </div>
        </div>
        <button class="btn btn--ghost btn--sm" (click)="load()" [disabled]="loading()">
          <lucide-icon name="rotate-cw" [size]="15"></lucide-icon> Refresh
        </button>
      </div>

      @if (loading()) {
        <div class="log-list card">
          @for (n of [1,2,3,4,5,6]; track n) {
            <div class="log-item sk-item">
              <div class="sk-avatar sk-pulse"></div>
              <div class="sk-body">
                <div class="sk-line sk-line--title sk-pulse"></div>
                <div class="sk-line sk-line--sub sk-pulse"></div>
                <div class="sk-line sk-line--foot sk-pulse"></div>
              </div>
            </div>
          }
        </div>
      } @else if (logs().length === 0) {
        <div class="empty-state card">
          <lucide-icon name="shield-check" [size]="40"></lucide-icon>
          <h3>No audit logs yet</h3>
          <p>Security and payment events will appear here as they occur.</p>
        </div>
      } @else {
        <div class="log-list card">
          @for (l of logs(); track l.id; let last = $last) {
            <div class="log-item" [class.log-item--error]="isError(l.action)" [class.log-item--ok]="isOk(l.action)">
              <div class="log-item__track">
                <div class="log-item__icon"
                     [class.icon--error]="isError(l.action)"
                     [class.icon--ok]="isOk(l.action)"
                     [class.icon--warn]="isWarn(l.action)">
                  <lucide-icon [name]="eventIcon(l.action)" [size]="15"></lucide-icon>
                </div>
                @if (!last) { <div class="log-item__line"></div> }
              </div>

              <div class="log-item__content">
                <div class="log-item__row1">
                  <span class="log-item__title">{{ humanizeAction(l.action) }}</span>
                  <span class="log-item__badge" [class]="'badge--' + eventCategory(l.action)">
                    {{ eventCategory(l.action) }}
                  </span>
                  <span class="log-item__time" [title]="l.createdAt | date:'EEEE, MMMM d y, h:mm:ss a'">
                    {{ relativeTime(l.createdAt) }}
                  </span>
                </div>

                @if (eventSummary(l.action, l.details); as summary) {
                  <div class="log-item__summary">{{ summary }}</div>
                }

                <div class="log-item__pills">
                  @if (l.paymentId) {
                    <span class="pill pill--id">
                      <lucide-icon name="hash" [size]="10"></lucide-icon>
                      {{ l.paymentId.slice(0, 8) }}
                    </span>
                  }
                  @for (chip of detailChips(l.details); track chip.label) {
                    <span class="pill">{{ chip.label }}: <strong>{{ chip.value }}</strong></span>
                  }
                </div>

                <div class="log-item__foot">
                  <span class="foot-item">
                    <lucide-icon name="globe" [size]="11"></lucide-icon>
                    {{ formatIp(l.ipAddress) }}
                  </span>
                  <span class="foot-sep">·</span>
                  <span class="foot-item">{{ l.createdAt | date:'dd MMM yyyy, HH:mm:ss' }}</span>
                </div>
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
      box-shadow: var(--shadow-sm); flex-shrink: 0;
    }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 60px 24px; text-align: center; color: var(--clr-text-muted);
      box-shadow: var(--shadow-card);
    }
    .empty-state h3 { margin: 0; font-size: 18px; color: var(--clr-text); }
    .empty-state p  { margin: 0; font-size: 14px; }

    /* ── Log list card ── */
    .log-list {
      box-shadow: var(--shadow-card);
      overflow: hidden;
      margin-bottom: 24px;
    }

    /* ── Log item ── */
    .log-item {
      display: flex; gap: 14px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--clr-border);
      transition: background 0.1s;
    }
    .log-item:last-child { border-bottom: none; }
    .log-item:hover { background: var(--clr-bg-elevated); }
    .log-item--error { border-left: 3px solid var(--clr-error); padding-left: 17px; }
    .log-item--ok    { border-left: 3px solid var(--clr-success); padding-left: 17px; }

    /* ── Track (icon + connector line) ── */
    .log-item__track {
      display: flex; flex-direction: column; align-items: center; gap: 0; flex-shrink: 0;
    }
    .log-item__icon {
      width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--clr-bg-elevated); color: var(--clr-text-muted);
      border: 1px solid var(--clr-border);
    }
    .log-item__line {
      flex: 1; width: 1px; min-height: 12px;
      background: var(--clr-border); margin-top: 4px;
    }
    .icon--error { background: rgba(239,68,68,.1);  color: var(--clr-error);   border-color: rgba(239,68,68,.25); }
    .icon--ok    { background: rgba(34,197,94,.1);  color: var(--clr-success); border-color: rgba(34,197,94,.25); }
    .icon--warn  { background: rgba(234,179,8,.1);  color: #ca8a04;            border-color: rgba(234,179,8,.25); }

    /* ── Content ── */
    .log-item__content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }

    .log-item__row1 {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .log-item__title {
      font-size: 14px; font-weight: 600; color: var(--clr-text); flex-shrink: 0;
    }
    .log-item__badge {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
      padding: 2px 7px; border-radius: 20px;
      background: var(--clr-bg-elevated); color: var(--clr-text-muted);
      border: 1px solid var(--clr-border);
    }
    .badge--payment  { background: rgba(59,130,246,.1);  color: #3b82f6; border-color: rgba(59,130,246,.2); }
    .badge--security { background: rgba(168,85,247,.1);  color: #a855f7; border-color: rgba(168,85,247,.2); }
    .badge--system   { background: rgba(107,114,128,.1); color: #6b7280; border-color: rgba(107,114,128,.2); }
    .badge--ride     { background: rgba(34,197,94,.1);   color: #16a34a; border-color: rgba(34,197,94,.2); }
    .log-item__time {
      margin-left: auto; font-size: 12px; color: var(--clr-text-muted);
      white-space: nowrap; cursor: default;
    }

    /* ── Summary ── */
    .log-item__summary {
      font-size: 13px; color: var(--clr-text-muted); line-height: 1.4;
    }

    /* ── Pills ── */
    .log-item__pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11px; color: var(--clr-text-muted);
      background: var(--clr-bg-elevated); border: 1px solid var(--clr-border);
      padding: 2px 8px; border-radius: 20px;
    }
    .pill strong { color: var(--clr-text); font-weight: 600; }
    .pill--id { font-family: var(--font-mono, monospace); font-size: 11px; }

    /* ── Footer row ── */
    .log-item__foot {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: var(--clr-text-muted);
    }
    .foot-item { display: flex; align-items: center; gap: 3px; }
    .foot-sep  { color: var(--clr-border); }

    /* ── Skeleton ── */
    @keyframes sk-shimmer { 0%{opacity:1}50%{opacity:.4}100%{opacity:1} }
    .sk-pulse { animation: sk-shimmer 1.4s ease-in-out infinite; background: var(--clr-bg-elevated); border-radius: 6px; }
    .sk-item { display: flex; gap: 14px; padding: 16px 20px; border-bottom: 1px solid var(--clr-border); }
    .sk-item:last-child { border-bottom: none; }
    .sk-avatar { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; }
    .sk-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .sk-line { height: 12px; border-radius: 4px; }
    .sk-line--title { width: 40%; height: 14px; }
    .sk-line--sub   { width: 65%; }
    .sk-line--foot  { width: 30%; height: 10px; }

    /* ── Pagination ── */
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
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  // ── Classification ───────────────────────────────────────

  protected isError(action: string): boolean {
    return /fail|error|suspicious|block|reject|unauthori/i.test(action ?? '');
  }

  protected isOk(action: string): boolean {
    return /complet|verif|approv|success/i.test(action ?? '');
  }

  protected isWarn(action: string): boolean {
    return /suspicious|webhook|reconcil/i.test(action ?? '');
  }

  protected eventCategory(action: string): string {
    if (!action) return 'system';
    if (/payment|mpesa|stk|cash|webhook|reconcil/i.test(action)) return 'payment';
    if (/login|auth|token|suspend|block|ban|verif/i.test(action))  return 'security';
    if (/ride/i.test(action))   return 'ride';
    return 'system';
  }

  protected eventIcon(action: string): string {
    if (!action) return 'activity';
    if (/stk|mpesa/i.test(action))             return 'smartphone';
    if (/payment/i.test(action))               return 'credit-card';
    if (/webhook/i.test(action))               return 'webhook';
    if (/reconcil/i.test(action))              return 'bar-chart-2';
    if (/login|auth|token/i.test(action))      return 'log-in';
    if (/suspend|block|ban/i.test(action))     return 'user-x';
    if (/verif|approv/i.test(action))          return 'shield-check';
    if (/fail|error|reject/i.test(action))     return 'alert-circle';
    if (/suspicious/i.test(action))            return 'alert-triangle';
    if (/ride/i.test(action))                  return 'bike';
    if (/parcel|deliver/i.test(action))        return 'package';
    if (/user|account|register/i.test(action)) return 'user';
    return 'activity';
  }

  // ── Human-readable event name ────────────────────────────

  protected humanizeAction(action: string): string {
    if (!action) return 'Unknown Event';
    const map: Record<string, string> = {
      PAYMENT_INITIATED:         'Payment Initiated',
      PAYMENT_COMPLETED:         'Payment Completed',
      PAYMENT_FAILED:            'Payment Failed',
      PAYMENT_INITIATION_FAILED: 'Payment Initiation Failed',
      STK_PUSH_SENT:             'M-Pesa STK Push Sent',
      WEBHOOK_RECEIVED:          'Webhook Received',
      WEBHOOK_PROCESSED:         'Webhook Processed',
      RECONCILIATION_PERFORMED:  'Reconciliation Performed',
    };
    return map[action] ?? action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── One-line event summary ───────────────────────────────

  protected eventSummary(action: string, details: any): string {
    if (!details || typeof details !== 'object') return '';
    const d = details as Record<string, any>;
    const amt   = d['amount']   != null ? `KSh ${Number(d['amount']).toLocaleString()}` : null;
    const meth  = d['method']   ? this.formatMethod(String(d['method']))                : null;
    const phone = d['phoneNumber'] || d['phone']                                        || null;
    const err   = d['error']    || d['errorMessage'] || d['message']                   || null;
    const rec   = d['mpesaReceiptNumber'] || d['receiptNumber']                         || null;
    const stat  = d['status']                                                           || null;

    const parts: string[] = [];
    if (amt)   parts.push(amt);
    if (meth)  parts.push(meth);
    if (phone) parts.push(`to ${phone}`);
    if (rec)   parts.push(`Receipt: ${rec}`);
    if (stat && !amt && !meth) parts.push(`Status: ${stat}`);
    if (err)   parts.push(err);
    return parts.join(' · ');
  }

  // ── Detail chips (key-value pills) ──────────────────────

  protected detailChips(details: any): Array<{ label: string; value: string }> {
    if (!details || typeof details !== 'object') return [];
    const d = details as Record<string, any>;
    const chips: Array<{ label: string; value: string }> = [];
    const shown = new Set<string>();

    const add = (label: string, key: string, fmt?: (v: any) => string) => {
      const v = d[key];
      if (v != null && String(v).trim() !== '' && !shown.has(key)) {
        shown.add(key);
        chips.push({ label, value: fmt ? fmt(v) : String(v) });
      }
    };

    add('Amount',  'amount',             (v) => `KSh ${Number(v).toLocaleString()}`);
    add('Method',  'method',             (v) => this.formatMethod(String(v)));
    add('Status',  'status');
    add('Phone',   'phoneNumber');
    add('Phone',   'phone');
    add('Receipt', 'mpesaReceiptNumber');
    add('Receipt', 'receiptNumber');

    return chips.slice(0, 4);
  }

  // ── Formatters ───────────────────────────────────────────

  protected formatIp(ip: string | null): string {
    if (!ip) return 'Unknown';
    if (ip === '::1' || ip === '127.0.0.1') return 'Localhost';
    if (ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');
    return ip;
  }

  protected relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)   return 'Just now';
    const m = Math.floor(s / 60);
    if (m < 60)   return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)   return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  private formatMethod(method: string): string {
    if (/mpesa/i.test(method)) return 'M-Pesa';
    if (/cash/i.test(method))  return 'Cash';
    return method;
  }
}
