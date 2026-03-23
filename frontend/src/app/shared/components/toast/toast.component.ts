import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toastSvc.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.type }}" (click)="toastSvc.dismiss(toast.id)">
          <div class="toast__content">
            <span class="toast__icon">{{ icons[toast.type] }}</span>
            <span class="toast__msg">{{ toast.message }}</span>
          </div>
          <div class="toast__timer">
            <div class="toast__timer-bar" [style.animation-duration]="toast.duration + 'ms'"></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed; top: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 12px;
      z-index: 9999; max-width: 380px;
    }
    .toast {
      position: relative;
      overflow: hidden;
      display: flex; flex-direction: column;
      min-width: 280px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      cursor: pointer;
      animation: toastIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      border: 1px solid rgba(255, 255, 255, 0.3);
      transition: transform 0.2s ease, opacity 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.95);
      }

      &--success {
        border-left: 4px solid #22c55e;
        .toast__icon { color: #22c55e; }
        .toast__timer-bar { background: #22c55e; }
      }
      &--error {
        border-left: 4px solid #ef4444;
        .toast__icon { color: #ef4444; }
        .toast__timer-bar { background: #ef4444; }
      }
      &--warning {
        border-left: 4px solid #f59e0b;
        .toast__icon { color: #f59e0b; }
        .toast__timer-bar { background: #f59e0b; }
      }
      &--info {
        border-left: 4px solid #3b82f6;
        .toast__icon { color: #3b82f6; }
        .toast__timer-bar { background: #3b82f6; }
      }
    }
    .toast__content {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px;
    }
    .toast__icon {
      font-size: 20px;
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px;
      background: rgba(0,0,0,0.03);
      border-radius: 50%;
    }
    .toast__msg {
      font-size: 14px; font-weight: 500; color: #1f2937;
      line-height: 1.4;
    }
    .toast__timer {
      height: 3px; width: 100%; background: rgba(0,0,0,0.05);
    }
    .toast__timer-bar {
      height: 100%; width: 100%;
      transform-origin: left;
      animation: timerProgress linear forwards;
    }

    @keyframes toastIn {
      from { opacity: 0; transform: translateX(100%) scale(0.9); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }

    @keyframes timerProgress {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }
  `],
})
export class ToastComponent {
  protected readonly toastSvc = inject(ToastService);
  protected readonly icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
}
