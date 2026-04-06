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

    // Log the raw payload shape (redacted) to help diagnose field-name mismatches.
    this.logger.debug(
      `Lipana webhook raw keys: ${JSON.stringify(Object.keys(payload))} / data keys: ${
        payload.data && typeof payload.data === 'object'
          ? JSON.stringify(Object.keys(payload.data as object))
          : 'n/a'
      }`,
    );

    if (typeof payload.event !== 'string') {
      throw new BadRequestException('Missing or invalid event field');
    }

    // Lipana may send the payload flat (no wrapper `data` key) or nested under `data`.
    // Accept both shapes.
    const rawData =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : payload;

    const pickStr = (...vals: unknown[]): string => {
      for (const v of vals) {
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'number' && Number.isFinite(v)) return String(v);
      }
      return '';
    };

    // Nested transaction object (some SDK shapes)
    const nestedTxn =
      rawData.transaction && typeof rawData.transaction === 'object'
        ? (rawData.transaction as Record<string, unknown>)
        : null;

    // ── transactionId ────────────────────────────────────────
    // Accept every known field name Lipana / Safaricom use.
    const transactionId = pickStr(
      rawData.transactionId,
      rawData.transaction_id,
      rawData.TransactionID,
      rawData.mpesaReceiptNumber,
      rawData.MpesaReceiptNumber,
      rawData.receiptNumber,
      rawData.receipt,
      rawData.id,
      nestedTxn?.transactionId,
      nestedTxn?.id,
      rawData.checkoutRequestID,
      rawData.checkoutRequestId,
      rawData.checkout_request_id,
      rawData.CheckoutRequestID,
      rawData.MerchantRequestID,
      rawData.merchantRequestId,
    );

    if (!transactionId) {
      // Log the full payload (safe — no PII beyond phone) so we can see what Lipana sent.
      this.logger.error(
        `Lipana webhook: cannot extract transactionId. Full payload: ${JSON.stringify(body)}`,
      );
      throw new BadRequestException('Missing transactionId');
    }

    // ── amount ───────────────────────────────────────────────
    let amount = 0;
    const rawAmount = rawData.amount ?? rawData.Amount ?? rawData.TransAmount;
    if (typeof rawAmount === 'number' && Number.isFinite(rawAmount)) {
      amount = rawAmount;
    } else if (typeof rawAmount === 'string') {
      const n = Number(rawAmount.trim());
      if (Number.isFinite(n)) amount = n;
    }
    // Treat 0 / missing amount as non-fatal — we still want to update payment status.
    if (amount < 0) {
      throw new BadRequestException('Invalid amount');
    }

    // ── status ───────────────────────────────────────────────
    // Derive status from event name if the field is absent.
    const rawStatus =
      rawData.status ??
      rawData.Status ??
      rawData.ResultCode ??
      rawData.resultCode;
    let status: string;
    if (typeof rawStatus === 'string' && rawStatus.trim()) {
      status = rawStatus.trim();
    } else if (typeof rawStatus === 'number') {
      // Safaricom ResultCode: 0 = success, anything else = failure
      status = rawStatus === 0 ? 'success' : 'failed';
    } else {
      // Derive from event name as last resort
      const ev = (payload.event as string).toLowerCase();
      if (ev.includes('success') || ev.includes('completed')) {
        status = 'success';
      } else if (ev.includes('fail') || ev.includes('cancel')) {
        status = 'failed';
      } else {
        status = 'pending';
      }
    }

    // ── phone ────────────────────────────────────────────────
    const phone = pickStr(
      rawData.phone,
      rawData.phoneNumber,
      rawData.Phone,
      rawData.PhoneNumber,
      rawData.msisdn,
    );

    // ── checkoutRequestID ────────────────────────────────────
    const checkoutRaw = pickStr(
      rawData.checkoutRequestID,
      rawData.checkoutRequestId,
      rawData.checkout_request_id,
      rawData.CheckoutRequestID,
      rawData.MerchantRequestID,
      rawData.merchantRequestId,
    );
    const checkoutRequestID = checkoutRaw || undefined;

    // ── timestamp ────────────────────────────────────────────
    const timestamp =
      typeof rawData.timestamp === 'string'
        ? rawData.timestamp
        : typeof rawData.TransTime === 'string'
          ? rawData.TransTime
          : undefined;

    return {
      event: payload.event as string,
      data: {
        transactionId,
        amount,
        status,
        phone,
        checkoutRequestID,
        timestamp,
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
