import {
  Component,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [LucideAngularModule, RouterLink],
  template: `
    <div class="auth-split-page auth-page-animate">

      <!-- Form side -->
      <div class="auth-split-page__form">
        <div class="auth-form-inner">

          <div class="verify-icon">
            <lucide-icon name="mail-check" [size]="28"></lucide-icon>
          </div>

          <h1>Verify your email</h1>
          <p class="auth-lead">
            We sent a 6-digit code to your email. Enter it below to activate your account.
          </p>

          <div class="otp-group" (paste)="onPaste($event)">
            @for (i of indices; track i) {
              <input
                #otpInput
                class="otp-input"
                type="text"
                inputmode="numeric"
                maxlength="1"
                pattern="[0-9]"
                autocomplete="one-time-code"
                [attr.aria-label]="'Digit ' + (i + 1) + ' of 6'"
                (input)="onInput($event, i)"
                (keydown)="onKeydown($event, i)"
              />
            }
          </div>

          @if (error()) {
            <p class="auth-error otp-error">{{ error() }}</p>
          }

          <button
            type="button"
            class="auth-btn-black"
            [disabled]="loading() || !isComplete()"
            (click)="verify()"
          >
            @if (loading()) {
              <span class="auth-btn-spinner"></span>
              <span>Verifying...</span>
            } @else {
              <span>Verify account</span>
            }
          </button>

          <div class="otp-resend">
            @if (resendCooldown() > 0) {
              <span>Resend code in {{ resendCooldown() }}s</span>
            } @else {
              <span>Didn't receive a code?</span>
              <button type="button" (click)="resend()">Resend</button>
            }
          </div>

          <footer class="auth-footer-links">
            <p><a routerLink="/auth/login">Back to sign in</a></p>
          </footer>

        </div>
      </div>

      <!-- Visual side -->
      <aside class="auth-split-page__aside" aria-label="Brand">
        <div class="auth-visual-panel verify-panel">
          <div class="auth-visual-panel__content">
            <div class="auth-glass auth-glass--badge">Almost there</div>
            <div class="auth-glass auth-glass--title">One step away from your first ride.</div>
            <p class="auth-glass auth-glass--tagline">Verify your email to unlock <strong>NduthiRide</strong>.</p>
          </div>
        </div>
      </aside>

    </div>
  `,
  styleUrls: ['../auth-pages.shared.scss'],
  styles: [`
    .verify-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: rgba(64, 138, 113, 0.1); border: 1px solid rgba(64, 138, 113, 0.25);
      display: flex; align-items: center; justify-content: center;
      color: var(--clr-primary); margin-bottom: 16px;
    }

    .otp-group {
      display: flex; gap: 8px; justify-content: center; margin: 20px 0 6px;
    }

    .otp-input {
      width: 46px; height: 54px; text-align: center; font-size: 22px; font-weight: 700;
      font-family: var(--font-display);
      border: 1.5px solid var(--clr-border); border-radius: 12px;
      background: var(--clr-bg-elevated); color: var(--clr-text);
      outline: none; transition: border-color 0.2s, box-shadow 0.2s;
      caret-color: transparent;
    }
    .otp-input:focus {
      border-color: var(--clr-primary);
      box-shadow: 0 0 0 3px rgba(64, 138, 113, 0.15);
    }
    .otp-input:not(:placeholder-shown) {
      border-color: color-mix(in srgb, var(--clr-primary) 60%, transparent);
    }

    .otp-error { text-align: center; padding-left: 0; margin-bottom: 6px; }

    .otp-resend {
      text-align: center; margin-top: 14px; font-size: 14px; color: var(--clr-text-muted);
      button {
        color: var(--clr-primary); font-weight: 700; font-size: 14px;
        background: none; border: none; cursor: pointer; margin-left: 4px; padding: 0;
        &:hover { text-decoration: underline; }
      }
    }

    .verify-panel {
      background: linear-gradient(145deg, var(--clr-primary-dark) 0%, var(--clr-primary) 55%, var(--clr-primary-light) 100%);
    }
  `],
})
export class VerifyEmailComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast  = inject(ToastService);

  protected readonly loading        = signal(false);
  protected readonly error          = signal('');
  protected readonly resendCooldown = signal(0);
  protected readonly indices        = [0, 1, 2, 3, 4, 5];

  private digits: string[]               = ['', '', '', '', '', ''];
  private cooldownTimer?: ReturnType<typeof setInterval>;

  ngAfterViewInit(): void {
    setTimeout(() => this.otpInputs.first?.nativeElement.focus(), 50);
    this.startCooldown();
  }

  ngOnDestroy(): void {
    clearInterval(this.cooldownTimer);
  }

  protected isComplete(): boolean {
    return this.digits.every(d => d !== '');
  }

  protected onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val   = input.value.replace(/\D/g, '').slice(-1);
    input.value     = val;
    this.digits[index] = val;
    this.error.set('');
    if (val && index < 5) {
      this.otpInputs.get(index + 1)?.nativeElement.focus();
    }
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const current = this.otpInputs.get(index)?.nativeElement;
      if (current && !current.value && index > 0) {
        this.digits[index - 1] = '';
        const prev = this.otpInputs.get(index - 1)?.nativeElement;
        if (prev) { prev.value = ''; prev.focus(); }
      } else if (current) {
        this.digits[index] = '';
      }
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const digits = (event.clipboardData?.getData('text') ?? '')
      .replace(/\D/g, '')
      .slice(0, 6)
      .split('');
    this.otpInputs.forEach((ref, i) => {
      const val = digits[i] ?? '';
      ref.nativeElement.value = val;
      this.digits[i] = val;
    });
    const focusIdx = Math.min(digits.length, 5);
    this.otpInputs.get(focusIdx)?.nativeElement.focus();
  }

  protected async verify(): Promise<void> {
    if (this.loading() || !this.isComplete()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.verifyEmail(this.digits.join(''));
      this.toast.success('Email verified! Welcome to NduthiRide.');
      const role = this.auth.role();
      void this.router.navigate([role === 'RIDER' ? '/rider' : '/user']);
    } catch {
      this.error.set('Invalid or expired code. Please try again.');
      this.loading.set(false);
    }
  }

  protected resend(): void {
    this.toast.info('A new verification code has been sent to your email.');
    this.startCooldown();
  }

  private startCooldown(): void {
    this.resendCooldown.set(60);
    clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const n = this.resendCooldown();
      if (n <= 1) { clearInterval(this.cooldownTimer); this.resendCooldown.set(0); }
      else { this.resendCooldown.set(n - 1); }
    }, 1000);
  }
}
