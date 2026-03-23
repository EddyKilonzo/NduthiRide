import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="hero">
      <div class="hero__container container">
        <div class="hero__content" data-aos="fade-right">
          <span class="hero__badge">Available in Nairobi & Beyond</span>
          <h1 class="hero__title">The Smartest Way to <span class="text-primary">Ride & Send</span> Parcels</h1>
          <p class="hero__description">
            Experience lightning-fast motorcycle-taxis and reliable parcel delivery at the tap of a button. 
            Safe, affordable, and built for the modern city.
          </p>
          <div class="hero__actions">
            <a [routerLink]="['/auth/register']" class="btn btn--primary btn--lg">Book a Ride</a>
            <a href="#how-it-works" class="btn btn--secondary btn--lg">Learn More</a>
          </div>
        </div>
        
        <div class="hero__image" data-aos="fade-left" data-aos-delay="200">
          <!-- CSS Phone Mockup -->
          <div class="phone-mockup">
            <div class="phone-frame">
              <div class="phone-screen">
                <div class="app-header">
                  <span class="app-logo">🏍️</span>
                  <div class="app-profile"></div>
                </div>
                <div class="app-content">
                  <div class="app-map">
                    <div class="map-rider">🛵</div>
                    <div class="map-user">📍</div>
                  </div>
                  <div class="app-card">
                    <div class="card-line long"></div>
                    <div class="card-line short"></div>
                    <div class="card-btn"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="phone-shadow"></div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .hero { padding: 160px 0 100px; background: var(--clr-bg); overflow: hidden; }
    .hero__container {
      display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 60px;
      align-items: center; max-width: 1200px; margin: 0 auto; padding: 0 24px;
      @media (max-width: 992px) { grid-template-columns: 1fr; text-align: center; }
    }
    .hero__badge {
      display: inline-block; padding: 6px 16px; background: rgba(255,107,0,.1);
      color: var(--clr-primary); border-radius: var(--radius-full);
      font-size: 13px; font-weight: 700; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px;
    }
    .hero__title { font-size: clamp(40px, 5vw, 64px); line-height: 1.1; font-weight: 800; margin-bottom: 24px; color: var(--clr-text); }
    .hero__description { font-size: 18px; color: var(--clr-text-muted); margin-bottom: 40px; max-width: 540px; @media (max-width: 992px) { margin-inline: auto; } }
    .hero__actions { display: flex; gap: 16px; @media (max-width: 992px) { justify-content: center; } }

    /* Phone Mockup Styling */
    .phone-mockup { position: relative; width: 280px; margin: 0 auto; }
    .phone-frame {
      width: 280px; height: 560px; background: #1a1a1a; border-radius: 40px;
      padding: 12px; box-shadow: inset 0 0 2px 2px rgba(255,255,255,0.1), 0 20px 50px rgba(0,0,0,0.3);
      border: 4px solid #333; position: relative; z-index: 2;
    }
    .phone-screen {
      width: 100%; height: 100%; background: #fff; border-radius: 30px;
      overflow: hidden; display: flex; flex-direction: column;
    }
    .app-header { height: 60px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #eee; }
    .app-logo { font-size: 24px; }
    .app-profile { width: 32px; height: 32px; background: #eee; border-radius: 50%; }
    .app-content { flex: 1; background: #f8f9fa; display: flex; flex-direction: column; }
    .app-map { flex: 1; background: #e9ecef; position: relative; overflow: hidden; }
    .map-rider { position: absolute; top: 40%; left: 30%; font-size: 24px; animation: drive 4s infinite linear; }
    .map-user { position: absolute; top: 60%; right: 20%; font-size: 20px; }
    .app-card { background: #fff; margin: 16px; padding: 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .card-line { height: 8px; background: #eee; border-radius: 4px; margin-bottom: 8px; }
    .card-line.long { width: 100%; }
    .card-line.short { width: 60%; }
    .card-btn { height: 36px; background: var(--clr-primary); border-radius: 8px; margin-top: 12px; }
    
    .phone-shadow {
      position: absolute; bottom: -20px; left: 10%; width: 80%; height: 40px;
      background: rgba(0,0,0,0.2); filter: blur(20px); border-radius: 50%;
    }

    @keyframes drive {
      0% { transform: translate(0, 0); }
      25% { transform: translate(20px, -10px); }
      50% { transform: translate(40px, 10px); }
      75% { transform: translate(20px, 20px); }
      100% { transform: translate(0, 0); }
    }
  `]
})
export class HeroSectionComponent {}
