-- AlterTable
ALTER TABLE "poc_clinics_contacts" ADD COLUMN     "crm_appointment_at" TIMESTAMPTZ(6),
ADD COLUMN     "crm_appointment_id" VARCHAR;
