/*
  Warnings:

  - A unique constraint covering the columns `[company_id,phone]` on the table `contacts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "poc_clinics_contacts_company_phone_key" ON "contacts"("company_id", "phone");
