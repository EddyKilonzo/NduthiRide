import { Component, signal, OnInit, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stats-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="stats" #statsSection>
      <div class="stats__container container">
        <div class="stat-item" data-aos="fade-up" data-aos-delay="0">
          <span class="stat-value">{{ rides().toLocaleString() }}+</span>
          <span class="stat-label">Happy Riders</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item" data-aos="fade-up" data-aos-delay="100">
          <span class="stat-value">{{ jobs().toLocaleString() }}+</span>
          <span class="stat-label">Completed Jobs</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item" data-aos="fade-up" data-aos-delay="200">
          <span class="stat-value">{{ rating() }}★</span>
          <span class="stat-label">Avg. Rating</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item" data-aos="fade-up" data-aos-delay="300">
          <span class="stat-value">&lt; {{ time() }}min</span>
          <span class="stat-label">Pickup Time</span>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .stats {
      padding: 60px 0;
      background: var(--clr-bg-card);
      border-top: 1px solid var(--clr-border);
      border-bottom: 1px solid var(--clr-border);
    }
    .stats__container {
      display: flex; justify-content: space-between; align-items: center;
      max-width: 1200px; margin: 0 auto; padding: 0 24px;
      @media (max-width: 768px) { flex-wrap: wrap; gap: 40px; justify-content: center; }
    }
    .stat-item { display: flex; flex-direction: column; align-items: center; text-align: center; flex: 1; }
    .stat-value { font-size: 36px; font-weight: 800; color: var(--clr-primary); line-height: 1; margin-bottom: 12px; font-variant-numeric: tabular-nums; }
    .stat-label { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 1.5px; }
    .stat-divider { width: 1px; height: 50px; background: var(--clr-border); @media (max-width: 768px) { display: none; } }
  `]
})
export class StatsBarComponent implements OnInit {
  private el = inject(ElementRef);
  
  rides = signal(0);
  jobs = signal(0);
  rating = signal(0);
  time = signal(0);

  ngOnInit() {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        this.animateStats();
        observer.disconnect();
      }
    }, { threshold: 0.5 });

    observer.observe(this.el.nativeElement);
  }

  private animateStats() {
    this.countUp(this.rides, 50000, 2000);
    this.countUp(this.jobs, 1000000, 2500);
    this.countUp(this.rating, 4.8, 1500, true);
    this.countUp(this.time, 5, 1000);
  }

  private countUp(sig: any, target: number, duration: number, isFloat = false) {
    const start = 0;
    const startTime = performance.now();

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out expo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = start + (target - start) * easeProgress;
      
      sig.set(isFloat ? parseFloat(current.toFixed(1)) : Math.floor(current));

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  }
}
