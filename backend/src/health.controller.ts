import { Controller, Get, Head, HttpCode } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle({ default: true })
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true };
  }

  /** UptimeRobot and Render pings use HEAD — respond with 200 and no body. */
  @Head()
  @HttpCode(200)
  ping() {
    return;
  }
}
