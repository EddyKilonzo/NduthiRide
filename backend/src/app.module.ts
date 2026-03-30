import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RidersModule } from './riders/riders.module';
import { AdminModule } from './admin/admin.module';
import { RidesModule } from './rides/rides.module';
import { ParcelsModule } from './parcels/parcels.module';
import { PaymentsModule } from './payments/payments.module';
import { MapModule } from './map/map.module';
import { TrackingModule } from './tracking/tracking.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SupportModule } from './support/support.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    // Load and validate environment variables from .env — available globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // Global Prisma client — no need to import in each module
    PrismaModule,

    // Rate limiting: 100 requests per 15 minutes globally
    ThrottlerModule.forRoot([
      {
        ttl: 900,
        limit: 100,
      },
    ]),

    // Auth — JWT strategies, guards, and token management
    AuthModule,

    // User management
    UsersModule,
    RidersModule,

    // Business domain modules
    RidesModule,
    ParcelsModule,
    PaymentsModule,

    // Map / geocoding / routing (Mapbox)
    MapModule,

    // Real-time features
    TrackingModule, // Live rider location WebSocket gateway
    ChatModule, // In-ride/delivery chat WebSocket + REST fallback
    NotificationsModule,

    // Admin dashboard
    AdminModule,

    // Media uploads (Cloudinary)
    MediaModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
