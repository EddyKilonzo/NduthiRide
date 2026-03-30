/**
 * Centralised app configuration loaded from environment variables.
 * All values are typed and validated at startup via NestJS ConfigModule.
 */
export default () => {
  const mailPort = parseInt(process.env.MAIL_PORT ?? '587', 10);
  const mailSecureEnv = process.env.MAIL_SECURE;
  const mailSecure =
    mailSecureEnv === 'true' ||
    (mailSecureEnv !== 'false' && mailPort === 465);
  const smtpFrom = process.env.SMTP_FROM ?? '';
  const smtpFromMatch = smtpFrom.match(/^"?([^"<]+?)\s*<([^>]+)>"?$/);
  const fallbackFromName = smtpFromMatch?.[1]?.trim();
  const fallbackFromAddress = smtpFromMatch?.[2]?.trim();

  return {
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4200',
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    apiUrl: process.env.MPESA_API_URL ?? 'https://sandbox.safaricom.co.ke',
    webhookSecret: process.env.LIPANA_WEBHOOK_SECRET,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  sms: {
    apiKey: process.env.SMS_API_KEY,
    username: process.env.SMS_USERNAME,
    senderId: process.env.SMS_SENDER_ID ?? 'NduthiRide',
  },

  firebase: {
    /**
     * Full Firebase service-account JSON, base64-encoded or as a raw JSON string.
     * Set FIREBASE_SERVICE_ACCOUNT in your environment.
     * When absent, FCM push notifications are silently disabled.
     */
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
  },

  mail: {
    host: process.env.MAIL_HOST ?? process.env.SMTP_HOST ?? 'smtp.mailtrap.io',
    port: parseInt(process.env.MAIL_PORT ?? process.env.SMTP_PORT ?? '587', 10),
    secure:
      process.env.MAIL_SECURE === 'true' ||
      (process.env.MAIL_SECURE !== 'false' &&
        parseInt(process.env.MAIL_PORT ?? process.env.SMTP_PORT ?? '587', 10) ===
          465),
    /** When using plain SMTP (e.g. Mailpit on 1025), set MAIL_REQUIRE_TLS=false */
    requireTls: process.env.MAIL_REQUIRE_TLS !== 'false',
    user: process.env.MAIL_USER ?? process.env.SMTP_USER,
    pass: process.env.MAIL_PASS ?? process.env.SMTP_PASS,
    fromName: process.env.MAIL_FROM_NAME ?? fallbackFromName ?? 'NduthiRide',
    fromAddress:
      process.env.MAIL_FROM_ADDRESS ??
      fallbackFromAddress ??
      process.env.SENDER_EMAIL ??
      'no-reply@nduthiride.co.ke',
    otpExpiresMins: parseInt(process.env.OTP_EXPIRES_MINS ?? '10', 10),
    /** Logs OTP to server console in development when MAIL_DEBUG_OTP=true (never in production). */
    debugLogOtp:
      process.env.NODE_ENV !== 'production' &&
      process.env.MAIL_DEBUG_OTP === 'true',
  },
  };
};
