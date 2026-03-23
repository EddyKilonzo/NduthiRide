import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Enable raw body for webhook signature verification
    rawBody: true,
  });

  // ── Security headers (helmet) ───────────────────────────
  app.use(helmet());

  // ── CORS — allow the Angular frontend ──────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    credentials: true,
  });

  // ── Global route prefix ─────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Global validation — strips unknown fields, validates DTOs ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in the DTO
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true, // Auto-transform payloads to DTO class instances
    }),
  );

  // ── Global exception filter ─────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Global interceptors ─────────────────────────────────
  // LoggingInterceptor runs first (outer) — logs request timing
  // ResponseInterceptor wraps the final payload in { success: true, data: ... }
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  // ── Swagger API docs (available in development only) ────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NduthiRide API')
      .setDescription(
        'REST API for the NduthiRide motorcycle-taxi and parcel delivery platform',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth', 'User authentication and account management')
      .addTag('Rides', 'Ride booking and management')
      .addTag('Parcels', 'Parcel delivery booking and tracking')
      .addTag('Payments', 'M-Pesa payment integration')
      .addTag('Map', 'Geocoding and routing')
      .addTag('Chat', 'In-ride chat messaging')
      .addTag('Users', 'User profile management')
      .addTag('Riders', 'Rider profile and availability')
      .addTag('Admin', 'Admin dashboard and management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'NduthiRide API Docs',
    });

    // Also expose the JSON endpoint for programmatic access
    app.use('/api/docs-json', (req, res) => {
      res.json(document);
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`NduthiRide API running on http://localhost:${port}/api/v1`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  }
}

// void marks the floating promise as intentionally unhandled at top-level
void bootstrap();
