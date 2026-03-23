import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role, RideStatus } from '@prisma/client';
import type { Account } from '@prisma/client';

import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { RideQueryDto } from './dto/ride-query.dto';
import { EstimateRideDto } from './dto/estimate-ride.dto';
import { RateRideDto } from './dto/rate-ride.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Rides')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  // ─── User endpoints ─────────────────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Book a new ride (user only)' })
  @ApiResponse({ status: 201, description: 'Ride created with fare estimate' })
  createRide(@CurrentUser() user: Account, @Body() dto: CreateRideDto) {
    return this.ridesService.createRide(user.id, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: 'List my rides (alias for /my)' })
  getRides(@CurrentUser() user: Account, @Query() query: RideQueryDto) {
    return this.ridesService.getUserRides(user.id, query);
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: 'List my rides with optional status filter' })
  getMyRides(@CurrentUser() user: Account, @Query() query: RideQueryDto) {
    return this.ridesService.getUserRides(user.id, query);
  }

  @Get('estimate')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Get fare and time estimate' })
  getEstimate(@Query() dto: EstimateRideDto) {
    return this.ridesService.calculateEstimate(dto);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending or accepted ride' })
  @ApiResponse({
    status: 400,
    description: 'Ride is too far in progress to cancel',
  })
  cancelRide(@Param('id') id: string, @CurrentUser() user: Account) {
    return this.ridesService.cancelRide(id, user.id);
  }

  @Post(':id/rate')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rate a completed ride' })
  rateRide(
    @Param('id') id: string,
    @CurrentUser() user: Account,
    @Body() dto: RateRideDto,
  ) {
    return this.ridesService.rateRide(id, user.id, dto);
  }

  // ─── Rider endpoints ────────────────────────────────────

  @Get('active')
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  @ApiOperation({ summary: 'Get my currently active ride (rider only)' })
  getActiveRide(@CurrentUser() user: Account) {
    return this.ridesService.getRiderActiveRide(user.id);
  }

  @Patch(':id/accept')
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a pending ride request (rider only)' })
  @ApiResponse({ status: 400, description: 'Ride already taken' })
  acceptRide(@Param('id') id: string, @CurrentUser() user: Account) {
    return this.ridesService.acceptRide(id, user.id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance ride status (rider only)' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: Account,
    @Body('status') status: RideStatus,
  ) {
    return this.ridesService.updateRideStatus(id, user.id, status);
  }

  // ─── Shared ─────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single ride by ID (user or assigned rider)' })
  @ApiResponse({ status: 403, description: 'Access denied — not your ride' })
  getRide(@Param('id') id: string, @CurrentUser() user: Account) {
    return this.ridesService.getRideById(id, user.id);
  }
}
