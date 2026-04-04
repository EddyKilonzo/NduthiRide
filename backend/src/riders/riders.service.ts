import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LipanaPayoutService } from '../payments/lipana-payout.service';
import {
  UpdateRiderAvailabilityDto,
  UpdateRiderLocationDto,
  UpdateRiderProfileDto,
} from './dto/update-rider.dto';
import { Rider } from '@prisma/client';
import { haversineKm } from '../common/utils/geo';

@Injectable()
export class RidersService {
  private readonly logger = new Logger(RidersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lipanaPayout: LipanaPayoutService,
  ) {}

  /**
   * Returns the full Rider profile for the given account.
   * Includes the linked Account (minus sensitive fields).
   */
  async getRiderProfile(accountId: string): Promise<Rider> {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
        include: {
          account: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              avatarUrl: true,
              email: true,
              isActive: true,
            },
          },
        },
      });

      if (!rider) {
        throw new NotFoundException('Rider profile not found');
      }

      return rider;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        `getRiderProfile failed for account ${accountId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Flips the rider's availability toggle.
   * Only the rider themselves can change their availability.
   */
  async updateAvailability(
    accountId: string,
    dto: UpdateRiderAvailabilityDto,
  ): Promise<Pick<Rider, 'id' | 'isAvailable'>> {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new NotFoundException('Rider profile not found');

      const updated = await this.prisma.rider.update({
        where: { accountId },
        data: { isAvailable: dto.isAvailable },
        select: { id: true, isAvailable: true },
      });

      this.logger.log(`Rider ${rider.id} availability → ${dto.isAvailable}`);
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        `updateAvailability failed for account ${accountId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Updates the rider's GPS position and records it in LocationHistory.
   * Called by the WebSocket gateway on each location ping.
   */
  async updateLocation(
    accountId: string,
    dto: UpdateRiderLocationDto,
  ): Promise<void> {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new NotFoundException('Rider profile not found');

      // Update current position + timestamp in a single transaction
      await this.prisma.$transaction([
        this.prisma.rider.update({
          where: { accountId },
          data: {
            currentLat: dto.lat,
            currentLng: dto.lng,
            lastSeenAt: new Date(),
          },
        }),
        this.prisma.locationHistory.create({
          data: {
            riderId: rider.id,
            lat: dto.lat,
            lng: dto.lng,
            speed: dto.speed,
          },
        }),
      ]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        `updateLocation failed for account ${accountId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Updates editable fields on the rider profile (bike model, avatar).
   * Sensitive fields like licenseNumber and bikeRegistration are read-only after creation.
   */
  async updateProfile(
    accountId: string,
    dto: UpdateRiderProfileDto,
  ): Promise<Rider> {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new NotFoundException('Rider profile not found');

      return this.prisma.rider.update({
        where: { accountId },
        data: {
          ...(dto.bikeModel !== undefined && { bikeModel: dto.bikeModel }),
          ...(dto.bikeRegistration !== undefined && {
            bikeRegistration: dto.bikeRegistration,
          }),
          ...(dto.licenseNumber !== undefined && {
            licenseNumber: dto.licenseNumber,
          }),
          ...(dto.licenseImageUrl !== undefined && {
            licenseImageUrl: dto.licenseImageUrl,
          }),
          ...(dto.idFrontImageUrl !== undefined && {
            idFrontImageUrl: dto.idFrontImageUrl,
          }),
          ...(dto.idBackImageUrl !== undefined && {
            idBackImageUrl: dto.idBackImageUrl,
          }),
          ...(dto.logbookImageUrl !== undefined && {
            logbookImageUrl: dto.logbookImageUrl,
          }),
          // Update the avatarUrl in the linked Account table
          account: {
            update: {
              ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
            },
          },
        },
        include: {
          account: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              avatarUrl: true,
              email: true,
              isActive: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`updateProfile failed for account ${accountId}`, error);
      throw error;
    }
  }

  /**
   * Returns paginated payout history for the rider.
   */
  async getPayouts(accountId: string, page = 1, limit = 10): Promise<any> {
    const rider = await this.prisma.rider.findUnique({ where: { accountId } });
    if (!rider) throw new NotFoundException('Rider not found');

    const skip = (page - 1) * limit;
    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where: { riderId: rider.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payout.count({ where: { riderId: rider.id } }),
    ]);

    return {
      data: payouts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Requests a payout from earnings.
   * MPESA: sends immediately via Lipana (POST /payouts/phone); no admin step.
   * Other methods (e.g. BANK): creates PENDING and reserves balance for admin processing.
   */
  async requestPayout(
    accountId: string,
    amount: number,
    method: string,
    details: string,
  ): Promise<any> {
    const rider = await this.prisma.rider.findUnique({
      where: { accountId },
      include: { account: { select: { phone: true } } },
    });
    if (!rider) throw new NotFoundException('Rider not found');

    const amt = Math.ceil(Number(amount));
    if (!Number.isFinite(amt) || amt < 1) {
      throw new BadRequestException('Invalid payout amount');
    }
    if (rider.totalEarnings < amt) {
      throw new BadRequestException('Insufficient earnings for payout');
    }

    const m = (method || 'MPESA').toUpperCase();
    if (m === 'MPESA') {
      return this.requestMpesaPayoutSelfService(rider, amt, details);
    }

    if (amt < 10) {
      throw new BadRequestException('Minimum payout is KES 10');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.rider.updateMany({
        where: { id: rider.id, totalEarnings: { gte: amt } },
        data: { totalEarnings: { decrement: amt } },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Insufficient earnings for payout');
      }
      return tx.payout.create({
        data: {
          riderId: rider.id,
          amount: amt,
          status: 'PENDING',
          method: m,
          accountDetails: details,
        },
      });
    });
  }

  /**
   * Reserves balance, sends M-Pesa via Lipana, marks COMPLETED or refunds on failure.
   */
  private async requestMpesaPayoutSelfService(
    rider: {
      id: string;
      totalEarnings: number;
      account: { phone: string | null };
    },
    amt: number,
    details: string,
  ) {
    if (amt < 10) {
      throw new BadRequestException('Minimum M-Pesa withdrawal is KES 10');
    }

    const raw = (details?.trim() || rider.account.phone || '').trim();
    if (!raw) {
      throw new BadRequestException(
        'Enter the M-Pesa number to receive funds, or add a phone number to your profile.',
      );
    }
    const e164 = this.lipanaPayout.normalizeToE164(raw);
    if (!this.lipanaPayout.isValidKenyanE164(e164)) {
      throw new BadRequestException('Invalid M-Pesa phone number');
    }
    const phone254 = e164.replace(/^\+/, '');

    const payout = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.rider.updateMany({
        where: { id: rider.id, totalEarnings: { gte: amt } },
        data: { totalEarnings: { decrement: amt } },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Insufficient earnings for payout');
      }
      return tx.payout.create({
        data: {
          riderId: rider.id,
          amount: amt,
          status: 'PROCESSING',
          method: 'MPESA',
          accountDetails: raw,
        },
      });
    });

    try {
      const { id: lipanaId } = await this.lipanaPayout.sendToPhone(
        phone254,
        amt,
      );
      try {
        return await this.prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'COMPLETED',
            reference: lipanaId,
            processedAt: new Date(),
          },
        });
      } catch (dbErr) {
        this.logger.error(
          `Lipana payout ${lipanaId} succeeded for rider ${rider.id} but DB update failed`,
          dbErr,
        );
        throw new InternalServerErrorException(
          'M-Pesa transfer may have been sent but we could not finalize your record. Contact support with your rider ID.',
        );
      }
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;

      const msg =
        err instanceof Error ? err.message : 'M-Pesa payout failed';
      this.logger.warn(
        `Rider self-service payout failed payoutId=${payout.id}: ${msg}`,
      );

      await this.prisma.$transaction([
        this.prisma.payout.update({
          where: { id: payout.id },
          data: { status: 'FAILED' },
        }),
        this.prisma.rider.update({
          where: { id: rider.id },
          data: { totalEarnings: { increment: amt } },
        }),
      ]);

      throw new BadRequestException(
        `${msg} Your balance has been restored. You can try again in a moment.`,
      );
    }
  }

  /**
   * Returns a list of all available riders within a given radius (km).
   * Uses a simple bounding-box pre-filter then Haversine for precision.
   */
  async findNearbyRiders(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Array<Rider & { distanceKm: number }>> {
    try {
      // Approximate degree delta for the bounding box (1 degree ≈ 111 km)
      const delta = radiusKm / 111;

      const riders = await this.prisma.rider.findMany({
        where: {
          isAvailable: true,
          isVerified: true,
          currentLat: { gte: lat - delta, lte: lat + delta },
          currentLng: { gte: lng - delta, lte: lng + delta },
        },
        include: {
          account: {
            select: { fullName: true, avatarUrl: true, phone: true },
          },
        },
      });

      // Apply Haversine formula for accurate distance filtering
      return riders
        .map((rider) => ({
          ...rider,
          distanceKm: haversineKm(
            lat,
            lng,
            rider.currentLat!,
            rider.currentLng!,
          ),
        }))
        .filter((r) => r.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    } catch (error) {
      this.logger.error('findNearbyRiders failed', error);
      throw error;
    }
  }
}
