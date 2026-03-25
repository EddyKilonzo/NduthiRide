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
    <div class="auth-split-page auth-page-animate verify-email-page">

      <div class="auth-split-page__form">
        <div class="auth-form-inner">

          <div class="verify-icon">
            <lucide-icon name="mail" [size]="28"></lucide-icon>
          </div>

          <h1>Verify your email</h1>
          <p class="auth-lead">
            We sent a 6-digit code to your email. Enter it below to activate your account.
          </p>

          <p class="nduth-otp-label">One digit per box — six separate boxes below.</p>

          <div class="nduth-otp-wrap" (paste)="onPaste($event)">
            @for (i of indices; track i) {
              <div class="nduth-otp-slot">
                <input
                  #otpInput
                  class="nduth-otp-digit"
                  type="tel"
                  inputmode="numeric"
                  maxlength="1"
                  pattern="[0-9]*"
                  [attr.name]="'otp-' + i"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  [attr.aria-label]="'Digit ' + (i + 1) + ' of 6'"
                  (input)="onInput($event, i)"
                  (keydown)="onKeydown($event, i)"
                />
              </div>
            }
          </div>

          @if (error()) {
            <p class="auth-error otp-error">{{ error() }}</p>
          }

          <div class="nduth-verify-actions">
            <button
              type="button"
              class="auth-btn-black"
              [disabled]="loading() || !isComplete()"
              (click)="verify()"
              aria-describedby="verify-email-hint"
            >
              @if (loading()) {
                <span class="auth-btn-spinner"></span>
                <span>Checking your code…</span>
              } @else if (!isComplete()) {
                <span>Enter all 6 digits above to unlock this button</span>
              } @else {
                <span>Verify email and continue</span>
              }
            </button>
            <p
              id="verify-email-hint"
              class="nduth-verify-hint"
              [class.nduth-verify-hint--muted]="isComplete() && !loading()"
              aria-live="polite"
            >
              @if (loading()) {
                Please wait while we confirm your code.
              } @else if (!isComplete()) {
                Fill each box with one number (or paste the full code). The button stays off until all six are filled.
              } @else {
                Ready — tap the button to verify your email and open your account.
              }
            </p>
          </div>

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

      <aside class="auth-split-page__aside" aria-label="Brand">
        <div class="auth-visual-panel">
          <div class="auth-visual-panel__media" aria-hidden="true">
            <!-- Inline SVG so the hero always paints (no CDN / public path issues) -->
            <svg
              class="verify-email-hero-svg"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1200 800"
              preserveAspectRatio="xMidYMid slice"
              focusable="false"
            >
              <defs>
                <linearGradient id="vhero-g" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#142e26" />
                  <stop offset="55%" style="stop-color:#285a48" />
                  <stop offset="100%" style="stop-color:#408a71" />
                </linearGradient>
                <linearGradient id="vhero-road" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#0d1f18;stop-opacity:0.9" />
                  <stop offset="100%" style="stop-color:#091413" />
                </linearGradient>
                <filter id="vhero-soft" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect width="1200" height="800" fill="url(#vhero-g)" />
              <ellipse cx="600" cy="720" rx="520" ry="120" fill="#091413" opacity="0.45" />
              <path d="M0 520 L1200 420 L1200 800 L0 800 Z" fill="url(#vhero-road)" />
              <path d="M600 420 L1180 360 L1200 380 L620 460 Z" fill="#1c3d2e" opacity="0.6" />
              <g fill="#b0e4cc" opacity="0.35" filter="url(#vhero-soft)">
                <circle cx="200" cy="140" r="3" />
                <circle cx="320" cy="100" r="2" />
                <circle cx="900" cy="120" r="2.5" />
                <circle cx="1020" cy="180" r="2" />
                <circle cx="150" cy="280" r="2" />
              </g>
              <g transform="translate(420 300) scale(1.15)" fill="#091413" opacity="0.88">
                <ellipse cx="180" cy="310" rx="52" ry="52" />
                <ellipse cx="380" cy="310" rx="52" ry="52" />
                <path d="M120 310 L200 310 L260 180 L340 160 L420 200 L380 280 L320 280 L280 200 Z" />
                <path d="M260 180 L340 90 L400 100 L420 200 L340 160 Z" fill="#142e26" />
                <rect x="330" y="75" width="8" height="55" rx="2" transform="rotate(-15 334 100)" fill="#285a48" />
              </g>
              <rect width="1200" height="800" fill="url(#vhero-g)" opacity="0.12" style="mix-blend-mode:overlay" />
            </svg>
          </div>
          <div class="auth-visual-panel__overlay" aria-hidden="true"></div>
          <div class="auth-visual-panel__content">
            <div class="auth-glass auth-glass--badge">Almost there</div>
            <div class="auth-glass auth-glass--title">One step away from your first ride.</div>
            <p class="auth-glass auth-glass--tagline">Verify your email to unlock <strong>NduthiRide</strong>.</p>
          </div>
        </div>
      </aside>

    </div>
  `,
  styleUrls: ['../auth-pages.shared.scss', './verify-email.component.scss'],
  styles: [`
    .verify-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: rgba(64, 138, 113, 0.1); border: 1px solid rgba(64, 138, 113, 0.25);
      display: flex; align-items: center; justify-content: center;
      color: var(--clr-primary); margin-bottom: 16px;
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
      const role = this.auth.role();
      const dest = role === 'RIDER' ? '/rider' : '/user';
      // Navigate first so the shell + dashboard can load immediately; toast after avoids blocking the transition.
      void this.router.navigateByUrl(dest).then(() => {
        this.toast.success('Email verified! Welcome to NduthiRide.');
      });
    } catch {
      this.error.set('Invalid or expired code. Please try again.');
      this.loading.set(false);
    }
  }

  protected resend(): void {
    void this.auth.resendOtp().then(() => {
      this.toast.success('A new code has been sent to your email.');
      this.startCooldown();
    }).catch(() => {
      this.toast.error('Could not resend code. Please try again.');
    });
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
