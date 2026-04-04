import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
  Request as Req,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Account } from '@prisma/client';
import type { Request } from 'express';

import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Initiate M-Pesa STK push for a ride or parcel via Lipana',
    description:
      'Initiates an STK push payment. Implements idempotency - duplicate requests within 60s are rejected.',
  })
  @ApiResponse({
    status: 201,
    description: 'STK push sent — returns transactionId to poll',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or duplicate payment in progress',
  })
  initiatePayment(
    @CurrentUser() user: Account,
    @Body() dto: InitiatePaymentDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.initiatePayment(user.id, dto, req.ip, req.headers['user-agent'] as string);
  }

  @Post('ride/:rideId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate payment for a specific ride' })
  initiateRidePayment(
    @CurrentUser() user: Account,
    @Param('rideId') rideId: string,
    @Body() dto: { method: 'MPESA' | 'CASH'; mpesaPhone?: string },
  ) {
    return this.paymentsService.initiatePayment(user.id, {
      rideId,
      ...dto,
    });
  }

  @Post('parcel/:parcelId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate payment for a specific parcel' })
  initiateParcelPayment(
    @CurrentUser() user: Account,
    @Param('parcelId') parcelId: string,
    @Body() dto: { method: 'MPESA' | 'CASH'; mpesaPhone?: string },
  ) {
    return this.paymentsService.initiatePayment(user.id, {
      parcelId,
      ...dto,
    });
  }

  @Get('status/:checkoutRequestId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Poll payment status by checkoutRequestId' })
  @ApiResponse({ status: 200, description: 'Returns current payment status' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  getStatus(@Param('checkoutRequestId') checkoutRequestId: string) {
    return this.paymentsService.getPaymentStatus(checkoutRequestId);
  }

  /**
   * Resend STK push for an existing PROCESSING or FAILED payment.
   * Marks the old payment FAILED and creates a fresh one so the user
   * gets a new M-Pesa prompt — even if the old payment is still PROCESSING.
   */
  @Post(':paymentId/resend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resend STK push for a PROCESSING or FAILED payment',
    description: 'Marks the existing payment as FAILED and initiates a new STK push.',
  })
  @ApiResponse({ status: 201, description: 'New STK push sent' })
  @ApiResponse({ status: 400, description: 'Payment not resendable (e.g., already COMPLETED)' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  resendPayment(
    @CurrentUser() user: Account,
    @Param('paymentId') paymentId: string,
    @Req() req: Request,
  ) {
    return this.paymentsService.resendPayment(
      user.id,
      paymentId,
      req.ip,
      req.headers['user-agent'] as string,
    );
  }

  /**
   * Public endpoint — called by Lipana's servers, not the frontend.
   * Receives webhook notifications for payment status changes.
   *
   * Security:
   * - Verifies X-Lipana-Signature header using HMAC-SHA256
   * - Validates payload structure
   * - Returns 200 even on errors to prevent retry loops
   */
  @Post('lipana/webhook')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        event: {
          type: 'string',
          enum: ['payment.success', 'payment.failed', 'payment.pending'],
          example: 'payment.success',
        },
        data: {
          type: 'object',
          properties: {
            transactionId: { type: 'string', example: 'TXN1234567890' },
            amount: { type: 'number', example: 5000 },
            status: { type: 'string', example: 'success' },
            phone: { type: 'string', example: '+254712345678' },
            checkoutRequestID: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['transactionId', 'amount', 'status', 'phone'],
        },
      },
      required: ['event', 'data'],
    },
  })
  @ApiOperation({
    summary: 'Lipana payment webhook (Lipana → server)',
    description:
      'Receives real-time payment status updates from Lipana. Verifies webhook signature for security.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Webhook received successfully (always returns 200 to prevent retries)',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid webhook signature or payload (logged but returns 200)',
  })
  lipanaWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: Record<string, unknown>,
  ) {
    const signature = req.headers['x-lipana-signature'] as string | undefined;
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(body));

    return this.paymentsService.handleLipanaWebhook(rawBody, signature, body);
  }

  // ────────────────────────────────────────────────────────────
  // Admin Endpoints - Audit Logs
  // ────────────────────────────────────────────────────────────

  @Get('audit/payment/:paymentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit logs for a specific payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns array of audit logs' })
  async getAuditLogsForPayment(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getAuditLogsForPayment(paymentId);
  }

  @Get('audit/user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit logs for a specific user (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns array of audit logs' })
  async getAuditLogsForUser(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.paymentsService.getAuditLogsForUser(userId, limit);
  }

  @Get('audit/suspicious')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get suspicious activity report (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns suspicious activity reports' })
  async getSuspiciousActivity(@Query('windowHours') windowHours: number = 24) {
    return this.paymentsService.getSuspiciousActivity(windowHours);
  }

  // ────────────────────────────────────────────────────────────
  // Admin Endpoints - Reconciliation & Analytics
  // ────────────────────────────────────────────────────────────

  @Get('reconcile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reconcile payments with Lipana records (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns reconciliation results' })
  async reconcilePayments(@Query('date') date: string) {
    return this.paymentsService.reconcilePayments(date);
  }

  @Get('analytics/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment analytics dashboard (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns payment analytics' })
  async getAnalytics(@Query('period') period: string = '7d') {
    return this.paymentsService.getAnalytics(period);
  }

  // ────────────────────────────────────────────────────────────
  // Receipt Endpoint
  // ────────────────────────────────────────────────────────────

  @Get(':paymentId/receipt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download payment receipt as PDF' })
  @ApiResponse({ status: 200, description: 'Returns PDF receipt' })
  async downloadReceipt(
    @Param('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.paymentsService.generateReceiptPDF(paymentId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${paymentId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  }
}
