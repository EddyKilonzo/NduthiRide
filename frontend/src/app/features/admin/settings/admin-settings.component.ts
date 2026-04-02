import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <lucide-icon name="settings" [size]="28"></lucide-icon>
          </div>
          <div>
            <h1>System Settings</h1>
            <p>Configure platform fees, limits and operational parameters</p>
          </div>
        </div>
      </div>

      @if (loading()) {
        <app-spinner [overlay]="true" />
      } @else {
        <div class="settings-grid">
          <form [formGroup]="settingsForm" (ngSubmit)="save()" class="settings-form">
            <!-- Platform Fees -->
            <div class="card settings-card">
              <div class="card-header">
                <lucide-icon name="banknote" [size]="20"></lucide-icon>
                <h3>Platform Fees & Revenue</h3>
              </div>
              <div class="card-body">
                <div class="form-group">
                  <label>Service Commission (%)</label>
                  <p class="field-desc">The percentage NduthRide takes from every trip.</p>
                  <input type="number" formControlName="COMMISSION_PERCENTAGE" placeholder="e.g. 15" />
                </div>
                <div class="form-group">
                  <label>Ride Base Fare (KES)</label>
                  <p class="field-desc">Minimum starting price for any ride.</p>
                  <input type="number" formControlName="MIN_FARE" placeholder="e.g. 50" />
                </div>
                <div class="form-group">
                  <label>Ride Rate per KM (KES)</label>
                  <p class="field-desc">Additional charge per kilometer for rides.</p>
                  <input type="number" formControlName="PER_KM_RATE" placeholder="e.g. 30" />
                </div>
                <div class="form-group">
                  <label>Parcel Base Fee (KES)</label>
                  <p class="field-desc">Minimum starting price for parcel deliveries.</p>
                  <input type="number" formControlName="PARCEL_BASE_FEE" placeholder="e.g. 80" />
                </div>
                <div class="form-group">
                  <label>Parcel Rate per KM (KES)</label>
                  <p class="field-desc">Additional charge per kilometer for deliveries.</p>
                  <input type="number" formControlName="PARCEL_PER_KM" placeholder="e.g. 25" />
                </div>
              </div>
            </div>

            <!-- Operational Limits -->
            <div class="card settings-card">
              <div class="card-header">
                <lucide-icon name="shield-alert" [size]="20"></lucide-icon>
                <h3>Operational Limits</h3>
              </div>
              <div class="card-body">
                <div class="form-group">
                  <label>Minimum Payout (KES)</label>
                  <p class="field-desc">Minimum balance a rider needs to request a withdrawal.</p>
                  <input type="number" formControlName="MIN_PAYOUT_AMOUNT" placeholder="e.g. 500" />
                </div>
                <div class="form-group">
                  <label>Max Search Radius (KM)</label>
                  <p class="field-desc">Distance to look for available riders from pickup.</p>
                  <input type="number" formControlName="MAX_RIDER_DISTANCE_KM" placeholder="e.g. 5" />
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn--primary btn--lg btn--pill" [disabled]="saving() || settingsForm.invalid">
                @if (saving()) {
                  <app-spinner [size]="18"></app-spinner> Saving...
                } @else {
                  <lucide-icon name="save" [size]="18"></lucide-icon> Save Configuration
                }
              </button>
            </div>
          </form>

          <div class="settings-sidebar">
            <div class="card info-card">
              <lucide-icon name="info" [size]="24" class="info-icon"></lucide-icon>
              <h4>About System Settings</h4>
              <p>These values directly affect the pricing engine and operational logic. Changes are applied instantly to all new bookings.</p>
              <div class="warning-box">
                <lucide-icon name="alert-triangle" [size]="16"></lucide-icon>
                <span>Handle with care — incorrect values can disrupt service.</span>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .header-content { display: flex; align-items: center; gap: 16px; }
    .header-icon {
      width: 48px; height: 48px; border-radius: var(--radius-md);
      background: var(--clr-bg-elevated); color: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      box-shadow: var(--shadow-sm);
    }
    .settings-grid { display: grid; grid-template-columns: 1fr 320px; gap: 32px; align-items: start; margin-top: 24px; }
    .settings-form { display: flex; flex-direction: column; gap: 24px; }
    .settings-card { padding: 0; overflow: hidden; }
    .card-header { padding: 20px 24px; border-bottom: 1px solid var(--clr-border); display: flex; align-items: center; gap: 12px; background: var(--clr-bg-elevated); h3 { font-size: 15px; font-weight: 700; margin: 0; } lucide-icon { color: var(--clr-primary); } }
    .card-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 13px; font-weight: 700; color: var(--clr-text); }
    .field-desc { font-size: 12px; color: var(--clr-text-muted); margin-bottom: 4px; }
    input { padding: 12px 16px; border-radius: var(--radius-md); background: var(--clr-bg-elevated); border: 1px solid var(--clr-border); color: var(--clr-text); font-size: 15px; font-weight: 600; width: 100%; max-width: 240px; transition: all 0.2s; &:focus { border-color: var(--clr-primary); outline: none; box-shadow: 0 0 0 3px rgba(64, 138, 113, 0.1); } }
    .form-actions { margin-top: 12px; display: flex; justify-content: flex-start; }
    .btn--pill { padding-left: 32px; padding-right: 32px; gap: 10px; }
    .info-card { padding: 24px; background: linear-gradient(180deg, var(--clr-bg-elevated), var(--clr-bg-card)); border-color: var(--clr-primary); h4 { margin: 16px 0 8px; font-size: 16px; font-weight: 700; } p { font-size: 13px; color: var(--clr-text-muted); line-height: 1.6; } }
    .info-icon { color: var(--clr-primary); }
    .warning-box { margin-top: 20px; padding: 12px; background: rgba(245, 158, 11, 0.1); border-radius: var(--radius-sm); border-left: 3px solid var(--clr-warning); display: flex; gap: 10px; span { font-size: 11px; font-weight: 600; color: var(--clr-warning); line-height: 1.4; } lucide-icon { color: var(--clr-warning); flex-shrink: 0; } }

    @media (max-width: 900px) { .settings-grid { grid-template-columns: 1fr; } .settings-sidebar { order: -1; } }
  `],
})
export class AdminSettingsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly settingsForm = this.fb.group({
    COMMISSION_PERCENTAGE: [15, [Validators.required, Validators.min(0), Validators.max(100)]],
    MIN_FARE: [50, [Validators.required, Validators.min(0)]],
    PER_KM_RATE: [30, [Validators.required, Validators.min(0)]],
    PARCEL_BASE_FEE: [80, [Validators.required, Validators.min(0)]],
    PARCEL_PER_KM: [25, [Validators.required, Validators.min(0)]],
    MIN_PAYOUT_AMOUNT: [500, [Validators.required, Validators.min(0)]],
    MAX_RIDER_DISTANCE_KM: [5, [Validators.required, Validators.min(1), Validators.max(50)]],
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const s = await this.adminService.getSettings();
      // Map string values from backend to form
      const formValues: any = {};
      Object.keys(this.settingsForm.controls).forEach(key => {
        if (s[key] !== undefined) {
          formValues[key] = parseFloat(s[key]);
        }
      });
      this.settingsForm.patchValue(formValues);
    } catch {
      this.toast.error('Failed to load settings');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.settingsForm.invalid) return;
    this.saving.set(true);
    try {
      const values = this.settingsForm.getRawValue();
      // Convert numbers back to strings for the backend
      const stringSettings: Record<string, string> = {};
      Object.entries(values).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          stringSettings[k] = v.toString();
        }
      });
      
      await this.adminService.updateSettings(stringSettings);
      this.toast.success('Settings updated successfully');
    } catch {
      this.toast.error('Failed to save settings');
    } finally {
      this.saving.set(false);
    }
  }
}
