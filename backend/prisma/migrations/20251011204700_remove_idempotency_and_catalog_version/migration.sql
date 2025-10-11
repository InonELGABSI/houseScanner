/*
  Warnings:

  - You are about to drop the column `base_catalog_version` on the `scans` table. All the data in the column will be lost.
  - You are about to drop the column `idempotency_key` on the `scans` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."scans_idempotency_key_key";

-- AlterTable
ALTER TABLE "scans" DROP COLUMN "base_catalog_version",
DROP COLUMN "idempotency_key";
