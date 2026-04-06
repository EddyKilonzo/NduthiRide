import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

/**
 * Service for verifying Lipana webhook signatures.
 * Ensures webhook requests are authentic and haven't been tampered with.
 */
@Injectable()
export class LipanaWebhookService {
  private readonly logger = new Logger(LipanaWebhookService.name);
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    this.webhookSecret = this.config.getOrThrow<string>('lipana.webhookSecret');
  }

  /**
   * Verifies the authenticity of a Lipana webhook request.
   *
   * @param payload - The raw request body (as string or Buffer)
   * @param signature - The X-Lipana-Signature header value
   * @returns true if the signature is valid, false otherwise
   *
   * @throws BadRequestException if signature header is missing
   */
  /**
   * Strips optional `sha256=` prefix and lowercases hex (matches @lipana/sdk behavior).
   */
  private normalizeSignatureHeader(signature: string): string {
    let s = signature.trim();
    if (s.toLowerCase().startsWith('sha256=')) {
      s = s.slice('sha256='.length).trim();
    }
    return s.toLowerCase();
  }

  verifySignature(payload: string | Buffer, signature?: string): boolean {
    if (!signature?.trim()) {
      this.logger.warn('Webhook request missing X-Lipana-Signature header');
      throw new BadRequestException('Missing webhook signature');
    }

    try {
      // Convert payload to Buffer if it's a string
      const body = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;

      // Compute expected signature using HMAC-SHA256 (same as @lipana/sdk Webhooks.verify)
      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex')
        .toLowerCase();

      const normalizedSig = this.normalizeSignatureHeader(signature);

      // Use constant-time comparison to prevent timing attacks
      const signatureBuffer = Buffer.from(normalizedSig, 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

      if (signatureBuffer.length !== expectedBuffer.length) {
        this.logger.warn('Webhook signature length mismatch');
        return false;
      }

      const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        this.logger.warn('Invalid webhook signature detected');
      }

      return isValid;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Webhook signature verification failed', error);
      return false;
    }
  }

  /**
   * Parses and validates a Lipana webhook payload.
   *
   * Note: Do not mark webhooks as "processed" here. If payment lookup fails (e.g. ID
   * mismatch), Lipana will retry — recording replays during parse would block retries.
   * Idempotency is enforced in PaymentsService via payment.status === COMPLETED.
   */
  parseWebhookPayload(body: unknown): {
    event: string;
    data: {
      transactionId: string;
      amount: number;
      status: string;
      phone: string;
      checkoutRequestID?: string;
      timestamp?: string;
    };
  } {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }

    const payload = body as Record<string, unknown>;

    // Validate required fields
    if (typeof payload.event !== 'string') {
      throw new BadRequestException('Missing or invalid event field');
    }

    if (!payload.data || typeof payload.data !== 'object') {
      throw new BadRequestException('Missing or invalid data field');
    }

    const data = payload.data as Record<string, unknown>;

    const nestedTxn =
      data.transaction && typeof data.transaction === 'object'
        ? (data.transaction as Record<string, unknown>)
        : null;
    const transactionIdRaw =
      data.transactionId ??
      data.id ??
      nestedTxn?.id ??
      nestedTxn?.transactionId;
    if (typeof transactionIdRaw !== 'string' || !transactionIdRaw.trim()) {
      throw new BadRequestException('Missing transactionId');
    }

    let amount: number;
    if (typeof data.amount === 'number' && Number.isFinite(data.amount)) {
      amount = data.amount;
    } else if (typeof data.amount === 'string') {
      const n = Number(data.amount.trim());
      if (!Number.isFinite(n)) {
        throw new BadRequestException('Invalid amount');
      }
      amount = n;
    } else {
      throw new BadRequestException('Invalid amount');
    }
    if (amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    if (typeof data.status !== 'string') {
      throw new BadRequestException('Missing status');
    }

    const phone =
      typeof data.phone === 'string'
        ? data.phone
        : typeof data.phoneNumber === 'string'
          ? data.phoneNumber
          : '';

    const checkoutRaw =
      data.checkoutRequestID ??
      data.checkoutRequestId ??
      data.checkout_request_id;
    const checkoutRequestID =
      typeof checkoutRaw === 'string' && checkoutRaw.trim()
        ? checkoutRaw.trim()
        : undefined;

    return {
      event: payload.event,
      data: {
        transactionId: transactionIdRaw.trim(),
        amount,
        status: data.status,
        phone,
        checkoutRequestID,
        timestamp:
          typeof data.timestamp === 'string' ? data.timestamp : undefined,
      },
    };
  }

  /**
   * Generates a unique nonce for additional replay protection.
   * Can be used in conjunction with timestamp validation.
   */
  generateNonce(): string {
    try {
      return randomBytes(32).toString('hex');
    } catch (error) {
      this.logger.error('Failed to generate nonce', error);
      throw new InternalServerErrorException(
        'Failed to generate security nonce',
      );
    }
  }

  /**
   * Validates webhook timestamp is within a reasonable window (24 hours).
   * Lipana retries and clock skew made the old 5-minute window too aggressive.
   */
  isTimestampValid(timestamp?: string): boolean {
    try {
      if (!timestamp) return true;

      const webhookTime = new Date(timestamp).getTime();
      if (Number.isNaN(webhookTime)) {
        this.logger.warn(`Webhook timestamp not parseable: ${timestamp}`);
        return true;
      }
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      return Math.abs(now - webhookTime) <= maxAge;
    } catch (error) {
      this.logger.error('Timestamp validation failed', error);
      return true;
    }
  }
}
