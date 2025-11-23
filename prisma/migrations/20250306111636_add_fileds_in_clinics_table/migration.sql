-- AlterTable
ALTER TABLE "poc_clinics_companies" ADD COLUMN     "belle_json" JSON DEFAULT '{}',
ADD COLUMN     "booking_type" VARCHAR,
ADD COLUMN     "clinicorp_json" JSON DEFAULT '{}',
ADD COLUMN     "crm_provider" VARCHAR;
