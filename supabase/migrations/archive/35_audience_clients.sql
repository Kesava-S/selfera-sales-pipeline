-- ==============================================================================
-- 35_audience_clients.sql
-- Table: "sales-pipe".audience_clients
-- Configuration and DPA compliance status per client business
-- ==============================================================================

CREATE TABLE IF NOT EXISTS "sales-pipe".audience_clients (
    business_id uuid PRIMARY KEY REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE,
    dpa_signed_on date,
    sender_name text,
    reply_to text,
    updated_by uuid REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE "sales-pipe".audience_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audience_clients_read ON "sales-pipe".audience_clients;
CREATE POLICY audience_clients_read ON "sales-pipe".audience_clients
    FOR SELECT TO authenticated
    USING ("sales-pipe".get_user_role() IN ('admin', 'sales'));

REVOKE ALL ON "sales-pipe".audience_clients FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sales-pipe".audience_clients TO authenticated, service_role;

