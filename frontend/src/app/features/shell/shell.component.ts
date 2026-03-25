import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, SiteHeaderComponent, FooterComponent],
  template: `
    <app-site-header />
    <div class="shell">
      <app-sidebar />
      <main class="shell__content">
        <router-outlet />
      </main>
    </div>
    <app-footer />
  `,
  styles: [`
    .shell { 
      display: flex; 
      min-height: calc(100vh - 90px); 
      margin-top: 90px;
      background: var(--clr-bg);
    }
    @media (max-width: 900px) {
      .shell { flex-direction: column; }
    }
    .shell__content { 
      flex: 1; 
      min-width: 0;
      padding: clamp(16px, 3.5vw, 32px); 
      overflow-y: auto;
    }
  `],
})
export class ShellComponent {}
