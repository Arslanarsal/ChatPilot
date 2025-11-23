-- This is an empty migration.
create or replace trigger contact_audit_trigger
after insert or update or delete on contacts
for each row execute procedure contact_audit_log();