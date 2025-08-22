-- CreateEnum
CREATE TYPE "public"."BotReplyType" AS ENUM ('all', 'paid_traffic_only', 'non_paid_traffic_only');

-- CreateTable
CREATE TABLE "public"."whatsapp_connector_server" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "whatsapp_connector_server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."companies" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR NOT NULL,
    "openai_assistant_id" VARCHAR NOT NULL,
    "cal_event_type_id" BIGINT DEFAULT 0,
    "cal_event_slug" VARCHAR,
    "cal_api_key" VARCHAR,
    "cal_booking_length" BIGINT,
    "phone" BIGINT NOT NULL,
    "clinic_notification_phone" BIGINT,
    "updated_at" TIMESTAMPTZ(6),
    "is_bot_activated" BOOLEAN DEFAULT true,
    "url_id" VARCHAR(6) NOT NULL DEFAULT "substring"(md5((random())::text), 1, 6),
    "whatsapp_connector_server_id" INTEGER,
    "crm_provider" VARCHAR,
    "wapi_connection_status" BOOLEAN,
    "timezone" TEXT DEFAULT 'America/Sao_Paulo',
    "is_booking_reminders_activated" BOOLEAN DEFAULT true,
    "is_replies_activated" BOOLEAN DEFAULT true,
    "booking_reminder_today" TEXT,
    "booking_reminder_tomorrow" TEXT,
    "deactivate_on_human_reply" BOOLEAN DEFAULT false,
    "deactivation_schedule" JSON,
    "llm_stack" TEXT DEFAULT 'asst_vMtUz7ei87so7jRdh5jgmbXy',
    "is_smart_followups_activated" BOOLEAN DEFAULT false,
    "bot_reply_to" "public"."BotReplyType" NOT NULL DEFAULT 'all',
    "assistant_id" INTEGER,

    CONSTRAINT "poc_clinics_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assistant_instructions" (
    "id" SERIAL NOT NULL,
    "prompt" TEXT NOT NULL,

    CONSTRAINT "poc_assistant_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contacts" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR,
    "phone" BIGINT,
    "pain_points" VARCHAR[],
    "recommended_treatments" VARCHAR[],
    "treatments_of_interest" VARCHAR[],
    "is_recommendation_good" BOOLEAN,
    "is_willing_to_schedule" BOOLEAN,
    "no_scheduling_reason" VARCHAR,
    "schedule_event" JSON,
    "thread_id" VARCHAR,
    "last_message_received" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "nr_immediate_followups_sent" INTEGER NOT NULL DEFAULT 0,
    "last_immediate_followup_sent" TIMESTAMPTZ(6),
    "nr_smart_followups_sent" INTEGER NOT NULL DEFAULT 0,
    "last_smart_followup_sent" TIMESTAMPTZ(6),
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "custom_data" JSONB,
    "company_id" INTEGER DEFAULT 1,
    "archived_on" TIMESTAMPTZ(6),
    "photo_url" VARCHAR,
    "is_bot_activated" BOOLEAN DEFAULT true,
    "crm_appointment_at" TIMESTAMPTZ(6),
    "crm_appointment_id" VARCHAR,
    "lead_status_id" INTEGER,
    "whatsapp_profile_name" TEXT,
    "next_smart_follow_up" TIMESTAMPTZ(6),
    "smart_follow_up_stop_date" TIMESTAMPTZ(6),
    "objection" VARCHAR,
    "is_replies_activated" BOOLEAN DEFAULT true,
    "last_activity" TIMESTAMPTZ(6),

    CONSTRAINT "poc_clinics_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" SERIAL NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "sender_phone" BIGINT,
    "message" TEXT NOT NULL,
    "image_url" TEXT,
    "sent_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "is_read" BOOLEAN DEFAULT false,
    "message_type" VARCHAR(50) DEFAULT 'text',
    "author_type" VARCHAR(50) NOT NULL DEFAULT 'bot',
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "original_message_type" VARCHAR(50) DEFAULT 'text',
    "source" TEXT,
    "author_auth_id" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_table" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "src_table" TEXT NOT NULL,
    "col_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "record_id" INTEGER,
    "user" TEXT NOT NULL DEFAULT CURRENT_USER,
    "action" TEXT NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."follow_up_config" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "delay" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "follow_up_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."smart_follow_ups" (
    "id" SERIAL NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "is_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "smart_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lead_statuses" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "description" TEXT,

    CONSTRAINT "lead_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."smart_follow_up_config" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "follow_up_count" INTEGER NOT NULL DEFAULT 1,
    "follow_up_duration_days" INTEGER NOT NULL DEFAULT 1,
    "target_lead_status_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "smart_follow_up_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique server url" ON "public"."whatsapp_connector_server"("url");

-- CreateIndex
CREATE UNIQUE INDEX "unique phone" ON "public"."companies"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "unique_company_phone" ON "public"."contacts"("company_id", "phone");

-- CreateIndex
CREATE INDEX "idx_audit_table_changed_at" ON "public"."audit_table"("changed_at");

-- CreateIndex
CREATE INDEX "idx_audit_table_col_name" ON "public"."audit_table"("col_name");

-- CreateIndex
CREATE INDEX "idx_audit_table_src_table" ON "public"."audit_table"("src_table");

-- AddForeignKey
ALTER TABLE "public"."companies" ADD CONSTRAINT "poc_clinics_companies_whatsapp_connector_server_id_fkey" FOREIGN KEY ("whatsapp_connector_server_id") REFERENCES "public"."whatsapp_connector_server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."companies" ADD CONSTRAINT "companies_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "public"."assistant_instructions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_lead_status_id_fkey" FOREIGN KEY ("lead_status_id") REFERENCES "public"."lead_statuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "poc_clinics_contacts_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."follow_up_config" ADD CONSTRAINT "follow_up_config_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."smart_follow_ups" ADD CONSTRAINT "smart_follow_ups_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."smart_follow_up_config" ADD CONSTRAINT "smart_follow_up_config_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
