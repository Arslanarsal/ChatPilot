/*
  Warnings:

  - You are about to drop the column `belle_api_key` on the `poc_clinics_companies` table. All the data in the column will be lost.
  - You are about to drop the column `belle_client_id` on the `poc_clinics_companies` table. All the data in the column will be lost.
  - You are about to drop the column `belle_estab_id` on the `poc_clinics_companies` table. All the data in the column will be lost.
  - You are about to drop the column `calendar_provider` on the `poc_clinics_companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "poc_clinics_companies" DROP COLUMN "belle_api_key",
DROP COLUMN "belle_client_id",
DROP COLUMN "belle_estab_id",
DROP COLUMN "calendar_provider";
