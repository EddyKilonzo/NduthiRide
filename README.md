# NduthiRide

NduthiRide is a full-stack motorcycle taxi and parcel delivery platform built for real-time dispatch, rider operations, and mobile-money payments.

It includes:
- a `NestJS` backend API with `PostgreSQL + Prisma`
- an `Angular` frontend for users, riders, and admins
- real-time features via `Socket.IO`
- M-Pesa checkout via `Lipana`

## Stack Logos

| Logo | Name |
| --- | --- |
| <img src="https://cdn.simpleicons.org/nestjs/E0234E" alt="NestJS" width="28" height="28" /> | NestJS |
| <img src="https://cdn.simpleicons.org/angular/DD0031" alt="Angular" width="28" height="28" /> | Angular |
| <img src="https://cdn.simpleicons.org/typescript/3178C6" alt="TypeScript" width="28" height="28" /> | TypeScript |
| <img src="https://cdn.simpleicons.org/nodedotjs/5FA04E" alt="Node.js" width="28" height="28" /> | Node.js |
| <img src="https://cdn.simpleicons.org/prisma/2D3748" alt="Prisma" width="28" height="28" /> | Prisma |
| <img src="https://cdn.simpleicons.org/postgresql/4169E1" alt="PostgreSQL" width="28" height="28" /> | PostgreSQL |
| <img src="https://cdn.simpleicons.org/socketdotio/010101" alt="Socket.IO" width="28" height="28" /> | Socket.IO |
| <img src="https://cdn.simpleicons.org/firebase/DD2C00" alt="Firebase" width="28" height="28" /> | Firebase |
| <img src="https://cdn.simpleicons.org/cloudinary/3448C5" alt="Cloudinary" width="28" height="28" /> | Cloudinary |
| <img src="https://cdn.simpleicons.org/render/46E3B7" alt="Render" width="28" height="28" /> | Render |
| <img src="https://cdn.simpleicons.org/vercel/000000" alt="Vercel" width="28" height="28" /> | Vercel |

## What The Platform Supports

### User and Rider Workflows
- User registration/login with JWT access + refresh flow
- Ride booking with fare estimates, status updates, and tracking
- Parcel booking with recipient details and delivery progression
- Rider-facing active tasks, history, and verification flows
- Admin-facing operations for users, rides, parcels, and settings

### Real-Time and Notifications
- Socket-based updates for ride/parcel progress and chat
- In-app notifications module
- Firebase push notification integration support

### Payments
- M-Pesa STK push integration via Lipana
- Payment webhooks with signature verification
- Payment status tracking and audit-friendly flow
- Cash payment option for applicable use cases

## Complete User Workflows

### 1) Passenger/User Workflow (Ride)
1. Create account or login.
2. Set pickup and dropoff on map.
3. Request fare estimate and confirm booking.
4. Wait for rider acceptance and track rider in real time.
5. Chat/call rider if needed during pickup and trip.
6. Complete payment (`M-Pesa` or `Cash` based on flow).
7. Ride is marked completed and appears in ride history.

### 2) Passenger/User Workflow (Parcel)
1. Create parcel request with pickup/dropoff.
2. Add parcel details (weight/category/notes).
3. Add recipient details for handover.
4. Confirm quote and place booking.
5. Rider accepts parcel order.
6. Track in-transit progress and chat with rider if needed.
7. Payment is completed and parcel is marked delivered.
8. Delivery proof and history are available to user.

### 3) Rider Workflow
1. Register/login as rider and complete verification steps.
2. Toggle availability to receive ride/parcel jobs.
3. Accept incoming requests.
4. Navigate to pickup and update status progression.
5. Share live location over websocket updates.
6. Communicate with customer using in-app chat.
7. Confirm payment status where required.
8. Complete ride/delivery and move task to history.

### 4) Admin Workflow
1. Login with admin role.
2. Review users/riders and account states.
3. Monitor rides and parcels in active and completed states.
4. Review payment states and audit events.
5. Manage operational settings and platform-level controls.
6. Investigate incidents/support escalations.

### 5) Support Workflow
1. Receive issue report from user/rider.
2. Inspect trip/parcel/payment record from support tools.
3. Validate timeline using status logs and chat trail.
4. Escalate to admin or operations if policy action is needed.
5. Resolve and notify affected user/rider.

## Tech Stack

### Backend (`backend/`)
- `NestJS` 11, `TypeScript`
- `Prisma` 7 + `PostgreSQL`
- `Socket.IO` (websockets)
- `Passport` + JWT auth guards
- `Swagger` docs in non-production environments
- `Cloudinary` media uploads
- `Nodemailer` + handlebars templates
- `Firebase Admin` notifications

### Frontend (`frontend/`)
- `Angular` 20
- `RxJS`
- `Leaflet` (maps)
- `Socket.IO Client`
- `Firebase` web SDK
- SCSS/Tailwind ecosystem tooling present

## Repository Structure

```text
NduthRide/
├── backend/
│   ├── prisma/                  # Schema, migrations, seed helpers
│   ├── src/
│   │   ├── auth/                # Authentication and token flows
│   │   ├── users/               # User profile/domain logic
│   │   ├── riders/              # Rider onboarding and rider features
│   │   ├── rides/               # Ride booking and lifecycle
│   │   ├── parcels/             # Parcel booking and lifecycle
│   │   ├── payments/            # Lipana + payment operations
│   │   ├── tracking/            # Real-time ride tracking gateway
│   │   ├── chat/                # Ride/parcel chat messaging
│   │   ├── notifications/       # Notification APIs
│   │   ├── media/               # Upload/media handling
│   │   ├── admin/               # Admin endpoints
│   │   ├── support/             # Support/ticket features
│   │   ├── map/                 # Mapping/geocoding helpers
│   │   └── common/              # Interceptors, filters, shared utils
│   └── .env.example             # Backend environment template
├── frontend/
│   ├── src/app/features/        # Feature-first Angular screens
│   │   ├── auth/
│   │   ├── user/
│   │   ├── rider/
│   │   ├── admin/
│   │   ├── chat/
│   │   ├── notifications/
│   │   ├── support/
│   │   └── landing/
│   └── src/environments/        # Frontend environment config
├── render.yaml                  # Backend deployment config (Render)
└── vercel.json                  # Frontend deployment config (Vercel)
```

## System Architecture

1. Frontend calls backend REST endpoints under `/api/v1`.
2. Backend validates DTOs globally and applies auth/role guards.
3. Stateful operations (rides/parcels/payments) persist via Prisma.
4. WebSocket channels push live updates to riders/users.
5. Payment webhook callbacks update transaction status asynchronously.

Backend defaults:
- API base path: `http://localhost:3000/api/v1`
- Swagger docs (non-production): `http://localhost:3000/api/docs`
- WebSocket base: `http://localhost:3000`

## Local Development Setup

### Prerequisites
- `Node.js` 20+ (recommended)
- `npm` 10+
- `PostgreSQL` instance
- Lipana test credentials (for M-Pesa flows)
- Optional: Firebase, Cloudinary, SMTP, SMS provider credentials

### 1) Backend Setup

```bash
cd backend
npm install
```

Create env file:

```bash
# Windows PowerShell
Copy-Item .env.example .env
```

Update the required values in `backend/.env`, then run:

```bash
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

Backend should be available at `http://localhost:3000/api/v1`.

### 2) Frontend Setup

Open a second terminal:

```bash
cd frontend
npm install
npm start
```

Frontend should be available at `http://localhost:4200`.

By default, development frontend environment points to:
- `apiUrl = http://localhost:3000/api/v1`
- `wsUrl = http://localhost:3000`

## Environment Variables

Use `backend/.env.example` as the source of truth.

Important backend keys include:
- `NODE_ENV`, `PORT`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, expiries
- `LIPANA_SECRET_KEY`, `LIPANA_PUBLISHABLE_KEY`, `LIPANA_WEBHOOK_SECRET`
- `FRONTEND_URL` or `CORS_ORIGINS`
- `CLOUDINARY_*`
- `MAIL_*`
- `FIREBASE_SERVICE_ACCOUNT`
- `SMS_*`

Notes:
- Do not commit `*.env` files.
- Keep production and sandbox payment credentials separate.
- Ensure webhook secrets match the value configured in Lipana.

## Scripts

### Backend (`backend/package.json`)
- `npm run start:dev` - start in watch mode
- `npm run build` - build NestJS app (includes Prisma generate)
- `npm run start:prod` - run compiled server
- `npm run lint` - run ESLint with fix
- `npm test` - unit tests
- `npm run test:e2e` - end-to-end tests
- `npm run prisma:migrate` - deploy migrations

### Frontend (`frontend/package.json`)
- `npm start` - run Angular dev server
- `npm run build` - production build
- `npm run watch` - build watcher
- `npm test` - unit tests (Karma/Jasmine)

## Payments and Webhooks

The platform uses Lipana for M-Pesa initiation and webhook callbacks.

Typical webhook endpoint:
- `/api/v1/payments/lipana/webhook`

For local webhook testing, expose backend publicly (for example with `ngrok`) and register that URL in Lipana dashboard.

For additional payment-specific implementation notes, see `frontend/PAYMENTS.md`.

## Deployment

### Backend (Render)
- Configured via `render.yaml`
- Root directory: `backend/`
- Build command: `npm ci --include=dev && npm run build`
- Start command: `node dist/main.js`

### Frontend (Vercel)
- Configured via `vercel.json`
- Build command executes in `frontend/`
- Output directory: `frontend/dist/browser`
- SPA rewrite routes to `index.html`

## Security and Operational Notes

- JWT-based authentication with role-oriented access control
- CORS configured from env (`CORS_ORIGINS` or `FRONTEND_URL`)
- Global validation pipes and exception handling in backend
- Helmet security headers enabled
- Webhook raw-body handling enabled for signature verification

## Troubleshooting

- **Database connection issues**: verify `DATABASE_URL` and DB reachability.
- **CORS errors**: confirm exact frontend origin in `FRONTEND_URL`/`CORS_ORIGINS`.
- **Payment webhook failures**: verify public callback URL and webhook secret.
- **No real-time updates**: confirm frontend `wsUrl` matches backend host.
- **Build failures on deploy**: ensure env vars are set in host dashboard.

## Contributing

1. Create a feature branch.
2. Keep changes scoped and tested.
3. Run lint and relevant tests before opening PRs.
4. Include env/setup notes for any new integration.

## License

No explicit root license file is currently included. Confirm project licensing before external distribution.
