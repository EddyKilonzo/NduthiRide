import { Injectable, OnDestroy, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import type { ChatMessage, Conversation, ConversationPreview, MessageSenderRole, SendMessageDto } from '../models/chat.models';

interface ApiResponse<T> { success: boolean; data: T; }
interface SendAck { status: 'ok' | 'error'; messageId?: string; error?: string; }

/** Minimal sender info needed for optimistic message creation. */
export interface MessageSender {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: MessageSenderRole;
}

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiUrl}/chat`;
  private socket: Socket | null = null;

  // Live message stream for the currently open conversation
  readonly messages   = signal<ChatMessage[]>([]);
  readonly isTyping   = signal<boolean>(false);
  readonly isClosed   = signal<boolean>(false);
  /** Total unread messages across all conversations. Refresh via loadUnreadCount(). */
  readonly totalUnread = signal<number>(0);

  /** Temp IDs of optimistically-added messages awaiting server confirmation. */
  private readonly pendingIds = new Set<string>();

  // ─── WebSocket lifecycle ─────────────────────────────────────────

  connect(): void {
    try {
      if (this.socket?.connected) return;

      this.socket = io(`${environment.wsUrl}/chat`, {
        auth: { token: this.auth.getAccessToken() ?? '' },
        transports: ['polling', 'websocket'],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30_000,
        timeout: 45_000,
      });

      this.socket.on('chat:message', (msg: ChatMessage) => {
        // Deduplicate: if an optimistic (pending) message from me matches, replace it
        const me = this.auth.user();
        if (me && msg.senderAccountId === me.id) {
          const tempId = [...this.pendingIds].find(tid => {
            const temp = this.messages().find(m => m.id === tid);
            return temp?.content === msg.content;
          });
          if (tempId) {
            this.replacePending(tempId, msg);
            return;
          }
        }
        this.messages.update(prev => [...prev, msg]);
      });

      this.socket.on('chat:typing', (payload: { senderAccountId: string; isTyping: boolean }) => {
        this.isTyping.set(payload.isTyping);
      });

      this.socket.on('chat:closed', () => {
        this.isClosed.set(true);
      });

      // When the other party reads the conversation, mark all our messages as read
      this.socket.on('chat:read-receipt', (payload: { readBy: string }) => {
        const me = this.auth.user();
        if (me && payload.readBy !== me.id) {
          this.messages.update(prev =>
            prev.map(msg =>
              msg.senderAccountId === me.id ? { ...msg, isRead: true } : msg,
            ),
          );
        }
      });

      this.socket.on('connect_error', (err) => {
        console.error('Chat socket connection error:', err);
      });
    } catch (error) {
      console.error('Failed to initialize chat socket:', error);
    }
  }

  /**
   * Joins the socket room for a conversation.
   * If the socket isn't connected yet, queues the join for when it connects.
   */
  joinConversation(conversationId: string): void {
    try {
      if (this.socket?.connected) {
        this.socket.emit('chat:join', { conversationId });
      } else {
        this.socket?.once('connect', () => {
          this.socket?.emit('chat:join', { conversationId });
        });
      }
    } catch (error) {
      console.error('Failed to join conversation:', error);
    }
  }

  leaveConversation(conversationId: string): void {
    try {
      this.socket?.emit('chat:leave', { conversationId });
    } catch (error) {
      console.error('Failed to leave conversation:', error);
    }
  }

  /**
   * Sends a message with optimistic UI.
   * - Immediately adds a temp message to the list (instant feedback).
   * - Confirms via socket acknowledgment (server returns { status, messageId }).
   * - Falls back to REST if the socket is not connected.
   * - On failure, removes the optimistic message and throws.
   */
  async sendMessage(conversationId: string, dto: SendMessageDto, sender: MessageSender): Promise<void> {
    const tempId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      conversationId,
      senderAccountId: sender.id,
      content: dto.content,
      type: dto.type ?? 'TEXT',
      locationPin: dto.locationPin ?? null,
      senderRole: sender.role,
      senderName: sender.fullName,
      senderAvatar: sender.avatarUrl,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    this.pendingIds.add(tempId);
    this.messages.update(prev => [...prev, tempMsg]);

    // REST fallback when socket is not connected
    if (!this.socket?.connected) {
      try {
        const confirmed = await this.sendViaRest(conversationId, dto);
        this.replacePending(tempId, confirmed);
      } catch (err) {
        this.removePending(tempId);
        throw err;
      }
      return;
    }

    // Socket send with acknowledgment
    return new Promise<void>((resolve, reject) => {
      this.socket!.emit(
        'chat:send',
        { conversationId, ...dto },
        (ack: SendAck) => {
          if (ack?.status === 'error') {
            this.removePending(tempId);
            reject(new Error(ack.error ?? 'Message delivery failed'));
          } else {
            // Server will broadcast chat:message → deduplication replaces the pending entry
            resolve();
          }
        },
      );
    });
  }

  emitTyping(conversationId: string, isTyping: boolean): void {
    try {
      this.socket?.emit('chat:typing', { conversationId, isTyping });
    } catch (error) {
      console.error('Failed to emit typing state:', error);
    }
  }

  markRead(conversationId: string): void {
    try {
      this.socket?.emit('chat:read', { conversationId });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  disconnect(): void {
    try {
      this.socket?.disconnect();
      this.socket = null;
    } catch (error) {
      console.error('Error during chat socket disconnect:', error);
    }
  }

  // ─── REST ────────────────────────────────────────────────────────

  async getMyConversations(): Promise<ConversationPreview[]> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<ConversationPreview[]>>(`${this.base}/conversations`),
    );
    return res.data;
  }

  /** Fetches conversations and updates the totalUnread signal. Safe to call on any page. */
  async loadUnreadCount(): Promise<void> {
    try {
      const convs = await this.getMyConversations();
      const total = convs.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
      this.totalUnread.set(total);
    } catch {
      // Silently swallow — badge just won't update
    }
  }

  async getConversationByRide(rideId: string): Promise<Conversation | null> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<Conversation | null>>(`${this.base}/conversation/ride/${rideId}`),
    );
    return res.data;
  }

  async getConversationByParcel(parcelId: string): Promise<Conversation | null> {
    const res = await lastValueFrom(
      this.http.get<ApiResponse<Conversation | null>>(`${this.base}/conversation/parcel/${parcelId}`),
    );
    return res.data;
  }

  async getMessages(
    conversationId: string,
    cursor?: string,
    limit = 30,
  ): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
    let params = new HttpParams().set('conversationId', conversationId).set('limit', limit);
    if (cursor) params = params.set('cursor', cursor);
    const res = await lastValueFrom(
      this.http.get<ApiResponse<{ messages: ChatMessage[]; nextCursor: string | null }>>(
        `${this.base}/messages`,
        { params },
      ),
    );
    return res.data;
  }

  async sendViaRest(conversationId: string, dto: SendMessageDto): Promise<ChatMessage> {
    const params = new HttpParams().set('conversationId', conversationId);
    const res = await lastValueFrom(
      this.http.post<ApiResponse<ChatMessage>>(`${this.base}/messages`, dto, { params }),
    );
    return res.data;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await lastValueFrom(this.http.delete<void>(`${this.base}/messages/${messageId}`));
  }

  // ─── State helpers ───────────────────────────────────────────────

  loadHistory(messages: ChatMessage[]): void {
    this.messages.set(messages);
  }

  reset(): void {
    this.messages.set([]);
    this.isTyping.set(false);
    this.isClosed.set(false);
    this.pendingIds.clear();
  }

  private replacePending(tempId: string, confirmed: ChatMessage): void {
    this.pendingIds.delete(tempId);
    this.messages.update(prev => prev.map(m => m.id === tempId ? confirmed : m));
  }

  private removePending(tempId: string): void {
    this.pendingIds.delete(tempId);
    this.messages.update(prev => prev.filter(m => m.id !== tempId));
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
