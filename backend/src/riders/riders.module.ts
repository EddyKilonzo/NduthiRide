import { Module } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';

@Module({
  providers: [RidersService],
  controllers: [RidersController],
  exports: [RidersService],
})
export class RidersModule {}
