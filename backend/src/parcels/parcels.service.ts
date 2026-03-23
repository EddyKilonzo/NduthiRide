import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ParcelStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { RideQueryDto } from '../rides/dto/ride-query.dto';
import { EstimateParcelDto } from './dto/estimate-parcel.dto';
import { RateParcelDto } from './dto/rate-parcel.dto';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { haversineKm } from '../common/utils/geo';

// Delivery fee: base + per-km rate + weight surcharge per kg over 1kg
const BASE_FEE = 80;
const PER_KM_RATE = 25;
const WEIGHT_SURCHARGE_PER_KG = 20;
/** Valid status transitions for parcels */
const PARCEL_TRANSITIONS: Partial<Record<ParcelStatus, ParcelStatus>> = {
  [ParcelStatus.ACCEPTED]: ParcelStatus.PICKED_UP,
  [ParcelStatus.PICKED_UP]: ParcelStatus.IN_TRANSIT,
  [ParcelStatus.IN_TRANSIT]: ParcelStatus.DELIVERED,
};

@Injectable()
export class ParcelsService {
  private readonly logger = new Logger(ParcelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly trackingGateway: TrackingGateway,
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Calculates a delivery fee estimate based on coordinates and weight.
   */
  calculateEstimate(dto: EstimateParcelDto) {
    const distanceKm = haversineKm(
      dto.pickupLat,
      dto.pickupLng,
      dto.dropoffLat,
      dto.dropoffLng,
    );
    const weightSurcharge =
      Math.max(0, dto.weightKg - 1) * WEIGHT_SURCHARGE_PER_KG;
    const deliveryFee = Math.round(
      BASE_FEE + distanceKm * PER_KM_RATE + weightSurcharge,
    );

    return {
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      deliveryFee,
    };
  }

  /**
   * Creates a new parcel delivery with calculated fee.
   * Fee = base + distance rate + weight surcharge for packages over 1kg.
   */
  async createParcel(userId: string, dto: CreateParcelDto) {
    try {
      const estimate = this.calculateEstimate(dto);

      const parcel = await this.prisma.parcel.create({
        data: {
          userId,
          itemDescription: dto.itemDescription,
          weightKg: dto.weightKg,
          pickupLat: dto.pickupLat,
          pickupLng: dto.pickupLng,
          pickupAddress: dto.pickupAddress,
          dropoffLat: dto.dropoffLat,
          dropoffLng: dto.dropoffLng,
          dropoffAddress: dto.dropoffAddress,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          deliveryFee: estimate.deliveryFee,
          distanceKm: estimate.distanceKm,
          paymentMethod: dto.paymentMethod ?? 'MPESA',
          mpesaPhone: dto.mpesaPhone,
        },
        include: {
          user: { select: { fullName: true, phone: true } },
        },
      });

      this.logger.log(
        `Parcel created: ${parcel.id} — KES ${parcel.deliveryFee}`,
      );

      // Notify available riders via WebSocket
      this.trackingGateway.emitNewParcelRequest(parcel);

      return parcel;
    } catch (error) {
      this.logger.error('createParcel failed', error);
      throw error;
    }
  }

  /**
   * Paginated list of parcels for the authenticated user.
   */
  async getUserParcels(userId: string, query: RideQueryDto) {
    try {
      const skip = (query.page - 1) * query.limit;
      const where = { userId };

      const [parcels, total] = await Promise.all([
        this.prisma.parcel.findMany({
          where,
          skip,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            rider: {
              include: {
                account: {
                  select: { fullName: true, avatarUrl: true, phone: true },
                },
              },
            },
            payment: { select: { status: true, amount: true } },
            rating: { select: { score: true } },
          },
        }),
        this.prisma.parcel.count({ where }),
      ]);

      return {
        data: parcels,
        total,
        page: query.page,
        totalPages: Math.ceil(total / query.limit),
      };
    } catch (error) {
      this.logger.error(`getUserParcels failed for ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get a single parcel — accessible by the owner user or the assigned rider.
   */
  async getParcelById(parcelId: string, accountId: string) {
    try {
      const parcel = await this.prisma.parcel.findUnique({
        where: { id: parcelId },
        include: {
          user: { select: { fullName: true, phone: true, avatarUrl: true } },
          rider: {
            include: {
              account: {
                select: { fullName: true, avatarUrl: true, phone: true },
              },
            },
          },
          payment: true,
          rating: true,
        },
      });

      if (!parcel) throw new NotFoundException('Parcel not found');

      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      const isOwner = parcel.userId === accountId;
      const isAssignedRider = rider && parcel.riderId === rider.id;

      if (!isOwner && !isAssignedRider)
        throw new ForbiddenException('Access denied');

      return parcel;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      )
        throw error;
      this.logger.error(`getParcelById failed: ${parcelId}`, error);
      throw error;
    }
  }

  /**
   * Rider accepts a pending parcel delivery.
   */
  async acceptParcel(parcelId: string, accountId: string) {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new ForbiddenException('Rider profile not found');
      if (!rider.isVerified)
        throw new ForbiddenException('Your account is not yet verified');

      const parcel = await this.prisma.parcel.findUnique({
        where: { id: parcelId },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');
      if (parcel.status !== ParcelStatus.PENDING) {
        throw new BadRequestException('This parcel is no longer available');
      }

      const updated = await this.prisma.parcel.update({
        where: { id: parcelId },
        data: { riderId: rider.id, status: ParcelStatus.ACCEPTED },
        include: { user: { select: { fullName: true, phone: true } } },
      });

      this.logger.log(`Rider ${rider.id} accepted parcel ${parcelId}`);

      // Create a chat conversation for the parcel
      await this.chatService.createConversation(undefined, parcelId);

      return updated;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`acceptParcel failed: ${parcelId}`, error);
      throw error;
    }
  }

  /**
   * Rider updates the parcel status along the delivery chain.
   */
  async updateParcelStatus(
    parcelId: string,
    accountId: string,
    newStatus: ParcelStatus,
  ) {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new ForbiddenException('Rider profile not found');

      const parcel = await this.prisma.parcel.findUnique({
        where: { id: parcelId },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');
      if (parcel.riderId !== rider.id)
        throw new ForbiddenException('This is not your parcel');

      const allowedNext = PARCEL_TRANSITIONS[parcel.status];
      if (allowedNext !== newStatus) {
        throw new BadRequestException(
          `Cannot transition from ${parcel.status} to ${newStatus}`,
        );
      }

      const data: Record<string, unknown> = { status: newStatus };
      if (newStatus === ParcelStatus.DELIVERED) {
        data.deliveredAt = new Date();
      }

      const updated = await this.prisma.parcel.update({
        where: { id: parcelId },
        data,
      });

      // Close the chat conversation on delivery
      if (newStatus === ParcelStatus.DELIVERED) {
        const conversation =
          await this.chatService.getConversationByRideOrParcel(
            undefined,
            parcelId,
          );
        if (conversation) {
          const closed = await this.chatService.closeConversation(
            conversation.id,
          );
          this.chatGateway.emitChatClosed(closed.id, closed.closedAt!);
        }
      }

      this.logger.log(`Parcel ${parcelId} status → ${newStatus}`);
      return updated;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`updateParcelStatus failed: ${parcelId}`, error);
      throw error;
    }
  }

  /**
   * Rider uploads proof of delivery (Cloudinary URL from frontend).
   */
  async uploadProof(parcelId: string, accountId: string, imageUrl: string) {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new ForbiddenException('Rider profile not found');

      const parcel = await this.prisma.parcel.findUnique({
        where: { id: parcelId },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');
      if (parcel.riderId !== rider.id)
        throw new ForbiddenException('Not your parcel');

      return this.prisma.parcel.update({
        where: { id: parcelId },
        data: { proofImageUrl: imageUrl },
        select: { id: true, proofImageUrl: true, status: true },
      });
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      )
        throw error;
      this.logger.error(`uploadProof failed: ${parcelId}`, error);
      throw error;
    }
  }

  /**
   * Cancel a parcel delivery — allowed for owner user or assigned rider.
   * Only allowed while status is PENDING or ACCEPTED.
   */
  async cancelParcel(parcelId: string, accountId: string) {
    try {
      const parcel = await this.prisma.parcel.findUnique({
        where: { id: parcelId },
      });
      if (!parcel) throw new NotFoundException('Parcel not found');

      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });

      const isOwner = parcel.userId === accountId;
      const isAssignedRider = rider && parcel.riderId === rider.id;

      if (!isOwner && !isAssignedRider) {
        throw new ForbiddenException('Access denied');
      }

      const cancellableStatuses: ParcelStatus[] = [
        ParcelStatus.PENDING,
        ParcelStatus.ACCEPTED,
      ];
      if (!cancellableStatuses.includes(parcel.status)) {
        throw new BadRequestException(
          'Parcel cannot be cancelled at this stage',
        );
      }

      const updated = await this.prisma.parcel.update({
        where: { id: parcelId },
        data: { status: ParcelStatus.CANCELLED },
      });

      // Close the chat conversation if it exists
      if (parcel.status === ParcelStatus.ACCEPTED) {
        const conversation =
          await this.chatService.getConversationByRideOrParcel(
            undefined,
            parcelId,
          );
        if (conversation) {
          const closed = await this.chatService.closeConversation(
            conversation.id,
          );
          this.chatGateway.emitChatClosed(closed.id, closed.closedAt!);
        }
      }

      this.logger.log(`Parcel ${parcelId} was CANCELLED by ${accountId}`);
      return updated;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`cancelParcel failed: ${parcelId}`, error);
      throw error;
    }
  }

  /** Returns the rider's currently active parcel delivery. */
  async getRiderActiveParcel(accountId: string) {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new NotFoundException('Rider profile not found');

      return this.prisma.parcel.findFirst({
        where: {
          riderId: rider.id,
          status: {
            in: [
              ParcelStatus.ACCEPTED,
              ParcelStatus.PICKED_UP,
              ParcelStatus.IN_TRANSIT,
            ],
          },
        },
        include: { user: { select: { fullName: true, phone: true } } },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getRiderActiveParcel failed`, error);
      throw error;
    }
  }

  // ─── Rating ───────────────────────────────────────────────

  /**
   * Allows a user to rate a completed parcel delivery.
   */
  async rateParcel(parcelId: string, userId: string, dto: RateParcelDto) {
    try {
      const parcel = await this.prisma.parcel.findUnique({
        where: { id: parcelId },
        include: { rating: true },
      });

      if (!parcel) throw new NotFoundException('Parcel not found');
      if (parcel.userId !== userId)
        throw new ForbiddenException('Access denied');
      if (parcel.status !== ParcelStatus.DELIVERED) {
        throw new BadRequestException('You can only rate delivered parcels');
      }
      if (parcel.rating) {
        throw new BadRequestException('You have already rated this delivery');
      }
      if (!parcel.riderId) {
        throw new BadRequestException('No rider associated with this delivery');
      }

      const rating = await this.prisma.rating.create({
        data: {
          parcelId,
          userId,
          riderId: parcel.riderId,
          score: dto.score,
          comment: dto.comment,
        },
      });

      // Update rider's average rating
      const allRatings = await this.prisma.rating.findMany({
        where: { riderId: parcel.riderId },
        select: { score: true },
      });

      const average =
        allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;

      await this.prisma.rider.update({
        where: { id: parcel.riderId },
        data: { ratingAverage: parseFloat(average.toFixed(1)) },
      });

      return rating;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`rateParcel failed: ${parcelId}`, error);
      throw error;
    }
  }
}
