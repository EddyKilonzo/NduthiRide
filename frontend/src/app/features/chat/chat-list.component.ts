import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ChatService } from '../../core/services/chat.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, SpinnerComponent],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div>
          <h1>Messages</h1>
          <p>Recent conversations with riders and customers</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loader-wrap"><app-spinner /></div>
      } @else if (conversations().length === 0) {
        <div class="empty-state card modern-shadow">
          <lucide-icon name="message-square" [size]="48" class="muted-icon"></lucide-icon>
          <h3>No messages yet</h3>
          <p>Conversations will appear here once a ride or delivery starts.</p>
        </div>
      } @else {
        <div class="chat-list">
          @for (conv of conversations(); track conv.id) {
            <div class="card chat-item modern-shadow" [routerLink]="getChatLink(conv)">
              <div class="chat-item__avatar">
                @if (conv.otherPartyAvatar) {
                  <img [src]="conv.otherPartyAvatar" [alt]="conv.otherPartyName" />
                } @else {
                  <div class="avatar-placeholder">{{ conv.otherPartyName.charAt(0) }}</div>
                }
              </div>
              
              <div class="chat-item__content">
                <div class="chat-item__header">
                  <span class="name">{{ conv.otherPartyName }}</span>
                  <span class="time">{{ conv.updatedAt | date:'shortTime' }}</span>
                </div>
                <div class="chat-item__context">{{ conv.context }}</div>
                <div class="chat-item__preview">
                  {{ conv.lastMessage?.content || 'No messages yet' }}
                </div>
              </div>

              <div class="chat-item__meta">
                @if (conv.status === 'ACTIVE') {
                  <span class="status-indicator active" title="Active conversation"></span>
                }
                <lucide-icon name="chevron-right" [size]="18" class="text-dim"></lucide-icon>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .chat-list { display: flex; flex-direction: column; gap: 12px; }
    .chat-item {
      display: flex; align-items: center; gap: 16px; padding: 16px;
      cursor: pointer; transition: transform 0.2s, border-color 0.2s;
      border: 1px solid var(--clr-border);
      box-shadow: rgba(50, 50, 93, 0.25) 0px 50px 100px -20px, rgba(0, 0, 0, 0.3) 0px 30px 60px -30px, rgba(10, 37, 64, 0.35) 0px -2px 6px 0px inset;
    }
    .chat-item:hover { transform: translateY(-2px); border-color: var(--clr-primary); }
    
    .chat-item__avatar {
      width: 50px; height: 50px; border-radius: 50%; overflow: hidden;
      flex-shrink: 0; background: var(--clr-bg-elevated);
      display: flex; align-items: center; justify-content: center;
    }
    .chat-item__avatar img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-placeholder { font-size: 20px; font-weight: 700; color: var(--clr-primary); }

    .chat-item__content { flex: 1; min-width: 0; }
    .chat-item__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .chat-item__header .name { font-weight: 700; font-size: 15px; }
    .chat-item__header .time { font-size: 12px; color: var(--clr-text-dim); }
    
    .chat-item__context { font-size: 11px; font-weight: 600; color: var(--clr-primary); text-transform: uppercase; margin-bottom: 2px; }
    .chat-item__preview {
      font-size: 14px; color: var(--clr-text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .chat-item__meta { display: flex; align-items: center; gap: 8px; }
    .status-indicator { width: 8px; height: 8px; border-radius: 50%; }
    .status-indicator.active { background: var(--clr-success); box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2); }

    .loader-wrap { padding: 80px; display: flex; justify-content: center; }
    .empty-state { padding: 60px; text-align: center; }
    .muted-icon { color: var(--clr-text-dim); opacity: 0.3; margin-bottom: 16px; }
    .text-dim { color: var(--clr-text-dim); }
    .modern-shadow { box-shadow: var(--shadow-card); }
  `],
})
export class ChatListComponent implements OnInit {
  private readonly chatService = inject(ChatService);
  protected readonly conversations = signal<any[]>([]);
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.chatService.getMyConversations();
      this.conversations.set(data);
    } catch (error) {
      console.error('Failed to load conversations', error);
    } finally {
      this.loading.set(false);
    }
  }

  protected getChatLink(conv: any): any[] {
    const role = window.location.pathname.startsWith('/rider') ? 'rider' : 'user';
    if (conv.rideId) return [`/${role}/chat/ride`, conv.rideId];
    return [`/${role}/chat/parcel`, conv.parcelId];
  }
}
