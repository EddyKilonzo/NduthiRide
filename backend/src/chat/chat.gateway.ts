import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed = (
        process.env.CORS_ORIGINS ??
        process.env.FRONTEND_URL ??
        'https://nduthi-ride-r479.vercel.app'
      ).split(',').map(o => o.trim());
      if (!origin || allowed.includes(origin)) callback(null, true);
      else callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly chatService: ChatService,
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────

  handleConnection(client: Socket): void {
    try {
      const token =
        (client.handshake.auth as { token?: string }).token ??
        (client.handshake.headers.authorization ?? '').replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });

      (client.data as { accountId: string; role: string }) = {
        accountId: payload.sub,
        role: payload.role,
      };

      this.logger.log(`Chat connected: ${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const { accountId } = client.data as { accountId?: string };
    if (accountId) this.logger.log(`Chat disconnected: ${accountId}`);
  }

  // ─── Client → Server events ───────────────────────────────

  /**
   * Client joins a conversation room to receive messages.
   * Marks all unread messages as read on join.
   */
  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const { accountId } = client.data as { accountId: string };
    const { conversationId } = payload;

    await client.join(`conversation:${conversationId}`);
    await this.chatService.markAsRead(conversationId, accountId);

    client.emit('chat:joined', { conversationId });
    this.logger.log(`${accountId} joined conversation ${conversationId}`);
  }

  @SubscribeMessage('chat:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    await client.leave(`conversation:${payload.conversationId}`);
  }

  /**
   * Receives a message from the client, persists it, and broadcasts to the conversation room.
   */
  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string } & SendMessageDto,
  ): Promise<{ status: string; messageId?: string; error?: string }> {
    const { accountId } = client.data as { accountId: string };

    try {
      const message = await this.chatService.sendMessage(
        accountId,
        payload.conversationId,
        {
          content: payload.content,
          type: payload.type,
          locationPin: payload.locationPin,
        },
      );

      // Broadcast to everyone in the conversation room (including sender for confirmation)
      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('chat:message', {
          id: message.id,
          conversationId: payload.conversationId,
          senderAccountId: message.senderAccountId,
          content: message.isDeleted
            ? 'This message was deleted'
            : message.content,
          type: message.type,
          locationPin: message.locationPin,
          senderRole: message.senderRole,
          senderName: message.senderAccount.fullName,
          senderAvatar: message.senderAccount.avatarUrl,
          isRead: message.isRead,
          createdAt: message.createdAt,
        });

      return { status: 'ok', messageId: message.id };
    } catch (error) {
      const err = error as Error;
      return { status: 'error', error: err.message };
    }
  }

  /**
   * Typing indicator — NOT persisted to the database.
   * Forwarded only to the other participant(s) in the room.
   */
  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; isTyping: boolean },
  ): void {
    const { accountId } = client.data as { accountId: string };

    client.to(`conversation:${payload.conversationId}`).emit('chat:typing', {
      senderAccountId: accountId,
      isTyping: payload.isTyping,
    });
  }

  /**
   * Client marks all messages in a conversation as read.
   */
  @SubscribeMessage('chat:read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    const { accountId } = client.data as { accountId: string };
    await this.chatService.markAsRead(payload.conversationId, accountId);

    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('chat:read-receipt', {
        readBy: accountId,
        readAt: new Date().toISOString(),
      });
  }

  // ─── Server-push helpers ──────────────────────────────────

  /**
   * Emits 'chat:closed' to a conversation room.
   * Called by ChatService.closeConversation().
   */
  emitChatClosed(conversationId: string, closedAt: Date): void {
    this.server.to(`conversation:${conversationId}`).emit('chat:closed', {
      conversationId,
      closedAt: closedAt.toISOString(),
    });
  }
}
