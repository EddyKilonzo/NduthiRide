import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { LipanaWebhookService } from './lipana-webhook.service';
import { LipanaPayoutService } from './lipana-payout.service';
import { PaymentAuditService } from './payment-audit.service';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [TrackingModule],
  providers: [
    PaymentsService,
    LipanaWebhookService,
    LipanaPayoutService,
    PaymentAuditService,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, PaymentAuditService, LipanaPayoutService],
})
export class PaymentsModule {}
