import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import {
  ListAccountsDto,
  ListRidesDto,
  ListParcelsDto,
  ListPaymentsDto,
} from './dto/admin-query.dto';
import {
  SetAccountStatusDto,
  SetRiderVerificationDto,
} from './dto/admin-action.dto';

/**
 * All admin endpoints require:
 *  1. A valid JWT access token (JwtAuthGuard)
 *  2. The ADMIN role (RolesGuard)
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Dashboard ──────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns counts and revenue totals',
  })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ─── Accounts ───────────────────────────────────────────

  @Get('accounts')
  @ApiOperation({ summary: 'List all accounts with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of accounts' })
  listAccounts(@Query() query: ListAccountsDto) {
    return this.adminService.listAccounts(query);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get a single account by ID' })
  @ApiResponse({ status: 200, description: 'Full account details' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  getAccount(@Param('id') id: string) {
    return this.adminService.getAccountById(id);
  }

  @Patch('accounts/:id/status')
  @ApiOperation({ summary: 'Suspend or reactivate an account' })
  @ApiResponse({ status: 200, description: 'Account status updated' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  setAccountStatus(@Param('id') id: string, @Body() dto: SetAccountStatusDto) {
    return this.adminService.setAccountStatus(id, dto);
  }

  // ─── Riders ─────────────────────────────────────────────

  @Patch('riders/:accountId/verification')
  @ApiOperation({ summary: 'Verify or reject a rider account' })
  @ApiResponse({
    status: 200,
    description: 'Rider verification status updated',
  })
  @ApiResponse({ status: 404, description: 'Rider not found' })
  setRiderVerification(
    @Param('accountId') accountId: string,
    @Body() dto: SetRiderVerificationDto,
  ) {
    return this.adminService.setRiderVerification(accountId, dto);
  }

  // ─── Rides ──────────────────────────────────────────────

  @Get('rides')
  @ApiOperation({ summary: 'List all rides with optional status filter' })
  @ApiResponse({ status: 200, description: 'Paginated list of rides' })
  listRides(@Query() query: ListRidesDto) {
    return this.adminService.listRides(query);
  }

  // ─── Parcels ────────────────────────────────────────────

  @Get('parcels')
  @ApiOperation({
    summary: 'List all parcel deliveries with optional status filter',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of parcels' })
  listParcels(@Query() query: ListParcelsDto) {
    return this.adminService.listParcels(query);
  }

  // ─── Payments ───────────────────────────────────────────

  @Get('payments')
  @ApiOperation({ summary: 'List all payments with optional status filter' })
  @ApiResponse({ status: 200, description: 'Paginated list of payments' })
  listPayments(@Query() query: ListPaymentsDto) {
    return this.adminService.listPayments(query);
  }
}
