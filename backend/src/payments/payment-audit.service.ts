import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogDto {
  paymentId: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Service for creating and querying payment audit logs.
 * Used for compliance, fraud investigation, and debugging.
 */
@Injectable()
export class PaymentAuditService {
  private readonly logger = new Logger(PaymentAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates an audit log entry for a payment operation.
   */
  async createLog(dto: AuditLogDto): Promise<void> {
    try {
      await this.prisma.paymentAudit.create({
        data: {
          paymentId: dto.paymentId,
          userId: dto.userId,
          action: dto.action,
          details: dto.details as any, // Prisma Json type
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        },
      });
      this.logger.debug(`Audit log created: ${dto.action} for payment ${dto.paymentId}`);
    } catch (error) {
      // Don't fail the operation if audit logging fails
      this.logger.error('Failed to create audit log', error);
    }
  }

  /**
   * Retrieves audit logs for a specific payment.
   */
  async getLogsForPayment(paymentId: string): Promise<Array<{
    id: string;
    action: string;
    details: unknown;
    createdAt: Date;
  }>> {
    try {
      const logs = await this.prisma.paymentAudit.findMany({
        where: { paymentId },
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      return logs;
    } catch (error) {
      this.logger.error(`Failed to retrieve audit logs for payment ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Retrieves audit logs for a specific user.
   */
  async getLogsForUser(userId: string, limit = 50): Promise<Array<{
    id: string;
    paymentId: string;
    action: string;
    details: unknown;
    createdAt: Date;
  }>> {
    try {
      const logs = await this.prisma.paymentAudit.findMany({
        where: { userId },
        select: {
          id: true,
          paymentId: true,
          action: true,
          details: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return logs;
    } catch (error) {
      this.logger.error(`Failed to retrieve audit logs for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Retrieves suspicious activity patterns (multiple failed attempts).
   */
  async getSuspiciousActivity(windowHours = 24): Promise<Array<{
    userId: string;
    failedCount: number;
    lastAttempt: Date;
  }>> {
    try {
      const cutoff = new Date(Date.now() - (windowHours * 60 * 60 * 1000));
      
      // Get all failed attempts in the window
      const failedLogs = await this.prisma.paymentAudit.findMany({
        where: {
          action: { in: ['PAYMENT_FAILED', 'PAYMENT_INITIATION_FAILED'] },
          createdAt: { gte: cutoff },
        },
        select: {
          userId: true,
          action: true,
          createdAt: true,
        },
      });

      // Group by userId and count
      const userFailures = new Map<string, { count: number; lastAttempt: Date }>();
      for (const log of failedLogs) {
        const existing = userFailures.get(log.userId);
        if (!existing) {
          userFailures.set(log.userId, { count: 1, lastAttempt: log.createdAt });
        } else {
          existing.count++;
          if (log.createdAt > existing.lastAttempt) {
            existing.lastAttempt = log.createdAt;
          }
        }
      }

      // Filter users with 5+ failures
      const suspicious: Array<{ userId: string; failedCount: number; lastAttempt: Date }> = [];
      for (const [userId, data] of userFailures.entries()) {
        if (data.count >= 5) {
          suspicious.push({
            userId,
            failedCount: data.count,
            lastAttempt: data.lastAttempt,
          });
        }
      }

      return suspicious;
    } catch (error) {
      this.logger.error('Failed to retrieve suspicious activity', error);
      throw error;
    }
  }
}
