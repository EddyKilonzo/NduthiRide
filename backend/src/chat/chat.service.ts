import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ConversationStatus,
  MessageType,
  MessageSenderRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

/** Words to filter from messages. Extend via CHAT_BLOCKED_WORDS env var (comma-separated). */
function getBlockedWords(): string[] {
  const envWords = process.env.CHAT_BLOCKED_WORDS ?? '';
  return envWords
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Conversation lifecycle ───────────────────────────────

  /**
   * Creates a new ACTIVE conversation linked to a ride or parcel.
   * Called automatically when a rider accepts a booking.
   */
  async createConversation(rideId?: string, parcelId?: string) {
    try {
      const conversation = await this.prisma.conversation.create({
        data: {
          rideId,
          parcelId,
          status: ConversationStatus.ACTIVE,
        },
      });

      // Post opening system message — no senderAccountId for system messages
      // We store a sentinel value and filter it out on the client
      this.logger.log(`Conversation created: ${conversation.id}`);
      return conversation;
    } catch (error) {
      this.logger.error('createConversation failed', error);
      throw error;
    }
  }

  /**
   * Closes a conversation — called when a ride/parcel is COMPLETED or CANCELLED.
   * Returns the updated conversation so the gateway can emit 'chat:closed'.
   */
  async closeConversation(conversationId: string) {
    try {
      const updated = await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: ConversationStatus.CLOSED,
          closedAt: new Date(),
        },
      });

      this.logger.log(`Conversation closed: ${conversationId}`);
      return updated;
    } catch (error) {
      this.logger.error(`closeConversation failed: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * Looks up a conversation by ride or parcel ID.
   * Used on page load to restore chat history.
   */
  async getConversationByRideOrParcel(rideId?: string, parcelId?: string) {
    try {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          ...(rideId ? { rideId } : {}),
          ...(parcelId ? { parcelId } : {}),
        },
        // Always return the most recent conversation so that if stale rows
        // exist (e.g. before the @unique constraint was applied) we get the
        // one that actually has messages.
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            where: { isDeleted: false },
            orderBy: { createdAt: 'asc' },
            take: 50,
            include: {
              senderAccount: {
                select: { fullName: true, avatarUrl: true, role: true },
              },
            },
          },
        },
      });

      if (!conversation) return null;

      return {
        ...conversation,
        messages: conversation.messages.map((msg: any) => ({
          id: msg.id,
          conversationId: msg.conversationId,
          senderAccountId: msg.senderAccountId,
          content: msg.isDeleted ? 'This message was deleted' : msg.content,
          type: msg.type,
          locationPin: msg.locationPin,
          senderRole: msg.senderRole,
          senderName: msg.senderAccount?.fullName ?? 'Unknown',
          senderAvatar: msg.senderAccount?.avatarUrl ?? null,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error('getConversationByRideOrParcel failed', error);
      throw error;
    }
  }

  /**
   * Returns all active and recent conversations for a user or rider.
   * Includes the last message and basic participant info.
   */
  async getConversations(accountId: string) {
    try {
      const rider = await this.prisma.rider.findUnique({ where: { accountId } });
      const riderId = rider?.id;

      const conversations = await this.prisma.conversation.findMany({
        where: {
          OR: [
            { ride: { userId: accountId } },
            { ride: { riderId: riderId || 'NONE' } },
            { parcel: { userId: accountId } },
            { parcel: { riderId: riderId || 'NONE' } },
          ],
        },
        include: {
          messages: {
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              senderAccount: {
                select: { fullName: true, avatarUrl: true, role: true },
              },
            },
          },
          _count: {
            select: {
              messages: {
                where: { isRead: false, senderAccountId: { not: accountId } },
              },
            },
          },
          ride: {
            select: {
              userId: true,
              riderId: true,
              pickupAddress: true,
              dropoffAddress: true,
              user: { select: { fullName: true, avatarUrl: true } },
              rider: { include: { account: { select: { fullName: true, avatarUrl: true } } } },
            },
          },
          parcel: {
            select: {
              userId: true,
              riderId: true,
              itemDescription: true,
              user: { select: { fullName: true, avatarUrl: true } },
              rider: { include: { account: { select: { fullName: true, avatarUrl: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return (conversations as any[]).map((conv) => {
        const lastMsg = conv.messages[0];
        const ride = conv.ride;
        const parcel = conv.parcel;

        // Determine the "other party" name and avatar — must use ride.userId / parcel.userId
        // (riderId was omitted from selects before, so riders always saw their own profile).
        let otherPartyName = 'System';
        let otherPartyAvatar = null;

        if (ride) {
          if (ride.userId === accountId) {
            otherPartyName = ride.rider?.account?.fullName || 'Rider';
            otherPartyAvatar = ride.rider?.account?.avatarUrl ?? null;
          } else {
            otherPartyName = ride.user?.fullName || 'User';
            otherPartyAvatar = ride.user?.avatarUrl ?? null;
          }
        } else if (parcel) {
          if (parcel.userId === accountId) {
            otherPartyName = parcel.rider?.account?.fullName || 'Rider';
            otherPartyAvatar = parcel.rider?.account?.avatarUrl ?? null;
          } else {
            otherPartyName = parcel.user?.fullName || 'User';
            otherPartyAvatar = parcel.user?.avatarUrl ?? null;
          }
        }

        return {
          id: conv.id,
          status: conv.status,
          updatedAt: conv.createdAt, // Fallback to createdAt as updatedAt is missing in schema
          lastMessage: lastMsg ? {
            content: lastMsg.content,
            createdAt: lastMsg.createdAt,
            senderName: lastMsg.senderAccount?.fullName,
          } : null,
          otherPartyName,
          otherPartyAvatar,
          context: conv.ride ? `Ride: ${conv.ride.pickupAddress.slice(0, 20)}...` : `Parcel: ${conv.parcel?.itemDescription}`,
          rideId: conv.rideId,
          parcelId: conv.parcelId,
          unreadCount: (conv as any)._count?.messages ?? 0,
        };
      });
    } catch (error) {
      this.logger.error(`getConversations failed for ${accountId}`, error);
      throw error;
    }
  }

  // ─── Messages ─────────────────────────────────────────────

  /**
   * Validates the sender is a participant, filters bad words, persists, and returns the message.
   * Emitting the message to the WebSocket room is handled by the gateway after calling this method.
   */
  async sendMessage(
    senderAccountId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          ride: { select: { userId: true, riderId: true } },
          parcel: { select: { userId: true, riderId: true } },
        },
      });

      if (!conversation) throw new NotFoundException('Conversation not found');
      if (conversation.status === ConversationStatus.CLOSED) {
        throw new ForbiddenException('This conversation is closed');
      }

      // Determine if sender is the user or the rider
      const ride = conversation.ride;
      const parcel = conversation.parcel;

      const rider = await this.prisma.rider.findUnique({
        where: { accountId: senderAccountId },
      });

      const isUser =
        ride?.userId === senderAccountId || parcel?.userId === senderAccountId;
      const isRider =
        rider && (ride?.riderId === rider.id || parcel?.riderId === rider.id);

      if (!isUser && !isRider) {
        throw new ForbiddenException(
          'You are not a participant of this conversation',
        );
      }

      // Content filter
      const blocked = getBlockedWords();
      const lowerContent = dto.content.toLowerCase();
      if (blocked.some((word) => word && lowerContent.includes(word))) {
        throw new BadRequestException('Message contains prohibited content');
      }

      const senderRole: MessageSenderRole = isRider
        ? MessageSenderRole.RIDER
        : MessageSenderRole.USER;

      // Persist the message
      const message = await this.prisma.message.create({
        data: {
          conversationId,
          senderAccountId,
          senderRole,
          content: dto.content,
          type: dto.type ?? MessageType.TEXT,
          locationPin: dto.locationPin as object | undefined,
        },
        include: {
          senderAccount: { select: { fullName: true, avatarUrl: true } },
        },
      });

      // Mark unread messages from the other party as read
      await this.prisma.message.updateMany({
        where: {
          conversationId,
          senderAccountId: { not: senderAccountId },
          isRead: false,
        },
        data: { isRead: true },
      });

      return message;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `sendMessage failed in conversation ${conversationId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Cursor-based message history fetch.
   * Returns messages in chronological order (oldest first).
   */
  async getMessages(
    requesterId: string,
    conversationId: string,
    cursor?: string,
    limit = 30,
  ) {
    try {
      await this.assertIsParticipant(requesterId, conversationId);

      // If cursor is provided, fetch messages older than that message
      const cursorCondition = cursor
        ? {
            createdAt: {
              lt: (
                await this.prisma.message.findUnique({ where: { id: cursor } })
              )?.createdAt,
            },
          }
        : {};

      const messages = await this.prisma.message.findMany({
        where: {
          conversationId,
          isDeleted: false,
          ...cursorCondition,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Fetch one extra to determine if there are more
        include: {
          senderAccount: {
            select: { fullName: true, avatarUrl: true, role: true },
          },
        },
      });

      let nextCursor: string | null = null;
      if (messages.length > limit) {
        const lastItem = messages.pop(); // Remove the extra item
        nextCursor = lastItem?.id ?? null;
      }

      return {
        messages: messages.reverse(), // Chronological order (oldest first)
        nextCursor,
      };
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      )
        throw error;
      this.logger.error(
        `getMessages failed for conversation ${conversationId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Marks all messages from the other party as read.
   */
  async markAsRead(
    conversationId: string,
    readerAccountId: string,
  ): Promise<void> {
    try {
      await this.prisma.message.updateMany({
        where: {
          conversationId,
          senderAccountId: { not: readerAccountId },
          isRead: false,
        },
        data: { isRead: true },
      });
    } catch (error) {
      this.logger.error(`markAsRead failed for ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * Soft-deletes own message within 5 minutes of sending.
   */
  async deleteMessage(messageId: string, requesterId: string): Promise<void> {
    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
      });
      if (!message) throw new NotFoundException('Message not found');
      if (message.senderAccountId !== requesterId) {
        throw new ForbiddenException('You can only delete your own messages');
      }

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (message.createdAt < fiveMinutesAgo) {
        throw new BadRequestException(
          'Messages can only be deleted within 5 minutes of sending',
        );
      }

      await this.prisma.message.update({
        where: { id: messageId },
        data: { isDeleted: true, content: 'This message was deleted' },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`deleteMessage failed: ${messageId}`, error);
      throw error;
    }
  }

  // ─── Private helpers ──────────────────────────────────────

  /**
   * Throws ForbiddenException if the given account is not a participant of the conversation.
   */
  private async assertIsParticipant(
    accountId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        ride: { select: { userId: true, riderId: true } },
        parcel: { select: { userId: true, riderId: true } },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const rider = await this.prisma.rider.findUnique({ where: { accountId } });

    const isUser =
      conversation.ride?.userId === accountId ||
      conversation.parcel?.userId === accountId;
    const isRider =
      rider &&
      (conversation.ride?.riderId === rider.id ||
        conversation.parcel?.riderId === rider.id);

    if (!isUser && !isRider) {
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }
  }
}
