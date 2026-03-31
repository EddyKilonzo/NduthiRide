-- =============================================================
-- NduthiRide — Full Database Setup for Neon
-- Paste this entire file into the Neon SQL Editor and run it.
-- =============================================================

-- ─── Migration: 20260323111041_init ──────────────────────────

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'RIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PICKUP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'CASH');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riders" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "license_number" TEXT NOT NULL,
    "bike_registration" TEXT NOT NULL,
    "bike_model" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "current_lat" DOUBLE PRECISION,
    "current_lng" DOUBLE PRECISION,
    "last_seen_at" TIMESTAMP(3),
    "rating_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_rides" INTEGER NOT NULL DEFAULT 0,
    "total_earnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rider_id" TEXT,
    "pickup_lat" DOUBLE PRECISION NOT NULL,
    "pickup_lng" DOUBLE PRECISION NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "dropoff_lat" DOUBLE PRECISION NOT NULL,
    "dropoff_lng" DOUBLE PRECISION NOT NULL,
    "dropoff_address" TEXT NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'PENDING',
    "estimated_fare" DOUBLE PRECISION NOT NULL,
    "final_fare" DOUBLE PRECISION,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "estimated_mins" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'MPESA',
    "mpesa_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "rides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rider_id" TEXT,
    "item_description" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "pickup_lat" DOUBLE PRECISION NOT NULL,
    "pickup_lng" DOUBLE PRECISION NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "dropoff_lat" DOUBLE PRECISION NOT NULL,
    "dropoff_lng" DOUBLE PRECISION NOT NULL,
    "dropoff_address" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "status" "ParcelStatus" NOT NULL DEFAULT 'PENDING',
    "delivery_fee" DOUBLE PRECISION NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "proof_image_url" TEXT,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'MPESA',
    "mpesa_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT,
    "parcel_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod" NOT NULL DEFAULT 'MPESA',
    "mpesa_phone" TEXT,
    "checkout_request_id" TEXT,
    "mpesa_receipt_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "ride_id" TEXT,
    "parcel_id" TEXT,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_history" (
    "id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");
CREATE UNIQUE INDEX "accounts_phone_key" ON "accounts"("phone");
CREATE UNIQUE INDEX "riders_account_id_key" ON "riders"("account_id");
CREATE UNIQUE INDEX "payments_ride_id_key" ON "payments"("ride_id");
CREATE UNIQUE INDEX "payments_parcel_id_key" ON "payments"("parcel_id");
CREATE UNIQUE INDEX "payments_checkout_request_id_key" ON "payments"("checkout_request_id");
CREATE UNIQUE INDEX "ratings_ride_id_key" ON "ratings"("ride_id");
CREATE UNIQUE INDEX "ratings_parcel_id_key" ON "ratings"("parcel_id");
CREATE INDEX "location_history_rider_id_created_at_idx" ON "location_history"("rider_id", "created_at");

-- AddForeignKey
ALTER TABLE "riders" ADD CONSTRAINT "riders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rides" ADD CONSTRAINT "rides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rides" ADD CONSTRAINT "rides_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Migration: 20260323112057_add_chat_module ────────────────

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "MessageSenderRole" AS ENUM ('USER', 'RIDER', 'SYSTEM');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'LOCATION', 'SYSTEM');

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "ride_id" TEXT,
    "parcel_id" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_account_id" TEXT NOT NULL,
    "senderRole" "MessageSenderRole" NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "locationPin" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_ride_id_key" ON "conversations"("ride_id");
CREATE UNIQUE INDEX "conversations_parcel_id_key" ON "conversations"("parcel_id");
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_account_id_fkey" FOREIGN KEY ("sender_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Migration: 20260323114434_add_mail_verification ──────────

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "is_email_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");
CREATE INDEX "verification_tokens_account_id_type_idx" ON "verification_tokens"("account_id", "type");

ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Migration: 20260323133711_add_fcm_token ──────────────────

ALTER TABLE "accounts" ADD COLUMN "fcm_token" TEXT;

-- ─── Migration: 20260323175405_add_payment_audit ──────────────

CREATE TABLE "payment_audit" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_audit_payment_id_idx" ON "payment_audit"("payment_id");
CREATE INDEX "payment_audit_user_id_idx" ON "payment_audit"("user_id");

-- ─── Extra models in schema not yet in migrations ─────────────
-- (settings, notifications, payouts, support_tickets, + schema column additions)

-- AlterTable: riders — add nullable document image columns
ALTER TABLE "riders"
    ALTER COLUMN "license_number" DROP NOT NULL,
    ALTER COLUMN "bike_registration" DROP NOT NULL,
    ADD COLUMN "license_image_url" TEXT,
    ADD COLUMN "id_front_image_url" TEXT,
    ADD COLUMN "id_back_image_url" TEXT,
    ADD COLUMN "logbook_image_url" TEXT;

-- AlterTable: rides — add financial breakdown columns
ALTER TABLE "rides"
    ADD COLUMN "commission_amount" DOUBLE PRECISION,
    ADD COLUMN "rider_earnings" DOUBLE PRECISION;

-- AlterTable: parcels — add financial breakdown columns
ALTER TABLE "parcels"
    ADD COLUMN "commission_amount" DOUBLE PRECISION,
    ADD COLUMN "rider_earnings" DOUBLE PRECISION;

CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_account_id_created_at_idx" ON "notifications"("account_id", "created_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "account_details" TEXT,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payouts_rider_id_idx" ON "payouts"("rider_id");

ALTER TABLE "payouts" ADD CONSTRAINT "payouts_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_account_id_idx" ON "support_tickets"("account_id");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Prisma migrations tracking table ────────────────────────

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count") VALUES
('1', '', now(), '20260323111041_init', now(), 1),
('2', '', now(), '20260323112057_add_chat_module', now(), 1),
('3', '', now(), '20260323114434_add_mail_verification', now(), 1),
('4', '', now(), '20260323133711_add_fcm_token', now(), 1),
('5', '', now(), '20260323175405_add_payment_audit', now(), 1);
