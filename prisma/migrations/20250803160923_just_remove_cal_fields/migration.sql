/*
  Warnings:

  - You are about to drop the column `cal_api_key` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `cal_booking_length` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `cal_event_slug` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `cal_event_type_id` on the `companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."companies" DROP COLUMN "cal_api_key",
DROP COLUMN "cal_booking_length",
DROP COLUMN "cal_event_slug",
DROP COLUMN "cal_event_type_id";
