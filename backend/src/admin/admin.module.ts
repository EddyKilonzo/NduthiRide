import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [SupportModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
