import { Component, HostListener, AfterViewInit, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  protected readonly auth = inject(AuthService);
  protected readonly notificationsSvc = inject(NotificationsService);

  readonly isDark = this.themeSvc.theme;
  readonly unreadNotifications = this.notificationsSvc.unreadCount;

  /** Home route for the signed-in role (shell + public pages with a session). */
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
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.syncScrollState();
  }

  private syncScrollState(): void {
    const next = window.scrollY > 60;
    if (this.navScrolled !== next) {
      this.navScrolled = next;
    }
  }

  toggleTheme(): void {
    this.themeSvc.toggle();
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
