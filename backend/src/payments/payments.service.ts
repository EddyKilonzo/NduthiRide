import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { Lipana } from '@lipana/sdk';
import { LipanaWebhookService } from './lipana-webhook.service';
import { PaymentAuditService } from './payment-audit.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import PDFDocument from 'pdfkit';

/** NduthiRide brand palette — aligned with frontend `styles.scss` */
const RECEIPT_BRAND = {
  primary: '#408A71',
  primaryDark: '#285A48',
  primaryLight: '#B0E4CC',
  ink: '#091413',
  muted: '#4D6B5F',
  paper: '#F8FCFA',
  line: '#C5E5D8',
} as const;

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private lipana: Lipana | null = null;

  // Idempotency cache: Map<userId:entityId, timestamp>
  private readonly recentRequests = new Map<string, number>();
  private readonly IDEMPOTENCY_WINDOW_MS = 60_000; // 60 seconds

  // Fraud detection: Track failed attempts per user
  private readonly failedAttempts = new Map<
    string,
    { count: number; lastAttempt: number }
  >();
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  // Circuit breaker for Lipana API
  private circuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED' as 'CLOSED' | 'OPEN' | 'HALF_OPEN',
    threshold: 5,
    timeout: 60_000, // 1 minute
  };

  // Payment amount limits (KES)
  private readonly MIN_PAYMENT_AMOUNT = 10;
  private readonly MAX_PAYMENT_AMOUNT = 150_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly webhookService: LipanaWebhookService,
    private readonly auditService: PaymentAuditService,
    private readonly trackingGateway: TrackingGateway,
  ) {}

  onModuleInit() {
    // Eagerly validate Lipana config so missing keys fail at startup, not on first payment
    this.getLipana();
  }

  /**
   * Lazily initialize the Lipana SDK.
   * This allows testing without the SDK being instantiated during DI.
   */
  private getLipana(): Lipana {
    try {
      if (!this.lipana) {
        const apiKey = this.config.getOrThrow<string>('lipana.secretKey');
        this.lipana = new Lipana({
          apiKey,
          environment: apiKey.startsWith('lip_sk_live_') ? 'production' : 'sandbox',
        });
      }
      return this.lipana;
    } catch (error) {
      this.logger.error('Failed to initialize Lipana SDK', error);
      throw new InternalServerErrorException(
        'Payment service initialization failed',
      );
    }
  }

  /**
   * Lipana (and SDK unwrapping) may return checkoutRequestID or checkoutRequestId.
   * Missing normalization caused 500 after STK had already been sent to the handset.
   */
  private normalizeStkInitResponse(raw: unknown): {
    transactionId: string;
    checkoutRequestId: string;
  } | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const r = raw as Record<string, unknown>;
    const checkoutRaw =
      r.checkoutRequestID ??
      r.checkoutRequestId ??
      r.checkout_request_id;
    const transactionRaw = r.transactionId ?? r.transaction_id;
    const checkoutRequestId =
      typeof checkoutRaw === 'string' ? checkoutRaw.trim() : '';
    const transactionId =
      typeof transactionRaw === 'string' ? transactionRaw.trim() : '';
    if (!checkoutRequestId || !transactionId) {
      return null;
    }
    return { transactionId, checkoutRequestId };
  }

  /**
   * Calls Lipana STK and stores checkout / transaction ids on the payment row.
   */
  private async performStkPushAndPersistIds(
    paymentId: string,
    amount: number,
    entityType: 'ride' | 'parcel',
    entityId: string,
    mpesaPhoneRaw: string,
    userId: string,
  ): Promise<{ transactionId: string; checkoutRequestId: string }> {
    const phone = this.normalizePhone(mpesaPhoneRaw);
    if (!this.isValidKenyanPhone(phone)) {
      throw new BadRequestException(
        'Invalid phone number. Use format: 07XX, +2547XX, or 2547XX',
      );
    }

    const stkResponse = await this.getLipana().transactions.initiateStkPush({
      phone,
      amount: Math.ceil(amount),
      accountReference: `NduthiRide-${entityType}-${entityId.slice(0, 8)}`,
      transactionDesc: `${entityType === 'ride' ? 'Ride' : 'Parcel'} payment`,
    });

    const normalized = this.normalizeStkInitResponse(stkResponse);
    if (!normalized) {
      this.logger.error(
        'Lipana STK response missing transactionId/checkoutRequestId',
        stkResponse,
      );
      this.recordCircuitFailure();
      throw new InternalServerErrorException(
        'Invalid response from payment provider',
      );
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        checkoutRequestId: normalized.checkoutRequestId,
        mpesaReceiptNumber: normalized.transactionId,
      },
    });

    this.recordCircuitSuccess();
    this.clearFailedAttempts(userId);

    this.logger.log(
      `STK push initiated: ${normalized.transactionId} for payment ${paymentId}`,
    );

    return {
      transactionId: normalized.transactionId,
      checkoutRequestId: normalized.checkoutRequestId,
    };
  }

  /**
   * Races the STK push against a 20-second timeout so the HTTP handler always
   * returns well within Render's 30-second request limit.
   *
   * - Resolves with STK ids when Lipana responds quickly (< 20 s).
   * - Resolves with null when the timeout fires first; the push continues in
   *   the background and a catch handler marks the payment FAILED on error.
   * - Rejects immediately on synchronous validation errors (bad phone, etc.)
   *   so callers can still surface those to the user.
   */
  private async launchStkPushWithTimeout(
    paymentId: string,
    amount: number,
    entityType: 'ride' | 'parcel',
    entityId: string,
    phone: string,
    userId: string,
  ): Promise<{ transactionId: string; checkoutRequestId: string } | null> {
    const STK_TIMEOUT_MS = 20_000;

    const stkPromise = this.performStkPushAndPersistIds(
      paymentId,
      amount,
      entityType,
      entityId,
      phone,
      userId,
    );

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), STK_TIMEOUT_MS),
    );

    const result = await Promise.race([stkPromise, timeoutPromise]);

    if (result === null) {
      // Timeout fired — STK push still running in the background
      this.logger.warn(
        `STK push for payment ${paymentId} exceeded ${STK_TIMEOUT_MS}ms; ` +
          'returning early — background task continues',
      );
      void stkPromise.catch(async (err) => {
        this.logger.error(
          `Background STK push failed for payment ${paymentId}`,
          err,
        );
        try {
          await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: PaymentStatus.FAILED },
          });
          this.trackingGateway.emitPaymentUpdate(paymentId, {
            status: 'FAILED',
          });
        } catch (dbErr) {
          this.logger.error(
            `Failed to mark payment ${paymentId} as FAILED after background STK error`,
            dbErr,
          );
        }
        this.recordCircuitFailure();
      });
    }

    return result;
  }

  // ─── Initiate payment ─────────────────────────────────────

  /**
   * Initiates an M-Pesa STK push via Lipana.
   * Creates a Payment record in PROCESSING state and returns the transaction details
   * which the frontend should poll to check for completion.
   *
   * Implements idempotency to prevent duplicate STK pushes within a 60-second window.
   */
  async initiatePayment(
    userId: string,
    dto: InitiatePaymentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // SECURITY: Check circuit breaker state
      this.checkCircuitBreaker();

      // SECURITY: Fraud detection - check for excessive failed attempts
      this.checkFraudDetection(userId);

      if (!dto.rideId && !dto.parcelId) {
        throw new BadRequestException('Provide either rideId or parcelId');
      }

      // Resolve the amount from the ride or parcel
      let amount: number;
      let entityType: 'ride' | 'parcel';
      let entityId: string;

      if (dto.rideId) {
        const ride = await this.prisma.ride.findUnique({
          where: { id: dto.rideId },
        });
        if (!ride) throw new NotFoundException('Ride not found');
        if (ride.userId !== userId)
          throw new BadRequestException('Not your ride');

        // Validate amount is positive and within limits
        if (ride.estimatedFare <= 0) {
          throw new BadRequestException('Invalid ride fare');
        }
        this.validatePaymentAmount(ride.estimatedFare);

        amount = ride.estimatedFare;
        entityType = 'ride';
        entityId = ride.id;
      } else {
        const parcel = await this.prisma.parcel.findUnique({
          where: { id: dto.parcelId! },
        });
        if (!parcel) throw new NotFoundException('Parcel not found');
        if (parcel.userId !== userId)
          throw new BadRequestException('Not your parcel');

        // Validate amount is positive and within limits
        if (parcel.deliveryFee <= 0) {
          throw new BadRequestException('Invalid parcel delivery fee');
        }
        this.validatePaymentAmount(parcel.deliveryFee);

        amount = parcel.deliveryFee;
        entityType = 'parcel';
        entityId = parcel.id;
      }

      // Idempotency check: prevent duplicate in-flight requests within window
      const idempotencyKey = `${userId}:${dto.rideId || dto.parcelId}`;

      // Check for existing pending payment for this entity
      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          ...(dto.rideId
            ? { rideId: dto.rideId }
            : { parcelId: dto.parcelId! }),
          status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
        },
      });

      if (existingPayment) {
        this.logger.log(
          `Returning existing pending payment: ${existingPayment.id}`,
        );
        return {
          paymentId: existingPayment.id,
          transactionId: existingPayment.mpesaReceiptNumber || undefined,
          checkoutRequestId: existingPayment.checkoutRequestId || undefined,
          message: 'Payment already in progress',
        };
      }

      // No in-flight payment — apply idempotency only to prevent simultaneous new requests
      if (this.isDuplicateRequest(idempotencyKey)) {
        this.logger.warn(
          `Duplicate payment request detected: ${idempotencyKey}`,
        );
        throw new BadRequestException(
          'A payment request is already being processed. Please wait.',
        );
      }
      this.recordRequest(idempotencyKey);

      // Create a PROCESSING payment record
      const payment = await this.prisma.payment.create({
        data: {
          rideId: dto.rideId,
          parcelId: dto.parcelId,
          amount,
          status: PaymentStatus.PROCESSING,
          method: dto.method,
          mpesaPhone: dto.mpesaPhone,
        },
      });

      // SECURITY: Create audit log
      await this.createAuditLog(userId, 'PAYMENT_INITIATED', payment.id, {
        amount,
        entityType,
        entityId,
        method: dto.method,
        phone: dto.mpesaPhone,
      }, ipAddress, userAgent);

      // For cash payments we don't call Lipana
      if (dto.method === 'CASH') {
        this.logger.log(`Cash payment recorded: ${payment.id}`);
        this.clearFailedAttempts(userId);
        return {
          paymentId: payment.id,
          method: 'CASH',
          message: 'Cash payment noted',
        };
      }

      if (!dto.mpesaPhone) {
        throw new BadRequestException(
          'mpesaPhone is required for M-Pesa payments',
        );
      }

      const stk = await this.launchStkPushWithTimeout(
        payment.id,
        amount,
        entityType,
        entityId,
        dto.mpesaPhone,
        userId,
      );

      return {
        paymentId: payment.id,
        transactionId: stk?.transactionId,
        checkoutRequestId: stk?.checkoutRequestId,
        message: 'Check your phone for the M-Pesa prompt',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        this.recordFailedAttempt(userId);
        throw error;
      }
      if (
        error instanceof InternalServerErrorException ||
        error instanceof ForbiddenException
      )
        throw error;
      this.logger.error('initiatePayment failed', error);
      throw new InternalServerErrorException('Payment service unavailable');
    }
  }

  // ─── Lipana webhook callback ──────────────────────────────

  /**
   * Receives and processes the Lipana webhook notification.
   * Verifies signature, validates payload, and marks payment as COMPLETED or FAILED.
   */
  async handleLipanaWebhook(
    rawBody: string | Buffer,
    signature: string | undefined,
    parsedBody: unknown,
  ): Promise<void> {
    try {
      // 1. Verify webhook signature (SECURITY CRITICAL).
      // Prefer raw request bytes (Nest `rawBody: true`); fall back to JSON.stringify
      // of the parsed body so verification matches @lipana/sdk Webhooks.verify().
      let signatureValid = false;
      try {
        signatureValid = this.webhookService.verifySignature(rawBody, signature);
      } catch {
        signatureValid = false;
      }
      if (
        !signatureValid &&
        parsedBody !== null &&
        typeof parsedBody === 'object'
      ) {
        try {
          signatureValid = this.webhookService.verifySignature(
            Buffer.from(JSON.stringify(parsedBody), 'utf8'),
            signature,
          );
        } catch {
          signatureValid = false;
        }
      }
      if (!signatureValid) {
        this.logger.warn('Webhook signature verification failed — request ignored');
        // Return 200 to prevent Lipana from retrying with the same bad request
        return;
      }

      // 2. Parse and validate payload structure (includes replay attack check)
      const payload = this.webhookService.parseWebhookPayload(parsedBody);
      const { event, data } = payload;
      const { transactionId, status, checkoutRequestID, timestamp } = data;

      // 3. Validate timestamp (prevent old webhooks)
      if (!this.webhookService.isTimestampValid(timestamp)) {
        this.logger.warn(
          `Webhook timestamp outside valid window: ${timestamp}`,
        );
        return;
      }

      this.logger.log(
        `Received verified Lipana webhook: ${event} for ${transactionId}`,
      );

      // 4. Find payment by Lipana / M-Pesa transaction id or checkout request id
      const payment = await this.prisma.payment.findFirst({
        where: {
          OR: [
            { mpesaReceiptNumber: transactionId },
            ...(checkoutRequestID != null && checkoutRequestID !== ''
              ? [{ checkoutRequestId: checkoutRequestID }]
              : []),
          ],
        },
      });

      if (!payment) {
        this.logger.warn(
          `Webhook received for unknown transaction: ${transactionId}`,
        );
        return;
      }

      if (
        Math.round(data.amount * 100) !== Math.round(Number(payment.amount) * 100)
      ) {
        this.logger.warn(
          `Webhook amount ${data.amount} differs from stored payment amount ${payment.amount} for payment ${payment.id} — proceeding after signature verification`,
        );
      }

      // 5. Prevent duplicate processing
      if (payment.status === PaymentStatus.COMPLETED) {
        this.logger.debug(`Payment ${payment.id} already completed, skipping`);
        return;
      }

      // 6. Update payment status based on webhook event
      if (event === 'payment.success' || status === 'success') {
        const updatedPayment = await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            completedAt: new Date(),
            mpesaReceiptNumber: transactionId,
            ...(checkoutRequestID
              ? { checkoutRequestId: checkoutRequestID }
              : {}),
          },
          include: {
            ride: {
              select: {
                id: true,
                userId: true,
                rider: { select: { accountId: true } },
              },
            },
            parcel: {
              select: {
                id: true,
                userId: true,
                rider: { select: { accountId: true } },
              },
            },
          },
        });

        this.logger.log(
          `Payment ${payment.id} completed — Transaction: ${transactionId}`,
        );

        // Emit WebSocket update to subscribed clients
        this.trackingGateway.emitPaymentUpdate(payment.id, {
          status: 'COMPLETED',
          amount: updatedPayment.amount,
          mpesaReceiptNumber: updatedPayment.mpesaReceiptNumber,
          completedAt: updatedPayment.completedAt?.toISOString(),
        });

        this.emitTripPaymentAccountNotifications(updatedPayment, 'COMPLETED');
        
        // SECURITY: Audit log for completed payment
        await this.createAuditLog(
          payment.rideId ? 'SYSTEM' : 'SYSTEM',
          'PAYMENT_COMPLETED_WEBHOOK',
          payment.id,
          { transactionId, amount: payment.amount },
        );
      } else if (event === 'payment.failed' || status === 'failed') {
        const updatedPayment = await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
          },
          include: {
            ride: {
              select: {
                id: true,
                userId: true,
                rider: { select: { accountId: true } },
              },
            },
            parcel: {
              select: {
                id: true,
                userId: true,
                rider: { select: { accountId: true } },
              },
            },
          },
        });

        this.logger.warn(
          `Payment ${payment.id} failed — Transaction: ${transactionId}`,
        );

        // Emit WebSocket update to subscribed clients
        this.trackingGateway.emitPaymentUpdate(payment.id, {
          status: 'FAILED',
        });

        this.emitTripPaymentAccountNotifications(updatedPayment, 'FAILED');
      } else if (event === 'payment.pending' || status === 'pending') {
        // Already in PROCESSING state, no update needed
        this.logger.debug(
          `Payment ${payment.id} still pending — Transaction: ${transactionId}`,
        );

        // Emit WebSocket update to subscribed clients
        this.trackingGateway.emitPaymentUpdate(payment.id, {
          status: 'PROCESSING',
        });
      } else {
        this.logger.warn(`Unknown webhook event: ${event}`);
      }
    } catch (error) {
      // Log but don't throw - webhook should always return 200
      this.logger.error('handleLipanaWebhook failed', error);
    }
  }

  // ─── Resend STK push ──────────────────────────────────────

  /**
   * Re-fires STK on the **same** Payment row. Required because `rideId` / `parcelId`
   * are @unique — a second `payment.create` would violate the constraint (500).
   */
  async resendPayment(
    userId: string,
    paymentId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          ride: { select: { userId: true } },
          parcel: { select: { userId: true } },
        },
      });

      if (!payment) throw new NotFoundException('Payment not found');

      const ownerId = payment.ride?.userId ?? payment.parcel?.userId;
      if (ownerId !== userId) throw new BadRequestException('Not your payment');

      if (
        payment.status !== PaymentStatus.PROCESSING &&
        payment.status !== PaymentStatus.FAILED
      ) {
        throw new BadRequestException(
          'Only PROCESSING or FAILED payments can be resent',
        );
      }

      if (payment.method !== PaymentMethod.MPESA) {
        throw new BadRequestException('Only M-Pesa payments can be resent');
      }

      if (!payment.mpesaPhone) {
        throw new BadRequestException('No M-Pesa phone recorded on this payment');
      }

      this.checkCircuitBreaker();
      this.checkFraudDetection(userId);

      const entityKey = payment.rideId ?? payment.parcelId ?? '';
      const idempotencyKey = `${userId}:${entityKey}`;
      this.recentRequests.delete(idempotencyKey);
      if (this.isDuplicateRequest(idempotencyKey)) {
        throw new BadRequestException(
          'A payment request is already being processed. Please wait.',
        );
      }
      this.recordRequest(idempotencyKey);

      await this.createAuditLog(
        userId,
        'PAYMENT_RESEND_REQUESTED',
        paymentId,
        { paymentId, entityKey },
        ipAddress,
        userAgent,
      );

      const entityType: 'ride' | 'parcel' = payment.rideId ? 'ride' : 'parcel';
      const entityId = payment.rideId ?? payment.parcelId!;
      this.validatePaymentAmount(payment.amount);

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PROCESSING,
          checkoutRequestId: null,
          mpesaReceiptNumber: null,
        },
      });

      this.trackingGateway.emitPaymentUpdate(paymentId, { status: 'PROCESSING' });

      const stk = await this.launchStkPushWithTimeout(
        paymentId,
        payment.amount,
        entityType,
        entityId,
        payment.mpesaPhone,
        userId,
      );

      return {
        paymentId,
        transactionId: stk?.transactionId,
        checkoutRequestId: stk?.checkoutRequestId,
        message: 'Check your phone for the M-Pesa prompt',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error('resendPayment failed', error);
      throw new InternalServerErrorException('Could not resend payment');
    }
  }

  // ─── Poll payment status ──────────────────────────────────

  /**
   * Returns the current status of a payment.
   * Frontend polls this every 3 seconds after initiating an STK push.
   */
  async getPaymentStatus(checkoutRequestId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { checkoutRequestId },
        select: {
          id: true,
          status: true,
          amount: true,
          mpesaReceiptNumber: true,
          completedAt: true,
        },
      });

      if (!payment) throw new NotFoundException('Payment not found');
      return payment;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getPaymentStatus failed: ${checkoutRequestId}`, error);
      throw error;
    }
  }

  /**
   * Returns the current status of a payment by its primary ID.
   * Used as a polling fallback when checkoutRequestId is not yet available
   * (e.g. the STK push timed out and is still running in the background).
   */
  async getPaymentStatusById(paymentId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          status: true,
          amount: true,
          mpesaReceiptNumber: true,
          completedAt: true,
          checkoutRequestId: true,
        },
      });

      if (!payment) throw new NotFoundException('Payment not found');
      return payment;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`getPaymentStatusById failed: ${paymentId}`, error);
      throw error;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  /** Push payment outcome to passenger + rider account rooms (real-time status / feedback). */
  private emitTripPaymentAccountNotifications(
    payment: {
      id: string;
      mpesaReceiptNumber: string | null;
      completedAt: Date | null;
      ride: {
        id: string;
        userId: string;
        rider: { accountId: string } | null;
      } | null;
      parcel: {
        id: string;
        userId: string;
        rider: { accountId: string } | null;
      } | null;
    },
    status: 'COMPLETED' | 'FAILED',
  ): void {
    const base = {
      paymentId: payment.id,
      status,
      mpesaReceiptNumber: payment.mpesaReceiptNumber,
      completedAt: payment.completedAt?.toISOString() ?? null,
    };
    if (payment.ride) {
      this.trackingGateway.emitTripPaymentUpdate(payment.ride.userId, {
        kind: 'ride',
        entityId: payment.ride.id,
        ...base,
      });
      const riderAccountId = payment.ride.rider?.accountId;
      if (riderAccountId) {
        this.trackingGateway.emitTripPaymentUpdate(riderAccountId, {
          kind: 'ride',
          entityId: payment.ride.id,
          ...base,
        });
      }
    }
    if (payment.parcel) {
      this.trackingGateway.emitTripPaymentUpdate(payment.parcel.userId, {
        kind: 'parcel',
        entityId: payment.parcel.id,
        ...base,
      });
      const riderAccountId = payment.parcel.rider?.accountId;
      if (riderAccountId) {
        this.trackingGateway.emitTripPaymentUpdate(riderAccountId, {
          kind: 'parcel',
          entityId: payment.parcel.id,
          ...base,
        });
      }
    }
  }

  /**
   * Normalizes a Kenyan phone number to the +254XXXXXXXXX format.
   */
  private normalizePhone(phone: string): string {
    try {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.startsWith('0')) {
        return `+254${cleaned.slice(1)}`;
      }
      if (cleaned.startsWith('254')) {
        return `+${cleaned}`;
      }
      if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
        return `+254${cleaned}`;
      }
      return phone.startsWith('+') ? phone : `+${phone}`;
    } catch (error) {
      this.logger.error('Phone normalization failed', error);
      throw new BadRequestException('Invalid phone number format');
    }
  }

  /**
   * Validates a Kenyan phone number format.
   */
  private isValidKenyanPhone(phone: string): boolean {
    try {
      const kenyanPhoneRegex = /^(\+254|254|0)(7|1)\d{8}$/;
      return kenyanPhoneRegex.test(phone.replace(/\D/g, ''));
    } catch (error) {
      this.logger.error('Phone validation failed', error);
      return false;
    }
  }

  /**
   * Checks if a request is a duplicate within the idempotency window.
   */
  private isDuplicateRequest(key: string): boolean {
    try {
      const lastRequest = this.recentRequests.get(key);
      if (!lastRequest) return false;

      const now = Date.now();
      return now - lastRequest < this.IDEMPOTENCY_WINDOW_MS;
    } catch (error) {
      this.logger.error('Idempotency check failed', error);
      return false;
    }
  }

  /**
   * Records a request timestamp for idempotency checking.
   */
  private recordRequest(key: string): void {
    try {
      this.recentRequests.set(key, Date.now());

      // Cleanup old entries
      const now = Date.now();
      for (const [k, timestamp] of this.recentRequests.entries()) {
        if (now - timestamp > this.IDEMPOTENCY_WINDOW_MS * 2) {
          this.recentRequests.delete(k);
        }
      }
    } catch (error) {
      this.logger.error('Failed to record request for idempotency', error);
    }
  }

  /**
   * Fraud detection: Check if user has exceeded failed payment attempts.
   */
  private checkFraudDetection(userId: string): void {
    try {
      const userAttempts = this.failedAttempts.get(userId);
      if (!userAttempts) return;

      const now = Date.now();
      if (now - userAttempts.lastAttempt > this.FAILED_ATTEMPT_WINDOW_MS) {
        // Reset if outside window
        this.failedAttempts.delete(userId);
        return;
      }

      if (userAttempts.count >= this.MAX_FAILED_ATTEMPTS) {
        this.logger.warn(
          `Fraud alert: User ${userId} exceeded max failed payment attempts`,
        );
        throw new ForbiddenException(
          'Too many failed payment attempts. Please try again later or contact support.',
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error('Fraud detection check failed', error);
    }
  }

  /**
   * Records a failed payment attempt for fraud detection.
   */
  private recordFailedAttempt(userId: string): void {
    try {
      const userAttempts = this.failedAttempts.get(userId);
      const now = Date.now();

      if (
        !userAttempts ||
        now - userAttempts.lastAttempt > this.FAILED_ATTEMPT_WINDOW_MS
      ) {
        this.failedAttempts.set(userId, { count: 1, lastAttempt: now });
      } else {
        userAttempts.count++;
        userAttempts.lastAttempt = now;
      }
    } catch (error) {
      this.logger.error('Failed to record failed payment attempt', error);
    }
  }

  /**
   * Clears failed attempts on successful payment.
   */
  private clearFailedAttempts(userId: string): void {
    try {
      this.failedAttempts.delete(userId);
    } catch (error) {
      this.logger.error('Failed to clear failed attempts', error);
    }
  }

  /**
   * Circuit breaker: Check if Lipana API calls should be blocked.
   */
  private checkCircuitBreaker(): void {
    try {
      if (this.circuitBreaker.state === 'OPEN') {
        const now = Date.now();
        if (
          now - this.circuitBreaker.lastFailureTime >
          this.circuitBreaker.timeout
        ) {
          // Try again after timeout
          this.circuitBreaker.state = 'HALF_OPEN';
          this.logger.log('Circuit breaker: Entering HALF_OPEN state');
        } else {
          this.logger.warn(
            'Circuit breaker: OPEN - Lipana API temporarily unavailable',
          );
          throw new InternalServerErrorException(
            'Payment service temporarily unavailable. Please try again in a minute.',
          );
        }
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.logger.error('Circuit breaker check failed', error);
    }
  }

  /**
   * Circuit breaker: Record successful API call.
   */
  private recordCircuitSuccess(): void {
    try {
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.state = 'CLOSED';
    } catch (error) {
      this.logger.error('Failed to record circuit success', error);
    }
  }

  /**
   * Circuit breaker: Record failed API call.
   */
  private recordCircuitFailure(): void {
    try {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailureTime = Date.now();

      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.state = 'OPEN';
        this.logger.error(
          `Circuit breaker: OPEN after ${this.circuitBreaker.failures} failures`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to record circuit failure', error);
    }
  }

  /**
   * Validates payment amount is within acceptable limits.
   */
  private validatePaymentAmount(amount: number): void {
    try {
      if (amount < this.MIN_PAYMENT_AMOUNT) {
        throw new BadRequestException(
          `Payment amount must be at least KES ${this.MIN_PAYMENT_AMOUNT}`,
        );
      }
      if (amount > this.MAX_PAYMENT_AMOUNT) {
        throw new BadRequestException(
          `Payment amount cannot exceed KES ${this.MAX_PAYMENT_AMOUNT}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Payment amount validation failed', error);
      throw new BadRequestException('Invalid payment amount');
    }
  }

  /**
   * Creates an audit log entry for payment operations.
   */
  private async createAuditLog(
    userId: string,
    action: string,
    paymentId: string,
    details: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.auditService.createLog({
        paymentId,
        userId,
        action,
        details,
        ipAddress,
        userAgent,
      });
      this.logger.log(
        `[AUDIT] ${action} by user ${userId}: ${JSON.stringify(details)}`,
      );
    } catch (error) {
      // Don't fail the operation if audit logging fails
      this.logger.error('Audit logging failed', error);
    }
  }

  // ────────────────────────────────────────────────────────────
  // Admin Endpoints - Audit Logs
  // ────────────────────────────────────────────────────────────

  /**
   * Get audit logs for a specific payment
   */
  async getAuditLogsForPayment(paymentId: string) {
    try {
      return await this.auditService.getLogsForPayment(paymentId);
    } catch (error) {
      this.logger.error(`getAuditLogsForPayment failed: ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getAuditLogsForUser(userId: string, limit: number = 50) {
    try {
      return await this.auditService.getLogsForUser(userId, limit);
    } catch (error) {
      this.logger.error(`getAuditLogsForUser failed: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get suspicious activity report
   */
  async getSuspiciousActivity(windowHours: number = 24) {
    try {
      return await this.auditService.getSuspiciousActivity(windowHours);
    } catch (error) {
      this.logger.error('getSuspiciousActivity failed', error);
      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Admin Endpoints - Reconciliation & Analytics
  // ────────────────────────────────────────────────────────────

  /**
   * Reconcile local payments with Lipana records for a specific date
   */
  async reconcilePayments(date: string) {
    try {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      // Get all local payments for the date
      const localPayments = await this.prisma.payment.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          amount: true,
          status: true,
          mpesaReceiptNumber: true,
        },
      });

      // Group by status for summary
      const byStatus = localPayments.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalAmount = localPayments.reduce((sum, p) => sum + p.amount, 0);

      return {
        date,
        totalPayments: localPayments.length,
        totalAmount,
        byStatus,
        payments: localPayments,
      };
    } catch (error) {
      this.logger.error('reconcilePayments failed', error);
      throw new InternalServerErrorException('Reconciliation failed');
    }
  }

  /**
   * Get payment analytics dashboard data
   */
  async getAnalytics(period: string) {
    try {
      // Parse period (e.g., '7d', '30d', '7w')
      const match = period.match(/^(\d+)(d|w|m)$/);
      if (!match) {
        throw new BadRequestException('Invalid period format. Use: 7d, 30d, 7w, 1m');
      }

      const value = parseInt(match[1], 10);
      const unit = match[2];
      const days = unit === 'd' ? value : unit === 'w' ? value * 7 : value * 30;

      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      // Get payments in period
      const payments = await this.prisma.payment.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        select: {
          amount: true,
          status: true,
          method: true,
          createdAt: true,
          completedAt: true,
        },
      });

      // Calculate metrics
      const completed = payments.filter(p => p.status === 'COMPLETED');
      const failed = payments.filter(p => p.status === 'FAILED');
      const totalRevenue = completed.reduce((sum, p) => sum + p.amount, 0);
      const successRate = payments.length > 0 
        ? (completed.length / payments.length) * 100 
        : 0;

      // Average payment time (for completed payments with completedAt)
      const paymentTimes = completed
        .filter(p => p.completedAt)
        .map(p => (p.completedAt!.getTime() - p.createdAt.getTime()) / 1000);
      const avgPaymentTime = paymentTimes.length > 0
        ? paymentTimes.reduce((a, b) => a + b, 0) / paymentTimes.length
        : 0;

      // Group by payment method
      const byMethod = payments.reduce((acc, p) => {
        if (!acc[p.method]) {
          acc[p.method] = { count: 0, amount: 0 };
        }
        acc[p.method].count++;
        if (p.status === 'COMPLETED') {
          acc[p.method].amount += p.amount;
        }
        return acc;
      }, {} as Record<string, { count: number; amount: number }>);

      return {
        period,
        days,
        totalTransactions: payments.length,
        totalRevenue,
        successRate: parseFloat(successRate.toFixed(2)),
        averagePaymentTime: Math.round(avgPaymentTime),
        completedPayments: completed.length,
        failedPayments: failed.length,
        byMethod,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('getAnalytics failed', error);
      throw new InternalServerErrorException('Analytics generation failed');
    }
  }

  // ────────────────────────────────────────────────────────────
  // Receipt PDF Generation
  // ────────────────────────────────────────────────────────────

  /**
   * Generate a branded PDF receipt (M-Pesa transaction details + trip/parcel summary).
   * Only the account that owns the ride/parcel may download.
   */
  async generateReceiptPDF(
    paymentId: string,
    requesterAccountId: string,
    requesterRole: Role,
  ): Promise<Buffer> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          ride: {
            include: {
              user: { select: { fullName: true, phone: true, email: true } },
            },
          },
          parcel: {
            include: {
              user: { select: { fullName: true, phone: true, email: true } },
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      const ownerId = payment.ride?.userId ?? payment.parcel?.userId;
      const isAdmin = requesterRole === Role.ADMIN;
      if (
        !isAdmin &&
        (!ownerId || ownerId !== requesterAccountId)
      ) {
        throw new ForbiddenException(
          'You can only download receipts for your own payments',
        );
      }

      const user = payment.ride?.user || payment.parcel?.user;
      const entityType = payment.ride ? 'Ride' : 'Parcel';
      const entityId = payment.rideId || payment.parcelId;

      const fmtKe = (d: Date) =>
        d.toLocaleString('en-KE', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

      return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        const chunks: Buffer[] = [];
        const pageW = 595.28;
        const margin = 48;
        const contentW = pageW - margin * 2;
        let y = 0;

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const row = (
          label: string,
          value: string,
          opts?: { mono?: boolean; emphasize?: boolean },
        ) => {
          const labelW = 150;
          doc
            .fontSize(9)
            .fillColor(RECEIPT_BRAND.muted)
            .font('Helvetica')
            .text(label, margin, y, { width: labelW, continued: false });
          doc
            .font(opts?.emphasize ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(opts?.emphasize ? 10 : 9)
            .fillColor(RECEIPT_BRAND.ink)
            .text(value, margin + labelW, y, {
              width: contentW - labelW,
              ...(opts?.mono ? { lineGap: 1 } : {}),
            });
          y = doc.y + 6;
        };

        // ── Brand header band ─────────────────────────────────
        const headerH = 108;
        doc.save();
        doc.rect(0, 0, pageW, headerH).fill(RECEIPT_BRAND.primaryDark);
        doc
          .fontSize(26)
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .text('NduthiRide', margin, 32, { width: contentW });
        doc
          .fontSize(11)
          .fillColor(RECEIPT_BRAND.primaryLight)
          .font('Helvetica')
          .text('Payment receipt', margin, 66, { width: contentW });
        doc.restore();
        y = headerH + 28;

        // ── Amount card ──────────────────────────────────────
        const cardH = 78;
        doc.save();
        doc
          .roundedRect(margin, y, contentW, cardH, 10)
          .fill(RECEIPT_BRAND.primaryLight);
        doc
          .fontSize(9)
          .fillColor(RECEIPT_BRAND.primaryDark)
          .font('Helvetica-Bold')
          .text('Amount paid', margin + 16, y + 14);
        doc
          .fontSize(22)
          .fillColor(RECEIPT_BRAND.primary)
          .font('Helvetica-Bold')
          .text(
            `KES ${Math.round(payment.amount).toLocaleString('en-KE')}`,
            margin + 16,
            y + 34,
          );
        doc
          .fontSize(8)
          .fillColor(RECEIPT_BRAND.muted)
          .font('Helvetica')
          .text(`Status: ${payment.status}`, margin + 16, y + 58);
        doc.restore();
        y += cardH + 24;

        // ── M-Pesa transaction (when applicable) ─────────────
        if (payment.method === PaymentMethod.MPESA) {
          doc
            .fontSize(11)
            .fillColor(RECEIPT_BRAND.primaryDark)
            .font('Helvetica-Bold')
            .text('M-Pesa transaction', margin, y);
          y = doc.y + 10;

          doc
            .moveTo(margin, y)
            .lineTo(margin + contentW, y)
            .strokeColor(RECEIPT_BRAND.primary)
            .lineWidth(2)
            .stroke();
          y += 14;

          row(
            'Confirmation / receipt no.',
            payment.mpesaReceiptNumber ?? '—',
            { mono: true, emphasize: true },
          );
          row(
            'STK checkout request ID',
            payment.checkoutRequestId ?? '—',
            { mono: true },
          );
          row('Paid from (phone)', payment.mpesaPhone ?? '—');
          row(
            'Settlement time',
            payment.completedAt ? fmtKe(payment.completedAt) : '—',
          );
          row('Provider', 'M-Pesa (via Lipana)');
          y += 8;
        } else {
          doc
            .fontSize(11)
            .fillColor(RECEIPT_BRAND.primaryDark)
            .font('Helvetica-Bold')
            .text('Payment method', margin, y);
          y = doc.y + 8;
          doc
            .fontSize(9)
            .fillColor(RECEIPT_BRAND.ink)
            .font('Helvetica')
            .text(
              'Paid in cash to the rider at the end of the trip. No M-Pesa transaction reference applies.',
              margin,
              y,
              { width: contentW },
            );
          y = doc.y + 16;
        }

        // ── Record & customer ─────────────────────────────────
        doc
          .fontSize(11)
          .fillColor(RECEIPT_BRAND.primaryDark)
          .font('Helvetica-Bold')
          .text('Receipt record', margin, y);
        y = doc.y + 10;

        row('NduthiRide payment ID', payment.id, { mono: true });
        row('Created', fmtKe(payment.createdAt));
        if (payment.completedAt) {
          row('Completed', fmtKe(payment.completedAt));
        }

        if (user) {
          y += 6;
          doc
            .fontSize(11)
            .fillColor(RECEIPT_BRAND.primaryDark)
            .font('Helvetica-Bold')
            .text('Customer', margin, y);
          y = doc.y + 10;
          row('Name', user.fullName);
          row('Phone', user.phone);
          if (user.email) {
            row('Email', user.email);
          }
        }

        // ── Trip / parcel ─────────────────────────────────────
        y += 8;
        doc
          .fontSize(11)
          .fillColor(RECEIPT_BRAND.primaryDark)
          .font('Helvetica-Bold')
          .text(`${entityType} summary`, margin, y);
        y = doc.y + 10;

        row(`${entityType} ID`, entityId ?? '—');
        if (payment.ride) {
          row('Pickup', payment.ride.pickupAddress);
          row('Drop-off', payment.ride.dropoffAddress);
        } else if (payment.parcel) {
          row('Pickup', payment.parcel.pickupAddress);
          row('Drop-off', payment.parcel.dropoffAddress);
        }

        // ── Footer bar (bottom of page — keep content concise so it stays above) ──
        const footerH = 56;
        const footY = doc.page.height - footerH;
        doc.rect(0, footY, pageW, footerH).fill(RECEIPT_BRAND.ink);
        doc
          .fontSize(8)
          .fillColor(RECEIPT_BRAND.primaryLight)
          .font('Helvetica')
          .text('Thank you for riding with NduthiRide.', margin, footY + 14, {
            width: contentW,
            align: 'center',
          });
        doc
          .fillColor('#8BA89E')
          .fontSize(7)
          .font('Helvetica')
          .text('Questions? support@nduthiride.co.ke', margin, footY + 30, {
            width: contentW,
            align: 'center',
          });

        doc.end();
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error('generateReceiptPDF failed', error);
      throw new InternalServerErrorException('Failed to generate receipt');
    }
  }
}
