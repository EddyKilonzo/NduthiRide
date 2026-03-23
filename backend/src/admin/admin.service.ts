import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListAccountsDto,
  ListRidesDto,
  ListParcelsDto,
  ListPaymentsDto,
} from './dto/admin-query.dto';
import {
  SetAccountStatusDto,
  SetRiderVerificationDto,
} from './dto/admin-action.dto';

/** Generic paginated result wrapper */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Dashboard ────────────────────────────────────────────

  /**
   * Returns high-level platform statistics for the admin dashboard.
   * Runs all counts concurrently for performance.
   */
  async getDashboardStats(): Promise<Record<string, number>> {
    try {
      const [
        totalUsers,
        totalRiders,
        verifiedRiders,
        availableRiders,
        totalRides,
        activeRides,
        completedRides,
        totalParcels,
        completedParcels,
        totalRevenue,
      ] = await Promise.all([
        this.prisma.account.count({ where: { role: 'USER' } }),
        this.prisma.account.count({ where: { role: 'RIDER' } }),
        this.prisma.rider.count({ where: { isVerified: true } }),
        this.prisma.rider.count({ where: { isAvailable: true } }),
        this.prisma.ride.count(),
        this.prisma.ride.count({
          where: {
            status: {
              in: [
                'ACCEPTED',
                'IN_PROGRESS',
                'EN_ROUTE_TO_PICKUP',
                'ARRIVED_AT_PICKUP',
              ],
            },
          },
        }),
        this.prisma.ride.count({ where: { status: 'COMPLETED' } }),
        this.prisma.parcel.count(),
        this.prisma.parcel.count({ where: { status: 'DELIVERED' } }),
        // Sum all completed payments
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: 'COMPLETED' },
        }),
      ]);

      return {
        totalUsers,
        totalRiders,
        verifiedRiders,
        availableRiders,
        totalRides,
        activeRides,
        completedRides,
        totalParcels,
        completedParcels,
        totalRevenue: totalRevenue._sum.amount ?? 0,
      };
    } catch (error) {
      this.logger.error('getDashboardStats failed', error);
      throw error;
    }
  }

  // ─── Accounts ─────────────────────────────────────────────

  /**
   * Lists all accounts with optional role filter, active filter, and name/phone search.
   * Returns paginated results with sensitive fields excluded.
   */
  async listAccounts(dto: ListAccountsDto): Promise<PaginatedResult<unknown>> {
    try {
      const skip = (dto.page - 1) * dto.limit;

      const where = {
        ...(dto.role && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.search && {
          OR: [
            {
              fullName: { contains: dto.search, mode: 'insensitive' as const },
            },
            { phone: { contains: dto.search } },
            { email: { contains: dto.search, mode: 'insensitive' as const } },
          ],
        }),
      };

      const [accounts, total] = await Promise.all([
        this.prisma.account.findMany({
          where,
          skip,
          take: dto.limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            role: true,
            isActive: true,
            avatarUrl: true,
            createdAt: true,
            // Include rider status if applicable
            rider: {
              select: {
                isVerified: true,
                isAvailable: true,
                ratingAverage: true,
                totalRides: true,
              },
            },
          },
        }),
        this.prisma.account.count({ where }),
      ]);

      return this.paginate(accounts, total, dto.page, dto.limit);
    } catch (error) {
      this.logger.error('listAccounts failed', error);
      throw error;
    }
  }

  /**
   * Fetches a single account with full details.
   */
  async getAccountById(accountId: string): Promise<unknown> {
    try {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
          rider: true,
          _count: {
            select: { rides: true, parcels: true, ratings: true },
          },
        },
      });

      if (!account) throw new NotFoundException('Account not found');
      return account;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getAccountById failed for ${accountId}`, error);
      throw error;
    }
  }

  /**
   * Suspends or reactivates an account.
   */
  async setAccountStatus(
    accountId: string,
    dto: SetAccountStatusDto,
  ): Promise<unknown> {
    try {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });
      if (!account) throw new NotFoundException('Account not found');

      const updated = await this.prisma.account.update({
        where: { id: accountId },
        data: { isActive: dto.isActive },
        select: { id: true, fullName: true, isActive: true },
      });

      this.logger.log(
        `Admin ${dto.isActive ? 'reactivated' : 'suspended'} account ${accountId}. Reason: ${dto.reason ?? 'none'}`,
      );

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`setAccountStatus failed for ${accountId}`, error);
      throw error;
    }
  }

  // ─── Riders ───────────────────────────────────────────────

  /**
   * Verifies or rejects a rider's account (e.g. after checking their documents).
   */
  async setRiderVerification(
    accountId: string,
    dto: SetRiderVerificationDto,
  ): Promise<unknown> {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { accountId },
      });
      if (!rider) throw new NotFoundException('Rider profile not found');

      const updated = await this.prisma.rider.update({
        where: { accountId },
        data: { isVerified: dto.isVerified },
        select: {
          id: true,
          accountId: true,
          isVerified: true,
          licenseNumber: true,
        },
      });

      this.logger.log(
        `Admin ${dto.isVerified ? 'verified' : 'rejected'} rider ${accountId}. Notes: ${dto.notes ?? 'none'}`,
      );

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`setRiderVerification failed for ${accountId}`, error);
      throw error;
    }
  }

  // ─── Rides ────────────────────────────────────────────────

  /**
   * Lists all rides with optional status filter. Paginated.
   */
  async listRides(dto: ListRidesDto): Promise<PaginatedResult<unknown>> {
    try {
      const skip = (dto.page - 1) * dto.limit;

      const where = {
        ...(dto.status && { status: dto.status }),
        ...(dto.search && {
          OR: [
            {
              pickupAddress: {
                contains: dto.search,
                mode: 'insensitive' as const,
              },
            },
            {
              dropoffAddress: {
                contains: dto.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }),
      };

      const [rides, total] = await Promise.all([
        this.prisma.ride.findMany({
          where,
          skip,
          take: dto.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { fullName: true, phone: true } },
            rider: {
              include: { account: { select: { fullName: true, phone: true } } },
            },
            payment: { select: { status: true, amount: true, method: true } },
          },
        }),
        this.prisma.ride.count({ where }),
      ]);

      return this.paginate(rides, total, dto.page, dto.limit);
    } catch (error) {
      this.logger.error('listRides failed', error);
      throw error;
    }
  }

  // ─── Parcels ──────────────────────────────────────────────

  /**
   * Lists all parcels with optional status filter. Paginated.
   */
  async listParcels(dto: ListParcelsDto): Promise<PaginatedResult<unknown>> {
    try {
      const skip = (dto.page - 1) * dto.limit;

      const where = {
        ...(dto.status && { status: dto.status }),
        ...(dto.search && {
          OR: [
            {
              pickupAddress: {
                contains: dto.search,
                mode: 'insensitive' as const,
              },
            },
            {
              dropoffAddress: {
                contains: dto.search,
                mode: 'insensitive' as const,
              },
            },
            {
              recipientName: {
                contains: dto.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }),
      };

      const [parcels, total] = await Promise.all([
        this.prisma.parcel.findMany({
          where,
          skip,
          take: dto.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { fullName: true, phone: true } },
            rider: {
              include: { account: { select: { fullName: true, phone: true } } },
            },
            payment: { select: { status: true, amount: true, method: true } },
          },
        }),
        this.prisma.parcel.count({ where }),
      ]);

      return this.paginate(parcels, total, dto.page, dto.limit);
    } catch (error) {
      this.logger.error('listParcels failed', error);
      throw error;
    }
  }

  // ─── Payments ─────────────────────────────────────────────

  /**
   * Lists all payments with optional status filter. Paginated.
   */
  async listPayments(dto: ListPaymentsDto): Promise<PaginatedResult<unknown>> {
    try {
      const skip = (dto.page - 1) * dto.limit;

      const where = {
        ...(dto.status && { status: dto.status }),
      };

      const [payments, total] = await Promise.all([
        this.prisma.payment.findMany({
          where,
          skip,
          take: dto.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            ride: {
              select: {
                id: true,
                status: true,
                user: { select: { fullName: true, phone: true } },
              },
            },
            parcel: {
              select: {
                id: true,
                status: true,
                user: { select: { fullName: true, phone: true } },
              },
            },
          },
        }),
        this.prisma.payment.count({ where }),
      ]);

      return this.paginate(payments, total, dto.page, dto.limit);
    } catch (error) {
      this.logger.error('listPayments failed', error);
      throw error;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  /** Wraps an array of results in a standard pagination envelope */
  private paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
