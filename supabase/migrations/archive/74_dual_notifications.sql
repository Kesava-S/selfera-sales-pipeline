-- ==============================================================================
-- 74_dual_notifications.sql
-- Two places for every notification, by who the user is:
--   * Local (sales-pipe.notifications): everyone, shown in the bell and the
--     Notifications page.
--   * Admin Panel (shared.product_notifications, product 'sales_pipeline'): an
--     extra copy only for users who are Admin Panel members with Sales Pipeline
--     access (hr.employees + user_product_access). Sales Direct users get the
--     local one only. Never sent with employee_id NULL (that means "all admins").
--
-- Fixes:
--   * the bell and page read notifications.message, which didn't exist, so they
--     showed nothing: the column is added.
--   * migration 59's mirror wrote a "link" column that shared.product_notifications
--     doesn't have, so every copy failed silently: the link now goes in metadata,
--     as the other products do.
-- Marking read locally still marks the Admin Panel copy read (migration 59).
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe".notifications ADD COLUMN IF NOT EXISTS message text;

CREATE OR REPLACE FUNCTION "sales-pipe".trg_sync_to_shared_product_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = "sales-pipe", public
AS $$
DECLARE
    v_employee_id integer;
    v_role text;
BEGIN
    IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

    -- Admin Panel members with Sales Pipeline access only
    SELECT e.id INTO v_employee_id
    FROM hr.employees e
    JOIN public.user_product_access upa ON upa.employee_id = e.id
    JOIN public.products p ON p.product_id = upa.product_id AND p.code = 'sales_pipeline'
    WHERE e.auth_user_id = NEW.user_id
    LIMIT 1;
    IF v_employee_id IS NULL THEN RETURN NEW; END IF;

    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = NEW.user_id;

    INSERT INTO shared.product_notifications (product_code, title, message, type, employee_id, is_read, created_at, metadata)
    VALUES (
        'sales_pipeline',
        CASE NEW.type
            WHEN 'new_reply' THEN 'New reply'
            WHEN 'assigned_to_you' THEN 'Assigned to you'
            WHEN 'needs_consultant' THEN 'Needs a consultant'
            WHEN 'upsell_due' THEN 'Upsell due'
            WHEN 'unsubscribed' THEN 'Opted out'
            WHEN 'booking_matched' THEN 'Booking matched'
            WHEN 'booking_unmatched' THEN 'Booking not matched'
            ELSE 'Sales Pipeline'
        END,
        coalesce(nullif(NEW.message, ''), NEW.title),
        CASE WHEN NEW.type IN ('assigned_to_you', 'needs_consultant') THEN 'action_required'
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
        -- Never block the local notification
        RAISE WARNING 'trg_sync_to_shared_product_notifications error: %', SQLERRM;
        RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
