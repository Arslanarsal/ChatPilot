/*
  Warnings:

  - You are about to drop the column `type_url` on the `whatsapp_connector_server` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[url]` on the table `whatsapp_connector_server` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `whatsapp_connector_server` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `whatsapp_connector_server` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "unique server url";

-- AlterTable
ALTER TABLE "whatsapp_connector_server" DROP COLUMN "type_url",
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "unique server url" ON "whatsapp_connector_server"("url");
