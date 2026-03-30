import {
  Controller,
  Get,
  Post,
  Param,
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
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Account } from '@prisma/client';

@ApiTags('Support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  createTicket(
    @CurrentUser() user: Account,
    @Body() dto: { subject: string; message: string; priority?: string },
  ) {
    return this.supportService.createTicket(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all my support tickets' })
  @ApiResponse({ status: 200, description: 'List of user tickets' })
  listMyTickets(@CurrentUser() user: Account) {
    return this.supportService.listMyTickets(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get support ticket details' })
  @ApiResponse({ status: 200, description: 'Ticket details' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  getTicket(@Param('id') id: string, @CurrentUser() user: Account) {
    return this.supportService.getTicketById(id, user.id);
  }
}
