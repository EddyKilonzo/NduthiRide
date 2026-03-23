-- CreateTable
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

-- CreateIndex
CREATE INDEX "payment_audit_payment_id_idx" ON "payment_audit"("payment_id");

-- CreateIndex
CREATE INDEX "payment_audit_user_id_idx" ON "payment_audit"("user_id");
