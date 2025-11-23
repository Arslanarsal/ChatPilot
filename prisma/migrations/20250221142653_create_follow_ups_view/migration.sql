-- This is an empty migration.
CREATE OR REPLACE VIEW follow_ups AS
 SELECT poc_clinics_contacts.id,
    poc_clinics_contacts.name,
    poc_clinics_contacts.thread_id,
    poc_clinics_contacts.company_id,
    poc_clinics_contacts.phone,
    poc_clinics_contacts.nr_reminders_sent,
    GREATEST(poc_clinics_contacts.last_message_received, poc_clinics_contacts.last_reminder_sent) AS last_interaction
   FROM poc_clinics_contacts
  WHERE
        CASE
            WHEN poc_clinics_contacts.nr_reminders_sent = 0 THEN GREATEST(poc_clinics_contacts.last_message_received, poc_clinics_contacts.last_reminder_sent) < (now() - '00:30:00'::interval)
            WHEN poc_clinics_contacts.nr_reminders_sent = 1 THEN GREATEST(poc_clinics_contacts.last_message_received, poc_clinics_contacts.last_reminder_sent) < (now() - '04:00:00'::interval)
            ELSE false
        END AND GREATEST(poc_clinics_contacts.last_message_received, poc_clinics_contacts.last_reminder_sent) > (now() - '24:00:00'::interval) AND (now() AT TIME ZONE 'America/Sao_Paulo'::text)::time without time zone > '09:00:00'::time without time zone AND (now() AT TIME ZONE 'America/Sao_Paulo'::text)::time without time zone < '21:00:00'::time without time zone AND poc_clinics_contacts.appointment_scheduled_on IS NULL AND poc_clinics_contacts.is_willing_to_schedule IS NOT FALSE AND poc_clinics_contacts.thread_id IS NOT NULL AND poc_clinics_contacts.needs_review IS FALSE AND poc_clinics_contacts.archived_on IS NULL;