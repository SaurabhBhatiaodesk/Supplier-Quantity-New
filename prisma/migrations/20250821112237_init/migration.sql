-- AlterTable
ALTER TABLE "public"."Connection" ADD COLUMN     "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduleFrequency" TEXT,
ADD COLUMN     "scheduleTime" TEXT;
