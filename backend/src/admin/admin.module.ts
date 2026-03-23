import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
