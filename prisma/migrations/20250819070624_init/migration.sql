/*
  Warnings:

  - You are about to drop the `import_configurations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `import_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_mappings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `temp_data` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Session" ALTER COLUMN "expires" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."import_configurations";

-- DropTable
DROP TABLE "public"."import_history";

-- DropTable
DROP TABLE "public"."product_mappings";

-- DropTable
DROP TABLE "public"."temp_data";

-- CreateTable
CREATE TABLE "public"."Connection" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiUrl" TEXT,
    "accessToken" TEXT,
    "csvFileName" TEXT,
    "supplierName" TEXT,
    "supplierEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastSync" TIMESTAMP(3),
    "scheduledTime" TEXT,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);
