-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "next_smart_follow_up" TIMESTAMPTZ;
ALTER TABLE "contacts" ADD COLUMN "smart_reminders_sent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "contacts" ADD COLUMN "contact_stop_date" TIMESTAMPTZ;
ALTER TABLE "contacts" ADD COLUMN "objection" VARCHAR;