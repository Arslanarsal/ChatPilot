/*
  Warnings:

  - You are about to drop the column `appointment_scheduled_on` on the `contacts` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `contacts` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `contacts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "contacts" DROP COLUMN "appointment_scheduled_on",
DROP COLUMN "latitude",
DROP COLUMN "longitude";
