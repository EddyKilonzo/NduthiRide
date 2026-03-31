import { Component, HostListener, AfterViewInit, inject, computed, signal } from '@angular/core';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsService } from '../../../core/services/notifications.service';

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss',
})
export class SiteHeaderComponent implements AfterViewInit {
  private readonly themeSvc = inject(ThemeService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly notificationsSvc = inject(NotificationsService);

  readonly isDark = this.themeSvc.theme;
  readonly unreadNotifications = this.notificationsSvc.unreadCount;
  readonly menuOpen = signal(false);

  protected readonly dashboardPath = computed(() => {
    const r = this.auth.role();
    if (r === 'ADMIN') return '/admin';
    if (r === 'RIDER') return '/rider';
    return '/user';
  });

  protected readonly sessionFirstName = computed(() => {
    const n = this.auth.user()?.fullName?.split(' ')?.[0];
    return n?.length ? n : 'Account';
  });

  navScrolled = false;

  ngAfterViewInit(): void {
    this.syncScrollState();
    // Close menu on route change
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) this.menuOpen.set(false);
    });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.syncScrollState();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (window.innerWidth > 992) this.menuOpen.set(false);
  }

  private syncScrollState(): void {
    const next = window.scrollY > 60;
    if (this.navScrolled !== next) this.navScrolled = next;
  }

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  toggleTheme(): void {
    this.themeSvc.toggle();
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
