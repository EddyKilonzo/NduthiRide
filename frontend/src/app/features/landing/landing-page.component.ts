import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingNavComponent } from './landing-nav.component';
import { HeroSectionComponent } from './hero-section.component';
import { StatsBarComponent } from './stats-bar.component';
import { HowItWorksComponent } from './how-it-works.component';
import { FeaturesGridComponent } from './features-grid.component';
import { TestimonialsMarqueeComponent } from './testimonials-marquee.component';
import { CtaBannerComponent } from './cta-banner.component';
import { LandingFooterComponent } from './landing-footer.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    LandingNavComponent,
    HeroSectionComponent,
    StatsBarComponent,
    HowItWorksComponent,
    FeaturesGridComponent,
    TestimonialsMarqueeComponent,
    CtaBannerComponent,
    LandingFooterComponent
  ],
  template: `
    <div class="landing bg-grain">
      <!-- Decorative Orbs -->
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      
      <app-landing-nav />
      <app-hero-section />
      <app-stats-bar />
      <app-how-it-works />
      <app-features-grid />
      <app-testimonials-marquee />
      <app-cta-banner />
      <app-landing-footer />
    </div>
  `,
  styles: [`
    .landing {
      background: var(--secondary);
      color: #fff;
      overflow-x: hidden;
      position: relative;
      min-height: 100vh;
    }

    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(120px);
      z-index: 0;
      pointer-events: none;
      opacity: 0.15;
    }
    .orb-1 { width: 600px; height: 600px; background: var(--primary); top: -100px; right: -200px; }
    .orb-2 { width: 500px; height: 500px; background: var(--accent); bottom: 10%; left: -150px; }

    /* Custom scroll behavior for the whole page */
    :host { display: block; }
  `]
})
export class LandingPageComponent {}
