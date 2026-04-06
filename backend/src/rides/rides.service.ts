import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus, RideStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { RideQueryDto } from './dto/ride-query.dto';
import { EstimateRideDto } from './dto/estimate-ride.dto';
import { RateRideDto } from './dto/rate-ride.dto';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { haversineKm } from '../common/utils/geo';
import { MapService } from '../map/map.service';

// Base fare in KES (Kenyan Shillings)
const BASE_FARE_KES = 50;
const PER_KM_RATE_KES = 30;
const AVG_SPEED_KPH = 25; // Conservative average for Nairobi traffic

/** Valid status transitions: what a rider can set given the current status */
const ALLOWED_STATUS_TRANSITIONS: Partial<Record<RideStatus, RideStatus>> = {
  [RideStatus.ACCEPTED]: RideStatus.EN_ROUTE_TO_PICKUP,
  [RideStatus.EN_ROUTE_TO_PICKUP]: RideStatus.ARRIVED_AT_PICKUP,
  [RideStatus.ARRIVED_AT_PICKUP]: RideStatus.IN_PROGRESS,
  [RideStatus.IN_PROGRESS]: RideStatus.COMPLETED,
};

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

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

  // ─── Create ───────────────────────────────────────────────

  /**
   * Calculates a fare and time estimate based on coordinates.
   * Uses real routing via OSRM and rates from the settings table.
   */
  async calculateEstimate(dto: EstimateRideDto) {
    // 1. Get rates from settings (fallback to constants)
    const settings = await this.prisma.setting.findMany();
    const minFareVal = settings.find((s) => s.key === 'MIN_FARE')?.value;
    const perKmRateVal = settings.find((s) => s.key === 'PER_KM_RATE')?.value;

    const baseFare = minFareVal ? parseFloat(minFareVal) : BASE_FARE_KES;
    const perKmRate = perKmRateVal ? parseFloat(perKmRateVal) : PER_KM_RATE_KES;

    try {
      // 2. Try real routing via MapService (OSRM Public API)
      const route = await this.mapService.getDirections(
        { lat: dto.pickupLat, lng: dto.pickupLng },
        { lat: dto.dropoffLat, lng: dto.dropoffLng },
      );

      // Price = base + (distance * per_km) — capped at MIN_FARE
      const estimatedFare = Math.max(
        baseFare,
        Math.round(baseFare + route.distanceKm * perKmRate),
      );

      return {
        distanceKm: route.distanceKm,
        estimatedFare,
        estimatedMins: route.durationMins,
        baseFare,
        perKmRate,
      };
    } catch (error) {
      this.logger.warn(`Routing estimate failed, falling back to Haversine: ${error.message}`);
      
      // 3. Fallback to Haversine straight-line distance
      const distanceKm = haversineKm(
        dto.pickupLat,
        dto.pickupLng,
        dto.dropoffLat,
        dto.dropoffLng,
      );

      const estimatedFare = Math.max(
        baseFare,
        Math.round(baseFare + distanceKm * perKmRate),
      );
      const estimatedMins = Math.round((distanceKm / AVG_SPEED_KPH) * 60);

      return {
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        estimatedFare,
        estimatedMins,
        baseFare,
        perKmRate,
      };
    }
  }

  /**
   * Creates a new PENDING ride with a fare estimate.
   * The estimate is based on Haversine distance — replaced with Mapbox routing in production.
   */
  async createRide(userId: string, dto: CreateRideDto) {
    try {
      const estimate = await this.calculateEstimate(dto);

      const ride = await this.prisma.ride.create({
        data: {
          userId,
          pickupLat: dto.pickupLat,
          pickupLng: dto.pickupLng,
          pickupAddress: dto.pickupAddress,
          dropoffLat: dto.dropoffLat,
          dropoffLng: dto.dropoffLng,
          dropoffAddress: dto.dropoffAddress,
          estimatedFare: estimate.estimatedFare,
          estimatedMins: estimate.estimatedMins,
          distanceKm: estimate.distanceKm,
          paymentMethod: dto.paymentMethod ?? 'MPESA',
          mpesaPhone: dto.mpesaPhone,
        },
        include: {
          user: { select: { fullName: true, phone: true, avatarUrl: true } },
        },
      });

      this.logger.log(
        `Ride created: ${ride.id} for user ${userId} — KES ${estimate.estimatedFare}`,
      );

      // Notify available riders via WebSocket
      this.trackingGateway.emitNewRideRequest(ride);

      // Send booking confirmation email if the user has one on file
      const account = await this.prisma.account.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true },
      });
      if (account?.email) {
        void this.mailService.sendRideConfirmed({
          to: account.email,
          userName: account.fullName,
          rideId: ride.id,
          pickupAddress: ride.pickupAddress,
          dropoffAddress: ride.dropoffAddress,
          distanceKm: ride.distanceKm,
          estimatedMins: ride.estimatedMins,
          estimatedFare: ride.estimatedFare,
          paymentMethod: ride.paymentMethod,
        });
      }

      return ride;
    } catch (error) {
      this.logger.error('createRide failed', error);
      throw error;
    }
  }

  // ─── Read ─────────────────────────────────────────────────

  /**
   * Returns a paginated list of rides for the authenticated user.
   */
  async getUserRides(userId: string, query: RideQueryDto) {
    try {
      const skip = (query.page - 1) * query.limit;
      const where = {
        userId,
        ...(query.status && { status: query.status }),
      };

      const [rides, total] = await Promise.all([
        this.prisma.ride.findMany({
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
            payment: {
              select: { status: true, amount: true, completedAt: true },
            },
            rating: { select: { score: true } },
            passengerRating: { select: { score: true, comment: true } },
          },
        }),
        this.prisma.ride.count({ where }),
      ]);

      return {
        data: rides,
        total,
        page: query.page,
        totalPages: Math.ceil(total / query.limit),
      };
    } catch (error) {
      this.logger.error(`getUserRides failed for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Returns paginated completed/filtered rides assigned to the authenticated rider.
   */
  async getRiderRides(accountId: string, query: RideQueryDto) {
    try {
      const rider = await this.prisma.rider.findUnique({ where: { accountId } });
      if (!rider) throw new NotFoundException('Rider profile not found');

      const skip = (query.page - 1) * query.limit;
      const where = {
        riderId: rider.id,
        ...(query.status && { status: query.status }),
      };

      const [rides, total] = await Promise.all([
        this.prisma.ride.findMany({
          where,
          skip,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { fullName: true, avatarUrl: true, phone: true } },
            payment: {
              select: { status: true, amount: true, completedAt: true },
            },
            rating: { select: { score: true } },
            passengerRating: { select: { score: true, comment: true } },
          },
        }),
        this.prisma.ride.count({ where }),
      ]);

      return {
        data: rides,
        total,
        page: query.page,
        totalPages: Math.ceil(total / query.limit),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getRiderRides failed for account ${accountId}`, error);
      throw error;
    }
  }

  /**
   * Returns a list of all PENDING ride requests within a given radius (km).
   * Used by riders to browse nearby work.
   */
  async getNearbyPendingRides(query: RideQueryDto) {
    const { lat, lng, radiusKm = 500, limit = 20 } = query;
    
    if (lat === undefined || lng === undefined) {
      // If no location provided, just return most recent pending rides
      return this.prisma.ride.findMany({
        where: { status: RideStatus.PENDING },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, avatarUrl: true, passengerRatingAverage: true } },
        },
      });
    }

    try {
      // 1 degree ≈ 111 km
      const delta = radiusKm / 111;

      const rides = await this.prisma.ride.findMany({
        where: {
          status: RideStatus.PENDING,
          pickupLat: { gte: lat - delta, lte: lat + delta },
          pickupLng: { gte: lng - delta, lte: lng + delta },
        },
        take: limit * 2, // Take more for manual Haversine filtering
        include: {
          user: { select: { fullName: true, avatarUrl: true, passengerRatingAverage: true } },
        },
      });

      // Precise Haversine distance filtering
      return rides
        .map((ride) => ({
          ...ride,
          distanceFromRiderKm: haversineKm(
            lat,
            lng,
            ride.pickupLat,
            ride.pickupLng,
          ),
        }))
        .filter((r) => r.distanceFromRiderKm <= radiusKm)
        .sort((a, b) => a.distanceFromRiderKm - b.distanceFromRiderKm)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('getNearbyPendingRides failed', error);
      throw error;
    }
  }

  /**
   * Returns a single ride. User can only see their own rides; riders see rides assigned to them.
   */
  async getRideById(rideId: string, accountId: string) {
    try {
      const ride = await this.prisma.ride.findUnique({
        where: { id: rideId },
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
          passengerRating: { select: { score: true, comment: true } },
        },
      });

      if (!ride) throw new NotFoundException('Ride not found');

      // Check if the account is a rider
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });

      const isOwner = ride.userId === accountId;
      const isAssignedRider = rider && ride.riderId === rider.id;

      if (!isOwner && !isAssignedRider) {
        throw new ForbiddenException('Access denied');
      }

      return ride;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      )
        throw error;
      this.logger.error(`getRideById failed: ${rideId}`, error);
      throw error;
    }
  }

  // ─── Rider actions ────────────────────────────────────────

  /**
   * Rider accepts a pending ride — sets their riderId and moves status to ACCEPTED.
   */
  async acceptRide(rideId: string, accountId: string) {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new ForbiddenException('Rider profile not found');
      if (!rider.isVerified)
        throw new ForbiddenException('Your account is not yet verified');
      if (!rider.isAvailable)
        throw new ForbiddenException('You are currently marked as unavailable');

      const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) throw new NotFoundException('Ride not found');
      if (ride.status !== RideStatus.PENDING) {
        throw new BadRequestException('This ride is no longer available');
      }

      const updated = await this.prisma.ride.update({
        where: { id: rideId },
        data: { riderId: rider.id, status: RideStatus.ACCEPTED },
        include: {
          user: { select: { fullName: true, phone: true, avatarUrl: true } },
        },
      });

      this.logger.log(`Rider ${rider.id} accepted ride ${rideId}`);

      // Fire-and-forget: side effects must not delay the HTTP response
      // (sequential DB round-trips to Neon can cause 504s on Render)
      void (async () => {
        try {
          await this.chatService.createConversation(rideId);

          const [userAccount, riderAccount] = await Promise.all([
            this.prisma.account.findUnique({
              where: { id: updated.userId },
              select: { email: true, fullName: true },
            }),
            this.prisma.account.findUnique({
              where: { id: accountId },
              select: { fullName: true, phone: true },
            }),
          ]);

          if (userAccount?.email && riderAccount) {
            void this.mailService.sendRiderAccepted({
              to: userAccount.email,
              userName: userAccount.fullName,
              rideId,
              pickupAddress: updated.pickupAddress,
              dropoffAddress: updated.dropoffAddress,
              estimatedFare: updated.estimatedFare,
              riderName: riderAccount.fullName,
              riderPhone: riderAccount.phone,
              bikeModel: rider.bikeModel ?? 'Motorcycle',
              bikeRegistration: rider.bikeRegistration ?? 'Not provided',
              ratingAverage: rider.ratingAverage,
            });
          }

          await this.sendRideNotification(
            updated.userId,
            'Rider Assigned',
            `${riderAccount?.fullName ?? 'Your rider'} has accepted your ride request and is on the way!`,
            rideId,
          );
        } catch (err) {
          this.logger.error(`Post-accept side effects failed for ride ${rideId}`, err);
        }
      })();

      return updated;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`acceptRide failed: ${rideId}`, error);
      throw error;
    }
  }

  /**
   * Rider updates the status of their active ride.
   * Status must follow the allowed transition sequence.
   */
  async updateRideStatus(
    rideId: string,
    accountId: string,
    newStatus: RideStatus,
  ) {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new ForbiddenException('Rider profile not found');

      const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) throw new NotFoundException('Ride not found');
      if (ride.riderId !== rider.id)
        throw new ForbiddenException('This is not your ride');

      const allowedNext = ALLOWED_STATUS_TRANSITIONS[ride.status];
      if (allowedNext !== newStatus) {
        throw new BadRequestException(
          `Cannot transition from ${ride.status} to ${newStatus}`,
        );
      }

      // For MPESA rides, require a completed payment before marking the ride done
      if (newStatus === RideStatus.COMPLETED && ride.paymentMethod === 'MPESA') {
        const payment = await this.prisma.payment.findFirst({
          where: { rideId, status: 'COMPLETED' },
        });
        if (!payment) {
          throw new BadRequestException(
            'Payment has not been confirmed yet. Ask the passenger to complete M-Pesa payment before finishing the ride.',
          );
        }
      }

      /** Set when rider completes a cash trip — payment row + realtime clients */
      let cashPaymentSettled: {
        id: string;
        amount: number;
        completedAt: Date;
      } | null = null;

      // Cash: rider completing the ride confirms cash was collected — settle payment record
      if (newStatus === RideStatus.COMPLETED && ride.paymentMethod === 'CASH') {
        const existing = await this.prisma.payment.findFirst({
          where: { rideId },
        });
        if (existing) {
          if (existing.status !== PaymentStatus.COMPLETED) {
            const p = await this.prisma.payment.update({
              where: { id: existing.id },
              data: {
                status: PaymentStatus.COMPLETED,
                completedAt: new Date(),
                method: PaymentMethod.CASH,
              },
            });
            cashPaymentSettled = {
              id: p.id,
              amount: p.amount,
              completedAt: p.completedAt!,
            };
          }
        } else {
          const p = await this.prisma.payment.create({
            data: {
              rideId,
              amount: ride.estimatedFare,
              status: PaymentStatus.COMPLETED,
              method: PaymentMethod.CASH,
              completedAt: new Date(),
            },
          });
          cashPaymentSettled = {
            id: p.id,
            amount: p.amount,
            completedAt: p.completedAt!,
          };
        }
      }

      const data: Record<string, unknown> = { status: newStatus };
      if (newStatus === RideStatus.COMPLETED) {
        data.completedAt = new Date();
        data.finalFare = ride.estimatedFare; // Payment service will confirm actual fare

        // Calculate commission
        const settings = await this.prisma.setting.findMany({ where: { key: 'COMMISSION_PERCENTAGE' } });
        const commissionPct = settings.length > 0 ? parseFloat(settings[0].value) : 15; // Default 15%
        const finalFare = ride.estimatedFare;
        const commissionAmount = (commissionPct / 100) * finalFare;
        const riderEarnings = finalFare - commissionAmount;

        data.commissionAmount = commissionAmount;
        data.riderEarnings = riderEarnings;
      }

      const updated = await this.prisma.ride.update({
        where: { id: rideId },
        data,
      });

      if (cashPaymentSettled) {
        this.trackingGateway.emitPaymentUpdate(cashPaymentSettled.id, {
          status: 'COMPLETED',
          amount: cashPaymentSettled.amount,
          completedAt: cashPaymentSettled.completedAt.toISOString(),
        });
        this.trackingGateway.emitTripPaymentUpdate(ride.userId, {
          kind: 'ride',
          entityId: rideId,
          paymentId: cashPaymentSettled.id,
          status: 'COMPLETED',
          mpesaReceiptNumber: null,
          completedAt: cashPaymentSettled.completedAt.toISOString(),
        });
        this.trackingGateway.emitTripPaymentUpdate(accountId, {
          kind: 'ride',
          entityId: rideId,
          paymentId: cashPaymentSettled.id,
          status: 'COMPLETED',
          mpesaReceiptNumber: null,
          completedAt: cashPaymentSettled.completedAt.toISOString(),
        });
      }

      // Update rider's total rides count and earnings on completion
      if (newStatus === RideStatus.COMPLETED) {
        await this.prisma.rider.update({
          where: { id: rider.id },
          data: { 
            totalRides: { increment: 1 },
            totalEarnings: { increment: updated.riderEarnings || 0 }
          },
        });

        // Close the chat conversation
        const conversation =
          await this.chatService.getConversationByRideOrParcel(rideId);
        if (conversation) {
          const closed = await this.chatService.closeConversation(
            conversation.id,
          );
          this.chatGateway.emitChatClosed(closed.id, closed.closedAt!);
        }
      }

      this.logger.log(`Ride ${rideId} status → ${newStatus}`);

      // In-app notifications for status updates
      if (newStatus === RideStatus.ARRIVED_AT_PICKUP) {
        await this.sendRideNotification(
          updated.userId,
          'Rider Arrived',
          'Your rider has arrived at the pickup location.',
          rideId,
        );
      } else if (newStatus === RideStatus.IN_PROGRESS) {
        await this.sendRideNotification(
          updated.userId,
          'Ride Started',
          'Your ride has started. Enjoy the trip!',
          rideId,
        );
      } else if (newStatus === RideStatus.COMPLETED) {
        await this.sendRideNotification(
          updated.userId,
          'Ride Completed',
          `Your trip is finished. Total fare: KES ${updated.finalFare}`,
          rideId,
        );
      }

      // Send receipt email on completion
      if (newStatus === RideStatus.COMPLETED) {
        const [userAccount, riderAccount] = await Promise.all([
          this.prisma.account.findUnique({
            where: { id: updated.userId },
            select: { email: true, fullName: true },
          }),
          this.prisma.account.findUnique({
            where: { id: accountId },
            select: { fullName: true },
          }),
        ]);
        if (userAccount?.email && riderAccount) {
          void this.mailService.sendRideCompleted({
            to: userAccount.email,
            userName: userAccount.fullName,
            rideId,
            pickupAddress: updated.pickupAddress,
            dropoffAddress: updated.dropoffAddress,
            distanceKm: updated.distanceKm,
            finalFare: updated.finalFare ?? updated.estimatedFare,
            riderName: riderAccount.fullName,
            paymentMethod: updated.paymentMethod,
          });
        }
      }

      return updated;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`updateRideStatus failed: ${rideId}`, error);
      throw error;
    }
  }

  // ─── User cancel ──────────────────────────────────────────

  /**
   * User cancels a ride — only allowed while status is PENDING or ACCEPTED.
   */
  async cancelRide(rideId: string, userId: string) {
    try {
      const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) throw new NotFoundException('Ride not found');
      if (ride.userId !== userId) throw new ForbiddenException('Access denied');

      const cancellableStatuses: RideStatus[] = [
        RideStatus.PENDING,
        RideStatus.ACCEPTED,
      ];
      if (!cancellableStatuses.includes(ride.status)) {
        throw new BadRequestException('Ride cannot be cancelled at this stage');
      }

      const updated = await this.prisma.ride.update({
        where: { id: rideId },
        data: { status: RideStatus.CANCELLED },
      });

      // Close the chat conversation if it exists
      if (ride.status === RideStatus.ACCEPTED) {
        const conversation =
          await this.chatService.getConversationByRideOrParcel(rideId);
        if (conversation) {
          const closed = await this.chatService.closeConversation(
            conversation.id,
          );
          this.chatGateway.emitChatClosed(closed.id, closed.closedAt!);
        }
      }

      return updated;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`cancelRide failed: ${rideId}`, error);
      throw error;
    }
  }

  // ─── Rider's active ride ──────────────────────────────────

  /**
   * Returns the rider's currently active ride (ACCEPTED → IN_PROGRESS), if any.
   */
  async getRiderActiveRide(accountId: string) {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new NotFoundException('Rider profile not found');

      return this.prisma.ride.findFirst({
        where: {
          riderId: rider.id,
          status: {
            in: [
              RideStatus.ACCEPTED,
              RideStatus.EN_ROUTE_TO_PICKUP,
              RideStatus.ARRIVED_AT_PICKUP,
              RideStatus.IN_PROGRESS,
            ],
          },
        },
        include: {
          user: { select: { fullName: true, phone: true, avatarUrl: true } },
          payment: { select: { status: true } },
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        `getRiderActiveRide failed for account ${accountId}`,
        error,
      );
      throw error;
    }
  }

  // ─── Rating ───────────────────────────────────────────────

  /**
   * Allows a user to rate a completed ride.
   */
  async rateRide(rideId: string, userId: string, dto: RateRideDto) {
    try {
      const ride = await this.prisma.ride.findUnique({
        where: { id: rideId },
        include: { rating: true },
      });

      if (!ride) throw new NotFoundException('Ride not found');
      if (ride.userId !== userId) throw new ForbiddenException('Access denied');
      if (ride.status !== RideStatus.COMPLETED) {
        throw new BadRequestException('You can only rate completed rides');
      }
      if (ride.rating) {
        throw new BadRequestException('You have already rated this ride');
      }
      if (!ride.riderId) {
        throw new BadRequestException('No rider associated with this ride');
      }

      const rating = await this.prisma.rating.create({
        data: {
          rideId,
          userId,
          riderId: ride.riderId,
          score: dto.score,
          comment: dto.comment,
        },
      });

      // Update rider's average rating
      const allRatings = await this.prisma.rating.findMany({
        where: { riderId: ride.riderId },
        select: { score: true },
      });

      const average =
        allRatings.reduce((sum, r) => sum + r.score, 0) / allRatings.length;

      await this.prisma.rider.update({
        where: { id: ride.riderId },
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
      this.logger.error(`rateRide failed: ${rideId}`, error);
      throw error;
    }
  }

  /**
   * Allows the assigned rider to rate the passenger after a completed ride.
   */
  async ratePassenger(rideId: string, accountId: string, dto: RateRideDto) {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new ForbiddenException('Rider profile not found');

      const ride = await this.prisma.ride.findUnique({
        where: { id: rideId },
        include: { passengerRating: true },
      });

      if (!ride) throw new NotFoundException('Ride not found');
      if (ride.riderId !== rider.id) {
        throw new ForbiddenException('Access denied');
      }
      if (ride.status !== RideStatus.COMPLETED) {
        throw new BadRequestException(
          'You can only rate passengers after the ride is completed',
        );
      }
      if (ride.passengerRating) {
        throw new BadRequestException('You have already rated this passenger');
      }

      await this.prisma.passengerRating.create({
        data: {
          rideId,
          riderId: rider.id,
          passengerAccountId: ride.userId,
          score: dto.score,
          comment: dto.comment,
        },
      });

      const allScores = await this.prisma.passengerRating.findMany({
        where: { passengerAccountId: ride.userId },
        select: { score: true },
      });
      const average =
        allScores.reduce((sum, r) => sum + r.score, 0) / allScores.length;

      await this.prisma.account.update({
        where: { id: ride.userId },
        data: {
          passengerRatingAverage: parseFloat(average.toFixed(1)),
        },
      });

      return { score: dto.score };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(`ratePassenger failed: ${rideId}`, error);
      throw error;
    }
  }

  private async sendRideNotification(
    accountId: string,
    title: string,
    body: string,
    rideId: string,
  ) {
    try {
      await this.notificationsService.createInAppNotification(
        accountId,
        title,
        body,
        'RIDE_UPDATE',
        { rideId },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ride notification to ${accountId}`,
        error,
      );
    }
  }
}
