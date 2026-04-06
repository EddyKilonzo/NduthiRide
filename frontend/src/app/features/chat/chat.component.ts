import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import type { ChatMessage, Conversation, ConversationPreview, MessageSenderRole } from '../../core/models/chat.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, SpinnerComponent, RouterLink, RouterLinkActive],
  template: `
    <div class="chat-page app-page">
      <div class="chat-layout modern-shadow">
        <!-- Sidebar: Chat List -->
        <div class="chat-sidebar" [class.show-sidebar]="!conversationId">
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
                    @if (conv.unreadCount > 0) {
                      <span class="conv-avatar-unread" aria-label="Unread messages">{{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}</span>
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
                    <div class="conv-footer">
                      <div class="last-msg">{{ conv.lastMessage?.content || 'No messages yet' }}</div>
                    </div>
                  </div>
                </a>
              }
            }
          </div>
        </div>

        <!-- Main: Messages Area -->
        <div class="chat-main" [class.show-main]="!!conversationId || loading()">
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
              <button class="back-btn" type="button" (click)="goBack()" aria-label="Back to conversations">
                <lucide-icon name="arrow-left" [size]="18"></lucide-icon>
              </button>
              <div class="header-info">
                <h3>{{ title() }}</h3>
                <div class="status-line">
                  <span class="presence-dot"
                        [class.presence-dot--active]="!isClosed() && !isTyping()"
                        [class.presence-dot--typing]="!isClosed() && isTyping()"
                        [class.presence-dot--closed]="isClosed()"></span>
                  <span class="status-text" [class.online]="!isClosed()">
                    @if (isClosed()) {
                      Conversation closed
                    } @else if (isTyping()) {
                      Typing...
                    } @else if (lastSeenLabel()) {
                      {{ lastSeenLabel() }}
                    } @else {
                      Active
                    }
                  </span>
                </div>
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
                  <div class="message-row" [class.own-message]="isOwnMessage(msg)" [class.system-row]="msg.type === 'SYSTEM'">
                    @if (msg.type !== 'SYSTEM' && !isOwnMessage(msg)) {
                      <div class="msg-avatar">
                        @if (msg.senderAvatar) {
                          <img [src]="msg.senderAvatar" [alt]="msg.senderName" />
                        } @else {
                          <div class="msg-avatar-placeholder">{{ msg.senderName.charAt(0) }}</div>
                        }
                      </div>
                    }
                    <div class="message-bubble" [class.system]="msg.type === 'SYSTEM'">
                      @if (msg.type !== 'SYSTEM' && !isOwnMessage(msg)) {
                        <span class="sender-name">{{ msg.senderName }}</span>
                      }
                      <p class="message-content">{{ msg.content }}</p>
                      <div class="msg-meta">
                        <span class="message-time">{{ msg.createdAt | date:'shortTime' }}</span>
                        @if (isOwnMessage(msg) && msg.type !== 'SYSTEM') {
                          <span class="read-receipt"
                                [class.read-receipt--pending]="isPending(msg)"
                                [class.read-receipt--sent]="!isPending(msg) && !msg.isRead"
                                [class.read-receipt--read]="!isPending(msg) && msg.isRead">
                            @if (isPending(msg)) {
                              <lucide-icon name="clock" [size]="10"></lucide-icon>
                            } @else if (msg.isRead) {
                              <lucide-icon name="check-check" [size]="12"></lucide-icon>
                            } @else {
                              <lucide-icon name="check" [size]="12"></lucide-icon>
                            }
                          </span>
                        }
                      </div>
                    </div>
                    @if (msg.type !== 'SYSTEM' && isOwnMessage(msg)) {
                      <div class="msg-avatar own-avatar">
                        @if (currentUserAvatar()) {
                          <img [src]="currentUserAvatar()!" [alt]="currentUserName()" />
                        } @else {
                          <div class="msg-avatar-placeholder">{{ currentUserName().charAt(0) }}</div>
                        }
                      </div>
                    }
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
                <button type="submit" class="send-btn" [disabled]="chatForm.invalid || isClosed()">
                  <lucide-icon name="send" [size]="20"></lucide-icon>
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
    
    .conv-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--clr-bg-card); position: relative; flex-shrink: 0; overflow: visible; }
    .conv-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .avatar-placeholder { width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--clr-primary); font-size: 18px; }
    .conv-avatar-unread {
      position: absolute; top: -4px; right: -4px; z-index: 2;
      min-width: 18px; height: 18px; border-radius: 99px;
      background: #dc2626; color: #fff;
      font-size: 10px; font-weight: 700; line-height: 1;
      padding: 0 5px;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--clr-bg-elevated);
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .online-status {
      position: absolute; bottom: 2px; right: 2px; z-index: 1;
      width: 10px; height: 10px;
      border-radius: 50%; background: var(--clr-success); border: 2px solid var(--clr-bg-elevated);
      animation: dot-appear 0.3s ease;
    }
    @keyframes dot-appear { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .conv-info { flex: 1; min-width: 0; }
    .conv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .conv-header .name { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .conv-header .time { font-size: 11px; color: var(--clr-text-dim); flex-shrink: 0; margin-left: 6px; }
    .context-tag { font-size: 10px; font-weight: 600; color: var(--clr-primary); text-transform: uppercase; margin-bottom: 2px; }
    .conv-footer { display: flex; align-items: center; gap: 6px; }
    .last-msg { font-size: 13px; color: var(--clr-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }

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

    .status-line { display: flex; align-items: center; gap: 6px; margin-top: 3px; }

    /* Presence dot — three states */
    .presence-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; transition: background 0.3s;
    }
    .presence-dot--active  { background: #22c55e; box-shadow: 0 0 0 2px rgba(34,197,94,0.2); }
    .presence-dot--typing  {
      background: #22c55e;
      box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
      animation: dot-pulse 1s ease-in-out infinite;
    }
    .presence-dot--closed  { background: var(--clr-text-dim); box-shadow: none; }
    @keyframes dot-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(0.75); }
    }

    .status-text { font-size: 12px; color: var(--clr-text-muted); }
    .status-text.online { color: #22c55e; font-weight: 500; }

    .messages-area {
      flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 12px;
      background: rgba(var(--clr-primary-rgb), 0.01);
    }
    .chat-loader { display: flex; justify-content: center; padding: 40px; }
    .empty-chat { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--clr-text-dim); height: 100%; opacity: 0.6; }

    .message-row { display: flex; width: 100%; align-items: flex-end; gap: 8px; }
    .message-row.own-message { justify-content: flex-end; }
    .message-row.system-row { justify-content: center; }

    /* Per-message avatars */
    .msg-avatar {
      width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
      overflow: hidden; border: 2px solid var(--clr-border);
    }
    .msg-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .msg-avatar-placeholder {
      width: 100%; height: 100%; background: rgba(var(--clr-primary-rgb), 0.15);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: var(--clr-primary);
    }
    .own-avatar { border-color: var(--clr-primary); }

    .message-bubble {
      max-width: 70%; padding: 10px 14px; border-radius: 18px; position: relative;
      background: var(--clr-bg-elevated); border: 1px solid var(--clr-border);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    /* Tail for other's message */
    .message-row:not(.own-message):not(.system-row) .message-bubble {
      border-bottom-left-radius: 4px;
    }
    /* Tail for own message */
    .own-message .message-bubble {
      border-bottom-right-radius: 4px;
    }
    .message-bubble .sender-name { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--clr-primary); display: block; margin-bottom: 4px; }
    .message-bubble .message-content { font-size: 14px; color: var(--clr-text); line-height: 1.4; word-break: break-word; }

    /* Meta row: timestamp + read receipt */
    .msg-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 4px; }
    .message-time { font-size: 9px; color: var(--clr-text-dim); }
    .read-receipt { display: flex; align-items: center; line-height: 1; }
    .read-receipt--pending  { color: rgba(255,255,255,0.4); }
    .read-receipt--sent     { color: rgba(255,255,255,0.55); }
    .read-receipt--read     { color: #86efac; } /* light green for "seen" */

    .message-bubble.system { background: rgba(var(--clr-primary-rgb), 0.06); border: 1px solid rgba(var(--clr-primary-rgb), 0.15); max-width: 80%; text-align: center; border-radius: 99px; padding: 6px 16px; }
    .message-bubble.system .message-content { font-style: italic; color: var(--clr-text-dim); font-size: 12px; }
    .message-bubble.system .message-time { display: none; }

    .own-message .message-bubble {
      background: var(--clr-primary); border-color: var(--clr-primary);
    }
    .own-message .message-bubble .message-content { color: #fff; }
    .own-message .message-bubble .message-time { color: rgba(255,255,255,0.7); }
    .own-message .message-bubble .msg-meta { color: rgba(255,255,255,0.7); }

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

    .back-btn {
      display: none; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--clr-bg-card); border: 1px solid var(--clr-border);
      color: var(--clr-text); cursor: pointer; flex-shrink: 0;
      transition: all 0.2s;
      &:hover { border-color: var(--clr-primary); color: var(--clr-primary); }
    }

    @media (max-width: 900px) {
      .chat-layout { grid-template-columns: 80px 1fr; }
      .sidebar-header, .conv-info { display: none; }
      .conversation-item { justify-content: center; padding: 12px; }
    }

    @media (max-width: 640px) {
      .chat-layout { grid-template-columns: 1fr; }
      .chat-sidebar { display: none; }
      .chat-sidebar.show-sidebar { display: flex; }
      .chat-main { display: none; }
      .chat-main.show-main { display: flex; }
      .back-btn { display: flex; }
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

  protected readonly messages    = this.chatService.messages;
  protected readonly isTyping    = this.chatService.isTyping;
  protected readonly isClosed    = this.chatService.isClosed;
  protected readonly loading     = signal(false);
  protected readonly loadingList = signal(true);
  protected readonly title       = signal('Select a Chat');
  protected readonly conversations = signal<ConversationPreview[]>([]);

  protected readonly currentUserAvatar = computed(() => this.auth.user()?.avatarUrl ?? null);
  protected readonly currentUserName   = computed(() => this.auth.user()?.fullName ?? 'Me');

  /** Smart "last seen" label based on the most recent message from the other party. */
  protected readonly lastSeenLabel = computed<string | null>(() => {
    const me = this.auth.user();
    if (!me) return null;
    const msgs = this.messages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];
      if (msg.senderAccountId !== me.id && msg.type !== 'SYSTEM') {
        return this.formatLastSeen(msg.createdAt);
      }
    }
    return null;
  });

  protected conversationId: string | null = null;
  private typingTimer: any = null;
  private routeSub?: Subscription;

  async ngOnInit(): Promise<void> {
    this.chatService.connect();
    await this.loadConversations();
    // paramMap fires immediately with current params AND again on every param change,
    // so this handles both the initial load and same-pattern navigation (ride A → ride B).
    // We pass the emitted params directly to avoid any stale-snapshot edge case.
    this.routeSub = this.route.paramMap.subscribe((params) => {
      void this.initChatFromRoute(
        params.get('rideId') ?? undefined,
        params.get('parcelId') ?? undefined,
      );
    });
  }

  private async loadConversations(): Promise<void> {
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

  private async initChatFromRoute(
    rideId?: string,
    parcelId?: string,
  ): Promise<void> {
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

      let conversation: Conversation | null;
      if (rideId) {
        conversation = await this.chatService.getConversationByRide(rideId);
        this.title.set('Ride Support Chat');
      } else {
        conversation = await this.chatService.getConversationByParcel(parcelId!);
        this.title.set('Delivery Chat');
      }

      if (!conversation) {
        this.toast.error('No chat found for this booking');
        return;
      }

      this.conversationId = conversation.id;

      // Prefer the messages embedded in the conversation response.
      // If the server returned zero messages (stale query edge case), fall back
      // to the dedicated messages endpoint so the thread is never blank.
      if (conversation.messages.length > 0) {
        this.chatService.loadHistory(conversation.messages);
      } else {
        const { messages } = await this.chatService.getMessages(conversation.id);
        this.chatService.loadHistory(messages);
      }

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
    this.routeSub?.unsubscribe();
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

    const user = this.auth.user();
    if (!user) return;

    // Clear the form immediately — the message appears instantly via optimistic update
    this.chatForm.reset();
    this.messageInput?.nativeElement.focus();

    try {
      await this.chatService.sendMessage(
        this.conversationId,
        { content, type: 'TEXT' },
        { id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl, role: user.role as MessageSenderRole },
      );
    } catch {
      this.toast.error('Failed to send message. Please try again.');
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

  /** True while a message is optimistically added but not yet confirmed by the server. */
  protected isPending(msg: ChatMessage): boolean {
    return msg.id.startsWith('pending_');
  }

  protected goBack(): void {
    if (this.conversationId) {
      this.chatService.leaveConversation(this.conversationId);
    }
    this.conversationId = null;
    this.chatService.reset();
    const role = window.location.pathname.startsWith('/rider') ? 'rider' : 'user';
    void this.router.navigate([`/${role}/chat`]);
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

  /** Returns a human-readable "last seen" string relative to today. */
  private formatLastSeen(isoDate: string): string {
    const date = new Date(isoDate);
    const now  = new Date();

    const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
    const msgDayStart    = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (msgDayStart.getTime() === todayStart.getTime()) {
      return `Last seen today at ${timeStr}`;
    } else if (msgDayStart.getTime() === yesterdayStart.getTime()) {
      return `Last seen yesterday at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `Last seen ${dateStr} at ${timeStr}`;
    }
  }
}
