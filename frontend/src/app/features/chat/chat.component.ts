import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import type { ChatMessage, Conversation } from '../../core/models/chat.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, SpinnerComponent],
  template: `
    <div class="chat-page app-page">
      <div class="chat-container modern-shadow">
        <!-- Header -->
        <div class="chat-header">
          <button class="back-btn" (click)="goBack()">
            <lucide-icon name="arrow-left" [size]="20"></lucide-icon>
          </button>
          <div class="header-info">
            <h3>{{ title() }}</h3>
            <p class="status-text" [class.online]="!isClosed()">
              {{ isClosed() ? 'Conversation Closed' : (isTyping() ? 'Typing...' : 'Active Now') }}
            </p>
          </div>
          <div class="header-actions">
            @if (loading()) {
              <app-spinner [size]="18" />
            }
          </div>
        </div>

        <!-- Messages Area -->
        <div class="messages-area" #scrollMe>
          @if (loading() && messages().length === 0) {
            <div class="chat-loader"><app-spinner /></div>
          } @else if (messages().length === 0) {
            <div class="empty-chat">
              <lucide-icon name="message-square" [size]="48"></lucide-icon>
              <p>No messages yet. Start the conversation!</p>
            </div>
          } @else {
            @for (msg of messages(); track msg.id) {
              <div class="message-row" [class.own-message]="isOwnMessage(msg)">
                <div class="message-bubble" [class.system]="msg.type === 'SYSTEM'">
                  @if (msg.type !== 'SYSTEM' && !isOwnMessage(msg)) {
                    <span class="sender-name">{{ msg.senderName }}</span>
                  }
                  <p class="message-content">{{ msg.content }}</p>
                  <span class="message-time">{{ msg.createdAt | date:'shortTime' }}</span>
                </div>
              </div>
            }
          }
        </div>

        <!-- Input Area -->
        <div class="input-area" [class.disabled]="isClosed()">
          <form [formGroup]="chatForm" (ngSubmit)="sendMessage()" class="chat-form">
            <input
              #messageInput
              type="text"
              placeholder="Type a message..."
              formControlName="content"
              (input)="onTyping()"
              [attr.disabled]="isClosed() ? '' : null"
            />
            <button type="submit" class="send-btn" [disabled]="chatForm.invalid || sending() || isClosed()">
              @if (sending()) {
                <app-spinner [size]="18" />
              } @else {
                <lucide-icon name="send" [size]="20"></lucide-icon>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-page { height: calc(100vh - 120px); display: flex; flex-direction: column; padding-bottom: 20px; }
    .chat-container { flex: 1; display: flex; flex-direction: column; background: var(--clr-bg-card); border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--clr-border); }
    
    .chat-header {
      padding: 16px 20px; border-bottom: 1px solid var(--clr-border); background: var(--clr-bg-elevated);
      display: flex; align-items: center; gap: 16px;
    }
    .back-btn { background: none; border: none; color: var(--clr-text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .back-btn:hover { color: var(--clr-primary); }
    .header-info { flex: 1; }
    .header-info h3 { font-size: 16px; font-weight: 700; margin: 0; }
    .status-text { font-size: 12px; color: var(--clr-text-muted); margin: 2px 0 0; }
    .status-text.online { color: var(--clr-primary); }

    .messages-area {
      flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px;
      background: rgba(var(--clr-primary-rgb), 0.02);
    }
    .chat-loader { display: flex; justify-content: center; padding: 40px; }
    .empty-chat { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--clr-text-dim); height: 100%; opacity: 0.6; }
    .empty-chat p { font-size: 14px; }

    .message-row { display: flex; width: 100%; }
    .message-row.own-message { justify-content: flex-end; }
    .message-bubble {
      max-width: 80%; padding: 10px 14px; border-radius: 18px; position: relative;
      background: var(--clr-bg-elevated); border: 1px solid var(--clr-border);
    }
    .message-bubble .sender-name { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--clr-primary); display: block; margin-bottom: 4px; }
    .message-bubble .message-content { font-size: 14px; color: var(--clr-text); line-height: 1.4; word-break: break-word; }
    .message-bubble .message-time { font-size: 9px; color: var(--clr-text-dim); display: block; text-align: right; margin-top: 4px; }
    
    .message-bubble.system { background: transparent; border: none; width: 100%; max-width: 100%; text-align: center; }
    .message-bubble.system .message-content { font-style: italic; color: var(--clr-text-dim); font-size: 12px; }
    .message-bubble.system .message-time { display: none; }

    .own-message .message-bubble {
      background: var(--clr-primary); border-color: var(--clr-primary);
    }
    .own-message .message-bubble .message-content { color: #fff; }
    .own-message .message-bubble .message-time { color: rgba(255,255,255,0.7); }

    .input-area {
      padding: 16px 20px; border-top: 1px solid var(--clr-border); background: var(--clr-bg-elevated);
    }
    .input-area.disabled { opacity: 0.6; cursor: not-allowed; }
    .chat-form {
      display: flex; gap: 12px; align-items: center;
    }
    .chat-form input { flex: 1; padding: 12px 18px; border-radius: 99px; background: var(--clr-bg-card); border: 1px solid var(--clr-border); font-size: 14px; color: var(--clr-text); transition: all 0.2s; }
    .chat-form input:focus { border-color: var(--clr-primary); outline: none; box-shadow: 0 0 0 3px rgba(var(--clr-primary-rgb), 0.1); }
    .send-btn { width: 44px; height: 44px; border-radius: 50%; background: var(--clr-primary); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; border: none; }
    .send-btn:hover:not(:disabled) { transform: scale(1.05); background: var(--clr-primary-light); }
    .send-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 640px) { .chat-page { height: calc(100vh - 100px); } }
  `],
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly chatForm = this.fb.group({
    content: ['', [Validators.required, Validators.maxLength(500)]],
  });

  protected readonly messages = this.chatService.messages;
  protected readonly isTyping = this.chatService.isTyping;
  protected readonly isClosed = this.chatService.isClosed;
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly title = signal('Chat');

  private conversationId: string | null = null;
  private typingTimer: any = null;

  async ngOnInit(): Promise<void> {
    this.chatService.reset();
    const rideId = this.route.snapshot.paramMap.get('rideId');
    const parcelId = this.route.snapshot.paramMap.get('parcelId');

    try {
      this.loading.set(true);
      let conversation: Conversation;
      
      if (rideId) {
        conversation = await this.chatService.getConversationByRide(rideId);
        this.title.set('Ride Support Chat');
      } else if (parcelId) {
        conversation = await this.chatService.getConversationByParcel(parcelId);
        this.title.set('Delivery Chat');
      } else {
        throw new Error('No context provided');
      }

      this.conversationId = conversation.id;
      this.chatService.loadHistory(conversation.messages);
      this.chatService.connect();
      this.chatService.joinConversation(this.conversationId);
      this.chatService.markRead(this.conversationId);
      
      if (conversation.status === 'CLOSED') {
        this.chatService.isClosed.set(true);
      }
    } catch (error) {
      console.error('Chat initialization failed:', error);
      this.toast.error('Could not load chat conversation');
      this.goBack();
    } finally {
      this.loading.set(false);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    if (this.conversationId) {
      this.chatService.leaveConversation(this.conversationId);
    }
    this.chatService.disconnect();
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }

  protected async sendMessage(): Promise<void> {
    if (this.chatForm.invalid || !this.conversationId || this.isClosed()) return;
    
    const content = this.chatForm.value.content?.trim();
    if (!content) return;

    this.sending.set(true);
    try {
      // We use socket for real-time delivery
      this.chatService.sendViaSocket(this.conversationId, { content, type: 'TEXT' });
      this.chatForm.reset();
      this.messageInput.nativeElement.focus();
    } catch {
      this.toast.error('Failed to send message');
    } finally {
      this.sending.set(false);
    }
  }

  protected onTyping(): void {
    if (!this.conversationId || this.isClosed()) return;
    
    this.chatService.emitTyping(this.conversationId, true);
    
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      if (this.conversationId) this.chatService.emitTyping(this.conversationId, false);
    }, 2000);
  }

  protected isOwnMessage(msg: ChatMessage): boolean {
    const user = this.auth.user();
    if (!user) return false;
    return msg.senderAccountId === user.id;
  }

  protected goBack(): void {
    const role = this.auth.role();
    if (role === 'RIDER') {
      void this.router.navigate(['/rider/active']);
    } else {
      const rideId = this.route.snapshot.paramMap.get('rideId');
      const parcelId = this.route.snapshot.paramMap.get('parcelId');
      if (rideId) void this.router.navigate(['/user/rides', rideId]);
      else if (parcelId) void this.router.navigate(['/user/parcels', parcelId]);
      else void this.router.navigate(['/']);
    }
  }

  private scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }
}
