import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <footer class="footer">
      <div class="container">
        <div class="footer__grid" data-aos="fade-up">
          <div class="footer__brand">
            <div class="footer__logo">
              <span class="logo-icon">🏍</span>
              <span class="logo-text">NduthiRide</span>
            </div>
            <p class="footer__tagline">Revolutionizing urban mobility in Kenya, one ride at a time.</p>
            <div class="footer__social">
              <a href="#" class="social-link">𝕏</a>
              <a href="#" class="social-link">fb</a>
              <a href="#" class="social-link">ig</a>
            </div>
          </div>

          <div class="footer__links">
            <h4>Company</h4>
            <a href="#">About Us</a>
            <a href="#">Our Story</a>
            <a href="#">Careers</a>
            <a href="#">Press</a>
          </div>

          <div class="footer__links">
            <h4>Services</h4>
            <a [routerLink]="['/auth/register']">Book a Ride</a>
            <a [routerLink]="['/user/book-parcel']">Send a Parcel</a>
            <a [routerLink]="['/auth/register-rider']">Become a Rider</a>
            <a href="#">Business Portal</a>
          </div>

          <div class="footer__links">
            <h4>Support</h4>
            <a href="#">Help Center</a>
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Safety</a>
          </div>
        </div>

        <div class="footer__bottom">
          <p>&copy; 2026 NduthiRide Inc. All rights reserved. Made with ❤️ in Nairobi.</p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer { padding: 80px 0 40px; background: var(--clr-bg-card); border-top: 1px solid var(--clr-border); }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    
    .footer__grid {
      display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 60px;
      margin-bottom: 60px;
      @media (max-width: 992px) { grid-template-columns: 1fr 1fr; }
      @media (max-width: 480px) { grid-template-columns: 1fr; gap: 40px; }
    }
    
    .footer__logo {
      display: flex; align-items: center; gap: 10px; margin-bottom: 24px;
      .logo-icon { font-size: 28px; }
      .logo-text { font-size: 20px; font-weight: 800; color: var(--clr-primary); }
    }
    .footer__tagline { font-size: 15px; color: var(--clr-text-muted); line-height: 1.6; max-width: 300px; margin-bottom: 24px; }
    
    .footer__social { display: flex; gap: 12px; }
    .social-link {
      width: 36px; height: 36px; background: var(--clr-bg-elevated);
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; color: var(--clr-text); text-decoration: none;
      transition: all 0.2s;
      &:hover { background: var(--clr-primary); color: #fff; transform: translateY(-3px); }
    }
    
    .footer__links {
      display: flex; flex-direction: column; gap: 12px;
      h4 { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: var(--clr-text); }
      a { color: var(--clr-text-muted); font-size: 14px; text-decoration: none; transition: color 0.2s; &:hover { color: var(--clr-primary); } }
    }
    
    .footer__bottom {
      padding-top: 40px; border-top: 1px solid var(--clr-border);
      text-align: center; color: var(--clr-text-dim); font-size: 13px;
    }
  `]
})
export class LandingFooterComponent {}
