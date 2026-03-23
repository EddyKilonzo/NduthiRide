import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-landing-nav',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav class="nav" [class.nav--scrolled]="isScrolled">
      <div class="nav__container">
        <div class="nav__logo" [routerLink]="['/']">
          <div class="logo-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/>
              <circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
            </svg>
          </div>
          <span class="logo-text">NduthiRide</span>
        </div>

        <div class="nav__links">
          <a href="#how-it-works">How It Works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#download">Download</a>
        </div>

        <div class="nav__actions">
          <button class="theme-toggle" (click)="themeSvc.toggle()">
            {{ themeSvc.theme() === 'dark' ? '☀️' : '🌙' }}
          </button>
          <a [routerLink]="['/auth/login']" class="btn btn--ghost">Sign In</a>
          <a [routerLink]="['/auth/register']" class="btn btn--primary pill">Get Started</a>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      height: 90px; display: flex; align-items: center;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      background: transparent;
      transform: translateY(-10px);
      animation: navAppear 0.5s forwards;
    }
    @keyframes navAppear { to { transform: translateY(0); opacity: 1; } }

    .nav--scrolled {
      background: rgba(26, 26, 46, 0.8);
      backdrop-filter: blur(12px);
      height: 70px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .nav__container {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; max-width: 1300px; margin: 0 auto; padding: 0 32px;
    }

    .nav__logo {
      display: flex; align-items: center; gap: 12px; cursor: pointer;
      .logo-circle {
        width: 40px; height: 40px; background: var(--primary); border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        color: #fff; svg { width: 22px; height: 22px; }
      }
      .logo-text {
        font-family: var(--font-display); font-size: 22px; font-weight: 800;
        color: #fff; letter-spacing: -0.5px;
      }
    }

    .nav__links {
      display: flex; gap: 32px;
      @media (max-width: 992px) { display: none; }
      a {
        color: rgba(255,255,255,0.7); font-weight: 600; font-size: 14px;
        text-decoration: none; transition: all 0.2s;
        &:hover { color: var(--primary); }
      }
    }

    .nav__actions { display: flex; align-items: center; gap: 20px; }

    .btn.pill { border-radius: var(--radius-full); }

    .theme-toggle {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      width: 38px; height: 38px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 16px; transition: all 0.3s;
      &:hover { border-color: var(--primary); transform: rotate(15deg); }
    }
  `]
})
export class LandingNavComponent {
  protected readonly themeSvc = inject(ThemeService);
  isScrolled = false;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 60;
  }
}
