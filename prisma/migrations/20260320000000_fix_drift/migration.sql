-- AlterTable: Remove source column from messages
ALTER TABLE "messages" DROP COLUMN IF EXISTS "source";

-- AlterTable: Fix users table columns
ALTER TABLE "users" ALTER COLUMN "password" SET DATA TYPE TEXT;
ALTER TABLE "users" ALTER COLUMN "company_name" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP NOT NULL;

-- Fix users FK: change from RESTRICT to CASCADE
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_company_id_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
