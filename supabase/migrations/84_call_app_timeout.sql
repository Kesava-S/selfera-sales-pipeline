-- ==============================================================================
-- 84_call_app_timeout.sql
-- Scheduled jobs that call the app (call_app) waited only pg_net's default
-- 5 seconds, so slower runs (email sync, cold starts) were cut off. Wait 55 seconds.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

CREATE OR REPLACE FUNCTION "sales-pipe".call_app(p_path text, p_body jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_url text;
    v_secret text;
BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'sales_app_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'sales_cron_secret';
    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE WARNING 'call_app: set the Vault secrets sales_app_url and sales_cron_secret';
        RETURN NULL;
    END IF;
    RETURN net.http_post(
        url := rtrim(v_url, '/') || p_path,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
        body := p_body,
        timeout_milliseconds := 55000
    );
END;
$function$;
REVOKE ALL ON FUNCTION "sales-pipe".call_app(p_path text, p_body jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "sales-pipe".call_app(p_path text, p_body jsonb) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
