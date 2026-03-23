import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="shell">
      <app-sidebar />
      <main class="shell__content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .shell { display: flex; min-height: 100vh; }
    .shell__content { flex: 1; padding: 32px; overflow-y: auto; }
  `],
})
export class ShellComponent {}
