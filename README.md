# NduthiRide

NduthiRide is a comprehensive motorcycle-taxi (boda-boda) and parcel delivery platform. It enables users to book rides and schedule deliveries while providing riders with a powerful interface to manage their tasks and earnings.

## 🚀 Key Features

### 🛵 Ride-Hailing
- **Instant Booking:** Request a ride from your current location with real-time fare estimates.
- **Live Tracking:** Follow your rider's progress on a map as they head to your pickup and drop-off points.
- **Estimated Arrival Time:** Accurate ETA based on real-time distance and typical traffic.
- **In-Ride Chat:** Secure messaging between passenger and rider.

### 📦 Parcel Delivery
- **Flexible Logistics:** Send packages with weight-based pricing and distance surcharges.
- **Proof of Delivery:** Riders can upload images as confirmation of a successful drop-off.
- **Real-Time Updates:** Track your package status from accepted to delivered.
- **Recipient Management:** Provide specific recipient details for secure handovers.

### 💳 Payments & Security
- **Lipana M-Pesa Integration:** Seamless mobile money payments with STK Push.
- **Cash Option:** Support for traditional cash payments.
- **Fraud Detection:** Advanced circuit breakers and attempt limits to prevent payment abuse.
- **JWT Authentication:** Secure access with token rotation and role-based permissions (USER, RIDER, ADMIN).

### 🔔 Notifications & Real-Time
- **FCM Support:** Push notifications for ride acceptances, parcel updates, and more via Firebase.
- **WebSocket Gateway:** Real-time location updates and instant chat messages.

---

## 🛠️ Tech Stack

### Backend
- **Framework:** [NestJS](https://nestjs.com/) (TypeScript)
- **Database & ORM:** PostgreSQL with [Prisma](https://www.prisma.io/)
- **Payments:** [Lipana SDK](https://lipana.dev) (M-Pesa)
- **Real-Time:** Socket.io (WebSockets)
- **Authentication:** Passport.js with JWT Strategy
- **Mail:** Handlebars templates with Nodemailer

### Frontend
- **Framework:** [Angular 20+](https://angular.io/)
- **Maps:** [Leaflet](https://leafletjs.com/) with [OpenStreetMap](https://www.openstreetmap.org/)
- **Styling:** Vanilla CSS/SCSS for high-performance, responsive UI
- **Real-Time:** Socket.io-client
- **Progressive Web App:** Service workers for offline capabilities and push notifications

---

## 📂 Project Structure

```bash
NduthiRide/
├── backend/            # NestJS API
│   ├── prisma/         # Database schema & migrations
│   ├── src/
│   │   ├── auth/       # Identity & access management
│   │   ├── rides/      # Ride-hailing logic
│   │   ├── parcels/    # Delivery logistics
│   │   ├── payments/   # Lipana M-Pesa integration
│   │   ├── tracking/   # WebSocket location logic
│   │   └── chat/       # Messaging system
│   └── test/           # Integration & E2E tests
└── frontend/           # Angular PWA
    ├── src/
    │   ├── app/
    │   │   ├── core/      # Services & interceptors
    │   │   ├── shared/    # Common components & pipes
    │   │   └── features/  # Feature-specific modules
    │   └── environments/  # Configuration files
    └── public/            # Assets & service workers
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or later)
- PostgreSQL
- [Lipana](https://lipana.dev) account for M-Pesa test keys

### 1. Database Setup
```bash
cd backend
npm install
cp .env.example .env  # Update with your DB and API keys
npx prisma migrate dev
```

### 2. Run Backend
```bash
npm run start:dev
# Swagger documentation will be available at http://localhost:3000/api/docs
```

### 3. Run Frontend
```bash
cd ../frontend
npm install
npm start
# The app will open at http://localhost:4200
```

---

## 🧪 Testing

### Backend
- **Unit Tests:** `npm test`
- **Integration Tests:** `npm test src/payments/payments.integration.spec.ts`
- **E2E Tests:** `npm run test:e2e`

### Frontend
- **Unit Tests:** `ng test`

---

## 📜 License

This project is licensed under the MIT License.
