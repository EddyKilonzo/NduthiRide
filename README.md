# NduthiRide

Motorcycle-taxi (boda-boda) and parcel delivery platform built with NestJS backend and Angular frontend.

## Backend API

### Quick Start

```bash
cd backend
npm install
cp .env.example .env  # Edit with your credentials
npm run start:dev
```

### Environment Configuration

Create a `.env` file with the following variables:

```bash
# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:4200

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/nduthiride?schema=public

# JWT Auth
JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_REFRESH_EXPIRES_IN=7d

# M-Pesa Payments (Lipana)
# Get keys from: https://lipana.dev/dashboard
LIPANA_SECRET_KEY=lip_sk_test_YOUR_SECRET_KEY
LIPANA_WEBHOOK_SECRET=your_webhook_secret_here
LIPANA_API_URL=https://api.lipana.dev/v1

# Mapbox
MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Cloudinary (optional - for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### API Documentation

Swagger UI is available at: **http://localhost:3000/api/docs**

- **Interactive documentation** with all endpoints
- **Try it out** feature to test API calls directly
- **JWT authentication** built-in (click the lock icon to authorize)
- **JSON export** available at: http://localhost:3000/api/docs-json

### Payment Integration (Lipana M-Pesa)

NduthiRide uses [Lipana](https://lipana.dev) for secure M-Pesa payment processing.

#### Getting Lipana Keys

1. Sign up at [lipana.dev](https://lipana.dev)
2. Navigate to API Keys in your dashboard
3. Create a new key pair:
   - **Publishable Key** (`lip_pk_*`): Safe for frontend use
   - **Secret Key** (`lip_sk_*`): Keep private on server

#### Payment Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐     ┌─────────┐
│   Frontend  │────▶│  NduthiRide  │────▶│  Lipana  │────▶│  M-Pesa │
│   (Angular) │     │   (NestJS)   │     │   API    │     │  STK    │
└─────────────┘     └──────────────┘     └──────────┘     └─────────┘
       ▲                                                          │
       │                                                          │
       │              ┌──────────────┐                            │
       └──────────────│   Webhook    │◀───────────────────────────┘
                      │  Callback    │
                      └──────────────┘
```

#### 1. Initiate Payment

```typescript
// Frontend: payment.service.ts
await paymentService.initiateForRide(rideId, '0712345678', 'MPESA');
```

```bash
# API Request
POST /api/v1/payments/initiate
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "rideId": "clx123abc",
  "method": "MPESA",
  "mpesaPhone": "0712345678"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay-123",
    "transactionId": "TXN1234567890",
    "checkoutRequestId": "ws_CO_123",
    "message": "Check your phone for the M-Pesa prompt"
  }
}
```

#### 2. Poll Payment Status

```typescript
// Frontend: Poll every 4 seconds
const result = await paymentService.pollStatus(checkoutRequestId);
// result.status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
```

```bash
GET /api/v1/payments/status/:checkoutRequestId
Authorization: Bearer <access_token>
```

#### 3. Webhook Configuration

Configure your webhook URL in the Lipana dashboard:

```
Webhook URL: https://your-domain.com/api/v1/payments/lipana/webhook
```

**Security:** All webhooks are verified using HMAC-SHA256 signature verification.

#### Webhook Payload Example

```json
{
  "event": "payment.success",
  "data": {
    "transactionId": "TXN1234567890",
    "amount": 5000,
    "status": "success",
    "phone": "+254712345678",
    "checkoutRequestID": "ws_CO_123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Security Features

#### Payment Security

| Feature | Description |
|---------|-------------|
| **Webhook Signature Verification** | All Lipana webhooks verified using HMAC-SHA256 with constant-time comparison to prevent timing attacks |
| **Replay Attack Prevention** | Processed webhook IDs cached for 24 hours to prevent duplicate processing |
| **Timestamp Validation** | Webhooks older than 5 minutes are rejected |
| **Idempotency** | Duplicate payment requests within 30s automatically rejected |
| **Fraud Detection** | Users exceeding 5 failed payment attempts in 15 minutes are temporarily blocked |
| **Circuit Breaker** | Lipana API calls blocked after 5 consecutive failures (1-minute cooldown) |
| **Amount Limits** | Payments validated: min KES 10, max KES 150,000 |
| **Phone Validation** | Kenyan phone numbers validated before STK push |
| **Ownership Checks** | Users can only pay for their own rides/parcels |
| **Pending Payment Detection** | Prevents duplicate STK pushes for same entity |
| **Audit Logging** | All payment operations logged for security review |

#### General Security

| Feature | Description |
|---------|-------------|
| **JWT Authentication** | Access tokens (15min) + Refresh tokens (7 days) with secure rotation |
| **Role-Based Access Control** | USER, RIDER, ADMIN roles with guarded endpoints |
| **Rate Limiting** | 100 requests per 15 minutes globally via ThrottlerGuard |
| **Helmet Security Headers** | XSS protection, content sniffing prevention, HSTS, etc. |
| **CORS** | Restricted to frontend origin only |
| **Input Validation** | All DTOs validated with class-validator, unknown fields stripped |
| **SQL Injection Prevention** | Prisma ORM with parameterized queries |
| **Raw Body Handling** | Webhook endpoint receives raw body for signature verification |

### API Endpoints Overview

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/api/v1/auth` | Login, register, password reset, email verification |
| Rides | `/api/v1/rides` | Book rides, get estimates, rate riders |
| Parcels | `/api/v1/parcels` | Book deliveries, track parcels, rate service |
| Payments | `/api/v1/payments` | Lipana STK push, payment status, webhooks |
| Map | `/api/v1/map` | Geocoding, reverse geocoding, directions, ETA |
| Chat | `/api/v1/chat` | In-ride messaging (REST + WebSocket) |
| Users | `/api/v1/users` | User profile management |
| Riders | `/api/v1/riders` | Rider profile, availability toggle |
| Admin | `/api/v1/admin` | Dashboard stats, user/ride/payment management |

### Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error message here",
  "path": "/api/v1/endpoint",
  "timestamp": "2024-03-23T14:30:00.000Z"
}
```

### Running Tests

```bash
# Unit tests
npm test

# Test coverage
npm run test:cov

# E2E tests (requires running database)
npm run test:e2e
```

## Frontend

### Quick Start

```bash
cd frontend
npm install
npm start
```

The Angular app runs on: **http://localhost:4200**

### Frontend Services

All API calls use the `BaseApiService` which:
- Wraps responses in `{ success, data }` format
- Handles errors via `GlobalErrorInterceptor`
- Provides typed HTTP methods (`get`, `post`, `patch`, `delete`)

## Database

### Setup

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

## WebSocket Events

Real-time events for live tracking and chat:

| Namespace | Event | Direction | Description |
|-----------|-------|-----------|-------------|
| `/tracking` | `rider:location-update` | Rider → Server | GPS location update |
| `/tracking` | `tracking:location` | Server → User | Live rider location |
| `/tracking` | `ride:new-request` | Server → Riders | Broadcast new ride |
| `/tracking` | `parcel:new-request` | Server → Riders | Broadcast new parcel |
| `/chat` | `chat:send` | Client → Server | Send message |
| `/chat` | `chat:message` | Server → Clients | Receive message |
| `/chat` | `chat:closed` | Server → Clients | Conversation closed |

## License

MIT
