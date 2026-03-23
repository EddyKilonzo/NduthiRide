import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { LipanaWebhookService } from './lipana-webhook.service';
import { PaymentAuditService } from './payment-audit.service';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [TrackingModule],
  providers: [PaymentsService, LipanaWebhookService, PaymentAuditService],
  controllers: [PaymentsController],
  exports: [PaymentsService, PaymentAuditService],
})
export class PaymentsModule {}
