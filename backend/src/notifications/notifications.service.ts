import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const serviceAccount = this.config.get<string>('firebase.serviceAccount');
    if (!serviceAccount) {
      this.logger.warn(
        'Firebase service account not found. Push notifications will be disabled.',
      );
      return;
    }

    try {
      const config = JSON.parse(serviceAccount);
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(config),
      });
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  async sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.firebaseApp) return;

    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { contentAvailable: true } } },
      });
      this.logger.log(
        `Push notification sent to token: ${token.slice(0, 10)}...`,
      );
    } catch (error) {
      this.logger.error('Error sending push notification', error);
    }
  }
}
