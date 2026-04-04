import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SupportModule } from '../support/support.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [SupportModule, PaymentsModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
