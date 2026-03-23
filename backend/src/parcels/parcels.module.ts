import { Module, forwardRef } from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { ParcelsController } from './parcels.controller';
import { MailModule } from '../mail/mail.module';
import { TrackingModule } from '../tracking/tracking.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [MailModule, TrackingModule, forwardRef(() => ChatModule)],
  providers: [ParcelsService],
  controllers: [ParcelsController],
  exports: [ParcelsService],
})
export class ParcelsModule {}
