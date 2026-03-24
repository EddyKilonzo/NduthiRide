import { Component, HostListener, AfterViewInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss',
})
export class SiteHeaderComponent implements AfterViewInit {
  private readonly themeSvc = inject(ThemeService);

  readonly isDark = this.themeSvc.theme;

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
}
