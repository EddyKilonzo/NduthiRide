import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import type { AccountProfile } from '../../../core/api/users.api';
import { AccountProfileEditorComponent } from '../../../shared/components/account-profile-editor/account-profile-editor.component';
import { ChangePasswordFormComponent } from '../../../shared/components/change-password-form/change-password-form.component';

@Component({
  selector: 'app-rider-profile',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AccountProfileEditorComponent, ChangePasswordFormComponent],
  template: `
    <div class="rider-profile app-page">
      <header class="page-head">
        <div>
          <h1>My Profile</h1>
          <p>Manage your rider account</p>
        </div>
      </header>

      <div class="profile-grid">
        <div class="panel panel--editor">
          <h3 class="panel-title panel-title--first">
            <lucide-icon name="pencil" [size]="16"></lucide-icon>
            Account &amp; photo
          </h3>
          <app-account-profile-editor (profileLoaded)="onProfileLoaded($event)" />
        </div>

        <div class="profile-aside">
          <div class="panel">
            <h3 class="panel-title">
              <lucide-icon name="user" [size]="16"></lucide-icon>
              Account info
            </h3>
            <div class="info-row"><span>Email</span><strong>{{ auth.user()?.email || '—' }}</strong></div>
            <div class="info-row"><span>Phone</span><strong>{{ auth.user()?.phone }}</strong></div>
            <div class="info-row">
              <span>Member since</span>
              <strong>{{ memberSince() ? (memberSince()! | date: 'mediumDate') : '—' }}</strong>
            </div>
          </div>

          <app-change-password-form />

          <div class="panel panel--muted">
            <lucide-icon name="construction" [size]="28" class="panel-icon"></lucide-icon>
            <h3>Bike &amp; rider details coming soon</h3>
            <p>Edit bike model, plate, and availability from the rider dashboard when we ship this section.</p>
          </div>

          <div class="panel panel--muted">
            <lucide-icon name="file-text" [size]="28" class="panel-icon"></lucide-icon>
            <h3>Document management coming soon</h3>
            <p>Upload and manage your licence, ID, and insurance documents.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .rider-profile { animation: fadeIn 0.45s ease-out; }
    .page-head {
      margin-bottom: 28px;
      h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; color: var(--clr-text); }
      p { color: var(--clr-text-muted); font-size: 15px; margin-top: 4px; }
    }
    .profile-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
      align-items: start;
    }
    .profile-aside {
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-width: 0;
    }
    .panel--editor { grid-column: 1 / -1; }
    @media (min-width: 900px) {
      .panel--editor { grid-column: span 1; }
    }
    .panel-title--first { margin-top: 0; margin-bottom: 16px; }
    .panel {
      background: var(--clr-bg-card);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-card);
    }
    .panel-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; font-weight: 700; color: var(--clr-text-muted);
      text-transform: uppercase; letter-spacing: 0.06em;
      margin-bottom: 18px;
    }
    .info-row {
      display: flex; justify-content: space-between; gap: 12px;
      font-size: 14px; padding: 12px 0; border-bottom: 1px solid var(--clr-border);
      color: var(--clr-text-muted);
      &:last-child { border-bottom: none; }
      strong { color: var(--clr-text); font-weight: 600; }
    }
    .panel--muted {
      display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;
      color: var(--clr-text-muted);
      h3 { font-size: 16px; font-weight: 700; color: var(--clr-text); }
      p { font-size: 13px; line-height: 1.5; max-width: 320px; }
    }
    .panel-icon { color: var(--clr-primary); opacity: 0.9; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 899px) {
      .panel--editor { grid-column: 1 / -1; grid-row: auto; }
    }
    @media (max-width: 720px) {
      .profile-grid { grid-template-columns: 1fr; }
      .page-head h1 { font-size: 22px; }
    }
  `],
})
export class RiderProfileComponent {
  protected readonly auth = inject(AuthService);
  protected readonly memberSince = signal<string | null>(null);

  protected onProfileLoaded(p: AccountProfile): void {
    this.memberSince.set(p.createdAt);
  }
}
