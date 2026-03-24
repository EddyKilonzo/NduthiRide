import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'nduthi_theme';
  readonly theme = signal<'dark' | 'light'>('dark');

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY) as 'dark' | 'light' | null;
    this.apply(saved || 'dark');
  }

  toggle(): void {
    this.apply(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private apply(t: 'dark' | 'light'): void {
    this.theme.set(t);
    document.documentElement.classList.toggle('light', t === 'light');
    document.documentElement.classList.toggle('dark', t === 'dark');
    localStorage.setItem(this.STORAGE_KEY, t);
  }
}
