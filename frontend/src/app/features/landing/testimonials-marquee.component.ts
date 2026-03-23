import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-testimonials-marquee',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="testimonials" class="testimonials">
      <div class="container">
        <div class="section-header" data-aos="fade-up">
          <h2 class="section-title">Trusted by <span class="text-primary">Thousands</span></h2>
          <p class="section-desc">Our community is at the heart of everything we do.</p>
        </div>

        <!-- Row 1: Scrolling Left -->
        <div class="marquee-container" data-aos="fade-up">
          <div class="marquee marquee--left">
            <div class="testimonial-card" *ngFor="let t of row1">
              <div class="quote">"{{ t.text }}"</div>
              <div class="user">
                <div class="avatar">{{ t.name[0] }}</div>
                <div>
                  <div class="name">{{ t.name }}</div>
                  <div class="role">{{ t.role }}</div>
                </div>
              </div>
            </div>
            <!-- Duplicate for loop -->
            <div class="testimonial-card" *ngFor="let t of row1">
              <div class="quote">"{{ t.text }}"</div>
              <div class="user">
                <div class="avatar">{{ t.name[0] }}</div>
                <div>
                  <div class="name">{{ t.name }}</div>
                  <div class="role">{{ t.role }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 2: Scrolling Right -->
        <div class="marquee-container" data-aos="fade-up" data-aos-delay="100">
          <div class="marquee marquee--right">
            <div class="testimonial-card" *ngFor="let t of row2">
              <div class="quote">"{{ t.text }}"</div>
              <div class="user">
                <div class="avatar">{{ t.name[0] }}</div>
                <div>
                  <div class="name">{{ t.name }}</div>
                  <div class="role">{{ t.role }}</div>
                </div>
              </div>
            </div>
            <!-- Duplicate for loop -->
            <div class="testimonial-card" *ngFor="let t of row2">
              <div class="quote">"{{ t.text }}"</div>
              <div class="user">
                <div class="avatar">{{ t.name[0] }}</div>
                <div>
                  <div class="name">{{ t.name }}</div>
                  <div class="role">{{ t.role }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .testimonials { padding: 100px 0; background: var(--clr-bg); overflow: hidden; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .section-header { text-align: center; margin-bottom: 60px; }
    .section-title { font-size: 36px; font-weight: 800; margin-bottom: 16px; }
    .section-desc { font-size: 16px; color: var(--clr-text-muted); }

    .marquee-container { position: relative; width: 100%; margin-bottom: 24px; overflow: hidden; }
    .marquee {
      display: flex; gap: 24px; width: max-content;
      &:hover { animation-play-state: paused; }
    }
    
    .marquee--left { animation: marquee-left 40s linear infinite; }
    .marquee--right { animation: marquee-right 40s linear infinite; }

    .testimonial-card {
      width: 380px; background: var(--clr-bg-card); padding: 32px;
      border-radius: var(--radius-lg); border: 1px solid var(--clr-border);
      display: flex; flex-direction: column; gap: 20px;
    }
    .quote { font-size: 15px; color: var(--clr-text); line-height: 1.6; font-style: italic; }
    .user { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 40px; height: 40px; background: var(--clr-primary);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 700;
    }
    .name { font-size: 14px; font-weight: 700; }
    .role { font-size: 12px; color: var(--clr-text-muted); }

    @keyframes marquee-left {
      0% { transform: translateX(0); }
      100% { transform: translateX(calc(-50% - 12px)); }
    }
    @keyframes marquee-right {
      0% { transform: translateX(calc(-50% - 12px)); }
      100% { transform: translateX(0); }
    }
  `]
})
export class TestimonialsMarqueeComponent {
  row1 = [
    { name: 'Sarah W.', role: 'Daily Commuter', text: 'NduthiRide is a lifesaver! I never have to worry about traffic or overcharging anymore.' },
    { name: 'David M.', role: 'Verified Rider', text: 'Joining as a rider was the best decision. The flexible hours and steady requests are great.' },
    { name: 'Business Inc.', role: 'Merchant', text: 'The parcel delivery service is extremely reliable. Our customers love the real-time tracking.' },
  ];
  row2 = [
    { name: 'Kevin O.', role: 'User', text: 'The app is so smooth and the dark mode looks amazing. Best boda app in Kenya!' },
    { name: 'Anita K.', role: 'Student', text: 'Fair prices and very professional riders. I use it every day to get to campus.' },
    { name: 'John D.', role: 'Corporate Client', text: 'Setting up a business account was seamless. Highly recommend for city logistics.' },
  ];
}
