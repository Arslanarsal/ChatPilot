-- CreateTable
CREATE TABLE "poc_clinics_companies" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR NOT NULL,
    "openai_assistant_id" VARCHAR NOT NULL,
    "cal_event_type_id" BIGINT DEFAULT 0,
    "cal_event_slug" VARCHAR,
    "cal_api_key" VARCHAR,
    "cal_booking_length" BIGINT,
    "whatsapp_provider" VARCHAR NOT NULL DEFAULT 'mega',
    "zapi_instance" VARCHAR,
    "zapi_token" VARCHAR,
    "zapi_client_token" VARCHAR,
    "mega_host" VARCHAR,
    "mega_instance_key" VARCHAR,
    "mega_token" VARCHAR,
    "phone" BIGINT NOT NULL,
    "clinic_notification_phone" BIGINT,
    "updated_at" TIMESTAMPTZ(6),
    "is_bot_activated" BOOLEAN DEFAULT true,
    "calendar_provider" TEXT,
    "belle_api_key" TEXT,
    "belle_estab_id" BIGINT,
    "belle_client_id" BIGINT,
    "wapi_id" TEXT,
    "url_id" VARCHAR(6) NOT NULL DEFAULT "substring"(md5((random())::text), 1, 6),

    CONSTRAINT "poc_clinics_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poc_clinics_contacts" (
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
    "last_message_received" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nr_reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_sent" TIMESTAMPTZ(6),
    "appointment_scheduled_on" TIMESTAMPTZ(6),
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "custom_data" JSONB,
    "company_id" INTEGER DEFAULT 1,
    "archived_on" TIMESTAMPTZ(6),
    "photo_url" VARCHAR,
    "is_bot_activated" BOOLEAN DEFAULT true,

    CONSTRAINT "poc_clinics_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poc_clinics_messages" (
    "id" SERIAL NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "sender_phone" BIGINT,
    "message" TEXT NOT NULL,
    "image_url" TEXT,
    "sent_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "is_read" BOOLEAN DEFAULT false,
    "message_type" VARCHAR(50) DEFAULT 'text',
    "author_type" VARCHAR(10) NOT NULL DEFAULT 'bot',

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique phone" ON "poc_clinics_companies"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "poc_clinics_companies_wapi_id_key" ON "poc_clinics_companies"("wapi_id");

-- AddForeignKey
ALTER TABLE "poc_clinics_contacts" ADD CONSTRAINT "poc_clinics_contacts_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "poc_clinics_companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "poc_clinics_messages" ADD CONSTRAINT "messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "poc_clinics_contacts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
