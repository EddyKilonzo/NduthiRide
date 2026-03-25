import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../spinner/spinner.component';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const np = group.get('newPassword')?.value as string;
  const cp = group.get('confirmPassword')?.value as string;
  if (!np?.length || !cp?.length) return null;
  return np === cp ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-change-password-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, SpinnerComponent],
  template: `
    <div class="pw-panel">
      <div class="pw-head">
        <lucide-icon name="lock" [size]="22" class="pw-icon"></lucide-icon>
        <div>
          <h3>Change password</h3>
          <p class="pw-lead">
            At least 8 characters. Other signed-in devices will need to log in again.
          </p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="pw-form">
        <div class="form-group">
          <label for="pw-current">Current password</label>
          <input
            id="pw-current"
            type="password"
            class="form-control"
            formControlName="currentPassword"
            autocomplete="current-password"
            [attr.aria-invalid]="
              form.controls.currentPassword.invalid && form.controls.currentPassword.touched
            "
          />
          @if (form.controls.currentPassword.invalid && form.controls.currentPassword.touched) {
            <span class="form-error">Enter your current password</span>
          }
        </div>

        <div class="form-group">
          <label for="pw-new">New password</label>
          <input
            id="pw-new"
            type="password"
            class="form-control"
            formControlName="newPassword"
            autocomplete="new-password"
            [attr.aria-invalid]="
              form.controls.newPassword.invalid && form.controls.newPassword.touched
            "
          />
          @if (form.controls.newPassword.invalid && form.controls.newPassword.touched) {
            <span class="form-error">Use at least 8 characters</span>
          }
        </div>

        <div class="form-group">
          <label for="pw-confirm">Confirm new password</label>
          <input
            id="pw-confirm"
            type="password"
            class="form-control"
            formControlName="confirmPassword"
            autocomplete="new-password"
            [attr.aria-invalid]="
              (form.controls.confirmPassword.invalid && form.controls.confirmPassword.touched) ||
              (form.hasError('passwordMismatch') && form.controls.confirmPassword.touched)
            "
          />
          @if (form.controls.confirmPassword.invalid && form.controls.confirmPassword.touched) {
            <span class="form-error">Confirm your new password</span>
          }
          @if (
            form.hasError('passwordMismatch') &&
            form.controls.confirmPassword.touched &&
            form.controls.confirmPassword.valid
          ) {
            <span class="form-error">Passwords do not match</span>
          }
        </div>

        <p class="pw-footnote">
          Don't know your current password? Log out, then use <strong>Forgot password</strong> on the sign-in page.
        </p>

        <button type="submit" class="btn btn--primary btn--pw-submit" [disabled]="submitting() || form.invalid">
          @if (submitting()) {
            <app-spinner [size]="16" />
          } @else {
            Update password
          }
        </button>
      </form>
    </div>
  `,
  styles: [`
    .pw-panel {
      background: var(--clr-bg-card);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-lg);
      padding: clamp(16px, 3vw, 20px);
      box-shadow: var(--shadow-card);
    }
    .pw-head {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    .pw-icon { color: var(--clr-primary); flex-shrink: 0; margin-top: 2px; }
    .pw-head h3 {
      font-size: 15px;
      font-weight: 700;
      color: var(--clr-text);
      margin: 0 0 4px;
    }
    .pw-lead {
      font-size: 12px;
      color: var(--clr-text-muted);
      line-height: 1.4;
      margin: 0;
    }
    .pw-form .form-group {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-bottom: 10px;
    }
    .pw-form .form-group label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--clr-text-muted);
    }
    .pw-form .form-control {
      padding: 7px 10px;
      font-size: 13px;
      line-height: 1.35;
      min-height: 36px;
      border-radius: var(--radius-sm);
    }
    .pw-form .form-error {
      font-size: 11px;
      margin-top: 1px;
    }
    .pw-footnote {
      font-size: 11px;
      color: var(--clr-text-dim);
      margin: 2px 0 12px;
      line-height: 1.4;
    }
    .pw-footnote strong { color: var(--clr-text-muted); font-weight: 600; }
    .btn--pw-submit {
      padding: 9px 18px;
      font-size: 13px;
      min-height: 40px;
    }
  `],
})
export class ChangePasswordFormComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: passwordsMatchValidator },
  );

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting.set(true);
    try {
      await this.auth.changePassword(currentPassword, newPassword);
      this.toast.success('Password updated');
      this.form.reset();
    } finally {
      this.submitting.set(false);
    }
  }
}
