/*
  Warnings:

  - You are about to drop the column `clinic_notification_phone` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `wapi_connection_status` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `wapi_id` on the `companies` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[session_id]` on the table `companies` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "poc_clinics_companies_wapi_id_key";

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "clinic_notification_phone",
DROP COLUMN "wapi_connection_status",
DROP COLUMN "wapi_id",
ADD COLUMN     "company_notification_phone" BIGINT,
ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "whatsapp_connection_status" BOOLEAN;

-- CreateIndex
CREATE UNIQUE INDEX "poc_clinics_companies_wapi_id_key" ON "companies"("session_id");
