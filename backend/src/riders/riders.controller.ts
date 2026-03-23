import {
  Controller,
  Get,
  Patch,
  Body,
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
import { Role } from '@prisma/client';

import { RidersService } from './riders.service';
import {
  UpdateRiderAvailabilityDto,
  UpdateRiderLocationDto,
  UpdateRiderProfileDto,
} from './dto/update-rider.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Account } from '@prisma/client';

@ApiTags('Riders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RIDER)
@Controller('riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my rider profile' })
  @ApiResponse({ status: 200, description: 'Returns the full rider profile' })
  getMyProfile(@CurrentUser() user: Account) {
    return this.ridersService.getRiderProfile(user.id);
  }

  @Patch('me/profile')
  @ApiOperation({
    summary: 'Update editable rider profile fields (bike model, avatar)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the updated rider profile',
  })
  updateProfile(
    @CurrentUser() user: Account,
    @Body() dto: UpdateRiderProfileDto,
  ) {
    return this.ridersService.updateProfile(user.id, dto);
  }

  @Patch('me/availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle online/offline availability' })
  @ApiResponse({
    status: 200,
    description: 'Returns updated availability state',
  })
  updateAvailability(
    @CurrentUser() user: Account,
    @Body() dto: UpdateRiderAvailabilityDto,
  ) {
    return this.ridersService.updateAvailability(user.id, dto);
  }

  @Patch('me/location')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Update current GPS location (also called via WebSocket)',
  })
  @ApiResponse({ status: 204, description: 'Location updated' })
  updateLocation(
    @CurrentUser() user: Account,
    @Body() dto: UpdateRiderLocationDto,
  ) {
    return this.ridersService.updateLocation(user.id, dto);
  }
}
