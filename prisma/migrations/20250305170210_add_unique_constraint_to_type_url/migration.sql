/*
  Warnings:

  - A unique constraint covering the columns `[type_url]` on the table `whatsapp_connector_server` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "unique server url" ON "whatsapp_connector_server"("type_url");
