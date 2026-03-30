import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: admin.app.App;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    // ... (onModuleInit unchanged)
  }

  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    accountId?: string,
    type = 'SYSTEM',
  ) {
    if (accountId) {
      await this.createInAppNotification(accountId, title, body, type, data);
    }

    if (!this.firebaseApp) return;
    // ... (rest of push notification logic unchanged)
  }

  async createInAppNotification(
    accountId: string,
    title: string,
    body: string,
    type: string,
    data?: any,
  ) {
    return this.prisma.notification.create({
      data: {
        accountId,
        title,
        body,
        type,
        data,
      },
    });
  }

  async listNotifications(accountId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { accountId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { accountId } }),
    ]);

    return {
      data: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(accountId: string) {
    return this.prisma.notification.updateMany({
      where: { accountId, isRead: false },
      data: { isRead: true },
    });
  }
}
