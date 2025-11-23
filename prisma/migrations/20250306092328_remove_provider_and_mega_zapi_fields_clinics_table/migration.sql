/*
  Warnings:

  - You are about to drop the column `mega_host` on the `poc_clinics_companies` table. All the data in the column will be lost.
  - You are about to drop the column `mega_instance_key` on the `poc_clinics_companies` table. All the data in the column will be lost.
  - You are about to drop the column `mega_token` on the `poc_clinics_companies` table. All the data in the column will be lost.
  - You are about to drop the column `whatsapp_provider` on the `poc_clinics_companies` table. All the data in the column will be lost.
  - You are about to drop the column `zapi_client_token` on the `poc_clinics_companies` table. All the data in the column will be lost.
  - You are about to drop the column `zapi_instance` on the `poc_clinics_companies` table. All the data in the column will be lost.
  - You are about to drop the column `zapi_token` on the `poc_clinics_companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "poc_clinics_companies" DROP COLUMN "mega_host",
DROP COLUMN "mega_instance_key",
DROP COLUMN "mega_token",
DROP COLUMN "whatsapp_provider",
DROP COLUMN "zapi_client_token",
DROP COLUMN "zapi_instance",
DROP COLUMN "zapi_token";
