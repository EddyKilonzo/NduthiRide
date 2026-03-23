import { Component, signal, inject, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import * as AOS from 'aos';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements AfterViewInit {
  protected readonly title = signal('NduthiRide');
  private readonly themeSvc = inject(ThemeService);

  ngAfterViewInit() {
    AOS.init({
      duration: 800,
      once: true,
      mirror: false
    });
  }
}
