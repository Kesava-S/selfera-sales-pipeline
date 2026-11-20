-- ==============================================================================
-- 86_product_notifications_title_product_name.sql
-- Set title as product name ('Sales Pipeline') for shared.product_notifications.
-- Preserves full notification details (business name, context) in message.
-- Backfills existing sales_pipeline notifications in shared.product_notifications.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

CREATE OR REPLACE FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_employee_id integer;
    v_product_name text;
    v_role text;
    v_message text;
BEGIN
    IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
    SELECT e.id, p.name INTO v_employee_id, v_product_name
    FROM hr.employees e
    JOIN public.user_product_access upa ON upa.employee_id = e.id
    JOIN public.products p ON p.product_id = upa.product_id AND p.code = 'sales_pipeline'
    WHERE e.auth_user_id = NEW.user_id
    LIMIT 1;
    IF v_employee_id IS NULL THEN RETURN NEW; END IF;
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = NEW.user_id;

    -- Combine title and message if both present and different to preserve full details
    IF nullif(NEW.message, '') IS NOT NULL AND nullif(NEW.title, '') IS NOT NULL AND NEW.message <> NEW.title THEN
        v_message := NEW.title || ' - ' || NEW.message;
    ELSE
        v_message := coalesce(nullif(NEW.title, ''), nullif(NEW.message, ''), 'Sales notification');
    END IF;

    INSERT INTO shared.product_notifications (
        product_code,
        title,
        message,
        type,
        employee_id,
        is_read,
        created_at,
        metadata
    ) VALUES (
        'sales_pipeline',
        coalesce(v_product_name, 'Sales Pipeline'),
        v_message,
        CASE WHEN NEW.type IN ('assigned_to_you', 'needs_consultant', 'reply_waiting') THEN 'action_required'
             WHEN NEW.type IN ('unsubscribed', 'booking_unmatched') THEN 'warning'
             ELSE 'info' END,
        v_employee_id,
        coalesce(NEW.is_read, false),
        coalesce(NEW.created_at, now()),
        jsonb_build_object(
            'link', NEW.link,
            'channel', 'in_app',
            'sales_notification_id', NEW.id,
            'sales_user_id', NEW.user_id,
            'sales_type', NEW.type,
            'role', v_role
        )
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'trg_sync_to_shared_product_notifications error: %', SQLERRM;
        RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications() TO service_role;
REVOKE EXECUTE ON FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications() FROM anon;

-- Backfill existing shared.product_notifications rows for sales_pipeline
UPDATE shared.product_notifications spn
SET 
    title = 'Sales Pipeline',
    message = CASE 
        WHEN n.id IS NOT NULL AND nullif(n.message, '') IS NOT NULL AND nullif(n.title, '') IS NOT NULL AND n.message <> n.title 
            THEN n.title || ' - ' || n.message
        WHEN n.id IS NOT NULL 
            THEN coalesce(nullif(n.title, ''), nullif(n.message, ''), spn.message)
        ELSE spn.message
    END
FROM "sales-pipe".notifications n
WHERE spn.product_code = 'sales_pipeline'
  AND (spn.metadata->>'sales_notification_id')::uuid = n.id;

UPDATE shared.product_notifications
SET title = 'Sales Pipeline'
WHERE product_code = 'sales_pipeline' AND title <> 'Sales Pipeline';

COMMIT;

NOTIFY pgrst, 'reload schema';
