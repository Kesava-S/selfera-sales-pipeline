-- ==============================================================================
-- 62_meta_templates_ours_and_variables.sql
-- WhatsApp Meta templates now live inside Templates → WhatsApp.
--  * managed:      only templates this product created or added on purpose. The
--                  Meta account is shared with other products, whose templates are
--                  never stored or used here.
--  * variable_map: what fills each {{n}} when sending, per lead:
--                  {"body": ["contact_name", "business_name"], "header": "business_name"}
--                  Keys: contact_name, business_name, area, sender_name, message.
-- ==============================================================================

SET search_path TO "sales-pipe", public;

BEGIN;

ALTER TABLE "sales-pipe".meta_templates
    ADD COLUMN IF NOT EXISTS managed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS variable_map jsonb NOT NULL DEFAULT '{"body": []}'::jsonb;

-- Ours today: the default template, and any template an outreach template or campaign already uses.
-- Until a map is set they keep the old behaviour: the whole message goes into {{1}}.
UPDATE "sales-pipe".meta_templates m
SET managed = true,
    variable_map = jsonb_build_object('body', CASE WHEN m.components::text LIKE '%{{1}}%' THEN '["message"]'::jsonb ELSE '[]'::jsonb END)
WHERE m.name = 'selfera_sales_pipeline_general'
   OR m.name LIKE 'selfera\_%'
   OR m.name IN (SELECT whatsapp_template_name FROM "sales-pipe".templates WHERE whatsapp_template_name IS NOT NULL)
   OR m.name IN (SELECT template_name FROM "sales-pipe".whatsapp_campaigns WHERE template_name IS NOT NULL);

-- Other products' templates copied by the first sync
DELETE FROM "sales-pipe".meta_templates WHERE NOT managed;

CREATE INDEX IF NOT EXISTS idx_meta_templates_name ON "sales-pipe".meta_templates (name);

COMMIT;

NOTIFY pgrst, 'reload schema';
