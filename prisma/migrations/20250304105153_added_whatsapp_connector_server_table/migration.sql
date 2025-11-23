-- AlterTable
ALTER TABLE "poc_clinics_companies" ADD COLUMN     "whatsapp_connector_server_id" INTEGER;

-- CreateTable
CREATE TABLE "whatsapp_connector_server" (
    "id" SERIAL NOT NULL,
    "type_url" TEXT NOT NULL,

    CONSTRAINT "whatsapp_connector_server_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "poc_clinics_companies" ADD CONSTRAINT "poc_clinics_companies_whatsapp_connector_server_id_fkey" FOREIGN KEY ("whatsapp_connector_server_id") REFERENCES "whatsapp_connector_server"("id") ON DELETE SET NULL ON UPDATE CASCADE;
