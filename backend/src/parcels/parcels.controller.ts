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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role, ParcelStatus } from '@prisma/client';
import type { Account } from '@prisma/client';

import { ParcelsService } from './parcels.service';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { ParcelQueryDto } from './dto/parcel-query.dto';
import { EstimateParcelDto } from './dto/estimate-parcel.dto';
import { RateParcelDto } from './dto/rate-parcel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Parcels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parcels')
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Book a parcel delivery (user only)' })
  createParcel(@CurrentUser() user: Account, @Body() dto: CreateParcelDto) {
    return this.parcelsService.createParcel(user.id, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: 'List my parcel bookings (alias for /my)' })
  getParcels(@CurrentUser() user: Account, @Query() query: ParcelQueryDto) {
    return this.parcelsService.getUserParcels(user.id, query);
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: 'List my parcel bookings' })
  getMyParcels(@CurrentUser() user: Account, @Query() query: ParcelQueryDto) {
    return this.parcelsService.getUserParcels(user.id, query);
  }

  @Get('estimate')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Get delivery fee and distance estimate' })
  async getEstimate(@Query() dto: EstimateParcelDto) {
    return await this.parcelsService.calculateEstimate(dto);
  }


  @Post(':id/rate')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rate a completed parcel delivery' })
  rateParcel(
    @Param('id') id: string,
    @CurrentUser() user: Account,
    @Body() dto: RateParcelDto,
  ) {
    return this.parcelsService.rateParcel(id, user.id, dto);
  }

  @Get('active')
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  @ApiOperation({
    summary: 'Get my currently active parcel delivery (rider only)',
  })
  getActiveParcel(@CurrentUser() user: Account) {
    return this.parcelsService.getRiderActiveParcel(user.id);
  }

  @Get('rider/history')
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  @ApiOperation({ summary: 'List my assigned parcels (rider only)' })
  getRiderHistory(@CurrentUser() user: Account, @Query() query: ParcelQueryDto) {
    return this.parcelsService.getRiderParcels(user.id, query);
  }

  @Get('nearby')
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  @ApiOperation({ summary: 'List nearby pending parcel requests (rider only)' })
  getNearbyParcels(@Query() query: ParcelQueryDto) {
    return this.parcelsService.getNearbyPendingParcels(query);
  }

  @Patch(':id/accept')
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a pending parcel request (rider only)' })
  acceptParcel(@Param('id') id: string, @CurrentUser() user: Account) {
    return this.parcelsService.acceptParcel(id, user.id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance parcel delivery status (rider only)' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: Account,
    @Body('status') status: ParcelStatus,
  ) {
    return this.parcelsService.updateParcelStatus(id, user.id, status);
  }

  @Patch(':id/proof')
  @UseGuards(RolesGuard)
  @Roles(Role.RIDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload proof of delivery image URL (rider only)' })
  uploadProof(
    @Param('id') id: string,
    @CurrentUser() user: Account,
    @Body('imageUrl') imageUrl: string,
  ) {
    return this.parcelsService.uploadProof(id, user.id, imageUrl);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.RIDER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a parcel delivery booking' })
  cancelParcel(@Param('id') id: string, @CurrentUser() user: Account) {
    return this.parcelsService.cancelParcel(id, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a parcel by ID (owner or assigned rider)' })
  getParcel(@Param('id') id: string, @CurrentUser() user: Account) {
    return this.parcelsService.getParcelById(id, user.id);
  }
}
