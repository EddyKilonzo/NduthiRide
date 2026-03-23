import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="logo" [style.scale]="sizeScale">
      <div class="logo__circle">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 15.5C19 16.3284 18.3284 17 17.5 17C16.6716 17 16 16.3284 16 15.5C16 14.6716 16.6716 14 17.5 14C18.3284 14 19 14.6716 19 15.5ZM6.5 17C7.32843 17 8 16.3284 8 15.5C8 14.6716 7.32843 14 6.5 14C5.67157 14 5 14.6716 5 15.5C5 16.3284 5.67157 17 6.5 17Z" fill="white"/>
          <path d="M21 15.5C21 17.433 19.433 19 17.5 19C15.567 19 14 17.433 14 15.5C14 15.111 14.063 14.737 14.18 14.388L12.56 12H10.44L8.82 14.388C8.937 14.737 9 15.111 9 15.5C9 17.433 7.433 19 5.5 19C3.567 19 2 17.433 2 15.5C2 13.567 3.567 12 5.5 12C5.889 12 6.263 12.063 6.612 12.18L8.232 9.792C7.41 9.417 6.84 8.583 6.84 7.615C6.84 6.171 8.011 5 9.455 5H13V7H9.455C9.118 7 8.84 7.278 8.84 7.615C8.84 7.952 9.118 8.23 9.455 8.23H13.5L15.5 11.23L17.12 13.65C17.243 13.65 17.37 13.65 17.5 13.65C19.433 13.65 21 15.217 21 17.15V15.5Z" fill="white"/>
        </svg>
      </div>
      <span class="logo__text" *ngIf="showText">NduthiRide</span>
    </div>
  `,
  styles: [`
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo__circle {
      width: 40px; height: 40px; background: var(--primary);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      padding: 8px; box-shadow: 0 4px 12px rgba(232, 75, 14, 0.3);
    }
    .logo__text {
      font-family: var(--font-display); font-size: 22px; font-weight: 800;
      color: #fff; letter-spacing: -0.5px;
    }
    svg { width: 100%; height: 100%; }
  `]
})
export class LogoComponent {
  @Input() showText = true;
  @Input() sizeScale = '1';
}
