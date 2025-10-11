-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "HouseStatus" AS ENUM ('idle', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ChecklistScope" AS ENUM ('house', 'room', 'product');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "address" TEXT,
    "house_type" TEXT,
    "status" "HouseStatus" NOT NULL DEFAULT 'idle',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "status" "ScanStatus" NOT NULL,
    "idempotency_key" TEXT,
    "inputs_snapshot" JSONB NOT NULL,
    "base_catalog_version" TEXT,
    "detected_house_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "scan_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "label" TEXT,
    "detected_room_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_room_images" (
    "id" UUID NOT NULL,
    "scan_id" UUID NOT NULL,
    "room_id" UUID,
    "url" TEXT NOT NULL,
    "tag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_room_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklists" (
    "id" UUID NOT NULL,
    "scope" "ChecklistScope" NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_base" BOOLEAN NOT NULL DEFAULT true,
    "user_id" UUID,
    "items_raw" JSONB NOT NULL,
    "items_flat" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models_info" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "version" TEXT,
    "pricing" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "models_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents_runs" (
    "id" UUID NOT NULL,
    "scan_id" UUID NOT NULL,
    "agent_name" TEXT NOT NULL,
    "model_id" UUID,
    "input_json" JSONB,
    "output_json" JSONB,
    "prompt_hash" TEXT,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "cost_usd" DECIMAL(65,30),
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_scan_summary" (
    "id" UUID NOT NULL,
    "scan_id" UUID NOT NULL,
    "summary_json" JSONB NOT NULL,
    "pros_cons_json" JSONB,
    "cost_summary" JSONB,
    "schema_version" TEXT,
    "derived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_scan_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_houses_user" ON "houses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "scans_idempotency_key_key" ON "scans"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_scans_house_created" ON "scans"("house_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_scan_id_ordinal_key" ON "rooms"("scan_id", "ordinal");

-- CreateIndex
CREATE INDEX "idx_images_scan_room" ON "house_room_images"("scan_id", "room_id");

-- CreateIndex
CREATE INDEX "idx_checklists_items_flat" ON "checklists"("items_flat");

-- CreateIndex
CREATE UNIQUE INDEX "checklists_scope_name_version_user_id_key" ON "checklists"("scope", "name", "version", "user_id");

-- CreateIndex
CREATE INDEX "idx_models_info_model_from" ON "models_info"("model_name", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "uq_model_effective" ON "models_info"("model_name", "effective_from");

-- CreateIndex
CREATE INDEX "idx_agents_runs_scan_agent" ON "agents_runs"("scan_id", "agent_name", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "house_scan_summary_scan_id_key" ON "house_scan_summary"("scan_id");

-- AddForeignKey
ALTER TABLE "houses" ADD CONSTRAINT "houses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_room_images" ADD CONSTRAINT "house_room_images_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_room_images" ADD CONSTRAINT "house_room_images_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents_runs" ADD CONSTRAINT "agents_runs_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents_runs" ADD CONSTRAINT "agents_runs_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models_info"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_scan_summary" ADD CONSTRAINT "house_scan_summary_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
