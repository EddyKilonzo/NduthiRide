import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService }  from '../../../core/services/toast.service';
@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon"><lucide-icon name="users" [size]="24"></lucide-icon></div>
          <div><h1>Accounts</h1><p>Manage users, riders, and platform admins</p></div>
        </div>
        <button class="btn btn--ghost btn--sm" (click)="load()" [disabled]="loading()">
          <lucide-icon name="rotate-cw" [size]="15"></lucide-icon> Refresh
        </button>
      </div>

      <div class="filters card">
        <div class="filter-group">
          <label>Role</label>
          <div class="select-wrapper">
            <lucide-icon name="user-cog" [size]="15" class="select-icon"></lucide-icon>
            <select [(ngModel)]="roleFilter" (change)="resetAndLoad()">
              <option value="">All Roles</option>
              <option value="USER">Users</option>
              <option value="RIDER">Riders</option>
              <option value="ADMIN">Admins</option>
            </select>
          </div>
        </div>
        <div class="filter-group">
          <label>Status</label>
          <div class="select-wrapper">
            <lucide-icon name="shield" [size]="15" class="select-icon"></lucide-icon>
            <select [(ngModel)]="statusFilter" (change)="resetAndLoad()">
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Suspended</option>
            </select>
          </div>
        </div>
        <span class="filter-count">{{ loading() ? '…' : accounts().length + ' accounts' }}</span>
      </div>

      @if (error()) {
        <div class="error-state card">
          <lucide-icon name="circle-x" [size]="40"></lucide-icon>
          <h3>Oops! Something went wrong</h3>
          <p>{{ error() }}</p>
          <button class="btn btn--primary btn--sm" (click)="load()">Try Again</button>
        </div>
      } @else if (loading()) {
        <!-- Skeleton cards — shown immediately while data loads -->
        <div class="accounts-grid">
          @for (n of skeletons; track n) {
            <div class="account-card card sk-card">
              <div class="ac-head">
                <div class="sk-avatar sk-pulse"></div>
                <div class="ac-info">
                  <div class="sk-line sk-line--name sk-pulse"></div>
                  <div class="sk-line sk-line--id sk-pulse"></div>
                </div>
                <div class="sk-badge sk-pulse"></div>
              </div>
              <div class="ac-contact">
                <div class="sk-line sk-pulse"></div>
                <div class="sk-line sk-line--sm sk-pulse"></div>
              </div>
              <div class="ac-footer">
                <div class="sk-line sk-line--sm sk-pulse"></div>
                <div class="sk-actions sk-pulse"></div>
              </div>
            </div>
          }
        </div>
      } @else if (accounts().length === 0) {
        <div class="empty-state card">
          <lucide-icon name="users" [size]="40"></lucide-icon>
          <h3>No accounts found</h3>
          <p>No accounts match your current filters.</p>
          <button class="btn btn--secondary btn--sm" (click)="roleFilter = ''; statusFilter = ''; load()">Clear Filters</button>
        </div>
      } @else {
        <div class="accounts-grid">
        @for (a of accounts(); track a.id) {
          <div class="account-card card">
            <!-- Head -->
            <div class="ac-head">
              <div class="ac-avatar">{{ (a.fullName || '?').charAt(0).toUpperCase() }}</div>
              <div class="ac-info">
                <div class="ac-name">{{ a.fullName || 'No Name' }}</div>
                <div class="ac-id">{{ (a.id || '').slice(0,8) }}</div>
              </div>
              <span class="badge badge--{{ roleBadge(a.role) }}">{{ a.role }}</span>
            </div>

              <!-- Contact -->
              <div class="ac-contact">
                @if (a.phone) {
                  <div class="contact-row">
                    <lucide-icon name="phone" [size]="13"></lucide-icon>
                    <span>{{ a.phone }}</span>
                  </div>
                }
                @if (a.email) {
                  <div class="contact-row">
                    <lucide-icon name="mail" [size]="13"></lucide-icon>
                    <span class="contact-email">{{ a.email }}</span>
                  </div>
                }
                @if (!a.phone && !a.email) {
                  <div class="contact-row contact-row--muted">
                    <lucide-icon name="info" [size]="13"></lucide-icon>
                    <span>No contact info</span>
                  </div>
                }
              </div>
              <!-- Footer -->
              <div class="ac-footer">
                <div class="ac-statuses">
                  <span class="status-dot" [class.status-dot--active]="a.isActive">
                    {{ a.isActive ? 'Active' : 'Suspended' }}
                  </span>
                  @if (a.role === 'RIDER') {
                    <span class="verif-badge" [class.verif-badge--ok]="a.rider?.isVerified">
                      <lucide-icon [name]="a.rider?.isVerified ? 'check-circle' : 'clock'" [size]="11"></lucide-icon>
                      {{ a.rider?.isVerified ? 'Verified' : 'Pending' }}
                    </span>
                  }
                </div>
                <div class="ac-actions">
                  @if (a.role === 'RIDER') {
                    <button class="ac-btn" title="Review Details & Documents" (click)="viewDocs(a)">
                      <lucide-icon name="file-search" [size]="15"></lucide-icon>
                    </button>
                    <button class="ac-btn" [class.ac-btn--success]="!a.rider?.isVerified" [class.ac-btn--warn]="a.rider?.isVerified"
                            [title]="a.rider?.isVerified ? 'Revoke Verification' : 'Verify Rider'" (click)="toggleVerification(a)">
                      <lucide-icon [name]="a.rider?.isVerified ? 'shield-off' : 'shield-check'" [size]="15"></lucide-icon>
                    </button>
                  }
                  <button class="ac-btn" [class.ac-btn--danger]="a.isActive" [class.ac-btn--success]="!a.isActive"
                          [title]="a.isActive ? 'Suspend Account' : 'Activate Account'"
                          (click)="toggleStatus(a)" [disabled]="a.role === 'ADMIN'">
                    <lucide-icon [name]="a.isActive ? 'user-x' : 'user-check'" [size]="15"></lucide-icon>
                  </button>
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

    <!-- Rider Detail & Document Modal -->
    @if (selectedRider(); as r) {
      <div class="modal-overlay" (click)="selectedRider.set(null)">
        <div class="rider-modal" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <div class="modal-title-row">
              <div class="modal-avatar">{{ r.fullName.charAt(0).toUpperCase() }}</div>
              <div>
                <h3>{{ r.fullName }}</h3>
                <p class="modal-sub">{{ r.phone ?? 'No phone' }}@if (r.email) { &nbsp;·&nbsp;{{ r.email }} }</p>
              </div>
            </div>
            <button class="btn-close" (click)="selectedRider.set(null)">
              <lucide-icon name="x" [size]="20"></lucide-icon>
            </button>
          </header>

          <div class="modal-body">
            <!-- Rider profile fields -->
            <div class="profile-grid">
              <div class="profile-field">
                <span class="pf-label">Licence Number</span>
                <span class="pf-value">{{ r.rider?.licenseNumber || '—' }}</span>
              </div>
              <div class="profile-field">
                <span class="pf-label">Number Plate</span>
                <span class="pf-value">{{ r.rider?.bikeRegistration || '—' }}</span>
              </div>
              <div class="profile-field">
                <span class="pf-label">Bike Model</span>
                <span class="pf-value">{{ r.rider?.bikeModel || '—' }}</span>
              </div>
              <div class="profile-field">
                <span class="pf-label">Verification Status</span>
                <span class="pf-value">
                  <span class="verif-badge" [class.verif-badge--ok]="r.rider?.isVerified">
                    <lucide-icon [name]="r.rider?.isVerified ? 'check-circle' : 'clock'" [size]="12"></lucide-icon>
                    {{ r.rider?.isVerified ? 'Verified' : 'Pending Review' }}
                  </span>
                </span>
              </div>
              <div class="profile-field">
                <span class="pf-label">Total Rides</span>
                <span class="pf-value">{{ r.rider?.totalRides ?? 0 }}</span>
              </div>
              <div class="profile-field">
                <span class="pf-label">Rating</span>
                <span class="pf-value">{{ r.rider?.ratingAverage ? (r.rider.ratingAverage | number:'1.1-1') + ' ★' : '—' }}</span>
              </div>
            </div>

            <!-- Documents -->
            <h4 class="doc-section-title">
              <lucide-icon name="file-text" [size]="15"></lucide-icon>
              Verification Documents
            </h4>
            <div class="doc-grid">
              @for (doc of docItems(r); track doc.label) {
                <div class="doc-item">
                  <span class="doc-label">{{ doc.label }}</span>
                  @if (doc.url) {
                    <div class="doc-img-wrap" (click)="openLightbox(doc.url)">
                      <img [src]="doc.url" [alt]="doc.label" />
                      <div class="doc-img-overlay">
                        <lucide-icon name="zoom-in" [size]="20"></lucide-icon>
                      </div>
                    </div>
                  } @else {
                    <div class="doc-missing">
                      <lucide-icon name="image-off" [size]="24"></lucide-icon>
                      <span>Not uploaded</span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <footer class="modal-footer">
            <button class="btn btn--secondary" (click)="selectedRider.set(null)">Close</button>
            <button class="btn" [class.btn--primary]="!r.rider?.isVerified" [class.btn--danger]="r.rider?.isVerified"
                    (click)="toggleVerification(r); selectedRider.set(null)">
              <lucide-icon [name]="r.rider?.isVerified ? 'shield-off' : 'shield-check'" [size]="16"></lucide-icon>
              {{ r.rider?.isVerified ? 'Revoke Verification' : 'Approve & Verify Rider' }}
            </button>
          </footer>
        </div>
      </div>
    }

    <!-- Lightbox -->
    @if (lightboxUrl()) {
      <div class="lightbox-bg" (click)="lightboxUrl.set(null)">
        <button class="lightbox-close" (click)="lightboxUrl.set(null)">
          <lucide-icon name="x" [size]="22"></lucide-icon>
        </button>
        <img [src]="lightboxUrl()!" class="lightbox-img" alt="Document" (click)="$event.stopPropagation()" />
      </div>
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

    .error-state {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 60px 24px; text-align: center; color: var(--clr-error);
      box-shadow: var(--shadow-card);
    }
    .error-state h3 { margin: 0; font-size: 18px; color: var(--clr-text); }
    .error-state p { margin: 0; font-size: 14px; color: var(--clr-text-muted); }

    /* Account cards grid */
    .accounts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .account-card {
      padding: 16px; display: flex; flex-direction: column; gap: 12px;
      box-shadow: var(--shadow-card); transition: transform 0.15s;
    }
    .account-card:hover { transform: translateY(-2px); }

    /* Skeleton */
    .sk-card { pointer-events: none; }
    @keyframes sk-shimmer {
      0%   { opacity: 1; }
      50%  { opacity: 0.4; }
      100% { opacity: 1; }
    }
    .sk-pulse { animation: sk-shimmer 1.4s ease-in-out infinite; background: var(--clr-bg-elevated); border-radius: 6px; }
    .sk-avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
    .sk-line { height: 12px; border-radius: 4px; }
    .sk-line--name { width: 65%; height: 14px; }
    .sk-line--id   { width: 40%; height: 10px; margin-top: 5px; }
    .sk-line--sm   { width: 50%; }
    .sk-badge { width: 54px; height: 22px; border-radius: 99px; }
    .sk-actions { width: 64px; height: 28px; border-radius: 6px; }

    /* Head */
    .ac-head { display: flex; align-items: center; gap: 10px; }
    .ac-avatar {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      background: rgba(64,138,113,.12); color: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 700; border: 1px solid var(--clr-border);
    }
    .ac-info { flex: 1; min-width: 0; }
    .ac-name { font-size: 14px; font-weight: 600; color: var(--clr-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ac-id { font-size: 11px; font-family: var(--font-mono, monospace); color: var(--clr-text-muted); }

    /* Contact */
    .ac-contact { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-top: 1px solid var(--clr-border); border-bottom: 1px solid var(--clr-border); min-height: 40px; }
    .contact-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--clr-text-muted); }
    .contact-row lucide-icon { flex-shrink: 0; }
    .contact-email { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .contact-row--muted { opacity: 0.55; font-style: italic; }

    /* Footer */
    .ac-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .ac-statuses { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .status-dot {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; font-weight: 600; color: var(--clr-error);
    }
    .status-dot::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .status-dot--active { color: var(--clr-success); }
    .verif-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600; padding: 2px 7px;
      border-radius: 99px; background: rgba(245,158,11,.12); color: #d97706;
    }
    .verif-badge--ok { background: rgba(34,197,94,.12); color: var(--clr-success); }
    .ac-actions { display: flex; align-items: center; gap: 4px; }
    .ac-btn {
      width: 32px; height: 32px; border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      background: var(--clr-bg-elevated); border: 1px solid var(--clr-border);
      color: var(--clr-text-muted); cursor: pointer; transition: all 0.15s;
    }
    .ac-btn:hover:not(:disabled) { border-color: var(--clr-primary); color: var(--clr-primary); }
    .ac-btn--success:hover { border-color: var(--clr-success) !important; color: var(--clr-success) !important; background: rgba(34,197,94,.1) !important; }
    .ac-btn--warn:hover { border-color: #d97706 !important; color: #d97706 !important; background: rgba(245,158,11,.1) !important; }
    .ac-btn--danger:hover { border-color: var(--clr-error) !important; color: var(--clr-error) !important; background: rgba(239,68,68,.1) !important; }
    .ac-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    .pagination { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 8px; }
    .page-info { font-size: 14px; color: var(--clr-text-muted); }
    .page-info strong { color: var(--clr-text); }

    /* Rider Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.65); backdrop-filter: blur(4px);
      z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .rider-modal {
      background: var(--clr-bg-card); border: 1px solid var(--clr-border);
      border-radius: var(--radius-lg); width: 100%; max-width: 760px;
      max-height: 90vh; display: flex; flex-direction: column;
      box-shadow: 0 24px 60px rgba(0,0,0,0.25);
      animation: slideUp 0.22s ease;
    }
    .modal-header {
      padding: 20px 24px; border-bottom: 1px solid var(--clr-border);
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
    }
    .modal-title-row { display: flex; align-items: center; gap: 14px; }
    .modal-avatar {
      width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
      background: rgba(64,138,113,.15); color: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; font-weight: 700; border: 2px solid var(--clr-border);
    }
    .modal-header h3 { margin: 0; font-size: 18px; font-weight: 700; }
    .modal-sub { margin: 4px 0 0; font-size: 13px; color: var(--clr-text-muted); }
    .btn-close {
      background: none; border: none; cursor: pointer; padding: 4px;
      color: var(--clr-text-muted); border-radius: 6px; transition: all 0.15s;
    }
    .btn-close:hover { background: var(--clr-bg-elevated); color: var(--clr-text); }
    .modal-body { overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }

    /* Profile fields */
    .profile-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
      background: var(--clr-bg-elevated); border-radius: var(--radius-md);
      border: 1px solid var(--clr-border); padding: 16px;
    }
    .profile-field { display: flex; flex-direction: column; gap: 3px; }
    .pf-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--clr-text-muted); }
    .pf-value { font-size: 14px; font-weight: 600; color: var(--clr-text); }

    /* Documents */
    .doc-section-title {
      font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
      color: var(--clr-text-muted); margin: 0; display: flex; align-items: center; gap: 7px;
    }
    .doc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .doc-item { display: flex; flex-direction: column; gap: 7px; }
    .doc-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--clr-text-muted); }
    .doc-img-wrap {
      position: relative; width: 100%; aspect-ratio: 3/2;
      background: var(--clr-bg-elevated); border-radius: var(--radius-md);
      border: 1px solid var(--clr-border); overflow: hidden; cursor: pointer;
    }
    .doc-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.2s; }
    .doc-img-wrap:hover img { transform: scale(1.03); }
    .doc-img-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0);
      display: flex; align-items: center; justify-content: center;
      color: #fff; transition: background 0.2s;
    }
    .doc-img-wrap:hover .doc-img-overlay { background: rgba(0,0,0,0.35); }
    .doc-missing {
      width: 100%; aspect-ratio: 3/2;
      background: var(--clr-bg-elevated); border: 2px dashed var(--clr-border);
      border-radius: var(--radius-md);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; color: var(--clr-text-muted); font-size: 12px;
    }

    .modal-footer {
      padding: 16px 24px; border-top: 1px solid var(--clr-border);
      display: flex; justify-content: flex-end; gap: 12px;
    }

    /* Lightbox */
    .lightbox-bg {
      position: fixed; inset: 0; background: rgba(0,0,0,.88);
      z-index: 2000; display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.15s ease;
    }
    .lightbox-close {
      position: fixed; top: 20px; right: 24px;
      background: rgba(255,255,255,.15); border: none; border-radius: 8px;
      color: #fff; padding: 7px 10px; cursor: pointer; display: flex;
      transition: background 0.15s;
    }
    .lightbox-close:hover { background: rgba(255,255,255,.28); }
    .lightbox-img {
      max-width: 90vw; max-height: 88vh;
      border-radius: 10px; object-fit: contain;
      box-shadow: 0 24px 60px rgba(0,0,0,.5);
    }

    @media (max-width: 600px) {
      .doc-grid { grid-template-columns: 1fr; }
      .profile-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `],
})
export class AdminAccountsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast        = inject(ToastService);

  protected readonly accounts      = signal<any[]>([]);
  protected readonly loading       = signal(true);
  protected readonly error         = signal<string | null>(null);
  private loadAttempt = 0;
  protected readonly page          = signal(1);
  protected readonly totalPages    = signal(1);
  protected readonly selectedRider = signal<any | null>(null);
  protected readonly lightboxUrl   = signal<string | null>(null);

  protected readonly skeletons = [1, 2, 3, 4, 5, 6];

  protected roleFilter   = '';
  protected statusFilter = '';

  async ngOnInit(): Promise<void> { await this.load(); }

  protected resetAndLoad(): void { this.page.set(1); void this.load(); }

  async load(): Promise<void> {
    this.loadAttempt++;
    this.loading.set(true);
    this.error.set(null);
    try {
      const filters: { role?: string; isActive?: boolean } = {};
      if (this.roleFilter)   filters['role']     = this.roleFilter;
      if (this.statusFilter) filters['isActive']  = this.statusFilter === 'true';
      const res = await this.adminService.listAccounts(this.page(), 20, filters);
      this.accounts.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch (err) {
      console.error('Error loading admin accounts', err);
      if (this.loadAttempt < 2) {
        setTimeout(() => void this.load(), 400);
      } else {
        this.error.set('Failed to load accounts. Please check your connection and try again.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async toggleStatus(account: any): Promise<void> {
    try {
      const updated = await this.adminService.setAccountStatus(account.id, !account.isActive);
      this.accounts.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
      this.toast.success(`Account ${updated.isActive ? 'activated' : 'suspended'}`);
    } catch {
      this.toast.error('Action failed');
    }
  }

  async toggleVerification(account: any): Promise<void> {
    const wasVerified = account.rider?.isVerified ?? false;
    try {
      await this.adminService.setRiderVerification(account.id, !wasVerified);
      this.accounts.update((list) =>
        list.map((a) =>
          a.id === account.id
            ? { ...a, rider: { ...a.rider!, isVerified: !wasVerified } }
            : a,
        ),
      );
      this.toast.success(`Rider ${wasVerified ? 'unverified' : 'verified'}`);
    } catch {
      this.toast.error('Verification update failed');
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  protected viewDocs(account: any): void { this.selectedRider.set(account); }
  protected openLightbox(url: string): void { this.lightboxUrl.set(url); }

  protected docItems(a: any): { label: string; url: string | null }[] {
    return [
      { label: 'Driving Licence', url: a.rider?.licenseImageUrl  ?? null },
      { label: 'ID Front',        url: a.rider?.idFrontImageUrl  ?? null },
      { label: 'ID Back',         url: a.rider?.idBackImageUrl   ?? null },
      { label: 'Bike Logbook',    url: a.rider?.logbookImageUrl  ?? null },
    ];
  }

  protected roleBadge(role: string): string {
    const m: Record<string, string> = { USER: 'info', RIDER: 'active', ADMIN: 'pending' };
    return m[role] ?? 'info';
  }
}
