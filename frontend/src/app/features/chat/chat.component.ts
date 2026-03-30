import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import type { ChatMessage, Conversation, ConversationPreview } from '../../core/models/chat.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, SpinnerComponent, RouterLink, RouterLinkActive],
  template: `
    <div class="chat-page app-page">
      <div class="chat-layout modern-shadow">
        <!-- Sidebar: Chat List -->
        <div class="chat-sidebar">
          <div class="sidebar-header">
            <h2>Messages</h2>
          </div>
          
          <div class="conversations-list">
            @if (loadingList()) {
              <div class="side-loader"><app-spinner [size]="24" /></div>
            } @else if (conversations().length === 0) {
              <div class="empty-side">
                <lucide-icon name="message-square" [size]="32"></lucide-icon>
                <p>No chats found</p>
              </div>
            } @else {
              @for (conv of conversations(); track conv.id) {
                <a [routerLink]="getChatLink(conv)" 
                   routerLinkActive="active-chat"
                   class="conversation-item">
                  <div class="conv-avatar">
                    @if (conv.otherPartyAvatar) {
                      <img [src]="conv.otherPartyAvatar" [alt]="conv.otherPartyName" />
                    } @else {
                      <div class="avatar-placeholder">{{ conv.otherPartyName.charAt(0) }}</div>
                    }
                    @if (conv.status === 'ACTIVE') {
                      <span class="online-status"></span>
                    }
                  </div>
                  <div class="conv-info">
                    <div class="conv-header">
                      <span class="name">{{ conv.otherPartyName }}</span>
                      <span class="time">{{ conv.updatedAt | date:'shortTime' }}</span>
                    </div>
                    <div class="context-tag">{{ conv.context }}</div>
                    <div class="last-msg">{{ conv.lastMessage?.content || 'No messages' }}</div>
                  </div>
                </a>
              }
            }
          </div>
        </div>

        <!-- Main: Messages Area -->
        <div class="chat-main">
          @if (!conversationId && !loading()) {
            <div class="no-selection">
              <div class="selection-illustration">
                <lucide-icon name="message-circle" [size]="64"></lucide-icon>
              </div>
              <h3>Select a conversation</h3>
              <p>Choose a chat from the left to start messaging</p>
            </div>
          } @else {
            <!-- Header -->
            <div class="chat-header">
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
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-page { height: calc(100vh - 120px); padding-bottom: 20px; }
    .chat-layout { 
      display: grid; grid-template-columns: 320px 1fr; height: 100%; 
      background: var(--clr-bg-card); border-radius: var(--radius-lg); 
      overflow: hidden; border: 1px solid var(--clr-border); 
    }

    /* Sidebar Styles */
    .chat-sidebar { border-right: 1px solid var(--clr-border); display: flex; flex-direction: column; background: var(--clr-bg-elevated); }
    .sidebar-header { padding: 20px; border-bottom: 1px solid var(--clr-border); }
    .sidebar-header h2 { font-size: 20px; font-weight: 800; margin: 0; }
    
    .conversations-list { flex: 1; overflow-y: auto; }
    .conversation-item { 
      display: flex; gap: 12px; padding: 16px; border-bottom: 1px solid var(--clr-border); 
      cursor: pointer; text-decoration: none; color: inherit; transition: all 0.2s;
    }
    .conversation-item:hover { background: rgba(var(--clr-primary-rgb), 0.05); }
    .conversation-item.active-chat { background: rgba(var(--clr-primary-rgb), 0.1); border-left: 4px solid var(--clr-primary); }
    
    .conv-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--clr-bg-card); position: relative; flex-shrink: 0; }
    .conv-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .avatar-placeholder { width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--clr-primary); font-size: 18px; }
    .online-status { position: absolute; bottom: 2px; right: 2px; width: 10px; height: 10px; border-radius: 50%; background: var(--clr-success); border: 2px solid var(--clr-bg-elevated); }
    
    .conv-info { flex: 1; min-width: 0; }
    .conv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .conv-header .name { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .conv-header .time { font-size: 11px; color: var(--clr-text-dim); }
    .context-tag { font-size: 10px; font-weight: 600; color: var(--clr-primary); text-transform: uppercase; margin-bottom: 2px; }
    .last-msg { font-size: 13px; color: var(--clr-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Main Chat Area Styles */
    .chat-main { display: flex; flex-direction: column; height: 100%; position: relative; }
    .no-selection { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--clr-text-dim); padding: 40px; }
    .selection-illustration { margin-bottom: 24px; opacity: 0.2; }
    .no-selection h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: var(--clr-text); }
    
    .chat-header {
      padding: 16px 24px; border-bottom: 1px solid var(--clr-border); background: var(--clr-bg-elevated);
      display: flex; align-items: center; justify-content: space-between;
    }
    .header-info h3 { font-size: 16px; font-weight: 700; margin: 0; }
    .status-text { font-size: 12px; color: var(--clr-text-muted); margin: 2px 0 0; }
    .status-text.online { color: var(--clr-primary); }

    .messages-area {
      flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 12px;
      background: rgba(var(--clr-primary-rgb), 0.01);
    }
    .chat-loader { display: flex; justify-content: center; padding: 40px; }
    .empty-chat { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--clr-text-dim); height: 100%; opacity: 0.6; }

    .message-row { display: flex; width: 100%; }
    .message-row.own-message { justify-content: flex-end; }
    .message-bubble {
      max-width: 75%; padding: 10px 14px; border-radius: 18px; position: relative;
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
      padding: 20px 24px; border-top: 1px solid var(--clr-border); background: var(--clr-bg-elevated);
    }
    .input-area.disabled { opacity: 0.6; cursor: not-allowed; }
    .chat-form { display: flex; gap: 12px; align-items: center; }
    .chat-form input { flex: 1; padding: 12px 20px; border-radius: 99px; background: var(--clr-bg-card); border: 1px solid var(--clr-border); font-size: 14px; color: var(--clr-text); transition: all 0.2s; }
    .chat-form input:focus { border-color: var(--clr-primary); outline: none; box-shadow: 0 0 0 3px rgba(var(--clr-primary-rgb), 0.1); }
    .send-btn { width: 44px; height: 44px; border-radius: 50%; background: var(--clr-primary); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; }
    
    .side-loader { display: flex; justify-content: center; padding: 40px; }
    .empty-side { text-align: center; padding: 40px; color: var(--clr-text-dim); opacity: 0.6; }
    .empty-side p { font-size: 14px; margin-top: 8px; }

    @media (max-width: 900px) {
      .chat-layout { grid-template-columns: 80px 1fr; }
      .sidebar-header, .conv-info { display: none; }
      .conversation-item { justify-content: center; padding: 12px; }
    }

    @media (max-width: 640px) {
      .chat-layout { grid-template-columns: 1fr; }
      .chat-sidebar { display: none; }
    }
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
  protected readonly loading = signal(false);
  protected readonly loadingList = signal(true);
  protected readonly sending = signal(false);
  protected readonly title = signal('Select a Chat');
  protected readonly conversations = signal<ConversationPreview[]>([]);

  protected conversationId: string | null = null;
  private typingTimer: any = null;

  constructor() {
    // Re-load when URL parameters change
    effect(() => {
      const rideId = this.route.snapshot.paramMap.get('rideId');
      const parcelId = this.route.snapshot.paramMap.get('parcelId');
      if (rideId || parcelId) {
        this.zoneRunLoad();
      }
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    this.chatService.connect();
    await this.loadConversations();
    await this.initChatFromRoute();
  }

  private zoneRunLoad() {
    // Small delay to ensure route state is fully updated
    setTimeout(() => this.initChatFromRoute(), 0);
  }

  private async loadConversations() {
    try {
      this.loadingList.set(true);
      const list = await this.chatService.getMyConversations();
      this.conversations.set(list);
    } catch (error) {
      console.error('Failed to load chat list', error);
    } finally {
      this.loadingList.set(false);
    }
  }

  private async initChatFromRoute(): Promise<void> {
    const rideId = this.route.snapshot.paramMap.get('rideId');
    const parcelId = this.route.snapshot.paramMap.get('parcelId');

    if (!rideId && !parcelId) {
      this.conversationId = null;
      this.chatService.reset();
      return;
    }

    try {
      if (this.conversationId) {
        this.chatService.leaveConversation(this.conversationId);
      }

      this.loading.set(true);
      this.chatService.reset();
      
      let conversation: Conversation;
      if (rideId) {
        conversation = await this.chatService.getConversationByRide(rideId);
        this.title.set('Ride Support Chat');
      } else {
        conversation = await this.chatService.getConversationByParcel(parcelId!);
        this.title.set('Delivery Chat');
      }

      this.conversationId = conversation.id;
      this.chatService.loadHistory(conversation.messages);
      this.chatService.joinConversation(this.conversationId);
      this.chatService.markRead(this.conversationId);

      // Immediately reduce badge count for this conversation
      const conv = this.conversations().find((c) => c.id === this.conversationId);
      if (conv?.unreadCount) {
        this.chatService.totalUnread.update((n) => Math.max(0, n - conv.unreadCount));
      }
      
      if (conversation.status === 'CLOSED') {
        this.chatService.isClosed.set(true);
      }
    } catch (error) {
      console.error('Chat initialization failed:', error);
      this.toast.error('Could not load chat conversation');
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

  protected getChatLink(conv: ConversationPreview): any[] {
    const role = window.location.pathname.startsWith('/rider') ? 'rider' : 'user';
    if (conv.rideId) return [`/${role}/chat/ride`, conv.rideId];
    return [`/${role}/chat/parcel`, conv.parcelId];
  }

  private scrollToBottom(): void {
    try {
      if (this.myScrollContainer) {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }
}
