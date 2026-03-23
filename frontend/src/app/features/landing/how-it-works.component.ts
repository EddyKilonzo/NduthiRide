import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="how-it-works" class="how">
      <div class="container">
        <div class="section-header" data-aos="fade-up">
          <h2 class="section-title">How it <span class="text-primary">Works</span></h2>
          <p class="section-desc">Getting started is easy. Choose your service and follow the steps.</p>
        </div>

        <div class="tab-toggle" data-aos="fade-up">
          <button [class.active]="activeTab() === 'ride'" (click)="activeTab.set('ride')">Book a Ride</button>
          <button [class.active]="activeTab() === 'parcel'" (click)="activeTab.set('parcel')">Send a Parcel</button>
        </div>

        <div class="steps-grid" *ngIf="activeTab() === 'ride'">
          <div class="step-card" data-aos="fade-up" data-aos-delay="100">
            <div class="step-number">01</div>
            <div class="step-icon">📍</div>
            <h3>Request</h3>
            <p>Set your destination and see the estimated fare upfront.</p>
          </div>
          <div class="step-card" data-aos="fade-up" data-aos-delay="200">
            <div class="step-number">02</div>
            <div class="step-icon">🏍️</div>
            <h3>Match</h3>
            <p>We'll pair you with a nearby verified rider in seconds.</p>
          </div>
          <div class="step-card" data-aos="fade-up" data-aos-delay="300">
            <div class="step-number">03</div>
            <div class="step-icon">🏁</div>
            <h3>Arrive</h3>
            <p>Enjoy your ride and pay securely via M-Pesa or Cash.</p>
          </div>
        </div>

        <div class="steps-grid" *ngIf="activeTab() === 'parcel'">
          <div class="step-card" data-aos="fade-up" data-aos-delay="100">
            <div class="step-number">01</div>
            <div class="step-icon">📦</div>
            <h3>Pack</h3>
            <p>Enter parcel details and recipient contact information.</p>
          </div>
          <div class="step-card" data-aos="fade-up" data-aos-delay="200">
            <div class="step-number">02</div>
            <div class="step-icon">🚚</div>
            <h3>Pickup</h3>
            <p>A rider arrives at your door to safely collect the package.</p>
          </div>
          <div class="step-card" data-aos="fade-up" data-aos-delay="300">
            <div class="step-number">03</div>
            <div class="step-icon">📱</div>
            <h3>Track</h3>
            <p>Recipient receives a notification. Track the delivery live.</p>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .how { padding: 100px 0; background: var(--clr-bg); }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .section-header { text-align: center; margin-bottom: 40px; }
    .section-title { font-size: 36px; font-weight: 800; margin-bottom: 16px; }
    .section-desc { font-size: 16px; color: var(--clr-text-muted); max-width: 600px; margin: 0 auto; }
    
    .tab-toggle {
      display: flex; justify-content: center; gap: 8px; margin-bottom: 60px;
      background: var(--clr-bg-card); padding: 6px; border-radius: var(--radius-md);
      width: fit-content; margin-inline: auto; border: 1px solid var(--clr-border);
      button {
        padding: 10px 24px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 600;
        cursor: pointer; color: var(--clr-text-muted); transition: all 0.2s;
        &.active { background: var(--clr-primary); color: #fff; }
      }
    }

    .steps-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px;
    }
    .step-card {
      background: var(--clr-bg-card); padding: 40px; border-radius: var(--radius-lg);
      border: 1px solid var(--clr-border); position: relative;
      transition: transform 0.3s ease;
      &:hover { transform: translateY(-10px); border-color: var(--clr-primary); }
    }
    .step-number {
      position: absolute; top: 20px; right: 30px;
      font-size: 48px; font-weight: 900; color: var(--clr-primary); opacity: 0.1;
    }
    .step-icon {
      font-size: 40px; margin-bottom: 24px;
      width: 64px; height: 64px; background: rgba(255,107,0,0.1);
      display: flex; align-items: center; justify-content: center; border-radius: 16px;
    }
    h3 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 15px; color: var(--clr-text-muted); line-height: 1.6; }
  `]
})
export class HowItWorksComponent {
  activeTab = signal<'ride' | 'parcel'>('ride');
}
