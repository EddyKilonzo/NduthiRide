import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { RidersModule } from '../riders/riders.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    RidersModule, // Provides RidersService for location updates
    AuthModule, // Provides JwtService for WS token validation
  ],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class TrackingModule {}
