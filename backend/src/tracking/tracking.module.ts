import { Module, forwardRef } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { RidersModule } from '../riders/riders.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => RidersModule), // Breaks RidersModule → PaymentsModule → TrackingModule cycle
    AuthModule, // Provides JwtService for WS token validation
  ],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class TrackingModule {}
