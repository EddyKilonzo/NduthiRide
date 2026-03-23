import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cta-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="cta">
      <div class="container" data-aos="zoom-in">
        <div class="cta__card">
          <div class="cta__content">
            <h2>Ready to Ride?</h2>
            <p>Join over 50,000 satisfied users and experience the best motorcycle-taxi service in Kenya today.</p>
            <div class="cta__actions">
              <a [routerLink]="['/auth/register']" class="btn btn--primary btn--lg">Create Account</a>
              <a [routerLink]="['/auth/register-rider']" class="btn btn--secondary btn--lg">Become a Rider</a>
            </div>
          </div>
          <div class="cta__image">
            <span class="bike-emoji">🏍️💨</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .cta { padding: 80px 0; background: var(--clr-bg); }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .cta__card {
      background: var(--clr-primary);
      border-radius: var(--radius-lg);
      padding: 60px;
      display: grid; grid-template-columns: 1fr 0.4fr; gap: 40px;
      align-items: center;
      color: #fff;
      position: relative; overflow: hidden;
      @media (max-width: 768px) { grid-template-columns: 1fr; text-align: center; padding: 40px 24px; }
    }
    .cta__card::before {
      content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      pointer-events: none;
    }
    h2 { font-size: 48px; font-weight: 800; margin-bottom: 16px; }
    p { font-size: 18px; opacity: 0.9; margin-bottom: 32px; max-width: 500px; @media (max-width: 768px) { margin-inline: auto; } }
    .cta__actions { display: flex; gap: 16px; @media (max-width: 768px) { justify-content: center; } }
    .btn--secondary { background: #fff; color: var(--clr-primary); border: none; &:hover { background: #f0f0f0; } }
    .btn--primary { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.3); }
    .cta__image { font-size: 120px; @media (max-width: 768px) { display: none; } }
  `]
})
export class CtaBannerComponent {}
