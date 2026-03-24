import {
  Component,
  AfterViewInit,
  OnDestroy,
  inject,
  ElementRef,
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TextTypeComponent } from '../../shared/components/text-type/text-type.component';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, TextTypeComponent, LucideAngularModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss'],
})
export class LandingPageComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private revealObserver: IntersectionObserver | null = null;

  readonly heroTypewriterLines = [
    'Ride & Deliver',
    'Move Through Nairobi',
    'Ship Parcels in One Tap',
  ];

  readonly statsItems = [
    { val: '50,000+', lab: 'Happy Riders' },
    { val: '1,000,000+', lab: 'Completed Jobs' },
    { val: '4.8', lab: 'Avg. Rating' },
    { val: '5+ min', lab: 'Pickup Time' },
  ];

  readonly testimonialMarqueeItems = [
    {
      quote: 'NduthiRide has completely changed how I commute. Riders arrive fast and fares stay fair.',
      name: 'Sarah W.',
      initial: 'S',
      role: 'Daily commuter',
    },
    {
      quote: 'Flexible hours and steady requests — I earn more here than on other platforms.',
      name: 'David M.',
      initial: 'D',
      role: 'Verified rider',
    },
    {
      quote: 'Same-day parcel delivery with live tracking — our customers love it.',
      name: 'Citi Goods',
      initial: 'C',
      role: 'Merchant',
    },
    {
      quote: 'Affordable and professional riders every morning to campus.',
      name: 'Anita K.',
      initial: 'A',
      role: 'Student',
    },
    {
      quote: 'Dark mode UI is smooth — best boda experience I have used in Nairobi.',
      name: 'Kevin O.',
      initial: 'K',
      role: 'App user',
    },
    {
      quote: 'Business receipts and history make expense reporting trivial.',
      name: 'John D.',
      initial: 'J',
      role: 'Corporate client',
    },
  ] as const;

  readonly starRow = [0, 1, 2, 3, 4] as const;

  readonly featureItems = [
    {
      icon: 'zap',
      title: 'Fast matching',
      desc: 'Nearby riders are matched in seconds — typical pickup under five minutes.',
    },
    {
      icon: 'shield',
      title: 'Vetted riders',
      desc: 'Identity checks, safety training, and ratings keep every trip accountable.',
    },
    {
      icon: 'map-pin',
      title: 'Live tracking',
      desc: 'Follow your ride or parcel on the map from pickup to drop-off.',
    },
    {
      icon: 'smartphone',
      title: 'Flexible pay',
      desc: 'M-Pesa, cash, or in-app wallet — pay the way that suits you.',
    },
  ] as const;

  readonly accountTypes: Array<{
    badge: string;
    title: string;
    description: string;
    icon: string;
    cta: string;
    href: string;
    variant: 'passenger' | 'rider';
    points: string[];
  }> = [
    {
      badge: 'Ride & send',
      title: 'Passenger',
      description:
        'For commuters, students, and anyone sending parcels — book rides and deliveries from one place.',
      icon: 'user',
      cta: 'Create passenger account',
      href: '/auth/register',
      variant: 'passenger',
      points: [
        'Upfront fares before you confirm',
        'Parcel tracking and proof of delivery',
        'Saved locations and trip history',
      ],
    },
    {
      badge: 'Earn on the road',
      title: 'Rider',
      description:
        'For vetted boda operators who want steady requests, clear payouts, and in-app navigation.',
      icon: 'bike',
      cta: 'Apply as a rider',
      href: '/auth/register-rider',
      variant: 'rider',
      points: [
        'Accept rides & delivery jobs',
        'In-app navigation and earnings view',
        'Support and onboarding from our team',
      ],
    },
  ];

  readonly faqs = [
    {
      q: 'How do I book a ride?',
      a: 'Open the app, enter your destination, confirm the fare, and tap "Book a Ride". A rider will arrive in minutes.',
      open: false,
    },
    {
      q: 'Is my parcel delivery insured?',
      a: 'Yes, every parcel sent via NduthiRide is covered by our transit protection policy for your peace of mind.',
      open: false,
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept M-Pesa, Cash, and our in-app Nduthi Wallet for seamless payments.',
      open: false,
    },
    {
      q: 'How do I become a rider?',
      a: 'Register through our "Become a Rider" link, complete the basic info, and our onboarding team will contact you.',
      open: false,
    },
  ];

  ngAfterViewInit(): void {
    this.initHeroGridReveal();
    this.initHeroGSAPAnimation();
    // Two rAFs: wait until the browser paints after *ngFor / child components.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.initScrollReveal());
    });
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.revealObserver = null;
  }

  toggleFaq(index: number): void {
    this.faqs[index].open = !this.faqs[index].open;
  }

  /**
   * Native scroll reveal scoped to this component (AOS is unreliable with Angular's DOM timing).
   * Template keeps `data-aos` values as animation IDs; we map them in SCSS.
   */
  private initScrollReveal(): void {
    this.revealObserver?.disconnect();
    const root = this.host.nativeElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const markVisible = (el: HTMLElement): void => {
      if (el.classList.contains('landing-reveal--visible')) return;
      const delay = Number.parseInt(el.dataset['aosDelay'] ?? '0', 10) || 0;
      const duration =
        Number.parseInt(el.dataset['aosDuration'] ?? '800', 10) || 800;
      el.style.setProperty('--reveal-duration', `${duration}ms`);
      if (delay > 0) {
        el.style.transitionDelay = `${delay}ms`;
      }
      el.classList.add('landing-reveal--visible');
      this.revealObserver?.unobserve(el);
    };

    const nodes = Array.from(root.querySelectorAll('[data-aos]')) as HTMLElement[];

    if (reduced) {
      for (const el of nodes) {
        el.classList.add('landing-reveal--visible');
      }
      return;
    }

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          markVisible(entry.target as HTMLElement);
        }
      },
      { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );

    for (const el of nodes) {
      if (el.classList.contains('landing-reveal--visible')) continue;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.top < vh * 0.92 && rect.bottom > 0) {
        markVisible(el);
        continue;
      }
      this.revealObserver?.observe(el);
    }
  }

  private initHeroGridReveal(): void {
    const hero = document.getElementById('hero');
    const gridReveal = document.getElementById('gridReveal');

    hero?.addEventListener('mousemove', (e) => {
      if (!gridReveal) return;
      const rect = hero.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      gridReveal.style.maskImage = `radial-gradient(320px circle at ${x}px ${y}px, black, transparent)`;
      gridReveal.style.webkitMaskImage = `radial-gradient(320px circle at ${x}px ${y}px, black, transparent)`;
    });
  }

  private initHeroGSAPAnimation(): void {
    gsap.to('.orb-1', { y: 30, x: 20, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.orb-2', { y: -25, x: -15, duration: 5, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.5 });

    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      if (scrolled < 1000) {
        gsap.to('.orb-1', { y: scrolled * 0.1, duration: 0.5 });
        gsap.to('.orb-2', { y: -scrolled * 0.08, duration: 0.5 });
      }
    });
  }
}
