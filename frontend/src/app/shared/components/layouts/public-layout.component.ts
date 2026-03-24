import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, SiteHeaderComponent, FooterComponent],
  template: `
    <app-site-header />
    <router-outlet />
    <app-footer />
  `,
})
export class PublicLayoutComponent {}
