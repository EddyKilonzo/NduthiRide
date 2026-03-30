import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="spinner-wrap" [class.spinner-wrap--overlay]="overlay">
      <div class="spinner" [style.width.px]="size" [style.height.px]="size"></div>
    </div>
  `,
  styles: [`
    .spinner-wrap {
      display: flex; align-items: center; justify-content: center; padding: 32px;
    }
    .spinner-wrap--overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      z-index: 999;
    }
    .spinner {
      border: 3px solid var(--clr-border);
      border-top-color: var(--clr-primary);
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class SpinnerComponent {
  @Input() size = 36;
  @Input() overlay = false;
}
