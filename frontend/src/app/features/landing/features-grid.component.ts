import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-features-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="features" class="features">
      <div class="container">
        <div class="features__grid">
          <div class="features__text" data-aos="fade-right">
            <h2 class="section-title">Why Choose <span class="text-primary">NduthiRide?</span></h2>
            <p class="section-desc">We've built the ultimate platform for urban mobility, focusing on what matters most to you.</p>
            
            <ul class="features-list">
              <li>
                <div class="feat-icon">🛡️</div>
                <div>
                  <h4>Safety First</h4>
                  <p>Every rider is manually verified and background-checked for your peace of mind.</p>
                </div>
              </li>
              <li>
                <div class="feat-icon">⌛</div>
                <div>
                  <h4>Real-time Tracking</h4>
                  <p>Watch your rider or parcel move on the map in real-time from start to finish.</p>
                </div>
              </li>
              <li>
                <div class="feat-icon">💸</div>
                <div>
                  <h4>Fair Pricing</h4>
                  <p>Transparent fare estimates before you book. No hidden charges or surprises.</p>
                </div>
              </li>
            </ul>
          </div>
          
          <div class="features__cards" data-aos="fade-left">
            <div class="feat-card feat-card--accent">
              <div class="feat-card__icon">📱</div>
              <h3>PWA Support</h3>
              <p>Install NduthiRide on your phone home screen for an app-like experience without the App Store.</p>
            </div>
            <div class="feat-card">
              <div class="feat-card__icon">💬</div>
              <h3>In-App Chat</h3>
              <p>Communicate directly with your rider through our secure real-time messaging system.</p>
            </div>
            <div class="feat-card">
              <div class="feat-card__icon">📊</div>
              <h3>Business Ready</h3>
              <p>Detailed history and receipts for all your personal and business deliveries.</p>
            </div>
            <div class="feat-card feat-card--dark">
              <div class="feat-card__icon">🌙</div>
              <h3>Modern UI</h3>
              <p>Enjoy a beautiful interface with full support for Dark and Light modes.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .features { padding: 100px 0; background: var(--clr-bg-card); }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    
    .features__grid {
      display: grid; grid-template-columns: 1fr 1.2fr; gap: 80px; align-items: center;
      @media (max-width: 992px) { grid-template-columns: 1fr; gap: 60px; }
    }
    
    .section-title { font-size: 36px; font-weight: 800; margin-bottom: 20px; }
    .section-desc { font-size: 17px; color: var(--clr-text-muted); margin-bottom: 48px; }
    
    .features-list {
      list-style: none; display: flex; flex-direction: column; gap: 32px;
      li { display: flex; gap: 20px; }
      h4 { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
      p { color: var(--clr-text-muted); font-size: 15px; line-height: 1.5; }
    }
    .feat-icon {
      width: 48px; height: 48px; background: var(--clr-bg-elevated);
      display: flex; align-items: center; justify-content: center;
      border-radius: 12px; font-size: 24px; flex-shrink: 0;
    }
    
    .features__cards {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
      @media (max-width: 480px) { grid-template-columns: 1fr; }
    }
    .feat-card {
      background: var(--clr-bg); padding: 32px; border-radius: var(--radius-lg);
      border: 1px solid var(--clr-border);
      &__icon { font-size: 32px; margin-bottom: 20px; }
      h3 { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
      p { font-size: 14px; color: var(--clr-text-muted); line-height: 1.6; }
      
      &--accent { border-color: var(--clr-primary); background: rgba(255,107,0,0.03); }
      &--dark { background: #000; border-color: #333; * { color: #fff !important; } }
    }
  `]
})
export class FeaturesGridComponent {}
