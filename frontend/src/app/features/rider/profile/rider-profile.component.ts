import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { RidersApi, type RiderProfile } from '../../../core/api/riders.api';
import { ToastService } from '../../../core/services/toast.service';
import type { AccountProfile } from '../../../core/api/users.api';
import { AccountProfileEditorComponent } from '../../../shared/components/account-profile-editor/account-profile-editor.component';
import { ChangePasswordFormComponent } from '../../../shared/components/change-password-form/change-password-form.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-rider-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    AccountProfileEditorComponent,
    ChangePasswordFormComponent,
    SpinnerComponent,
  ],
  template: `
    <div class="rider-profile app-page">
      <header class="page-head">
        <div>
          <h1>My Profile</h1>
          <p>Manage your rider account and vehicle details</p>
        </div>
      </header>

      <div class="profile-grid">

        <!-- Left column -->
        <div class="left-col">
          <div class="panel">
            <h3 class="panel-title">
              <lucide-icon name="pencil" [size]="15"></lucide-icon>
              Account &amp; photo
            </h3>
            <app-account-profile-editor (profileLoaded)="onProfileLoaded($event)" />
          </div>

          <!-- Stats -->
          @if (riderProfile()) {
            <div class="panel stats-panel">
              <h3 class="panel-title">
                <lucide-icon name="bar-chart-2" [size]="15"></lucide-icon>
                Rider stats
              </h3>
              <div class="stats-row">
                <div class="stat-box">
                  <span class="stat-val">{{ riderProfile()!.totalRides }}</span>
                  <span class="stat-lbl">Total Rides</span>
                </div>
                <div class="stat-box">
                  <span class="stat-val">KES {{ riderProfile()!.totalEarnings | number:'1.0-0' }}</span>
                  <span class="stat-lbl">Total Earnings</span>
                </div>
                <div class="stat-box">
                  <span class="stat-val">{{ riderProfile()!.ratingAverage | number:'1.1-1' }}</span>
                  <span class="stat-lbl">Rating</span>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Right column -->
        <div class="right-col">

          <!-- Account info -->
          <div class="panel">
            <h3 class="panel-title">
              <lucide-icon name="user" [size]="15"></lucide-icon>
              Account info
            </h3>
            <div class="info-row"><span>Email</span><strong>{{ auth.user()?.email || '—' }}</strong></div>
            <div class="info-row"><span>Phone</span><strong>{{ auth.user()?.phone }}</strong></div>
            <div class="info-row">
              <span>Member since</span>
              <strong>{{ memberSince() ? (memberSince()! | date:'mediumDate') : '—' }}</strong>
            </div>
            @if (riderProfile()) {
              <div class="info-row">
                <span>Verification</span>
                <strong class="badge" [class.badge--success]="riderProfile()!.isVerified" [class.badge--warn]="!riderProfile()!.isVerified">
                  {{ riderProfile()!.isVerified ? 'Verified' : 'Pending review' }}
                </strong>
              </div>
            }
          </div>

          <!-- Bike & licence details -->
          <div class="panel">
            <div class="panel-header-row">
              <h3 class="panel-title panel-title--inline">
                <lucide-icon name="bike" [size]="15"></lucide-icon>
                Bike &amp; Licence
              </h3>
              @if (!editingVehicle() && riderProfile()) {
                <button class="btn-icon" (click)="startVehicleEdit()" title="Edit">
                  <lucide-icon name="pencil" [size]="15"></lucide-icon>
                </button>
              }
            </div>

            @if (loadingProfile()) {
              <div class="loader-wrap"><app-spinner /></div>
            } @else if (editingVehicle()) {
              <form [formGroup]="vehicleForm" (ngSubmit)="saveVehicle()" class="vehicle-form">
                <div class="field">
                  <label for="licenseNumber">Driving Licence Number</label>
                  <input id="licenseNumber" formControlName="licenseNumber" placeholder="e.g. DL123456"
                    [class.has-error]="vc['licenseNumber'].invalid && vc['licenseNumber'].touched" />
                  @if (vc['licenseNumber'].invalid && vc['licenseNumber'].touched) {
                    <p class="err">Required</p>
                  }
                </div>
                <div class="field">
                  <label for="bikeRegistration">Number Plate</label>
                  <input id="bikeRegistration" formControlName="bikeRegistration" placeholder="e.g. KBX 123A"
                    [class.has-error]="vc['bikeRegistration'].invalid && vc['bikeRegistration'].touched" />
                  @if (vc['bikeRegistration'].invalid && vc['bikeRegistration'].touched) {
                    <p class="err">Required</p>
                  }
                </div>
                <div class="field">
                  <label for="bikeModel">Bike Model</label>
                  <input id="bikeModel" formControlName="bikeModel" placeholder="e.g. Honda CB125F"
                    [class.has-error]="vc['bikeModel'].invalid && vc['bikeModel'].touched" />
                  @if (vc['bikeModel'].invalid && vc['bikeModel'].touched) {
                    <p class="err">Required</p>
                  }
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn btn--primary btn--sm" [disabled]="savingVehicle()">
                    @if (savingVehicle()) { <app-spinner /> } @else { Save changes }
                  </button>
                  <button type="button" class="btn btn--ghost btn--sm" (click)="cancelVehicleEdit()">
                    Cancel
                  </button>
                </div>
              </form>
            } @else if (riderProfile()) {
              <div class="info-row">
                <span>Licence No.</span>
                <strong>{{ display(riderProfile()!.licenseNumber) }}</strong>
              </div>
              <div class="info-row">
                <span>Number Plate</span>
                <strong>{{ display(riderProfile()!.bikeRegistration) }}</strong>
              </div>
              <div class="info-row">
                <span>Bike Model</span>
                <strong>{{ display(riderProfile()!.bikeModel) }}</strong>
              </div>
            } @else {
              <p class="empty-note">Could not load vehicle details.</p>
            }
          </div>

          <app-change-password-form />

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
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      align-items: start;
    }
    .left-col, .right-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }

    .panel {
      background: var(--clr-bg-card);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-card);
    }
    .panel-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; font-weight: 700; color: var(--clr-text-muted);
      text-transform: uppercase; letter-spacing: 0.06em;
      margin-bottom: 18px; margin-top: 0;
    }
    .panel-title--inline { margin-bottom: 0; }
    .panel-header-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 18px;
    }

    .info-row {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      font-size: 14px; padding: 11px 0; border-bottom: 1px solid var(--clr-border);
      color: var(--clr-text-muted);
    }
    .info-row:last-child { border-bottom: none; }
    .info-row strong { color: var(--clr-text); font-weight: 600; }

    .badge {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
    }
    .badge--success { background: rgba(34,197,94,.12); color: var(--clr-success); }
    .badge--warn { background: rgba(245,158,11,.12); color: var(--clr-warning); }

    /* Stats */
    .stats-panel .stats-row {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
    }
    .stat-box {
      background: var(--clr-bg-elevated); border-radius: var(--radius-md);
      padding: 14px 10px; text-align: center; border: 1px solid var(--clr-border);
      display: flex; flex-direction: column; gap: 4px;
    }
    .stat-val { font-size: 18px; font-weight: 800; color: var(--clr-text); font-family: var(--font-display); }
    .stat-lbl { font-size: 11px; color: var(--clr-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }

    /* Vehicle form */
    .vehicle-form { display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    label { font-size: 13px; font-weight: 600; color: var(--clr-text); }
    input {
      padding: 9px 12px; border: 1px solid var(--clr-border);
      border-radius: var(--radius-md); background: var(--clr-bg-elevated);
      color: var(--clr-text); font-size: 14px; width: 100%; box-sizing: border-box;
    }
    input:focus { outline: none; border-color: var(--clr-primary); }
    input.has-error { border-color: var(--clr-error); }
    .err { font-size: 12px; color: var(--clr-error); margin: 0; }
    .form-actions { display: flex; gap: 10px; margin-top: 4px; }

    .btn-icon {
      background: none; border: 1px solid var(--clr-border); border-radius: var(--radius-md);
      padding: 5px 8px; cursor: pointer; color: var(--clr-text-muted);
      display: flex; align-items: center;
    }
    .btn-icon:hover { color: var(--clr-primary); border-color: var(--clr-primary); }

    .loader-wrap { display: flex; justify-content: center; padding: 24px; }
    .empty-note { font-size: 13px; color: var(--clr-text-muted); text-align: center; padding: 16px 0; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 900px) {
      .profile-grid { grid-template-columns: 1fr; }
      .stats-panel .stats-row { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 480px) {
      .stats-panel .stats-row { grid-template-columns: 1fr 1fr; }
      .page-head h1 { font-size: 22px; }
    }
  `],
})
export class RiderProfileComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly ridersApi = inject(RidersApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly memberSince = signal<string | null>(null);
  protected readonly riderProfile = signal<RiderProfile | null>(null);
  protected readonly loadingProfile = signal(true);
  protected readonly editingVehicle = signal(false);
  protected readonly savingVehicle = signal(false);

  protected readonly vehicleForm = this.fb.nonNullable.group({
    licenseNumber:    ['', Validators.required],
    bikeRegistration: ['', Validators.required],
    bikeModel:        ['', Validators.required],
  });

  protected get vc() { return this.vehicleForm.controls; }

  /** Returns the value, or '—' if it's null/empty/placeholder */
  protected display(v: string | null | undefined): string {
    return (v && v !== 'To be provided') ? v : '—';
  }

  async ngOnInit() {
    try {
      const profile = await this.ridersApi.getMyProfile();
      this.riderProfile.set(profile);
    } catch {
      this.toast.error('Could not load rider profile');
    } finally {
      this.loadingProfile.set(false);
    }
  }

  protected onProfileLoaded(p: AccountProfile): void {
    this.memberSince.set(p.createdAt);
  }

  private real(v: string | null | undefined): string {
    return (v && v !== 'To be provided') ? v : '';
  }

  protected startVehicleEdit(): void {
    const p = this.riderProfile();
    if (!p) return;
    this.vehicleForm.setValue({
      licenseNumber:    this.real(p.licenseNumber),
      bikeRegistration: this.real(p.bikeRegistration),
      bikeModel:        this.real(p.bikeModel),
    });
    this.editingVehicle.set(true);
  }

  protected cancelVehicleEdit(): void {
    this.editingVehicle.set(false);
    this.vehicleForm.reset();
  }

  protected async saveVehicle(): Promise<void> {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }
    this.savingVehicle.set(true);
    try {
      const updated = await this.ridersApi.updateMyProfile(this.vehicleForm.getRawValue());
      this.riderProfile.set(updated);
      this.editingVehicle.set(false);
      this.toast.success('Vehicle details updated');
    } catch {
      // Error toast from interceptor
    } finally {
      this.savingVehicle.set(false);
    }
  }
}
