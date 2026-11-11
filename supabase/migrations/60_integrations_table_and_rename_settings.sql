-- ==============================================================================
-- 60_integrations_table_and_rename_settings.sql
-- 1. Rename "sales-pipe".pipeline_settings to "sales-pipe".settings
-- 2. Update canonical_business_type to reference "sales-pipe".settings
-- 3. Drop "sales-pipe".pipeline_settings
-- 4. Create separate table "sales-pipe".integrations for communication channels
-- ==============================================================================

-- 1. Rename pipeline_settings -> settings
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sales-pipe' AND table_name = 'pipeline_settings' AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE "sales-pipe".pipeline_settings RENAME TO settings;
    END IF;
END $$;

-- Update Index & Policies on settings
ALTER INDEX IF EXISTS "sales-pipe".idx_pipeline_settings_key RENAME TO idx_settings_key;

DROP POLICY IF EXISTS "pipeline_settings_read" ON "sales-pipe".settings;
DROP POLICY IF EXISTS "pipeline_settings_admin_manage" ON "sales-pipe".settings;
DROP POLICY IF EXISTS "settings_read" ON "sales-pipe".settings;
CREATE POLICY "settings_read" ON "sales-pipe".settings
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "settings_admin_manage" ON "sales-pipe".settings;
CREATE POLICY "settings_admin_manage" ON "sales-pipe".settings
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

-- 2. Update canonical_business_type to reference "sales-pipe".settings
CREATE OR REPLACE FUNCTION "sales-pipe".canonical_business_type(p_type text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH t AS (SELECT lower(trim(coalesce(p_type, ''))) AS clean),
  cats AS (
    SELECT c.name, c.slug, c.synonyms, c.sort_order
    FROM "sales-pipe".business_categories c
    WHERE c.is_active
  )
  SELECT coalesce(
    -- Name, slug or a known spelling
    (SELECT cats.name FROM cats, t
     WHERE t.clean <> '' AND (lower(cats.name) = t.clean OR cats.slug = t.clean OR t.clean = ANY(cats.synonyms))
     ORDER BY cats.sort_order LIMIT 1),
    -- A known spelling as a whole word inside it ("The Crown Hotel & Spa")
    (SELECT cats.name FROM cats, t, unnest(cats.synonyms) AS w
     WHERE t.clean <> '' AND length(w) >= 3
       AND t.clean ~ ('\m' || regexp_replace(w, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M')
     ORDER BY length(w) DESC, cats.sort_order LIMIT 1),
    -- Nothing matched
    (SELECT s.value #>> '{}' FROM "sales-pipe".settings s WHERE s.key = 'default_business_category')
  )
$$;

-- 3. Drop pipeline_settings completely
DROP VIEW IF EXISTS "sales-pipe".pipeline_settings CASCADE;
DROP TABLE IF EXISTS "sales-pipe".pipeline_settings CASCADE;

-- 4. Create separate table "sales-pipe".integrations
CREATE TABLE IF NOT EXISTS "sales-pipe".integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel text NOT NULL UNIQUE,
    name text NOT NULL,
    provider text NOT NULL,
    status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
    account_info text,
    webhook_url text,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    details jsonb DEFAULT '[]'::jsonb,
    updated_by uuid REFERENCES "sales-pipe".profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_channel ON "sales-pipe".integrations(channel);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON "sales-pipe".integrations(status);

-- Enable RLS on integrations
ALTER TABLE "sales-pipe".integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integrations_read" ON "sales-pipe".integrations;
CREATE POLICY "integrations_read" ON "sales-pipe".integrations
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "integrations_admin_manage" ON "sales-pipe".integrations;
CREATE POLICY "integrations_admin_manage" ON "sales-pipe".integrations
    FOR ALL TO authenticated
    USING ("sales-pipe".get_user_role() = 'admin')
    WITH CHECK ("sales-pipe".get_user_role() = 'admin');

-- Seed the initial 5 integrations if not already present
INSERT INTO "sales-pipe".integrations (channel, name, provider, status, account_info, webhook_url, config, details)
VALUES
  (
    'whatsapp',
    'WhatsApp',
    'Meta Cloud API v21.0',
    'connected',
    '+44 7700 900001 (Selfera Official)',
    'https://sales.selfera.co.uk/api/whatsapp/webhook',
    '{"phone_number_id":"491823901238491","waba_id":"109283746591023","access_token":"EAAG9...k921m","verify_token":"selfera_wa_verify_2026"}'::jsonb,
    '[{"label":"Sender","value":"+44 7700 900001"},{"label":"Webhook","value":"Active (/api/whatsapp/webhook)"},{"label":"Quality","value":"High (Tier 1K/day)"}]'::jsonb
  ),
  (
    'email',
    'Email',
    'Resend & Custom SMTP',
    'connected',
    'outreach@selfera.co.uk',
    'https://sales.selfera.co.uk/api/email/webhook',
    '{"provider":"resend","resend_api_key":"re_9xK8...21mP","from_name":"Selfera Sales Team","from_email":"outreach@selfera.co.uk"}'::jsonb,
    '[{"label":"Active Route","value":"Resend API"},{"label":"Webhook","value":"Active (/api/email/webhook)"},{"label":"Deliverability","value":"DKIM & SPF Verified"}]'::jsonb
  ),
  (
    'instagram',
    'Instagram',
    'Meta Graph API (Direct Messages)',
    'connected',
    '@selfera.official (Linked to Selfera UK)',
    'https://sales.selfera.co.uk/api/instagram/webhook',
    '{"account_id":"178414053092841","username":"@selfera.official","connected_page":"Selfera UK"}'::jsonb,
    '[{"label":"Handle","value":"@selfera.official"},{"label":"Linked Page","value":"Selfera UK"},{"label":"DMs Sync","value":"Active (2-Way)"}]'::jsonb
  ),
  (
    'facebook',
    'Facebook',
    'Meta Pages & Messenger Platform',
    'connected',
    'Selfera UK (Page ID: 102938475610293)',
    'https://sales.selfera.co.uk/api/facebook/webhook',
    '{"page_name":"Selfera UK","page_id":"102938475610293"}'::jsonb,
    '[{"label":"Page","value":"Selfera UK"},{"label":"Page ID","value":"102938475610293"},{"label":"Messenger","value":"Active"}]'::jsonb
  ),
  (
    'linkedin',
    'LinkedIn',
    'LinkedIn Messaging API',
    'disconnected',
    'Not configured',
    NULL,
    '{}'::jsonb,
    '[{"label":"App ID","value":"Not set"},{"label":"Scope","value":"r_compliance, w_member_social"},{"label":"InMail","value":"Disconnected"}]'::jsonb
  )
ON CONFLICT (channel) DO NOTHING;
