/*
  Warnings:

  - You are about to drop the column `belle_json` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `booking_type` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `clinicorp_json` on the `companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" DROP COLUMN "belle_json",
DROP COLUMN "booking_type",
DROP COLUMN "clinicorp_json";
