/*
  Warnings:

  - You are about to drop the column `crm_provider` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `whatsapp_connector_server_id` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `serverId` on the `whats_app_session` table. All the data in the column will be lost.
  - You are about to drop the `whatsapp_connector_server` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "poc_clinics_companies_whatsapp_connector_server_id_fkey";

-- DropIndex
DROP INDEX "idx_whats_app_session_serverId";

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "crm_provider",
DROP COLUMN "whatsapp_connector_server_id";

-- AlterTable
ALTER TABLE "whats_app_session" DROP COLUMN "serverId";

-- DropTable
DROP TABLE "whatsapp_connector_server";
