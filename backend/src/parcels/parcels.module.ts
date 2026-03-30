import { Module, forwardRef } from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { ParcelsController } from './parcels.controller';
import { MailModule } from '../mail/mail.module';
import { TrackingModule } from '../tracking/tracking.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MapModule } from '../map/map.module';

@Module({
  imports: [
    MailModule,
    TrackingModule,
    forwardRef(() => ChatModule),
    NotificationsModule,
    MapModule,
  ],
  providers: [ParcelsService],
  controllers: [ParcelsController],
  exports: [ParcelsService],
})
export class ParcelsModule {}
