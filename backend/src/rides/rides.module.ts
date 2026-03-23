import { Module, forwardRef } from '@nestjs/common';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { MailModule } from '../mail/mail.module';
import { TrackingModule } from '../tracking/tracking.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [MailModule, TrackingModule, forwardRef(() => ChatModule)],
  providers: [RidesService],
  controllers: [RidesController],
  exports: [RidesService],
})
export class RidesModule {}
