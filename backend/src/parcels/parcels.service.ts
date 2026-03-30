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
import { NotificationsService } from '../notifications/notifications.service';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { ParcelQueryDto } from './dto/parcel-query.dto';
import { EstimateParcelDto } from './dto/estimate-parcel.dto';
import { RateParcelDto } from './dto/rate-parcel.dto';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { haversineKm } from '../common/utils/geo';
import { haversineKm } from '../common/utils/geo';
import { MapService } from '../map/map.service';

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
    private readonly notificationsService: NotificationsService,
    private readonly trackingGateway: TrackingGateway,
    private readonly chatService: ChatService,
    private readonly mapService: MapService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Calculates a delivery fee estimate based on coordinates and weight.
   * Uses real routing via OSRM and rates from settings.
   */
  async calculateEstimate(dto: EstimateParcelDto) {
    // 1. Get rates from settings (fallback to constants)
    const settings = await this.prisma.setting.findMany();
    const minFeeVal = settings.find((s) => s.key === 'PARCEL_BASE_FEE')?.value;
    const perKmVal = settings.find((s) => s.key === 'PARCEL_PER_KM')?.value;

    const baseFee = minFeeVal ? parseFloat(minFeeVal) : BASE_FEE;
    const perKmRate = perKmVal ? parseFloat(perKmVal) : PER_KM_RATE;

    const weightSurcharge =
      Math.max(0, dto.weightKg - 1) * WEIGHT_SURCHARGE_PER_KG;

    try {
      // 2. Try real routing
      const route = await this.mapService.getDirections(
        { lat: dto.pickupLat, lng: dto.pickupLng },
        { lat: dto.dropoffLat, lng: dto.dropoffLng },
      );

      const deliveryFee = Math.round(
        baseFee + route.distanceKm * perKmRate + weightSurcharge,
      );

      return {
        distanceKm: route.distanceKm,
        deliveryFee,
        baseFee,
        perKmRate,
        weightSurcharge,
      };
    } catch (error) {
      this.logger.warn(`Routing failed for parcel, using Haversine: ${error.message}`);
      
      const distanceKm = haversineKm(
        dto.pickupLat,
        dto.pickupLng,
        dto.dropoffLat,
        dto.dropoffLng,
      );
      
      const deliveryFee = Math.round(
        baseFee + distanceKm * perKmRate + weightSurcharge,
      );

      return {
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        deliveryFee,
        baseFee,
        perKmRate,
        weightSurcharge,
      };
    }
  }

  /**
   * Creates a new parcel delivery with calculated fee.
   * Fee = base + distance rate + weight surcharge for packages over 1kg.
   */
  async createParcel(userId: string, dto: CreateParcelDto) {
    try {
      const estimate = await this.calculateEstimate(dto);

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
  async getUserParcels(userId: string, query: ParcelQueryDto) {
    try {
      const skip = (query.page - 1) * query.limit;
      const where: any = { userId };
      if (query.status) where.status = query.status;

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
   * Paginated list of parcels assigned to the authenticated rider.
   */
  async getRiderParcels(accountId: string, query: ParcelQueryDto) {
    try {
      const rider = await this.prisma.rider.findUnique({ where: { accountId } });
      if (!rider) throw new NotFoundException('Rider profile not found');

      const skip = (query.page - 1) * query.limit;
      const where: any = { riderId: rider.id };
      if (query.status) where.status = query.status;

      const [parcels, total] = await Promise.all([
        this.prisma.parcel.findMany({
          where,
          skip,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { fullName: true, avatarUrl: true, phone: true } },
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
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getRiderParcels failed for ${accountId}`, error);
      throw error;
    }
  }

  /**
   * Returns a list of all PENDING parcel requests within a given radius (km).
   * Used by riders to browse nearby work.
   */
  async getNearbyPendingParcels(query: ParcelQueryDto) {
    const { lat, lng, radiusKm = 500, limit = 20 } = query;

    if (lat === undefined || lng === undefined) {
      // If no location provided, just return most recent pending parcels
      return this.prisma.parcel.findMany({
        where: { status: ParcelStatus.PENDING },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, avatarUrl: true } },
        },
      });
    }

    try {
      // 1 degree ≈ 111 km
      const delta = radiusKm / 111;

      const parcels = await this.prisma.parcel.findMany({
        where: {
          status: ParcelStatus.PENDING,
          pickupLat: { gte: lat - delta, lte: lat + delta },
          pickupLng: { gte: lng - delta, lte: lng + delta },
        },
        take: limit * 2, // Take more for manual Haversine filtering
        include: {
          user: { select: { fullName: true, avatarUrl: true } },
        },
      });

      // Precise Haversine distance filtering
      return parcels
        .map((parcel) => ({
          ...parcel,
          distanceFromRiderKm: haversineKm(
            lat,
            lng,
            parcel.pickupLat,
            parcel.pickupLng,
          ),
        }))
        .filter((p) => p.distanceFromRiderKm <= radiusKm)
        .sort((a, b) => a.distanceFromRiderKm - b.distanceFromRiderKm)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('getNearbyPendingParcels failed', error);
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

      // In-app notification
      const riderAccount = await this.prisma.account.findUnique({
        where: { id: accountId },
        select: { fullName: true },
      });
      await this.sendParcelNotification(
        updated.userId,
        'Delivery Accepted',
        `${riderAccount?.fullName ?? 'A rider'} has accepted your parcel delivery request.`,
        parcelId,
      );

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

        // Calculate commission
        const settings = await this.prisma.setting.findMany({ where: { key: 'COMMISSION_PERCENTAGE' } });
        const commissionPct = settings.length > 0 ? parseFloat(settings[0].value) : 15; // Default 15%
        const deliveryFee = parcel.deliveryFee;
        const commissionAmount = (commissionPct / 100) * deliveryFee;
        const riderEarnings = deliveryFee - commissionAmount;

        data.commissionAmount = commissionAmount;
        data.riderEarnings = riderEarnings;
      }

      const updated = await this.prisma.parcel.update({
        where: { id: parcelId },
        data,
      });

      // Update rider's total earnings on delivery
      if (newStatus === ParcelStatus.DELIVERED) {
        await this.prisma.rider.update({
          where: { id: rider.id },
          data: { 
            totalEarnings: { increment: updated.riderEarnings || 0 }
          },
        });

        // Close the chat conversation on delivery
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

      // In-app notifications
      if (newStatus === ParcelStatus.PICKED_UP) {
        await this.sendParcelNotification(
          updated.userId,
          'Parcel Picked Up',
          'Your parcel has been picked up by the rider.',
          parcelId,
        );
      } else if (newStatus === ParcelStatus.IN_TRANSIT) {
        await this.sendParcelNotification(
          updated.userId,
          'Parcel In Transit',
          'Your parcel is now on its way to the destination.',
          parcelId,
        );
      } else if (newStatus === ParcelStatus.DELIVERED) {
        await this.sendParcelNotification(
          updated.userId,
          'Parcel Delivered',
          `Your parcel has been successfully delivered. Fee: KES ${updated.deliveryFee}`,
          parcelId,
        );
      }

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

  private async sendParcelNotification(
    accountId: string,
    title: string,
    body: string,
    parcelId: string,
  ) {
    try {
      await this.notificationsService.createInAppNotification(
        accountId,
        title,
        body,
        'PARCEL_UPDATE',
        { parcelId },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send parcel notification to ${accountId}`,
        error,
      );
    }
  }
}
