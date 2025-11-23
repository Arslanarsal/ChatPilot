-- This is an empty migration.

-- This is an empty migration.
CREATE OR REPLACE VIEW follow_ups AS
 SELECT contacts.id,
    contacts.name,
    contacts.thread_id,
    contacts.company_id,
    contacts.phone,
    contacts.nr_reminders_sent,
    GREATEST(contacts.last_message_received, contacts.last_reminder_sent) AS last_interaction
   FROM contacts
  WHERE
        CASE
            WHEN contacts.nr_reminders_sent = 0 THEN GREATEST(contacts.last_message_received, contacts.last_reminder_sent) < (now() - '00:30:00'::interval)
            WHEN contacts.nr_reminders_sent = 1 THEN GREATEST(contacts.last_message_received, contacts.last_reminder_sent) < (now() - '04:00:00'::interval)
            ELSE false
        END AND GREATEST(contacts.last_message_received, contacts.last_reminder_sent) > (now() - '24:00:00'::interval) AND (now() AT TIME ZONE 'America/Sao_Paulo'::text)::time without time zone > '09:00:00'::time without time zone AND (now() AT TIME ZONE 'America/Sao_Paulo'::text)::time without time zone < '21:00:00'::time without time zone AND contacts.schedule_event  IS NULL AND contacts.is_willing_to_schedule IS NOT FALSE AND contacts.thread_id IS NOT NULL AND contacts.needs_review IS FALSE AND contacts.archived_on IS NULL;