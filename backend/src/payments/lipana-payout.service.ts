import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';

export interface LipanaPhonePayoutResult {
  id: string;
  status?: string;
}

/**
 * Sends M-Pesa B2C-style payouts via Lipana (POST /payouts/phone).
 * The installed @lipana/sdk does not expose sendToPhone yet; this matches Lipana API docs.
 */
@Injectable()
export class LipanaPayoutService {
  private readonly logger = new Logger(LipanaPayoutService.name);

  constructor(private readonly config: ConfigService) {}

  private getHttpClient(): AxiosInstance {
    const apiKey = this.config.getOrThrow<string>('lipana.secretKey');
    const production = apiKey.startsWith('lip_sk_live_');
    const baseURL = production
      ? 'https://api.lipana.dev/v1'
      : 'https://api-sandbox.lipana.dev/v1';

    return axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    });
  }

  /**
   * Normalize to +2547XXXXXXXX (same rules as customer STK flow).
   */
  normalizeToE164(phone: string): string {
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
    return phone.startsWith('+') ? phone : `+${cleaned}`;
  }

  isValidKenyanE164(phone: string): boolean {
    const d = phone.replace(/\D/g, '');
    return /^254(7|1)\d{8}$/.test(d);
  }

  /**
   * @param phone254 — digits only, e.g. 254712345678 (Lipana docs)
   * @param amountKes — whole shillings, min 10 per Lipana
   */
  async sendToPhone(
    phone254: string,
    amountKes: number,
  ): Promise<LipanaPhonePayoutResult> {
    const client = this.getHttpClient();
    try {
      const { data } = await client.post<{
        success?: boolean;
        payout?: { id: string; status?: string };
        data?: { id: string; status?: string };
        message?: string;
      }>('/payouts/phone', {
        phone: phone254,
        amount: amountKes,
      });

      const payout = data?.payout ?? data?.data;
      if (!payout?.id) {
        this.logger.error('Lipana payout response missing id', data);
        throw new InternalServerErrorException(
          'Invalid response from Lipana payout API',
        );
      }
      return { id: payout.id, status: payout.status };
    } catch (err) {
      if (isAxiosError(err)) {
        const msg =
          (err.response?.data as { message?: string })?.message ||
          err.message ||
          'Lipana payout request failed';
        this.logger.warn(`Lipana sendToPhone failed: ${msg}`);
        throw new Error(msg);
      }
      throw err;
    }
  }
}
