CREATE OR REPLACE FUNCTION contact_audit_log() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
DECLARE 
    k TEXT;
    v TEXT;
    j_new JSONB := to_jsonb(NEW);
    j_old JSONB := to_jsonb(OLD);
    record_id INTEGER;
    old_value TEXT;
    new_value TEXT;
BEGIN
    -- Determine the record_id
    IF TG_OP = 'INSERT' THEN 
        record_id := NEW.id;
    ELSIF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        record_id := OLD.id;
    END IF;

    -- INSERT action: Log only new values
    IF TG_OP = 'INSERT' THEN 
        FOR k, v IN SELECT * FROM jsonb_each_text(j_new) LOOP
            INSERT INTO audit_table (src_table, col_name, new_value, action, record_id, changed_at) 
            VALUES (TG_TABLE_NAME, k, v, TG_OP, record_id, current_timestamp);
        END LOOP;

    -- UPDATE action: Log old and new values, including NULL checks
    ELSIF TG_OP = 'UPDATE' THEN 
        FOR k, v IN SELECT * FROM jsonb_each_text(j_new) LOOP
            old_value := j_old ->> k;
            new_value := v;
            
            -- Insert into audit log if values are different or either is NULL
            IF (old_value IS DISTINCT FROM new_value) OR (old_value IS NULL AND new_value IS NOT NULL) OR (old_value IS NOT NULL AND new_value IS NULL) THEN
                INSERT INTO audit_table (src_table, col_name, new_value, old_value, action, record_id, changed_at) 
                VALUES (TG_TABLE_NAME, k, new_value, old_value, TG_OP, record_id, current_timestamp);
            END IF;
        END LOOP;

    -- DELETE action: Log only old values
    ELSIF TG_OP = 'DELETE' THEN 
        FOR k, v IN SELECT * FROM jsonb_each_text(j_old) LOOP
            INSERT INTO audit_table (src_table, col_name, old_value, action, record_id, changed_at) 
            VALUES (TG_TABLE_NAME, k, v, TG_OP, record_id, current_timestamp);
        END LOOP;
    END IF;

    RETURN NULL;
END;
$$;



