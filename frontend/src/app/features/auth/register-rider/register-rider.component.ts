import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { MediaService } from '../../../core/services/media.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-register-rider',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SpinnerComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <span>🏍</span>
          <h1>Become a Rider</h1>
        </div>
        <p class="auth-sub">Join our growing network of riders</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <!-- Personal info -->
          <div class="section-title">Personal Information</div>
          <div class="form-group">
            <label>Full Name</label>
            <input formControlName="fullName" class="form-control" placeholder="John Kamau" />
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input formControlName="phone" class="form-control" type="tel" placeholder="07XXXXXXXX" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input formControlName="password" class="form-control" type="password" placeholder="At least 8 characters" />
          </div>

          <!-- Rider info -->
          <div class="section-title">Rider Details</div>
          <div class="form-group">
            <label>License Number</label>
            <input formControlName="licenseNumber" class="form-control" placeholder="DL-2024-001" />
          </div>
          <div class="form-group">
            <label>Bike Registration</label>
            <input formControlName="bikeRegistration" class="form-control" placeholder="KMBN 001A" />
          </div>
          <div class="form-group">
            <label>Bike Model (optional)</label>
            <input formControlName="bikeModel" class="form-control" placeholder="Bajaj Boxer" />
          </div>

          <!-- Document Upload (Simulated with text for now, but wired to MediaService) -->
          <div class="section-title">Documents</div>
          <div class="form-group">
            <label>Profile Picture</label>
            <input type="file" (change)="onFileSelected($event, 'avatar')" accept="image/*" class="form-control" />
          </div>

          <button type="submit" class="btn btn--primary btn--full btn--lg"
            [disabled]="loading() || form.invalid">
            @if (loading()) { <app-spinner [size]="18" /> }
            @else { Submit Application }
          </button>
        </form>

        <div class="auth-links">
          <a [routerLink]="['/auth/login']">Already registered? Sign in</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--clr-bg); padding: 24px; }
    .auth-card { width: 100%; max-width: 460px; background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 40px 36px; display: flex; flex-direction: column; gap: 16px; }
    .auth-logo { display: flex; align-items: center; gap: 10px; justify-content: center; span { font-size: 32px; } h1 { font-size: 22px; font-weight: 700; color: var(--clr-primary); } }
    .auth-sub { text-align: center; color: var(--clr-text-muted); font-size: 14px; }
    .section-title { font-size: 11px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .8px; padding-top: 8px; border-top: 1px solid var(--clr-border); }
    form { display: flex; flex-direction: column; gap: 12px; }
    .auth-links { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 13px; }
  `],
})
export class RegisterRiderComponent {
  private readonly auth   = inject(AuthService);
  private readonly media  = inject(MediaService);
  private readonly router = inject(Router);
  private readonly toast  = inject(ToastService);

  protected readonly loading = signal(false);
  private avatarFile: File | null = null;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName:        ['', Validators.required],
    phone:           ['', [Validators.required, Validators.pattern(/^(\+254|0)(7|1)\d{8}$/)]],
    password:        ['', [Validators.required, Validators.minLength(8)]],
    licenseNumber:   ['', Validators.required],
    bikeRegistration:['', Validators.required],
    bikeModel:       [''],
    avatarUrl:       [''],
  });

  protected onFileSelected(event: any, type: string): void {
    const file = event.target.files[0];
    if (file) {
      this.avatarFile = file;
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);

    try {
      // 1. Upload avatar if selected
      if (this.avatarFile) {
        const url = await this.media.uploadImage(this.avatarFile);
        this.form.patchValue({ avatarUrl: url });
      }

      // 2. Register rider
      await this.auth.registerRider(this.form.getRawValue());
      
      this.toast.success('Application submitted! Welcome to NduthRide.');
      void this.router.navigate(['/rider']);
    } catch (error) {
      this.loading.set(false);
    }
  }
}
