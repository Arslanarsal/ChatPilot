-- CreateTable
CREATE TABLE "whatsapp_connector_server" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "whatsapp_connector_server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
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
    "wapi_id" TEXT,
    "url_id" VARCHAR(6) NOT NULL DEFAULT "substring"(md5((random())::text), 1, 6),
    "whatsapp_connector_server_id" INTEGER,
    "crm_provider" VARCHAR,
    "wapi_connection_status" BOOLEAN,
    "assistant_id" INTEGER,

    CONSTRAINT "poc_clinics_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR,
    "phone" BIGINT,
    "is_recommendation_good" BOOLEAN,
    "is_willing_to_schedule" BOOLEAN,
    "no_scheduling_reason" VARCHAR,
    "schedule_event" JSON,
    "thread_id" VARCHAR,
    "last_message_received" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nr_reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_sent" TIMESTAMPTZ(6),
    "appointment_scheduled_on" TIMESTAMPTZ(6),
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "company_id" INTEGER DEFAULT 1,
    "archived_on" TIMESTAMPTZ(6),
    "photo_url" VARCHAR,
    "is_bot_activated" BOOLEAN DEFAULT true,
    "crm_appointment_at" TIMESTAMPTZ(6),
    "crm_appointment_id" VARCHAR,
    "whatsapp_profile_name" TEXT,
    "next_smart_follow_up" TIMESTAMPTZ(6),
    "smart_reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "contact_stop_date" TIMESTAMPTZ(6),
    "is_replies_activated" BOOLEAN DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "poc_clinics_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
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

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_config" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "delay" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "follow_up_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smart_follow_ups" (
    "id" SERIAL NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "is_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "smart_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_instructions" (
    "id" SERIAL NOT NULL,
    "model" TEXT DEFAULT 'gpt-4o-mini',
    "temperature" DOUBLE PRECISION DEFAULT 0.1,
    "system_prompt" TEXT,

    CONSTRAINT "poc_assistant_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique server url" ON "whatsapp_connector_server"("url");

-- CreateIndex
CREATE UNIQUE INDEX "unique phone" ON "companies"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "poc_clinics_companies_wapi_id_key" ON "companies"("wapi_id");

-- CreateIndex
CREATE UNIQUE INDEX "poc_clinics_contacts_company_phone_key" ON "contacts"("company_id", "phone");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistant_instructions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "poc_clinics_companies_whatsapp_connector_server_id_fkey" FOREIGN KEY ("whatsapp_connector_server_id") REFERENCES "whatsapp_connector_server"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "poc_clinics_contacts_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "follow_up_config" ADD CONSTRAINT "follow_up_config_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_follow_ups" ADD CONSTRAINT "smart_follow_ups_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
