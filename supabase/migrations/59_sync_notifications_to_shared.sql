-- Migration 59: Mirror Sales Pipeline notifications to shared.product_notifications for Admin Panel

CREATE TABLE IF NOT EXISTS shared.product_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code text NOT NULL,
    title text NOT NULL,
    message text,
    type text DEFAULT 'info',
    employee_id integer,
    link text,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_notifications_user 
ON shared.product_notifications USING btree (employee_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_notifications_product 
ON shared.product_notifications USING btree (product_code, created_at DESC);

-- Trigger function to mirror every new notification to shared.product_notifications
CREATE OR REPLACE FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_employee_id integer := NULL;
BEGIN
    -- Look up employee_id in hr.employees from user_id (which is auth_user_id)
    IF NEW.user_id IS NOT NULL THEN
        SELECT id INTO v_employee_id
        FROM hr.employees
        WHERE auth_user_id = NEW.user_id
        LIMIT 1;
    END IF;

    -- Insert into shared.product_notifications
    INSERT INTO shared.product_notifications (
        product_code,
        title,
        message,
        type,
        employee_id,
        link,
        is_read,
        created_at,
        metadata
    ) VALUES (
        'sales_pipeline',
        NEW.title,
        NEW.title,
        COALESCE(NEW.type, 'info'),
        v_employee_id,
        NEW.link,
        COALESCE(NEW.is_read, false),
        COALESCE(NEW.created_at, now()),
        jsonb_build_object(
            'sales_notification_id', NEW.id,
            'sales_user_id', NEW.user_id,
            'type', NEW.type
        )
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'trg_sync_to_shared_product_notifications error: %', SQLERRM;
        RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_notifications_sync_to_shared ON "sales-pipe".notifications;

CREATE TRIGGER trg_notifications_sync_to_shared
AFTER INSERT ON "sales-pipe".notifications
FOR EACH ROW
EXECUTE FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications();

-- Trigger function to mirror read status updates to shared.product_notifications
CREATE OR REPLACE FUNCTION "sales-pipe".trg_sync_read_to_shared_product_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
    IF NEW.is_read IS DISTINCT FROM OLD.is_read AND NEW.is_read = true THEN
        UPDATE shared.product_notifications
        SET is_read = true,
            read_at = COALESCE(read_at, now())
        WHERE metadata->>'sales_notification_id' = NEW.id::text;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'trg_sync_read_to_shared_product_notifications error: %', SQLERRM;
        RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_notifications_sync_read_to_shared ON "sales-pipe".notifications;

CREATE TRIGGER trg_notifications_sync_read_to_shared
AFTER UPDATE OF is_read ON "sales-pipe".notifications
FOR EACH ROW
EXECUTE FUNCTION "sales-pipe".trg_sync_read_to_shared_product_notifications();

