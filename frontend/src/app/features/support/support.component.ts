import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SupportService } from '../../core/services/support.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, SpinnerComponent],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <lucide-icon name="help-circle" [size]="28"></lucide-icon>
          </div>
          <div>
            <h1>Help & Support</h1>
            <p>How can we help you today?</p>
          </div>
        </div>
      </div>

      <div class="support-grid">
        <!-- Ticket Form -->
        <div class="card support-card">
          <div class="card-header">
            <h3>Submit a Request</h3>
          </div>
          <form [formGroup]="supportForm" (ngSubmit)="submitTicket()" class="support-form">
            <div class="form-group">
              <label>Subject</label>
              <input type="text" formControlName="subject" placeholder="What is this about?" />
            </div>
            <div class="form-group">
              <label>Priority</label>
              <select formControlName="priority">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div class="form-group">
              <label>Message</label>
              <textarea formControlName="message" rows="5" placeholder="Describe your issue in detail..."></textarea>
            </div>
            <button type="submit" class="btn btn--primary btn--pill" [disabled]="submitting() || supportForm.invalid">
              @if (submitting()) {
                <app-spinner [size]="18" /> Submitting...
              } @else {
                Send Message
              }
            </button>
          </form>
        </div>

        <!-- Ticket List -->
        <div class="my-tickets">
          <h2 class="section-title">My Recent Requests</h2>
          @if (loading()) {
            <div class="loader-wrap"><app-spinner /></div>
          } @else if (tickets().length === 0) {
            <div class="empty-tickets card">
              <p>You haven't submitted any requests yet.</p>
            </div>
          } @else {
            <div class="ticket-list">
              @for (t of tickets(); track t.id) {
                <div class="ticket-item card modern-shadow">
                  <div class="ticket-header">
                    <span class="ticket-subject">{{ t.subject }}</span>
                    <span class="badge badge--{{ badge(t.status) }}">{{ t.status }}</span>
                  </div>
                  <p class="ticket-msg">{{ t.message }}</p>
                  <div class="ticket-footer">
                    <span class="ticket-date">{{ t.createdAt | date:'shortDate' }}</span>
                    <span class="ticket-priority" [class]="t.priority.toLowerCase()">{{ t.priority }} Priority</span>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .header-content { display: flex; align-items: center; gap: 16px; }
    .header-icon {
      width: 48px; height: 48px; border-radius: var(--radius-md);
      background: var(--clr-bg-elevated); color: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      box-shadow: var(--shadow-sm);
    }
    .support-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 24px; align-items: start; }
    .card-header h3 { font-size: 16px; font-weight: 700; margin: 0; }
    .support-form { display: flex; flex-direction: column; gap: 20px; padding: 24px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 13px; font-weight: 700; color: var(--clr-text-muted); }
    input, select, textarea {
      padding: 12px 16px; border-radius: var(--radius-md); background: var(--clr-bg-elevated);
      border: 1px solid var(--clr-border); color: var(--clr-text); font-size: 14px;
      transition: all 0.2s;
      &:focus { border-color: var(--clr-primary); outline: none; }
    }
    .section-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
    .ticket-list { display: flex; flex-direction: column; gap: 12px; }
    .ticket-item { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .ticket-header { display: flex; justify-content: space-between; align-items: center; }
    .ticket-subject { font-weight: 700; font-size: 14px; }
    .ticket-msg { font-size: 13px; color: var(--clr-text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ticket-footer { display: flex; justify-content: space-between; font-size: 11px; color: var(--clr-text-dim); border-top: 1px solid var(--clr-border); pt: 8px; margin-top: 4px; }
    .ticket-priority.high { color: var(--clr-error); font-weight: 700; }
    .empty-tickets { padding: 40px; text-align: center; color: var(--clr-text-dim); }
    .loader-wrap { display: flex; justify-content: center; padding: 40px; }

    @media (max-width: 900px) { .support-grid { grid-template-columns: 1fr; } }
  `],
})
export class SupportComponent implements OnInit {
  private readonly supportSvc = inject(SupportService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly tickets = signal<any[]>([]);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);

  protected readonly supportForm = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(5)]],
    priority: ['NORMAL'],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  async ngOnInit() {
    const subject = this.route.snapshot.queryParamMap.get('subject');
    if (subject) {
      this.supportForm.patchValue({ subject });
    }
    await this.loadTickets();
  }

  async loadTickets() {
    this.loading.set(true);
    try {
      this.tickets.set(await this.supportSvc.getMyTickets());
    } finally {
      this.loading.set(false);
    }
  }

  async submitTicket() {
    if (this.supportForm.invalid) return;
    this.submitting.set(true);
    try {
      const v = this.supportForm.getRawValue();
      await this.supportSvc.createTicket(v.subject!, v.message!, v.priority!);
      this.toast.success('Your request has been submitted');
      this.supportForm.reset({ priority: 'NORMAL' });
      await this.loadTickets();
    } finally {
      this.submitting.set(false);
    }
  }

  protected badge(status: string): string {
    const m: Record<string, string> = { OPEN: 'info', IN_PROGRESS: 'pending', CLOSED: 'active' };
    return m[status] ?? 'info';
  }
}
