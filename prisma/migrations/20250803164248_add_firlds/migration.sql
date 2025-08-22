-- AlterTable
ALTER TABLE "public"."companies" ADD COLUMN     "cal_api_key" VARCHAR,
ADD COLUMN     "cal_booking_length" BIGINT,
ADD COLUMN     "cal_event_slug" VARCHAR,
ADD COLUMN     "cal_event_type_id" BIGINT DEFAULT 0;
