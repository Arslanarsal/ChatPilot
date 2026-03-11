-- AlterTable: Remove unused columns from companies
ALTER TABLE "companies" DROP COLUMN IF EXISTS "company_notification_phone",
DROP COLUMN IF EXISTS "url_id";

-- AlterTable: Remove old follow-up columns from contacts, add is_follow_up_sent
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "is_recommendation_good",
DROP COLUMN IF EXISTS "is_willing_to_schedule",
DROP COLUMN IF EXISTS "no_scheduling_reason",
DROP COLUMN IF EXISTS "thread_id",
DROP COLUMN IF EXISTS "last_reminder_sent",
DROP COLUMN IF EXISTS "nr_reminders_sent",
DROP COLUMN IF EXISTS "next_smart_follow_up",
DROP COLUMN IF EXISTS "smart_reminders_sent",
DROP COLUMN IF EXISTS "pain_points",
DROP COLUMN IF EXISTS "recommended_treatments",
DROP COLUMN IF EXISTS "treatments_of_interest",
ADD COLUMN IF NOT EXISTS "is_follow_up_sent" BOOLEAN NOT NULL DEFAULT false;

-- DropTable: Remove old follow-up tables
DROP TABLE IF EXISTS "smart_follow_ups";
DROP TABLE IF EXISTS "follow_up_config";
