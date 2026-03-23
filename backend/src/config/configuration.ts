/**
 * Centralised app configuration loaded from environment variables.
 * All values are typed and validated at startup via NestJS ConfigModule.
 */
export default () => ({
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
  },

  mapbox: {
    accessToken: process.env.MAPBOX_ACCESS_TOKEN,
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

  mail: {
    host: process.env.MAIL_HOST ?? 'smtp.mailtrap.io',
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    fromName: process.env.MAIL_FROM_NAME ?? 'NduthiRide',
    fromAddress: process.env.MAIL_FROM_ADDRESS ?? 'no-reply@nduthiride.co.ke',
    otpExpiresMins: parseInt(process.env.OTP_EXPIRES_MINS ?? '10', 10),
  },
});
