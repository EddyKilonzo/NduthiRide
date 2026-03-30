import { Injectable, OnDestroy, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import type { ChatMessage, Conversation, SendMessageDto } from '../models/chat.models';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiUrl}/chat`;
  private socket: Socket | null = null;

  // Live message stream for the currently open conversation
  readonly messages = signal<ChatMessage[]>([]);
  readonly isTyping = signal<boolean>(false);
  readonly isClosed = signal<boolean>(false);

  // ─── WebSocket lifecycle ─────────────────────────────────────────

  connect(): void {
    try {
      if (this.socket?.connected) return;

      this.socket = io(`${environment.wsUrl}/chat`, {
        auth: { token: this.auth.getAccessToken() ?? '' },
        transports: ['websocket'],
      });

      this.socket.on('chat:message', (msg: ChatMessage) => {
        this.messages.update((prev) => [...prev, msg]);
      });

      this.socket.on('chat:typing', (payload: { senderAccountId: string; isTyping: boolean }) => {
        this.isTyping.set(payload.isTyping);
      });

      this.socket.on('chat:closed', () => {
        this.isClosed.set(true);
      });

      this.socket.on('connect_error', (err) => {
        console.error('Chat socket connection error:', err);
      });
    } catch (error) {
      console.error('Failed to initialize chat socket:', error);
    }
  }

  joinConversation(conversationId: string): void {
    try {
      this.socket?.emit('chat:join', { conversationId });
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

  sendViaSocket(conversationId: string, dto: SendMessageDto): void {
    try {
      this.socket?.emit('chat:send', { conversationId, ...dto });
    } catch (error) {
      console.error('Failed to send message via socket:', error);
    }
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

  // ─── REST fallback (Secure async/await) ──────────────────────────

  async getMyConversations(): Promise<any[]> {
    try {
      const res = await lastValueFrom(this.http.get<ApiResponse<any[]>>(`${this.base}/conversations`));
      return res.data;
    } catch (error) {
      throw error;
    }
  }

  async getConversationByRide(rideId: string): Promise<Conversation> {
    try {
      const res = await lastValueFrom(this.http.get<ApiResponse<Conversation>>(`${this.base}/conversation/ride/${rideId}`));
      return res.data;
    } catch (error) {
      throw error;
    }
  }

  async getConversationByParcel(parcelId: string): Promise<Conversation> {
    try {
      const res = await lastValueFrom(this.http.get<ApiResponse<Conversation>>(`${this.base}/conversation/parcel/${parcelId}`));
      return res.data;
    } catch (error) {
      throw error;
    }
  }

  async getMessages(conversationId: string, cursor?: string, limit = 30): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
    try {
      let params = new HttpParams().set('conversationId', conversationId).set('limit', limit);
      if (cursor) params = params.set('cursor', cursor);
      const res = await lastValueFrom(this.http.get<ApiResponse<{ messages: ChatMessage[]; nextCursor: string | null }>>(`${this.base}/messages`, { params }));
      return res.data;
    } catch (error) {
      throw error;
    }
  }

  async sendViaRest(conversationId: string, dto: SendMessageDto): Promise<ChatMessage> {
    try {
      const params = new HttpParams().set('conversationId', conversationId);
      const res = await lastValueFrom(this.http.post<ApiResponse<ChatMessage>>(`${this.base}/messages`, dto, { params }));
      return res.data;
    } catch (error) {
      throw error;
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      await lastValueFrom(this.http.delete<void>(`${this.base}/messages/${messageId}`));
    } catch (error) {
      throw error;
    }
  }

  // ─── State helpers ───────────────────────────────────────────────

  loadHistory(messages: ChatMessage[]): void {
    this.messages.set(messages);
  }

  reset(): void {
    this.messages.set([]);
    this.isTyping.set(false);
    this.isClosed.set(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
