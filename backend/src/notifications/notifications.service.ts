import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    try {
      const serviceAccountJson = this.config.get<string>('firebase.serviceAccount');
      if (!serviceAccountJson) {
        this.logger.warn('FIREBASE_SERVICE_ACCOUNT not configured — FCM push notifications disabled');
        return;
      }

      const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;

      // Guard against duplicate initialisation (e.g. hot-reload in dev)
      this.firebaseApp = admin.apps.length
        ? admin.apps[0]!
        : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

      this.logger.log('Firebase Admin SDK initialised');
    } catch (error) {
      this.logger.error('Firebase Admin SDK initialisation failed — FCM disabled', (error as Error).message);
    }
  }

  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    accountId?: string,
    type = 'SYSTEM',
  ): Promise<void> {
    if (accountId) {
      await this.createInAppNotification(accountId, title, body, type, data);
    }

    if (!this.firebaseApp) return;

    try {
      await admin.messaging(this.firebaseApp).send({
        token,
        notification: { title, body },
        data: data ?? {},
      });
      this.logger.debug(`FCM push sent — token: ${token.slice(0, 12)}...`);
    } catch (error) {
      // Log but don't throw — a failed push should never break the caller
      this.logger.error(
        `FCM push failed — token: ${token.slice(0, 12)}... — ${(error as Error).message}`,
      );
    }
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
