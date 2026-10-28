-- ==============================================================================
-- Structure sync: makes the "sales-pipe" schema match dev.
-- Generated 2026-10-28T12:05:36.112Z from the live dev database.
-- Structure only: no rows are added, changed or removed. Rules that existing
-- rows break are added as NOT VALID (checked for new rows only).
-- ==============================================================================

SET check_function_bodies = off;
SET search_path TO "sales-pipe", public;

-- ----------------------------------------------------------------------------
-- Sequences
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS "sales-pipe"."leads_code_seq" AS bigint START 1 INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807;

-- ----------------------------------------------------------------------------
-- New tables (17)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sales-pipe"."audience_clients" (
    "business_id" uuid NOT NULL,
    "dpa_signed_on" date,
    "sender_name" text,
    "reply_to" text,
    "updated_by" uuid,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."business_categories" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "icon_name" text DEFAULT 'Building2'::text,
    "description" text,
    "synonyms" text[] DEFAULT '{}'::text[],
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "category_group" text
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."campaign_recipients" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "campaign_id" uuid,
    "business_id" uuid,
    "email" text,
    "status" text DEFAULT 'queued'::text NOT NULL,
    "sent_at" timestamp with time zone,
    "error_detail" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "channel" text DEFAULT 'email'::text NOT NULL,
    "whatsapp_campaign_id" uuid,
    "phone" text,
    "business_name" text,
    "contact_name" text,
    "attempts" integer DEFAULT 0 NOT NULL,
    "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
    "locked_at" timestamp with time zone,
    "external_message_id" text,
    "simulated" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "delivery_status" text,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "replied_at" timestamp with time zone,
    "customer_lead_id" uuid,
    "opted_out_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."campaign_replies" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "channel" text NOT NULL,
    "from_address" text NOT NULL,
    "subject" text,
    "body" text NOT NULL,
    "external_message_id" text,
    "received_at" timestamp with time zone DEFAULT now() NOT NULL,
    "recipient_id" uuid,
    "campaign_id" uuid,
    "whatsapp_campaign_id" uuid,
    "business_id" uuid,
    "opportunity_id" uuid,
    "thread_id" uuid,
    "status" text DEFAULT 'new'::text NOT NULL,
    "handled_by" uuid,
    "handled_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."customer_import_batches" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "business_id" uuid NOT NULL,
    "file_name" text,
    "created_count" integer DEFAULT 0 NOT NULL,
    "updated_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "created_by" uuid DEFAULT auth.uid(),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" uuid
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."customer_leads" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "business_id" uuid NOT NULL,
    "country" text DEFAULT 'UK'::text NOT NULL,
    "first_name" text,
    "last_name" text,
    "email" text,
    "phone" text,
    "phone_e164" text,
    "phone_type" text,
    "phone2" text,
    "phone2_e164" text,
    "phone2_type" text,
    "whatsapp_status" text DEFAULT 'unknown'::text NOT NULL,
    "town" text,
    "postcode" text,
    "last_purchase_on" date,
    "purchased" text,
    "birthday_month" smallint,
    "tags" text[] DEFAULT '{}'::text[] NOT NULL,
    "notes" text,
    "consent_confirmed" boolean DEFAULT false NOT NULL,
    "consent_confirmed_by" uuid,
    "consent_confirmed_at" timestamp with time zone,
    "do_not_contact" boolean DEFAULT false NOT NULL,
    "do_not_contact_reason" text,
    "do_not_contact_at" timestamp with time zone,
    "source" text DEFAULT 'form'::text NOT NULL,
    "import_batch_id" uuid,
    "created_by" uuid DEFAULT auth.uid(),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "is_ready" boolean GENERATED ALWAYS AS (((COALESCE(btrim(first_name), ''::text) <> ''::text) AND consent_confirmed AND ((email IS NOT NULL) OR (COALESCE(phone_type, ''::text) = ANY (ARRAY['mobile'::text, 'landline'::text, 'mobile_or_landline'::text])) OR (COALESCE(phone2_type, ''::text) = ANY (ARRAY['mobile'::text, 'landline'::text, 'mobile_or_landline'::text]))))) STORED NOT NULL
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."email_campaigns" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "subject" text NOT NULL,
    "preheader" text,
    "body" text NOT NULL,
    "service" text DEFAULT 'General'::text,
    "target_category" text DEFAULT 'All'::text,
    "target_stage" text DEFAULT 'All'::text,
    "status" text DEFAULT 'draft'::text,
    "recipient_count" integer DEFAULT 0,
    "recipients" jsonb DEFAULT '[]'::jsonb,
    "sent_at" timestamp with time zone,
    "scheduled_at" timestamp with time zone,
    "created_by" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "database_id" uuid,
    "database_name" text,
    "audience_business_id" uuid,
    "audience_filter" jsonb
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."email_databases" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "contacts" jsonb DEFAULT '[]'::jsonb,
    "contact_count" integer DEFAULT 0,
    "created_by" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."import_batches" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "file_name" text NOT NULL,
    "uploaded_by" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "total_rows" integer DEFAULT 0,
    "ready_count" integer DEFAULT 0,
    "missing_count" integer DEFAULT 0,
    "failed_count" integer DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."opt_outs" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "identifier" text NOT NULL,
    "channel" text DEFAULT 'All'::text NOT NULL,
    "reason" text,
    "source" text DEFAULT 'inbound'::text,
    "created_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."outreach_platforms" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "is_direct_send" boolean DEFAULT false,
    "daily_limit" integer DEFAULT 100,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."pipeline_settings" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "key" text NOT NULL,
    "value" jsonb NOT NULL,
    "description" text,
    "updated_by" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."services" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "code" text NOT NULL,
    "description" text,
    "price_range" text,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."tasks" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "opportunity_id" uuid,
    "business_id" uuid,
    "assigned_to" uuid,
    "title" text NOT NULL,
    "description" text,
    "due_at" timestamp with time zone,
    "status" text DEFAULT 'pending'::text NOT NULL,
    "priority" text DEFAULT 'normal'::text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."webhook_events" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "source" text NOT NULL,
    "event_type" text NOT NULL,
    "payload" jsonb NOT NULL,
    "status" text DEFAULT 'pending'::text NOT NULL,
    "error_message" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "processed_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."whatsapp_campaigns" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "message" text NOT NULL,
    "template_name" text,
    "service" text DEFAULT 'General'::text,
    "database_id" uuid,
    "database_name" text,
    "status" text DEFAULT 'draft'::text,
    "recipient_count" integer DEFAULT 0,
    "recipients" jsonb DEFAULT '[]'::jsonb,
    "sent_at" timestamp with time zone,
    "scheduled_at" timestamp with time zone,
    "created_by" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "audience_business_id" uuid,
    "audience_filter" jsonb
);
CREATE TABLE IF NOT EXISTS "sales-pipe"."whatsapp_databases" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "contacts" jsonb DEFAULT '[]'::jsonb,
    "contact_count" integer DEFAULT 0,
    "created_by" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- New columns on existing tables (18)
-- ----------------------------------------------------------------------------
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "owner_contact" text;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "gaps_found" text;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "has_no_website" boolean DEFAULT false;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "linkedin" text;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "owner_email" text;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "tech_partner_type" text;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "tech_partner_name" text;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "branches" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "source" text;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "import_batch_id" uuid;
ALTER TABLE "sales-pipe"."businesses" ADD COLUMN IF NOT EXISTS "problems" text[] DEFAULT '{}'::text[];
ALTER TABLE "sales-pipe"."messages" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;
ALTER TABLE "sales-pipe"."messages" ADD COLUMN IF NOT EXISTS "read_at" timestamp with time zone;
ALTER TABLE "sales-pipe"."messages" ADD COLUMN IF NOT EXISTS "opened_at" timestamp with time zone;
ALTER TABLE "sales-pipe"."messages" ADD COLUMN IF NOT EXISTS "clicked_at" timestamp with time zone;
ALTER TABLE "sales-pipe"."opportunities" ADD COLUMN IF NOT EXISTS "replied_after_close_at" timestamp with time zone;
ALTER TABLE "sales-pipe"."threads" ADD COLUMN IF NOT EXISTS "round" integer DEFAULT 1 NOT NULL;
ALTER TABLE "sales-pipe"."threads" ADD COLUMN IF NOT EXISTS "round_started_at" timestamp with time zone;

-- ----------------------------------------------------------------------------
-- Constraints (87 statements)
-- ----------------------------------------------------------------------------
ALTER TABLE "sales-pipe"."audience_clients" ADD CONSTRAINT "audience_clients_pkey" PRIMARY KEY (business_id);
ALTER TABLE "sales-pipe"."business_categories" ADD CONSTRAINT "business_categories_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."campaign_recipients" ADD CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."customer_import_batches" ADD CONSTRAINT "customer_import_batches_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."email_campaigns" ADD CONSTRAINT "email_campaigns_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."email_databases" ADD CONSTRAINT "email_databases_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."import_batches" ADD CONSTRAINT "import_batches_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."opt_outs" ADD CONSTRAINT "opt_outs_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."outreach_platforms" ADD CONSTRAINT "outreach_platforms_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."pipeline_settings" ADD CONSTRAINT "pipeline_settings_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."services" ADD CONSTRAINT "services_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."tasks" ADD CONSTRAINT "tasks_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."webhook_events" ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."whatsapp_databases" ADD CONSTRAINT "whatsapp_databases_pkey" PRIMARY KEY (id);
ALTER TABLE "sales-pipe"."business_categories" ADD CONSTRAINT "business_categories_name_key" UNIQUE (name);
ALTER TABLE "sales-pipe"."business_categories" ADD CONSTRAINT "business_categories_slug_key" UNIQUE (slug);
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_external_message_id_key" UNIQUE (external_message_id);
ALTER TABLE "sales-pipe"."outreach_platforms" ADD CONSTRAINT "outreach_platforms_name_key" UNIQUE (name);
ALTER TABLE "sales-pipe"."outreach_platforms" ADD CONSTRAINT "outreach_platforms_slug_key" UNIQUE (slug);
ALTER TABLE "sales-pipe"."pipeline_settings" ADD CONSTRAINT "pipeline_settings_key_key" UNIQUE (key);
ALTER TABLE "sales-pipe"."services" ADD CONSTRAINT "services_code_key" UNIQUE (code);
ALTER TABLE "sales-pipe"."services" ADD CONSTRAINT "services_name_key" UNIQUE (name);
ALTER TABLE "sales-pipe"."audience_clients" ADD CONSTRAINT "audience_clients_reply_to_check" CHECK (((reply_to IS NULL) OR (reply_to ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)));
ALTER TABLE "sales-pipe"."businesses" ADD CONSTRAINT "businesses_tech_partner_type_check" CHECK (((tech_partner_type IS NULL) OR (tech_partner_type = ANY (ARRAY['Agency'::text, 'DIY'::text, 'None'::text])))) NOT VALID;
DO $v$ BEGIN ALTER TABLE "sales-pipe"."businesses" VALIDATE CONSTRAINT "businesses_tech_partner_type_check"; EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE NOTICE 'Kept as NOT VALID (existing rows break it): %', 'businesses.businesses_tech_partner_type_check'; END $v$;
ALTER TABLE "sales-pipe"."campaign_recipients" ADD CONSTRAINT "campaign_recipients_channel_check" CHECK ((channel = ANY (ARRAY['email'::text, 'whatsapp'::text])));
ALTER TABLE "sales-pipe"."campaign_recipients" ADD CONSTRAINT "campaign_recipients_delivery_status_check" CHECK (((delivery_status IS NULL) OR (delivery_status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'bounced'::text, 'complained'::text]))));
ALTER TABLE "sales-pipe"."campaign_recipients" ADD CONSTRAINT "campaign_recipients_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE "sales-pipe"."campaign_recipients" ADD CONSTRAINT "campaign_recipients_target_check" CHECK ((((channel = 'email'::text) AND (campaign_id IS NOT NULL) AND (whatsapp_campaign_id IS NULL) AND (email IS NOT NULL)) OR ((channel = 'whatsapp'::text) AND (whatsapp_campaign_id IS NOT NULL) AND (campaign_id IS NULL) AND (phone IS NOT NULL))));
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_channel_check" CHECK ((channel = ANY (ARRAY['email'::text, 'whatsapp'::text])));
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'in_leads'::text, 'dismissed'::text])));
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_birthday_month_check" CHECK (((birthday_month IS NULL) OR ((birthday_month >= 1) AND (birthday_month <= 12))));
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_country_check" CHECK ((country = ANY (ARRAY['UK'::text, 'India'::text])));
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_email_check" CHECK (((email IS NULL) OR (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)));
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_has_identity" CHECK (((COALESCE(btrim(first_name), ''::text) <> ''::text) OR (email IS NOT NULL) OR (phone IS NOT NULL) OR (phone2 IS NOT NULL)));
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_phone2_type_check" CHECK (((phone2_type IS NULL) OR (phone2_type = ANY (ARRAY['mobile'::text, 'landline'::text, 'mobile_or_landline'::text, 'other'::text, 'invalid'::text]))));
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_phone_type_check" CHECK (((phone_type IS NULL) OR (phone_type = ANY (ARRAY['mobile'::text, 'landline'::text, 'mobile_or_landline'::text, 'other'::text, 'invalid'::text]))));
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_source_check" CHECK ((source = ANY (ARRAY['form'::text, 'csv'::text])));
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_whatsapp_status_check" CHECK ((whatsapp_status = ANY (ARRAY['unknown'::text, 'likely'::text, 'confirmed'::text, 'not_on_whatsapp'::text, 'no_mobile'::text])));
ALTER TABLE "sales-pipe"."email_campaigns" ADD CONSTRAINT "email_campaigns_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'archived'::text])));
ALTER TABLE "sales-pipe"."messages" DROP CONSTRAINT "messages_delivery_status_check";
ALTER TABLE "sales-pipe"."messages" ADD CONSTRAINT "messages_delivery_status_check" CHECK ((delivery_status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'bounced'::text, 'complained'::text]))) NOT VALID;
DO $v$ BEGIN ALTER TABLE "sales-pipe"."messages" VALIDATE CONSTRAINT "messages_delivery_status_check"; EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE NOTICE 'Kept as NOT VALID (existing rows break it): %', 'messages.messages_delivery_status_check'; END $v$;
ALTER TABLE "sales-pipe"."notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "sales-pipe"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ((type = ANY (ARRAY['new_reply'::text, 'booking_matched'::text, 'booking_unmatched'::text, 'needs_consultant'::text, 'assigned_to_you'::text, 'upsell_due'::text, 'unsubscribed'::text]))) NOT VALID;
DO $v$ BEGIN ALTER TABLE "sales-pipe"."notifications" VALIDATE CONSTRAINT "notifications_type_check"; EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE NOTICE 'Kept as NOT VALID (existing rows break it): %', 'notifications.notifications_type_check'; END $v$;
ALTER TABLE "sales-pipe"."templates" DROP CONSTRAINT "templates_platform_check";
ALTER TABLE "sales-pipe"."templates" ADD CONSTRAINT "templates_platform_check" CHECK ((platform = ANY (ARRAY['All'::text, 'WhatsApp'::text, 'Instagram'::text, 'Facebook'::text, 'Email'::text, 'LinkedIn'::text]))) NOT VALID;
DO $v$ BEGIN ALTER TABLE "sales-pipe"."templates" VALIDATE CONSTRAINT "templates_platform_check"; EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE NOTICE 'Kept as NOT VALID (existing rows break it): %', 'templates.templates_platform_check'; END $v$;
ALTER TABLE "sales-pipe"."threads" DROP CONSTRAINT "threads_platform_check";
ALTER TABLE "sales-pipe"."threads" ADD CONSTRAINT "threads_platform_check" CHECK ((platform = ANY (ARRAY['WhatsApp'::text, 'Instagram'::text, 'Facebook'::text, 'Email'::text, 'LinkedIn'::text]))) NOT VALID;
DO $v$ BEGIN ALTER TABLE "sales-pipe"."threads" VALIDATE CONSTRAINT "threads_platform_check"; EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE NOTICE 'Kept as NOT VALID (existing rows break it): %', 'threads.threads_platform_check'; END $v$;
ALTER TABLE "sales-pipe"."whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'archived'::text])));
ALTER TABLE "sales-pipe"."audience_clients" ADD CONSTRAINT "audience_clients_business_id_fkey" FOREIGN KEY (business_id) REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE;
ALTER TABLE "sales-pipe"."audience_clients" ADD CONSTRAINT "audience_clients_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."businesses" ADD CONSTRAINT "businesses_import_batch_id_fkey" FOREIGN KEY (import_batch_id) REFERENCES "sales-pipe".import_batches(id) ON DELETE SET NULL NOT VALID;
DO $v$ BEGIN ALTER TABLE "sales-pipe"."businesses" VALIDATE CONSTRAINT "businesses_import_batch_id_fkey"; EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE NOTICE 'Kept as NOT VALID (existing rows break it): %', 'businesses.businesses_import_batch_id_fkey'; END $v$;
ALTER TABLE "sales-pipe"."campaign_recipients" ADD CONSTRAINT "campaign_recipients_business_id_fkey" FOREIGN KEY (business_id) REFERENCES "sales-pipe".businesses(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES "sales-pipe".email_campaigns(id) ON DELETE CASCADE;
ALTER TABLE "sales-pipe"."campaign_recipients" ADD CONSTRAINT "campaign_recipients_customer_lead_id_fkey" FOREIGN KEY (customer_lead_id) REFERENCES "sales-pipe".customer_leads(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."campaign_recipients" ADD CONSTRAINT "campaign_recipients_whatsapp_campaign_id_fkey" FOREIGN KEY (whatsapp_campaign_id) REFERENCES "sales-pipe".whatsapp_campaigns(id) ON DELETE CASCADE;
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_business_id_fkey" FOREIGN KEY (business_id) REFERENCES "sales-pipe".businesses(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES "sales-pipe".email_campaigns(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_handled_by_fkey" FOREIGN KEY (handled_by) REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES "sales-pipe".opportunities(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES "sales-pipe".campaign_recipients(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES "sales-pipe".threads(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."campaign_replies" ADD CONSTRAINT "campaign_replies_whatsapp_campaign_id_fkey" FOREIGN KEY (whatsapp_campaign_id) REFERENCES "sales-pipe".whatsapp_campaigns(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."customer_import_batches" ADD CONSTRAINT "customer_import_batches_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."customer_import_batches" ADD CONSTRAINT "customer_import_batches_business_id_fkey" FOREIGN KEY (business_id) REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE;
ALTER TABLE "sales-pipe"."customer_import_batches" ADD CONSTRAINT "customer_import_batches_created_by_fkey" FOREIGN KEY (created_by) REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_business_id_fkey" FOREIGN KEY (business_id) REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE;
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_consent_confirmed_by_fkey" FOREIGN KEY (consent_confirmed_by) REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_created_by_fkey" FOREIGN KEY (created_by) REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."customer_leads" ADD CONSTRAINT "customer_leads_import_batch_id_fkey" FOREIGN KEY (import_batch_id) REFERENCES "sales-pipe".customer_import_batches(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."email_campaigns" ADD CONSTRAINT "email_campaigns_audience_business_id_fkey" FOREIGN KEY (audience_business_id) REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE;
ALTER TABLE "sales-pipe"."email_campaigns" ADD CONSTRAINT "email_campaigns_database_id_fkey" FOREIGN KEY (database_id) REFERENCES "sales-pipe".email_databases(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."import_batches" ADD CONSTRAINT "import_batches_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES "sales-pipe".profiles(id);
ALTER TABLE "sales-pipe"."pipeline_settings" ADD CONSTRAINT "pipeline_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES "sales-pipe".profiles(id);
ALTER TABLE "sales-pipe"."tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES "sales-pipe".profiles(id) ON DELETE SET NULL;
ALTER TABLE "sales-pipe"."tasks" ADD CONSTRAINT "tasks_business_id_fkey" FOREIGN KEY (business_id) REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE;
ALTER TABLE "sales-pipe"."tasks" ADD CONSTRAINT "tasks_opportunity_id_fkey" FOREIGN KEY (opportunity_id) REFERENCES "sales-pipe".opportunities(id) ON DELETE CASCADE;
ALTER TABLE "sales-pipe"."whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_audience_business_id_fkey" FOREIGN KEY (audience_business_id) REFERENCES "sales-pipe".businesses(id) ON DELETE CASCADE;
ALTER TABLE "sales-pipe"."whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_database_id_fkey" FOREIGN KEY (database_id) REFERENCES "sales-pipe".whatsapp_databases(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- Indexes (27)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_businesses_batch ON "sales-pipe".businesses USING btree (import_batch_id);
CREATE INDEX IF NOT EXISTS idx_businesses_problems ON "sales-pipe".businesses USING gin (problems);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_business ON "sales-pipe".campaign_recipients USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_cid ON "sales-pipe".campaign_recipients USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_customer ON "sales-pipe".campaign_recipients USING btree (customer_lead_id, created_at DESC) WHERE (customer_lead_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_due ON "sales-pipe".campaign_recipients USING btree (next_attempt_at) WHERE (status = 'queued'::text);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_email_norm ON "sales-pipe".campaign_recipients USING btree (lower(email)) WHERE (email IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_external ON "sales-pipe".campaign_recipients USING btree (external_message_id) WHERE (external_message_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_phone_norm ON "sales-pipe".campaign_recipients USING btree ("sales-pipe".normalise_phone(phone)) WHERE (phone IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_wa_cid ON "sales-pipe".campaign_recipients USING btree (whatsapp_campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_campaign ON "sales-pipe".campaign_replies USING btree (campaign_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_status ON "sales-pipe".campaign_replies USING btree (status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_wa_campaign ON "sales-pipe".campaign_replies USING btree (whatsapp_campaign_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_leads_batch ON "sales-pipe".customer_leads USING btree (import_batch_id);
CREATE INDEX IF NOT EXISTS idx_customer_leads_business ON "sales-pipe".customer_leads USING btree (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_audience ON "sales-pipe".email_campaigns USING btree (audience_business_id) WHERE (audience_business_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_opt_outs_identifier ON "sales-pipe".opt_outs USING btree (identifier);
CREATE INDEX IF NOT EXISTS idx_opt_outs_identifier_lower ON "sales-pipe".opt_outs USING btree (lower(identifier));
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON "sales-pipe".tasks USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_opp ON "sales-pipe".tasks USING btree (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON "sales-pipe".tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON "sales-pipe".webhook_events USING btree (status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_audience ON "sales-pipe".whatsapp_campaigns USING btree (audience_business_id) WHERE (audience_business_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipients_email ON "sales-pipe".campaign_recipients USING btree (campaign_id, lower(email)) WHERE (channel = 'email'::text);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipients_phone ON "sales-pipe".campaign_recipients USING btree (whatsapp_campaign_id, regexp_replace(phone, '\D'::text, ''::text, 'g'::text)) WHERE (channel = 'whatsapp'::text);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_leads_email ON "sales-pipe".customer_leads USING btree (business_id, lower(email)) WHERE (email IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_leads_phone ON "sales-pipe".customer_leads USING btree (business_id, phone_e164) WHERE (phone_e164 IS NOT NULL);

-- ----------------------------------------------------------------------------
-- Functions (78 statements)
-- ----------------------------------------------------------------------------
-- Kept for now: production (old code) still copies imports here through this function.
-- Drop it when production is synced:
-- DROP FUNCTION IF EXISTS "sales-pipe"."import_businesses"(p_rows jsonb);
CREATE OR REPLACE FUNCTION "sales-pipe".add_pitch(p_business_id uuid, p_services text[], p_demo_link text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
    INSERT INTO "sales-pipe".opportunities (business_id, services_pitched, stage, demo_link)
    VALUES (p_business_id, p_services, 'Needs review', p_demo_link)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".approve_customer_import(p_batch_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    b record;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    UPDATE "sales-pipe".customer_import_batches SET approved_at = now(), approved_by = auth.uid()
    WHERE id = p_batch_id AND approved_at IS NULL RETURNING * INTO b;
    IF b.id IS NULL THEN RAISE EXCEPTION 'This import was not found or is already approved'; END IF;
    PERFORM "sales-pipe".audience_log('audience_import_approved', b.business_id,
        jsonb_build_object('batch_id', b.id, 'file_name', b.file_name, 'customers', (SELECT count(*) FROM "sales-pipe".customer_leads WHERE import_batch_id = b.id)));
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".approve_import(p_business_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    b record;
    opp record;
    platforms text[];
    p text;
    approved uuid[] := '{}';
    t record;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    -- Refuse any lead whose problems is not empty
    FOR b IN SELECT id, business_name, problems FROM "sales-pipe".businesses WHERE id = ANY(p_business_ids) AND NOT archived LOOP
        IF array_length(b.problems, 1) > 0 THEN
            RAISE EXCEPTION 'Fix missing data first for %', b.business_name;
        END IF;
    END LOOP;

    FOR b IN SELECT * FROM "sales-pipe".businesses WHERE id = ANY(p_business_ids) AND NOT archived LOOP
        FOR opp IN SELECT * FROM "sales-pipe".opportunities WHERE business_id = b.id AND stage = 'Needs review' LOOP
            PERFORM "sales-pipe".check_opp_access(opp.id);

            platforms := '{}';
            IF b.email IS NOT NULL THEN platforms := array_append(platforms, 'Email'); END IF;
            IF coalesce(b.whatsapp_number, '') <> '' THEN
                platforms := array_append(platforms, 'WhatsApp');
            END IF;
            IF b.instagram IS NOT NULL THEN platforms := array_append(platforms, 'Instagram'); END IF;
            IF b.facebook IS NOT NULL THEN platforms := array_append(platforms, 'Facebook'); END IF;
            IF b.linkedin IS NOT NULL THEN platforms := array_append(platforms, 'LinkedIn'); END IF;

            -- Default to WhatsApp or Email if any
            IF array_length(platforms, 1) IS NULL THEN
                platforms := ARRAY['Email'];
            END IF;

            FOREACH p IN ARRAY platforms LOOP
                INSERT INTO "sales-pipe".threads (opportunity_id, platform, status, step, next_due_on)
                VALUES (opp.id, p, 'Not contacted', 0, CURRENT_DATE)
                ON CONFLICT (opportunity_id, platform) DO NOTHING;
            END LOOP;

            UPDATE "sales-pipe".opportunities SET stage = 'Active' WHERE id = opp.id;
            INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason, changed_by)
            VALUES (opp.id, 'Needs review', 'Active', 'Approved from review queue', auth.uid());
            approved := array_append(approved, opp.id);
        END LOOP;
    END LOOP;

    PERFORM "sales-pipe".auto_assign_sales(
        ARRAY(SELECT id FROM "sales-pipe".opportunities WHERE id = ANY(approved) AND assigned_sales_id IS NULL)
    );

    FOR t IN SELECT id FROM "sales-pipe".threads WHERE opportunity_id = ANY(approved) AND status = 'Not contacted' LOOP
        PERFORM "sales-pipe".generate_draft(t.id, 'First contact');
    END LOOP;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".audience_log(p_action text, p_business_id uuid, p_details jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, p_action, 'business', p_business_id::text, p_details
    FROM (SELECT 1) one LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid();
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".audience_opt_out_status(p_customer_id uuid, p_email text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
    SELECT jsonb_build_object('client', coalesce(a.sender_name, b.business_name), 'opted_out', c.do_not_contact)
    FROM "sales-pipe".customer_leads c
    JOIN "sales-pipe".businesses b ON b.id = c.business_id
    LEFT JOIN "sales-pipe".audience_clients a ON a.business_id = c.business_id
    WHERE c.id = p_customer_id AND lower(c.email) = lower(trim(p_email));
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".audience_preview(p_business_id uuid, p_channel text, p_filter jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    RETURN (
        SELECT jsonb_build_object(
            'send', count(*) FILTER (WHERE skip_reason IS NULL),
            'skipped', coalesce((SELECT jsonb_object_agg(reason, n) FROM (
                SELECT skip_reason AS reason, count(*) AS n FROM "sales-pipe".audience_targets(p_business_id, p_channel, p_filter)
                WHERE skip_reason IS NOT NULL GROUP BY 1) s), '{}'::jsonb))
        FROM "sales-pipe".audience_targets(p_business_id, p_channel, p_filter)
    );
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".audience_sync_pause(p_business_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_ok boolean := "sales-pipe".audience_unlocked(p_business_id);
BEGIN
    UPDATE "sales-pipe".campaign_recipients r
    SET next_attempt_at = CASE WHEN v_ok THEN now() ELSE 'infinity'::timestamptz END, updated_at = now()
    WHERE r.status = 'queued'
      AND (CASE WHEN v_ok THEN r.next_attempt_at = 'infinity'::timestamptz ELSE r.next_attempt_at <> 'infinity'::timestamptz END)
      AND (r.campaign_id IN (SELECT id FROM "sales-pipe".email_campaigns WHERE audience_business_id = p_business_id)
        OR r.whatsapp_campaign_id IN (SELECT id FROM "sales-pipe".whatsapp_campaigns WHERE audience_business_id = p_business_id));
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".audience_targets(p_business_id uuid, p_channel text, p_filter jsonb)
 RETURNS TABLE(customer_id uuid, email text, phone text, first_name text, skip_reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
    WITH f AS (SELECT coalesce(p_filter, '{}'::jsonb) AS j),
    gap AS (SELECT coalesce((SELECT days_delay FROM "sales-pipe".cadence_rules WHERE step_name = 'Audience gap'), 14) AS days),
    base AS (
        SELECT c.*, b.approved_at,
               CASE WHEN p_channel = 'email' THEN c.email
                    WHEN c.phone_type = 'mobile' THEN c.phone_e164
                    WHEN c.phone2_type = 'mobile' THEN c.phone2_e164
                    WHEN c.phone_type = 'mobile_or_landline' THEN c.phone_e164
                    WHEN c.phone2_type = 'mobile_or_landline' THEN c.phone2_e164 END AS addr
        FROM "sales-pipe".customer_leads c
        LEFT JOIN "sales-pipe".customer_import_batches b ON b.id = c.import_batch_id, f
        WHERE c.business_id = p_business_id
          AND (coalesce(jsonb_array_length(f.j->'tags'), 0) = 0
               OR c.tags && ARRAY(SELECT jsonb_array_elements_text(f.j->'tags')))
          AND (coalesce(jsonb_array_length(f.j->'birthday_months'), 0) = 0
               OR c.birthday_month = ANY (ARRAY(SELECT (jsonb_array_elements_text(f.j->'birthday_months'))::int)))
          AND (nullif(f.j->>'country', '') IS NULL OR c.country = f.j->>'country')
          AND (nullif(f.j->>'visited_within_days', '') IS NULL OR c.last_purchase_on >= CURRENT_DATE - (f.j->>'visited_within_days')::int)
          AND (nullif(f.j->>'not_visited_days', '') IS NULL OR c.last_purchase_on < CURRENT_DATE - (f.j->>'not_visited_days')::int)
          AND (NOT coalesce((f.j->>'mobile_only')::boolean, false) OR c.phone_type = 'mobile' OR c.phone2_type = 'mobile')
    )
    SELECT base.id, CASE WHEN p_channel = 'email' THEN base.addr END, CASE WHEN p_channel = 'whatsapp' THEN base.addr END, base.first_name,
           CASE
               WHEN base.do_not_contact THEN 'Opted out'
               WHEN NOT base.is_ready THEN 'Missing data'
               WHEN base.import_batch_id IS NOT NULL AND base.approved_at IS NULL THEN 'Import not approved yet'
               WHEN base.addr IS NULL THEN CASE WHEN p_channel = 'email' THEN 'No email' ELSE 'No mobile number' END
               WHEN p_channel = 'whatsapp' AND base.whatsapp_status = 'not_on_whatsapp' THEN 'Not on WhatsApp'
               WHEN EXISTS (SELECT 1 FROM "sales-pipe".campaign_recipients r, gap
                            WHERE r.customer_lead_id = base.id AND r.status IN ('queued', 'sending', 'sent')
                              AND coalesce(r.sent_at, r.created_at) > now() - make_interval(days => gap.days))
                   THEN 'Messaged in the last ' || (SELECT days FROM gap) || ' days'
           END
    FROM base;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".audience_unlocked(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
    SELECT EXISTS (SELECT 1 FROM "sales-pipe".opportunities WHERE business_id = p_business_id AND stage = 'Won')
       AND EXISTS (SELECT 1 FROM "sales-pipe".audience_clients WHERE business_id = p_business_id AND dpa_signed_on IS NOT NULL);
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".bulk_set_field(p_business_ids uuid[], p_field text, p_value text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_field text := lower(trim(p_field));
    v_val text := trim(coalesce(p_value, ''));
    v_services text[];
    v_count int := 0;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    IF v_field IN ('services', 'service', 'services_pitched') THEN
        SELECT coalesce(array_agg(DISTINCT trim(s)) FILTER (WHERE trim(s) <> ''), '{}')
          INTO v_services
          FROM unnest(string_to_array(replace(v_val, ';', ','), ',')) s;
        SELECT coalesce(array_agg(s), '{}') INTO v_services
          FROM unnest(v_services) s
          WHERE s = ANY("sales-pipe".valid_services());
        IF array_length(v_services, 1) IS NULL THEN
            RAISE EXCEPTION 'Pick at least one valid service';
        END IF;

        UPDATE "sales-pipe".opportunities o
        SET services_pitched = v_services
        WHERE o.business_id = ANY(p_business_ids)
          AND o.stage = 'Needs review'
          AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL));
        GET DIAGNOSTICS v_count = ROW_COUNT;

    ELSIF v_field IN ('category', 'business_type') THEN
        IF v_val NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
            v_val := "sales-pipe".canonical_business_type(v_val);
        END IF;
        IF v_val IS NULL THEN RAISE EXCEPTION 'Invalid category'; END IF;

        UPDATE "sales-pipe".businesses b
        SET business_type = v_val, category = "sales-pipe".type_category(v_val)
        WHERE b.id = ANY(p_business_ids)
          AND EXISTS (
              SELECT 1 FROM "sales-pipe".opportunities o
              WHERE o.business_id = b.id
                AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                     OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;

    ELSIF v_field = 'source' THEN
        UPDATE "sales-pipe".businesses b
        SET source = nullif(v_val, '')
        WHERE b.id = ANY(p_business_ids)
          AND EXISTS (
              SELECT 1 FROM "sales-pipe".opportunities o
              WHERE o.business_id = b.id
                AND (v_role = 'admin' OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                     OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          );
        GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
        RAISE EXCEPTION 'Bulk set not supported for %', p_field;
    END IF;

    -- Recompute problems
    PERFORM "sales-pipe".lead_problems(b_id) FROM unnest(p_business_ids) AS b_id;

    RETURN v_count;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".campaign_progress(p_channel text, p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'sales-pipe', 'public'
AS $function$
    WITH rows AS (
        SELECT * FROM "sales-pipe".campaign_recipients
        WHERE (p_channel = 'email' AND campaign_id = p_campaign_id)
           OR (p_channel = 'whatsapp' AND whatsapp_campaign_id = p_campaign_id)
    )
    SELECT jsonb_build_object(
        'status', CASE WHEN p_channel = 'email'
            THEN (SELECT status FROM "sales-pipe".email_campaigns WHERE id = p_campaign_id)
            ELSE (SELECT status FROM "sales-pipe".whatsapp_campaigns WHERE id = p_campaign_id) END,
        'total', (SELECT count(*) FROM rows WHERE status <> 'skipped'),
        'queued', (SELECT count(*) FROM rows WHERE status = 'queued'),
        'sending', (SELECT count(*) FROM rows WHERE status = 'sending'),
        'sent', (SELECT count(*) FROM rows WHERE status = 'sent'),
        'failed', (SELECT count(*) FROM rows WHERE status = 'failed'),
        'skipped', (SELECT count(*) FROM rows WHERE status = 'skipped'),
        'simulated', (SELECT count(*) FROM rows WHERE status = 'sent' AND simulated),
        'retrying', (SELECT count(*) FROM rows WHERE status = 'queued' AND attempts > 0),
        'delivered', (SELECT count(*) FROM rows WHERE delivery_status IN ('delivered', 'read')),
        'read', (SELECT count(*) FROM rows WHERE delivery_status = 'read'),
        'opened', (SELECT count(*) FROM rows WHERE opened_at IS NOT NULL),
        'clicked', (SELECT count(*) FROM rows WHERE clicked_at IS NOT NULL),
        'bounced', (SELECT count(*) FROM rows WHERE delivery_status IN ('bounced', 'complained')),
        'replied', (SELECT count(*) FROM rows WHERE replied_at IS NOT NULL),
        'opted_out', (SELECT count(*) FROM rows WHERE opted_out_at IS NOT NULL),
        'failures', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'to', coalesce(email, phone), 'name', business_name, 'error', error_detail) ORDER BY updated_at DESC)
            FROM (SELECT * FROM rows WHERE status IN ('failed', 'skipped') ORDER BY updated_at DESC LIMIT 50) f
        ), '[]'::jsonb)
    );
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".canonical_business_type(p_type text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
    (SELECT ps.value #>> '{}' FROM "sales-pipe".pipeline_settings ps WHERE ps.key = 'default_business_category')
  )
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".capture_campaign_reply(p_channel text, p_from text, p_body text, p_subject text, p_external_message_id text, p_looks_like_reply boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_rec record;
    v_msg record;
    v_business uuid;
BEGIN
    IF p_external_message_id IS NOT NULL AND EXISTS (SELECT 1 FROM "sales-pipe".campaign_replies WHERE external_message_id = p_external_message_id) THEN
        RETURN 'duplicate';
    END IF;

    -- The latest campaign message we sent this person in the last 30 days
    SELECT * INTO v_rec FROM "sales-pipe".campaign_recipients r
    WHERE r.channel = p_channel AND r.status = 'sent' AND r.sent_at > now() - interval '30 days'
      AND ((p_channel = 'email' AND lower(r.email) = "sales-pipe".normalise_email(p_from))
        OR (p_channel = 'whatsapp' AND "sales-pipe".normalise_phone(r.phone) = "sales-pipe".normalise_phone(p_from)))
    ORDER BY r.sent_at DESC LIMIT 1;

    -- Client Audience campaigns: count the reply, honour an opt-out, keep nothing else
    IF v_rec.customer_lead_id IS NOT NULL THEN
        UPDATE "sales-pipe".campaign_recipients SET replied_at = coalesce(replied_at, now()) WHERE id = v_rec.id;
        IF upper(regexp_replace(trim(coalesce(p_body, '')), '[.!]+$', '')) IN ('STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPT-OUT', 'OPTOUT') THEN
            UPDATE "sales-pipe".customer_leads
            SET do_not_contact = true, do_not_contact_at = now(),
                do_not_contact_reason = 'Replied "' || trim(p_body) || '" to a campaign'
            WHERE id = v_rec.customer_lead_id AND NOT do_not_contact;
            UPDATE "sales-pipe".campaign_recipients SET opted_out_at = coalesce(opted_out_at, now()) WHERE id = v_rec.id;
        END IF;
        RETURN 'audience';
    END IF;

    -- Did record_inbound already put it in a Lead Management chat?
    SELECT m.thread_id, t.opportunity_id INTO v_msg
    FROM "sales-pipe".messages m JOIN "sales-pipe".threads t ON t.id = m.thread_id
    WHERE p_external_message_id IS NOT NULL AND m.external_message_id = p_external_message_id
    LIMIT 1;

    IF v_rec.id IS NULL AND v_msg.thread_id IS NOT NULL THEN
        RETURN 'lead_chat_only';   -- a normal one-to-one reply, nothing to do here
    END IF;
    -- Unknown sender: keep WhatsApp messages, and emails that look like replies (not newsletters)
    IF v_rec.id IS NULL AND p_channel = 'email' AND NOT coalesce(p_looks_like_reply, false) THEN
        RETURN 'ignored';
    END IF;

    v_business := v_rec.business_id;
    IF v_business IS NULL THEN
        SELECT b.id INTO v_business FROM "sales-pipe".businesses b
        WHERE (p_channel = 'email' AND b.email_normalised = "sales-pipe".normalise_email(p_from))
           OR (p_channel = 'whatsapp' AND ("sales-pipe".normalise_phone(b.whatsapp_number) = "sales-pipe".normalise_phone(p_from)
                                           OR b.phone_normalised = "sales-pipe".normalise_phone(p_from)))
        ORDER BY b.archived, b.created_at DESC LIMIT 1;
    END IF;

    INSERT INTO "sales-pipe".campaign_replies
        (channel, from_address, subject, body, external_message_id, recipient_id, campaign_id, whatsapp_campaign_id,
         business_id, opportunity_id, thread_id, status)
    VALUES
        (p_channel, p_from, p_subject, coalesce(nullif(trim(p_body), ''), '(empty message)'), p_external_message_id, v_rec.id, v_rec.campaign_id, v_rec.whatsapp_campaign_id,
         v_business, v_msg.opportunity_id, v_msg.thread_id,
         CASE WHEN v_msg.thread_id IS NOT NULL THEN 'in_leads' ELSE 'new' END);

    IF v_rec.id IS NOT NULL THEN
        UPDATE "sales-pipe".campaign_recipients SET replied_at = coalesce(replied_at, now()) WHERE id = v_rec.id;
    END IF;
    RETURN CASE WHEN v_rec.id IS NOT NULL THEN 'campaign' ELSE 'unmatched' END;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".check_duplicate_lead(p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, lead_code text, business_name text, email text, phone text, channel text, stage text, current_service text, follow_up_count integer, assigned_to text, created_at timestamp with time zone, match_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_clean_email TEXT;
    v_clean_phone TEXT;
    v_digits_phone TEXT;
BEGIN
    v_clean_email := NULLIF(LOWER(TRIM(p_email)), '');
    v_clean_phone := NULLIF(TRIM(p_phone), '');
    v_digits_phone := NULLIF(REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');

    -- If neither valid email nor phone provided, return empty set
    IF v_clean_email IS NULL AND v_digits_phone IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        l.id,
        l.lead_code,
        l.business_name,
        l.email,
        l.phone,
        l.channel,
        l.stage,
        l.current_service,
        l.follow_up_count,
        l.assigned_to,
        l.created_at,
        CASE 
            WHEN v_clean_email IS NOT NULL AND LOWER(TRIM(COALESCE(l.email, ''))) = v_clean_email 
                 AND v_digits_phone IS NOT NULL AND REGEXP_REPLACE(COALESCE(l.phone, ''), '[^0-9]', '', 'g') = v_digits_phone
                THEN 'Both Email and Phone matched'
            WHEN v_clean_email IS NOT NULL AND LOWER(TRIM(COALESCE(l.email, ''))) = v_clean_email 
                THEN 'Email address matched'
            ELSE 'Phone number matched'
        END AS match_reason
    FROM "sales-pipe".leads l
    WHERE 
        (v_clean_email IS NOT NULL AND LOWER(TRIM(COALESCE(l.email, ''))) = v_clean_email)
        OR 
        (
            v_digits_phone IS NOT NULL 
            AND LENGTH(v_digits_phone) >= 7
            AND (
                REGEXP_REPLACE(COALESCE(l.phone, ''), '[^0-9]', '', 'g') = v_digits_phone
                OR REGEXP_REPLACE(COALESCE(l.phone, ''), '[^0-9]', '', 'g') LIKE '%' || RIGHT(v_digits_phone, 8)
                OR v_digits_phone LIKE '%' || RIGHT(REGEXP_REPLACE(COALESCE(l.phone, ''), '[^0-9]', '', 'g'), 8)
            )
        )
    ORDER BY l.created_at DESC;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".check_opp_access(p_opportunity_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_opp record;
    v_role text;
BEGIN
    IF auth.role() = 'service_role' THEN RETURN; END IF;
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not logged in'; END IF;
    v_role := "sales-pipe".get_user_role();
    IF v_role IS NULL THEN RAISE EXCEPTION 'Your account is not set up'; END IF;
    IF v_role = 'admin' THEN RETURN; END IF;

    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_opp.id IS NULL THEN RAISE EXCEPTION 'Pitch not found'; END IF;

    IF auth.uid() = v_opp.assigned_consultant_id THEN RETURN; END IF;

    IF auth.uid() = v_opp.assigned_sales_id THEN
        IF v_opp.assigned_consultant_id IS NOT NULL AND v_opp.stage = 'Consultation' THEN
            RAISE EXCEPTION 'This business has been handed over to a consultant';
        END IF;
        RETURN;
    END IF;

    IF v_role IN ('sales', 'consultant') AND v_opp.assigned_sales_id IS NULL AND v_opp.assigned_consultant_id IS NULL THEN
        RETURN; -- unassigned (review queue)
    END IF;

    RAISE EXCEPTION 'You are not assigned to this business';
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".claim_campaign_sends(p_limit integer DEFAULT 10, p_campaign_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, channel text, campaign_id uuid, email text, phone text, business_name text, contact_name text, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
#variable_conflict use_column
BEGIN
    -- A worker that died mid-batch leaves rows in 'sending'; after 5 minutes they go back in the queue
    UPDATE "sales-pipe".campaign_recipients cr
    SET status = 'queued', locked_at = NULL, updated_at = now()
    WHERE cr.status = 'sending' AND cr.locked_at < now() - interval '5 minutes';

    RETURN QUERY
    WITH picked AS (
        SELECT q.id FROM "sales-pipe".campaign_recipients q
        WHERE q.status = 'queued' AND q.next_attempt_at <= now()
          AND (p_campaign_id IS NULL OR q.campaign_id = p_campaign_id OR q.whatsapp_campaign_id = p_campaign_id)
        ORDER BY q.next_attempt_at, q.created_at
        LIMIT greatest(1, least(p_limit, 50))
        -- Two workers running at once never take the same row
        FOR UPDATE SKIP LOCKED
    )
    UPDATE "sales-pipe".campaign_recipients cr
    SET status = 'sending', locked_at = now(), attempts = cr.attempts + 1, updated_at = now()
    FROM picked
    WHERE cr.id = picked.id
    RETURNING cr.id, cr.channel, coalesce(cr.campaign_id, cr.whatsapp_campaign_id),
              cr.email, cr.phone, cr.business_name, cr.contact_name, cr.attempts;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".complete_campaign_sends(p_results jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    UPDATE "sales-pipe".campaign_recipients cr
    SET status = CASE
            WHEN r.ok THEN 'sent'
            WHEN coalesce(r.permanent, false) OR cr.attempts >= 3 THEN 'failed'
            ELSE 'queued' END,
        sent_at = CASE WHEN r.ok THEN now() ELSE cr.sent_at END,
        next_attempt_at = CASE
            WHEN r.ok THEN cr.next_attempt_at
            ELSE now() + interval '1 minute' * power(5, greatest(cr.attempts - 1, 0)) END,
        error_detail = CASE WHEN r.ok THEN NULL ELSE left(coalesce(r.error, 'Unknown error'), 500) END,
        external_message_id = coalesce(r.external_id, cr.external_message_id),
        simulated = coalesce(r.simulated, false),
        locked_at = NULL,
        updated_at = now()
    FROM jsonb_to_recordset(p_results) AS r(id uuid, ok boolean, error text, external_id text, simulated boolean, permanent boolean)
    WHERE cr.id = r.id AND cr.status = 'sending';

    -- Campaigns with nothing left to send are finished
    UPDATE "sales-pipe".email_campaigns c
    SET status = 'sent', sent_at = now(), updated_at = now()
    WHERE c.status = 'sending'
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".campaign_recipients q
                      WHERE q.campaign_id = c.id AND q.status IN ('queued', 'sending'));

    UPDATE "sales-pipe".whatsapp_campaigns c
    SET status = 'sent', sent_at = now(), updated_at = now()
    WHERE c.status = 'sending'
      AND NOT EXISTS (SELECT 1 FROM "sales-pipe".campaign_recipients q
                      WHERE q.whatsapp_campaign_id = c.id AND q.status IN ('queued', 'sending'));
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".compute_business_problems(b "sales-pipe".businesses)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_problems text[] := '{}';
    v_has_contact boolean := false;
BEGIN
    -- 1. Business name: required
    IF coalesce(trim(b.business_name), '') = '' THEN
        v_problems := array_append(v_problems, 'name');
    END IF;

    -- 2. Category (business_type): required
    IF b.business_type IS NULL OR b.business_type NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
        v_problems := array_append(v_problems, 'category');
    END IF;

    -- 3. Service: required (at least one service pitched)
    IF NOT EXISTS (
        SELECT 1 FROM "sales-pipe".opportunities o
        WHERE o.business_id = b.id
          AND array_length(o.services_pitched, 1) > 0
          AND o.services_pitched <@ "sales-pipe".valid_services()
    ) THEN
        v_problems := array_append(v_problems, 'service');
    END IF;

    -- 4. Contact: at least one contact method (email, whatsapp, instagram, facebook, linkedin, or owner_contact)
    IF coalesce(trim(b.email), '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
       OR coalesce(trim(b.whatsapp_number), '') <> ''
       OR coalesce(trim(b.instagram), '') <> ''
       OR coalesce(trim(b.facebook), '') <> ''
       OR coalesce(trim(b.linkedin), '') <> ''
       OR coalesce(trim(b.owner_contact), '') <> ''
       OR coalesce(trim(b.owner_email), '') <> '' THEN
        v_has_contact := true;
    END IF;

    IF NOT v_has_contact THEN
        v_problems := array_append(v_problems, 'business_contact');
    END IF;

    RETURN v_problems;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".create_import_batch(p_file_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
    DECLARE
        v_id uuid;
    BEGIN
        PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
        INSERT INTO "sales-pipe".import_batches (file_name, uploaded_by)
        VALUES (coalesce(nullif(trim(p_file_name), ''), 'leads.csv'), auth.uid())
        RETURNING id INTO v_id;
        RETURN v_id;
    END;
    $function$;
CREATE OR REPLACE FUNCTION "sales-pipe".customer_leads_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".delete_audience(p_business_id uuid, p_confirm_name text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_name text;
    n int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    SELECT business_name INTO v_name FROM "sales-pipe".businesses WHERE id = p_business_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'This business was not found'; END IF;
    IF lower(trim(coalesce(p_confirm_name, ''))) <> lower(trim(v_name)) THEN
        RAISE EXCEPTION 'Type the business name exactly to confirm';
    END IF;
    DELETE FROM "sales-pipe".customer_leads WHERE business_id = p_business_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    DELETE FROM "sales-pipe".customer_import_batches WHERE business_id = p_business_id;
    PERFORM "sales-pipe".audience_log('audience_deleted', p_business_id, jsonb_build_object('removed', n));
    RETURN n;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".delete_leads(p_business_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_count int := 0;
    v_bid uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    FOR v_bid IN
        SELECT b.id
        FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        LEFT JOIN "sales-pipe".import_batches ib ON ib.id = b.import_batch_id
        WHERE b.id = ANY(p_business_ids)
          AND o.stage = 'Needs review'
          AND NOT EXISTS (
              SELECT 1 FROM "sales-pipe".threads t
              JOIN "sales-pipe".messages m ON m.thread_id = t.id
              WHERE t.opportunity_id = o.id
          )
          AND (
              v_role = 'admin'
              OR ib.uploaded_by = v_uid
              OR o.assigned_sales_id = v_uid
              OR o.assigned_consultant_id = v_uid
              OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL)
          )
    LOOP
        DELETE FROM "sales-pipe".businesses WHERE id = v_bid;
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".dismiss_campaign_reply(p_reply_id uuid, p_undo boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    UPDATE "sales-pipe".campaign_replies
    SET status = CASE WHEN p_undo THEN 'new' ELSE 'dismissed' END,
        handled_by = CASE WHEN p_undo THEN NULL ELSE auth.uid() END,
        handled_at = CASE WHEN p_undo THEN NULL ELSE now() END
    WHERE id = p_reply_id AND status <> 'in_leads';
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".dismiss_late_reply(p_opportunity_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".check_opp_access(p_opportunity_id);
    UPDATE "sales-pipe".opportunities SET replied_after_close_at = NULL WHERE id = p_opportunity_id;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".enqueue_audience_campaign(p_channel text, p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_business uuid;
    v_filter jsonb;
    v_status text;
    v_client text;
    v_queued int;
    v_skipped int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    IF p_channel = 'email' THEN
        SELECT audience_business_id, audience_filter, status INTO v_business, v_filter, v_status
        FROM "sales-pipe".email_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSIF p_channel = 'whatsapp' THEN
        SELECT audience_business_id, audience_filter, status INTO v_business, v_filter, v_status
        FROM "sales-pipe".whatsapp_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Unknown campaign channel: %', p_channel;
    END IF;
    IF v_business IS NULL THEN RAISE EXCEPTION 'Campaign not found.'; END IF;
    IF v_status IN ('sending', 'sent') THEN RAISE EXCEPTION 'This campaign has already been launched.'; END IF;
    IF NOT "sales-pipe".audience_unlocked(v_business) THEN
        RAISE EXCEPTION 'Campaigns unlock when the business is Won and its data-processing agreement is recorded.';
    END IF;
    SELECT coalesce(a.sender_name, b.business_name) INTO v_client
    FROM "sales-pipe".businesses b LEFT JOIN "sales-pipe".audience_clients a ON a.business_id = b.id WHERE b.id = v_business;

    WITH ins AS (
        INSERT INTO "sales-pipe".campaign_recipients
            (channel, campaign_id, whatsapp_campaign_id, customer_lead_id, email, phone, business_name, contact_name, status, error_detail)
        SELECT p_channel,
               CASE WHEN p_channel = 'email' THEN p_campaign_id END,
               CASE WHEN p_channel = 'whatsapp' THEN p_campaign_id END,
               t.customer_id, t.email, t.phone, v_client, t.first_name,
               CASE WHEN t.skip_reason IS NULL THEN 'queued' ELSE 'skipped' END, t.skip_reason
        FROM "sales-pipe".audience_targets(v_business, p_channel, v_filter) t
        -- Customers without an address are left out entirely; everyone else is listed
        WHERE t.skip_reason IS NULL OR t.skip_reason NOT IN ('No email', 'No mobile number', 'Missing data')
        RETURNING status
    )
    SELECT count(*) FILTER (WHERE status = 'queued'), count(*) FILTER (WHERE status = 'skipped') INTO v_queued, v_skipped FROM ins;

    IF v_queued = 0 THEN RAISE EXCEPTION 'Nobody in this audience can be messaged right now.'; END IF;

    IF p_channel = 'email' THEN
        UPDATE "sales-pipe".email_campaigns SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now() WHERE id = p_campaign_id;
    ELSE
        UPDATE "sales-pipe".whatsapp_campaigns SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now() WHERE id = p_campaign_id;
    END IF;
    RETURN jsonb_build_object('queued', v_queued, 'skipped', v_skipped, 'removed', 0);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".enqueue_campaign(p_channel text, p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_status text;
    v_recipients jsonb;
    v_total int;
    v_queued int;
    v_skipped int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    IF p_channel = 'email' THEN
        SELECT status, recipients INTO v_status, v_recipients
        FROM "sales-pipe".email_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSIF p_channel = 'whatsapp' THEN
        SELECT status, recipients INTO v_status, v_recipients
        FROM "sales-pipe".whatsapp_campaigns WHERE id = p_campaign_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Unknown campaign channel: %', p_channel;
    END IF;

    IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found.'; END IF;
    IF v_status IN ('sending', 'sent') THEN RAISE EXCEPTION 'This campaign has already been launched.'; END IF;

    -- The app saves recipients with JSON.stringify, so the column can hold a JSON string of an array
    IF jsonb_typeof(v_recipients) = 'string' THEN
        v_recipients := (v_recipients #>> '{}')::jsonb;
    END IF;
    IF v_recipients IS NULL OR jsonb_typeof(v_recipients) <> 'array' THEN
        v_recipients := '[]'::jsonb;
    END IF;
    v_total := jsonb_array_length(v_recipients);

    IF p_channel = 'email' THEN
        WITH src AS (
            SELECT DISTINCT ON (lower(trim(r->>'email')))
                lower(trim(r->>'email')) AS email,
                nullif(trim(r->>'business_name'), '') AS business_name,
                nullif(trim(r->>'contact_name'), '') AS contact_name,
                CASE WHEN r->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     THEN (r->>'id')::uuid END AS rid
            FROM jsonb_array_elements(v_recipients) r
            WHERE coalesce(trim(r->>'email'), '') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        ), ins AS (
            INSERT INTO "sales-pipe".campaign_recipients
                (channel, campaign_id, email, business_name, contact_name, business_id, status, error_detail)
            SELECT 'email', p_campaign_id, s.email, s.business_name, s.contact_name,
                   (SELECT b.id FROM "sales-pipe".businesses b WHERE b.id = s.rid),
                   CASE WHEN o.id IS NULL THEN 'queued' ELSE 'skipped' END,
                   CASE WHEN o.id IS NULL THEN NULL ELSE 'Opted out' END
            FROM src s
            LEFT JOIN LATERAL (
                SELECT id FROM "sales-pipe".opt_outs
                WHERE lower(identifier) = s.email AND lower(channel) IN ('all', 'email') LIMIT 1
            ) o ON true
            RETURNING status
        )
        SELECT count(*) FILTER (WHERE status = 'queued'), count(*) FILTER (WHERE status = 'skipped')
        INTO v_queued, v_skipped FROM ins;
    ELSE
        WITH src AS (
            SELECT DISTINCT ON (regexp_replace(r->>'whatsapp_number', '\D', '', 'g'))
                trim(r->>'whatsapp_number') AS phone,
                regexp_replace(r->>'whatsapp_number', '\D', '', 'g') AS digits,
                nullif(trim(r->>'business_name'), '') AS business_name,
                nullif(trim(r->>'contact_name'), '') AS contact_name,
                CASE WHEN r->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     THEN (r->>'id')::uuid END AS rid
            FROM jsonb_array_elements(v_recipients) r
            WHERE length(regexp_replace(coalesce(r->>'whatsapp_number', ''), '\D', '', 'g')) >= 7
        ), ins AS (
            INSERT INTO "sales-pipe".campaign_recipients
                (channel, whatsapp_campaign_id, phone, business_name, contact_name, business_id, status, error_detail)
            SELECT 'whatsapp', p_campaign_id, s.phone, s.business_name, s.contact_name,
                   (SELECT b.id FROM "sales-pipe".businesses b WHERE b.id = s.rid),
                   CASE WHEN o.id IS NULL THEN 'queued' ELSE 'skipped' END,
                   CASE WHEN o.id IS NULL THEN NULL ELSE 'Opted out' END
            FROM src s
            LEFT JOIN LATERAL (
                SELECT id FROM "sales-pipe".opt_outs
                WHERE regexp_replace(identifier, '\D', '', 'g') = s.digits AND lower(channel) IN ('all', 'whatsapp') LIMIT 1
            ) o ON true
            RETURNING status
        )
        SELECT count(*) FILTER (WHERE status = 'queued'), count(*) FILTER (WHERE status = 'skipped')
        INTO v_queued, v_skipped FROM ins;
    END IF;

    IF v_queued = 0 THEN
        RAISE EXCEPTION '%', CASE WHEN v_skipped > 0
            THEN 'Every recipient in this list has opted out.'
            ELSE 'No valid recipients in this campaign.' END;
    END IF;

    IF p_channel = 'email' THEN
        UPDATE "sales-pipe".email_campaigns
        SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now()
        WHERE id = p_campaign_id;
    ELSE
        UPDATE "sales-pipe".whatsapp_campaigns
        SET status = 'sending', recipient_count = v_queued, sent_at = NULL, updated_at = now()
        WHERE id = p_campaign_id;
    END IF;

    RETURN jsonb_build_object(
        'queued', v_queued,
        'skipped', v_skipped,               -- opted out
        'removed', v_total - v_queued - v_skipped  -- invalid address or duplicate
    );
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".find_duplicates(p_rows jsonb)
 RETURNS TABLE(idx integer, business_id uuid, business_name text, matched_by text, open_pitches integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
    BEGIN
        PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);
        RETURN QUERY
        WITH r AS (
            SELECT (x->>'idx')::int AS idx,
                   lower(trim(x->>'business_name')) AS name,
                   "sales-pipe".normalise_phone(coalesce(x->>'whatsapp_number', x->>'phone')) AS phone,
                   "sales-pipe".normalise_email(x->>'email') AS email,
                   lower(trim(coalesce(x->>'linkedin', ''))) AS linkedin,
                   upper(regexp_replace(coalesce(x->>'postcode', ''), '\s', '', 'g')) AS pc
            FROM jsonb_array_elements(p_rows) x
        )
        SELECT DISTINCT ON (r.idx) r.idx, b.id, b.business_name,
               CASE WHEN r.email IS NOT NULL AND b.email_normalised = r.email THEN 'email'
                    WHEN r.phone IS NOT NULL AND (b.whatsapp_number IS NOT NULL AND "sales-pipe".normalise_phone(b.whatsapp_number) = r.phone) THEN 'whatsapp'
                    WHEN r.linkedin <> '' AND lower(b.linkedin) = r.linkedin THEN 'linkedin'
                    ELSE 'name and postcode' END,
               (SELECT count(*)::int FROM "sales-pipe".opportunities o
                 WHERE o.business_id = b.id AND o.stage NOT IN ('Won', 'Declined', 'Do not contact', 'No response', 'Went cold'))
        FROM r
        JOIN "sales-pipe".businesses b ON
              (r.email IS NOT NULL AND b.email_normalised = r.email)
           OR (r.phone IS NOT NULL AND b.whatsapp_number IS NOT NULL AND "sales-pipe".normalise_phone(b.whatsapp_number) = r.phone)
           OR (r.linkedin <> '' AND b.linkedin IS NOT NULL AND lower(b.linkedin) = r.linkedin)
           OR (r.pc <> '' AND lower(b.business_name) = r.name
               AND upper(regexp_replace(coalesce(b.postcode, ''), '\s', '', 'g')) = r.pc)
        ORDER BY r.idx;
    END;
    $function$;
CREATE OR REPLACE FUNCTION "sales-pipe".generate_business_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
begin
  if NEW.business_code is null then
    NEW.business_code := 'B' || nextval('"sales-pipe".business_code_seq')::text;
  end if;
  return NEW;
end;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".generate_draft(p_thread_id uuid, p_step text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
    DECLARE
        v_opp record;
        v_bus record;
        v_thread record;
        v_template record;
        v_sender text;
        v_body text;
        v_subject text;
        v_missing text[] := '{}';
    BEGIN
        SELECT * INTO v_thread FROM "sales-pipe".threads WHERE id = p_thread_id;
        SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = v_thread.opportunity_id;
        SELECT * INTO v_bus FROM "sales-pipe".businesses WHERE id = v_opp.business_id;
        SELECT full_name INTO v_sender FROM "sales-pipe".profiles WHERE id = v_opp.assigned_sales_id;

        IF EXISTS (SELECT 1 FROM "sales-pipe".drafts WHERE thread_id = p_thread_id AND step_label = p_step AND status IN ('ready', 'needs_data')) THEN
            RETURN;
        END IF;

        SELECT * INTO v_template
        FROM "sales-pipe".templates
        WHERE is_active = true
          AND (platform = v_thread.platform
               OR (platform = 'All' AND v_thread.platform IN ('WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn')))
          AND step = p_step
          AND (v_opp.services_pitched && services OR coalesce(array_length(services, 1), 0) = 0)
        ORDER BY
          CASE WHEN v_opp.services_pitched && services THEN 1 ELSE 2 END,
          CASE WHEN platform = v_thread.platform THEN 1 ELSE 2 END,
          CASE WHEN v_bus.business_type = ANY(business_types) THEN 1 ELSE 2 END,
          updated_at DESC
        LIMIT 1;

        IF v_template.id IS NULL THEN
            INSERT INTO "sales-pipe".drafts (thread_id, step_label, body, status, due_on, missing_fields)
            VALUES (p_thread_id, p_step, '', 'needs_data', CURRENT_DATE, ARRAY['template']);
            RETURN;
        END IF;

        v_body := v_template.body;
        v_subject := CASE WHEN v_thread.platform = 'Email' THEN v_template.subject END;

        v_body := replace(replace(v_body, '{business_name}', v_bus.business_name), '{business}', v_bus.business_name);
        v_subject := replace(replace(v_subject, '{business_name}', v_bus.business_name), '{business}', v_bus.business_name);

        IF v_body LIKE '%{area}%' THEN
            IF v_bus.area IS NOT NULL THEN v_body := replace(v_body, '{area}', v_bus.area);
            ELSE v_missing := array_append(v_missing, 'area'); END IF;
        END IF;

        IF v_body LIKE '%{contact_name}%' THEN
            IF v_bus.contact_name IS NOT NULL THEN v_body := replace(v_body, '{contact_name}', v_bus.contact_name);
            ELSE v_missing := array_append(v_missing, 'contact_name'); END IF;
        END IF;

        IF v_body LIKE '%{sender_name}%' THEN
            IF v_sender IS NOT NULL THEN v_body := replace(v_body, '{sender_name}', split_part(v_sender, ' ', 1));
            ELSE v_missing := array_append(v_missing, 'sender_name'); END IF;
        END IF;

        INSERT INTO "sales-pipe".drafts (thread_id, step_label, template_id, body, subject, missing_fields, status, due_on)
        VALUES (
            p_thread_id, p_step, v_template.id, v_body, v_subject, v_missing,
            CASE WHEN array_length(v_missing, 1) > 0 THEN 'needs_data' ELSE 'ready' END,
            CURRENT_DATE
        );
    END;
    $function$;
CREATE OR REPLACE FUNCTION "sales-pipe".generate_opportunity_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
begin
  if NEW.opportunity_code is null then
    NEW.opportunity_code := 'OPP' || nextval('"sales-pipe".opportunity_code_seq')::text;
  end if;
  return NEW;
end;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".get_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
        SELECT CASE 
            WHEN auth.role() = 'service_role' THEN 'admin'
            ELSE (SELECT role FROM "sales-pipe".profiles WHERE id = auth.uid() AND is_active = true)
        END;
    $function$;
CREATE OR REPLACE FUNCTION "sales-pipe".import_businesses(p_rows jsonb, p_batch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    x jsonb;
    v_bid uuid;
    v_action text;
    v_name text;
    v_type text;
    v_services text[];
    v_tech_type text;
    v_tech_name text;
    v_branches jsonb;
    v_raw_branches text;
    v_ready int := 0;
    v_missing int := 0;
    v_skipped int := 0;
    v_probs text[];
    b_str text;
    v_raw_services text;
    v_raw_tp text;
    v_site text;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    FOR x IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
        v_action := coalesce(x->>'action', 'new');
        v_name := trim(coalesce(x->>'business_name', ''));

        IF v_action = 'skip' THEN
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        IF v_action IN ('new', 'update') THEN
            -- Services parsing (handles JSON array e.g. ["Website"] and comma-separated string)
            IF x->'services' IS NOT NULL AND jsonb_typeof(x->'services') = 'array' THEN
                SELECT coalesce(array_agg(trim(val)), '{}'::text[]) INTO v_services
                FROM jsonb_array_elements_text(x->'services') val
                WHERE trim(val) = ANY("sales-pipe".valid_services());
            ELSIF x->'services_pitched' IS NOT NULL AND jsonb_typeof(x->'services_pitched') = 'array' THEN
                SELECT coalesce(array_agg(trim(val)), '{}'::text[]) INTO v_services
                FROM jsonb_array_elements_text(x->'services_pitched') val
                WHERE trim(val) = ANY("sales-pipe".valid_services());
            ELSE
                v_raw_services := trim(coalesce(x->>'services', x->>'services_pitched', ''));
                SELECT coalesce(array_agg(trim(s)), '{}'::text[]) INTO v_services
                FROM unnest(string_to_array(v_raw_services, ',')) s
                WHERE trim(s) = ANY("sales-pipe".valid_services());
            END IF;
            IF v_services IS NULL THEN
                v_services := '{}'::text[];
            END IF;

            v_type := nullif(trim(x->>'business_type'), '');
            IF v_type IS NOT NULL AND v_type NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
                v_type := "sales-pipe".canonical_business_type(v_type);
            END IF;

            -- Website normalization
            v_site := nullif(trim(x->>'existing_website'), '');
            IF v_site IS NOT NULL AND v_site !~* '^https?://' AND v_site ~* '^[^\s.]+\.[^\s]{2,}' THEN
                v_site := 'https://' || v_site;
            END IF;

            -- Tech partner parsing
            v_tech_type := nullif(trim(x->>'tech_partner_type'), '');
            v_raw_tp := nullif(trim(coalesce(x->>'tech_partner', x->>'existing_tech_partner', '')), '');
            IF v_tech_type IS NULL AND v_raw_tp IS NOT NULL THEN
                IF lower(v_raw_tp) = 'none' THEN
                    v_tech_type := 'None';
                    v_tech_name := NULL;
                ELSIF v_raw_tp ~* '^Agency' THEN
                    v_tech_type := 'Agency';
                    v_tech_name := nullif(btrim(regexp_replace(v_raw_tp, '^Agency\s*', '', 'i'), ' ()'), '');
                ELSIF v_raw_tp ~* '^DIY' THEN
                    v_tech_type := 'DIY';
                    v_tech_name := nullif(btrim(regexp_replace(v_raw_tp, '^DIY\s*', '', 'i'), ' ()'), '');
                ELSE
                    v_tech_type := 'Agency';
                    v_tech_name := v_raw_tp;
                END IF;
            END IF;
            IF v_tech_type IS NOT NULL AND v_tech_type NOT IN ('Agency', 'DIY', 'None') THEN
                v_tech_type := NULL;
            END IF;
            IF v_tech_name IS NULL THEN
                v_tech_name := nullif(trim(x->>'tech_partner_name'), '');
            END IF;

            -- Branches parsing
            IF x->'branches' IS NOT NULL AND jsonb_typeof(x->'branches') = 'array' THEN
                v_branches := x->'branches';
            ELSIF nullif(trim(x->>'branches'), '') IS NOT NULL THEN
                v_raw_branches := trim(x->>'branches');
                SELECT jsonb_agg(jsonb_build_object(
                    'name', trim(split_part(b_str, '|', 1)),
                    'address', trim(split_part(b_str, '|', 2)),
                    'postcode', upper(trim(split_part(b_str, '|', 3)))
                )) INTO v_branches
                FROM unnest(string_to_array(v_raw_branches, ';')) b_str
                WHERE trim(b_str) <> '';
            ELSE
                v_branches := '[]'::jsonb;
            END IF;

            IF v_action = 'new' THEN
                INSERT INTO "sales-pipe".businesses (
                    business_name, business_type, category, tier, room_count, area, address, postcode, maps_link,
                    google_rating, google_reviews_count, whatsapp_number, email, instagram, facebook, linkedin,
                    existing_website, company_type, contact_name, notes, owner_contact, gaps_found, has_no_website,
                    owner_email, tech_partner_type, tech_partner_name, branches, source, import_batch_id)
                VALUES (
                    v_name, v_type, "sales-pipe".type_category(v_type),
                    nullif(x->>'tier', ''), nullif(x->>'room_count', '')::int,
                    nullif(trim(x->>'area'), ''), nullif(trim(x->>'address'), ''), upper(nullif(trim(x->>'postcode'), '')),
                    nullif(trim(x->>'maps_link'), ''),
                    nullif(x->>'google_rating', '')::numeric, nullif(regexp_replace(coalesce(x->>'google_reviews_count', ''), '\D', '', 'g'), '')::int,
                    nullif(trim(x->>'whatsapp_number'), ''),
                    nullif(lower(trim(x->>'email')), ''),
                    "sales-pipe".clean_handle(x->>'instagram'), "sales-pipe".clean_handle(x->>'facebook'), nullif(trim(x->>'linkedin'), ''),
                    v_site,
                    coalesce(nullif(x->>'company_type', ''), 'Unknown'),
                    nullif(trim(x->>'contact_name'), ''), nullif(trim(x->>'notes'), ''),
                    coalesce(nullif(trim(x->>'owner_contact'), ''), nullif(trim(x->>'owner_whatsapp'), ''), nullif(trim(x->>'owner_social'), '')),
                    nullif(trim(x->>'gaps_found'), ''),
                    coalesce((x->>'has_no_website')::boolean, (lower(trim(coalesce(x->>'no_site', ''))) IN ('true', 'yes', '1', 't'))),
                    nullif(lower(trim(x->>'owner_email')), ''),
                    v_tech_type, v_tech_name, coalesce(v_branches, '[]'::jsonb), nullif(trim(x->>'source'), ''), p_batch_id)
                RETURNING id INTO v_bid;

                PERFORM "sales-pipe".add_pitch(v_bid, v_services, nullif(trim(x->>'demo_link'), ''));

                UPDATE "sales-pipe".businesses SET problems = "sales-pipe".lead_problems(v_bid) WHERE id = v_bid RETURNING problems INTO v_probs;
                IF array_length(v_probs, 1) IS NULL THEN
                    v_ready := v_ready + 1;
                ELSE
                    v_missing := v_missing + 1;
                END IF;
            ELSE
                v_bid := (x->>'match_id')::uuid;
                IF v_bid IS NOT NULL THEN
                    UPDATE "sales-pipe".businesses b SET
                        business_name = coalesce(nullif(v_name, ''), b.business_name),
                        business_type = coalesce(v_type, b.business_type),
                        category = coalesce("sales-pipe".type_category(v_type), b.category),
                        tier = coalesce(nullif(x->>'tier', ''), b.tier),
                        room_count = coalesce(nullif(x->>'room_count', '')::int, b.room_count),
                        area = coalesce(nullif(trim(x->>'area'), ''), b.area),
                        address = coalesce(nullif(trim(x->>'address'), ''), b.address),
                        postcode = coalesce(upper(nullif(trim(x->>'postcode'), '')), b.postcode),
                        maps_link = coalesce(nullif(trim(x->>'maps_link'), ''), b.maps_link),
                        google_rating = coalesce(nullif(x->>'google_rating', '')::numeric, b.google_rating),
                        google_reviews_count = coalesce(nullif(regexp_replace(coalesce(x->>'google_reviews_count', ''), '\D', '', 'g'), '')::int, b.google_reviews_count),
                        whatsapp_number = coalesce(nullif(trim(x->>'whatsapp_number'), ''), b.whatsapp_number),
                        email = coalesce(nullif(lower(trim(x->>'email')), ''), b.email),
                        instagram = coalesce("sales-pipe".clean_handle(x->>'instagram'), b.instagram),
                        facebook = coalesce("sales-pipe".clean_handle(x->>'facebook'), b.facebook),
                        linkedin = coalesce(nullif(trim(x->>'linkedin'), ''), b.linkedin),
                        existing_website = coalesce(v_site, b.existing_website),
                        company_type = coalesce(nullif(x->>'company_type', ''), b.company_type),
                        contact_name = coalesce(nullif(trim(x->>'contact_name'), ''), b.contact_name),
                        notes = CASE WHEN nullif(trim(x->>'notes'), '') IS NOT NULL THEN concat_ws('; ', b.notes, trim(x->>'notes')) ELSE b.notes END,
                        owner_contact = coalesce(nullif(trim(x->>'owner_contact'), ''), nullif(trim(x->>'owner_whatsapp'), ''), nullif(trim(x->>'owner_social'), ''), b.owner_contact),
                        owner_email = coalesce(nullif(lower(trim(x->>'owner_email')), ''), b.owner_email),
                        tech_partner_type = coalesce(v_tech_type, b.tech_partner_type),
                        tech_partner_name = coalesce(v_tech_name, b.tech_partner_name),
                        branches = CASE WHEN v_branches IS NOT NULL AND jsonb_array_length(v_branches) > 0 THEN v_branches ELSE b.branches END,
                        source = coalesce(nullif(trim(x->>'source'), ''), b.source),
                        import_batch_id = coalesce(p_batch_id, b.import_batch_id),
                        gaps_found = coalesce(nullif(trim(x->>'gaps_found'), ''), b.gaps_found),
                        has_no_website = coalesce((x->>'has_no_website')::boolean, (lower(trim(coalesce(x->>'no_site', ''))) IN ('true', 'yes', '1', 't')), b.has_no_website)
                    WHERE b.id = v_bid;

                    IF array_length(v_services, 1) > 0 THEN
                        UPDATE "sales-pipe".opportunities SET services_pitched = v_services
                        WHERE business_id = v_bid AND stage = 'Needs review';
                    END IF;

                    UPDATE "sales-pipe".businesses SET problems = "sales-pipe".lead_problems(v_bid) WHERE id = v_bid RETURNING problems INTO v_probs;
                    IF array_length(v_probs, 1) IS NULL THEN
                        v_ready := v_ready + 1;
                    ELSE
                        v_missing := v_missing + 1;
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'ready', v_ready,
        'missing', v_missing,
        'skipped', v_skipped,
        'total', v_ready + v_missing + v_skipped
    );
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".is_valid_uk_postcode(p_pc text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
    SELECT upper(trim(coalesce(p_pc, ''))) ~ '^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$'
        OR trim(coalesce(p_pc, '')) ~ '^[1-9][0-9]{2}\s?[0-9]{3}$';
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".lead_problems(p_business_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    b "sales-pipe".businesses;
BEGIN
    SELECT * INTO b FROM "sales-pipe".businesses WHERE id = p_business_id;
    IF b.id IS NULL THEN RETURN '{}'::text[]; END IF;
    RETURN "sales-pipe".compute_business_problems(b);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".list_import_batches()
 RETURNS TABLE(id uuid, file_name text, uploaded_by uuid, uploader_name text, created_at timestamp with time zone, total_rows integer, ready_count integer, missing_count integer, failed_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    SELECT
        ib.id,
        ib.file_name,
        ib.uploaded_by,
        coalesce(p.full_name, 'Staff') AS uploader_name,
        ib.created_at,
        ib.total_rows,
        ib.ready_count,
        ib.missing_count,
        ib.failed_count
    FROM "sales-pipe".import_batches ib
    LEFT JOIN "sales-pipe".profiles p ON p.id = ib.uploaded_by
    ORDER BY ib.created_at DESC
    LIMIT 100;
END;
$function$;
DROP FUNCTION "sales-pipe"."list_pitches"(p_service text, p_type text, p_filter text, p_search text, p_platform text, p_assigned text, p_include_archived boolean, p_limit integer, p_offset integer);
CREATE OR REPLACE FUNCTION "sales-pipe".list_pitches(p_service text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_filter text DEFAULT 'all'::text, p_search text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_assigned text DEFAULT NULL::text, p_include_archived boolean DEFAULT false, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
 RETURNS TABLE(opportunity_id uuid, business_id uuid, business_name text, business_type text, area text, postcode text, address text, google_rating numeric, phone text, email text, instagram text, facebook text, company_type text, contact_name text, archived boolean, stage text, services_pitched text[], services_won text[], assigned_sales_id uuid, assigned_sales_name text, assigned_consultant_name text, consultation_at timestamp with time zone, created_at timestamp with time zone, threads jsonb, next_due_on date, needs_reply boolean, total_count bigint, existing_website text, has_no_website boolean, whatsapp_number text, owner_contact text, owner_email text, tech_partner_type text, tech_partner_name text, gaps_found text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    WITH base AS (
        SELECT o.*,
               b.business_name AS b_name,
               b.business_type AS b_type,
               b.area AS b_area,
               b.postcode AS b_pc,
               b.address AS b_address,
               b.google_rating AS b_rating,
               coalesce(b.whatsapp_number, b.phone) AS b_phone,
               b.email AS b_email,
               b.instagram AS b_ig,
               b.facebook AS b_fb,
               b.company_type AS b_ct,
               b.contact_name AS b_contact,
               b.archived AS b_archived,
               b.existing_website AS b_website,
               coalesce(b.has_no_website, false) AS b_no_website,
               b.whatsapp_number AS b_whatsapp,
               b.owner_contact AS b_owner_contact,
               b.owner_email AS b_owner_email,
               b.tech_partner_type AS b_tech_type,
               b.tech_partner_name AS b_tech_name,
               b.gaps_found AS b_gaps,
               EXISTS (SELECT 1 FROM "sales-pipe".threads t
                        WHERE t.opportunity_id = o.id AND t.status = 'Replied'
                          AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity'))
               AND o.stage IN ('Active', 'Interested', 'Consultation') AS b_needs_reply
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE (p_include_archived OR NOT b.archived)
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_service, '') IS NULL OR p_service = ANY(o.services_pitched))
          AND (nullif(p_type, '') IS NULL 
               OR b.business_type = p_type 
               OR b.business_type = "sales-pipe".canonical_business_type(p_type))
          AND (nullif(p_search, '') IS NULL
               OR b.business_name ILIKE '%' || p_search || '%'
               OR b.area ILIKE '%' || p_search || '%'
               OR b.postcode ILIKE '%' || p_search || '%'
               OR b.phone_normalised = "sales-pipe".normalise_phone(p_search)
               OR b.email ILIKE '%' || p_search || '%')
          AND (nullif(p_platform, '') IS NULL OR EXISTS (
               SELECT 1 FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.platform = p_platform))
          AND (nullif(p_assigned, '') IS NULL
               OR (p_assigned = 'me' AND (o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid))
               OR (p_assigned = 'unassigned' AND o.assigned_sales_id IS NULL)
               OR (p_assigned NOT IN ('me', 'unassigned') AND (o.assigned_sales_id::text = p_assigned OR o.assigned_consultant_id::text = p_assigned)))
    ),
    filtered AS (
        SELECT * FROM base
        WHERE coalesce(p_filter, 'all') = 'all'
           OR (p_filter = 'needs-reply' AND base.b_needs_reply)
           OR (p_filter = 'needs-consultant' AND base.stage = 'Consultation' AND base.assigned_consultant_id IS NULL)
           OR (p_filter = 'open' AND base.stage IN ('Active', 'Interested', 'Consultation'))
           OR (p_filter = 'Needs review' AND base.stage = 'Needs review' AND EXISTS (
               SELECT 1 FROM "sales-pipe".businesses b WHERE b.id = base.business_id AND b.problems = '{}'::text[]
           ))
           OR (p_filter NOT IN ('Needs review', 'needs-reply', 'needs-consultant', 'open', 'all') AND base.stage = p_filter)
    )
    SELECT f.id, f.business_id, f.b_name, f.b_type, f.b_area, f.b_pc, f.b_address, f.b_rating, f.b_phone, f.b_email,
           f.b_ig, f.b_fb, f.b_ct, f.b_contact, f.b_archived, f.stage, f.services_pitched, f.services_won,
           f.assigned_sales_id,
           (SELECT full_name FROM "sales-pipe".profiles WHERE id = f.assigned_sales_id),
           (SELECT full_name FROM "sales-pipe".profiles WHERE id = f.assigned_consultant_id),
           f.consultation_at, f.created_at,
           coalesce((SELECT jsonb_agg(jsonb_build_object(
                        'id', t.id, 'platform', t.platform, 'status', t.status, 'step', t.step,
                        'next_due_on', t.next_due_on, 'paused_reason', t.paused_reason)
                      ORDER BY array_position(ARRAY['WhatsApp','Instagram','Facebook','Email','LinkedIn'], t.platform))
                     FROM "sales-pipe".threads t WHERE t.opportunity_id = f.id), '[]'::jsonb),
           (SELECT min(t.next_due_on) FROM "sales-pipe".threads t
             WHERE t.opportunity_id = f.id AND t.next_due_on IS NOT NULL),
           f.b_needs_reply,
           count(*) OVER (),
           f.b_website,
           f.b_no_website,
           f.b_whatsapp,
           f.b_owner_contact,
           f.b_owner_email,
           f.b_tech_type,
           f.b_tech_name,
           f.b_gaps
    FROM filtered f
    ORDER BY
        CASE WHEN p_filter = 'Needs review' THEN f.created_at END DESC,
        f.b_needs_reply DESC,
        (SELECT min(t.next_due_on) FROM "sales-pipe".threads t WHERE t.opportunity_id = f.id) ASC NULLS LAST,
        f.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".log_audience_export(p_business_id uuid, p_rows integer, p_filters jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    PERFORM "sales-pipe".audience_log('audience_exported', p_business_id, jsonb_build_object('rows', p_rows, 'filters', p_filters));
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".missing_counts(p_type text DEFAULT NULL::text, p_problem text DEFAULT NULL::text, p_batch uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_result jsonb;
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    WITH base AS (
        SELECT b.id, b.business_type, b.problems
        FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        WHERE o.stage = 'Needs review'
          AND b.problems <> '{}'::text[]
          AND NOT b.archived
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid
               OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (p_batch IS NULL OR b.import_batch_id = p_batch)
    ),
    type_counts AS (
        SELECT coalesce(jsonb_agg(jsonb_build_object('business_type', t.cat, 'count', coalesce(cnt.c, 0))
               ORDER BY array_position(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management'], t.cat)), '[]'::jsonb) AS js
        FROM unnest(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management']) AS t(cat)
        LEFT JOIN (
            SELECT b.business_type, count(b.id)::int AS c
            FROM base b
            WHERE (nullif(p_problem, '') IS NULL OR p_problem = ANY(b.problems))
            GROUP BY b.business_type
        ) cnt ON cnt.business_type = t.cat
    ),
    prob_counts AS (
        SELECT coalesce(jsonb_agg(jsonb_build_object('problem', p.code, 'label', p.label, 'count', coalesce(cnt.c, 0))), '[]'::jsonb) AS js
        FROM (VALUES
            ('name', 'Business name'),
            ('website', 'Website'),
            ('location', 'Location'),
            ('postcode', 'Postcode'),
            ('category', 'Category'),
            ('service', 'Service'),
            ('owner_name', 'Owner name'),
            ('owner_contact', 'Owner contact'),
            ('business_contact', 'Business contact'),
            ('tech_partner', 'Tech partner'),
            ('gaps', 'Gaps found')
        ) AS p(code, label)
        LEFT JOIN (
            SELECT unnest(b.problems) AS prob, count(b.id)::int AS c
            FROM base b
            WHERE (nullif(p_type, '') IS NULL OR b.business_type = p_type)
            GROUP BY prob
        ) cnt ON cnt.prob = p.code
    ),
    total_count AS (
        SELECT count(DISTINCT b.id)::bigint AS tot
        FROM base b
        WHERE (nullif(p_type, '') IS NULL OR b.business_type = p_type)
          AND (nullif(p_problem, '') IS NULL OR p_problem = ANY(b.problems))
    )
    SELECT jsonb_build_object(
        'types', (SELECT js FROM type_counts),
        'problems', (SELECT js FROM prob_counts),
        'total', coalesce((SELECT tot FROM total_count), 0)
    ) INTO v_result;

    RETURN v_result;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".missing_list(p_type text DEFAULT NULL::text, p_problem text DEFAULT NULL::text, p_batch uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(opportunity_id uuid, business_id uuid, business_name text, business_type text, existing_website text, has_no_website boolean, address text, postcode text, branches jsonb, services text[], contact_name text, owner_email text, owner_contact text, email text, whatsapp_number text, instagram text, facebook text, linkedin text, tech_partner_type text, tech_partner_name text, gaps_found text, source text, import_batch_id uuid, batch_file_name text, batch_uploaded_at timestamp with time zone, problems text[], total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    WITH rows AS (
        SELECT
            o.id AS r_opportunity_id,
            b.id AS r_business_id,
            b.business_name AS r_business_name,
            b.business_type AS r_business_type,
            b.existing_website AS r_existing_website,
            coalesce(b.has_no_website, false) AS r_has_no_website,
            b.address AS r_address,
            b.postcode AS r_postcode,
            coalesce(b.branches, '[]'::jsonb) AS r_branches,
            o.services_pitched AS r_services,
            b.contact_name AS r_contact_name,
            b.owner_email AS r_owner_email,
            b.owner_contact AS r_owner_contact,
            b.email AS r_email,
            b.whatsapp_number AS r_whatsapp_number,
            b.instagram AS r_instagram,
            b.facebook AS r_facebook,
            b.linkedin AS r_linkedin,
            b.tech_partner_type AS r_tech_partner_type,
            b.tech_partner_name AS r_tech_partner_name,
            b.gaps_found AS r_gaps_found,
            b.source AS r_source,
            b.import_batch_id AS r_import_batch_id,
            ib.file_name AS r_batch_file_name,
            ib.created_at AS r_batch_uploaded_at,
            b.problems AS r_problems
        FROM "sales-pipe".businesses b
        JOIN "sales-pipe".opportunities o ON o.business_id = b.id
        LEFT JOIN "sales-pipe".import_batches ib ON ib.id = b.import_batch_id
        WHERE o.stage = 'Needs review'
          AND b.problems <> '{}'::text[]
          AND NOT b.archived
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid
               OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_type, '') IS NULL OR b.business_type = p_type)
          AND (nullif(p_problem, '') IS NULL OR p_problem = ANY(b.problems))
          AND (p_batch IS NULL OR b.import_batch_id = p_batch)
    )
    SELECT
        r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
        r.r_existing_website, r.r_has_no_website, r.r_address, r.r_postcode,
        r.r_branches, r.r_services, r.r_contact_name, r.r_owner_email,
        r.r_owner_contact,
        r.r_email, r.r_whatsapp_number, r.r_instagram, r.r_facebook, r.r_linkedin,
        r.r_tech_partner_type, r.r_tech_partner_name,
        r.r_gaps_found, r.r_source, r.r_import_batch_id, r.r_batch_file_name,
        r.r_batch_uploaded_at, r.r_problems,
        count(*) OVER () AS total_count
    FROM rows r
    ORDER BY r.r_business_name ASC
    LIMIT p_limit OFFSET p_offset;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".normalise_email(p_email text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    IF p_email IS NULL OR trim(p_email) = '' THEN RETURN NULL; END IF;
    RETURN LOWER(TRIM(p_email));
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".normalise_phone(p_phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    clean_phone text;
BEGIN
    IF p_phone IS NULL OR trim(p_phone) = '' THEN RETURN NULL; END IF;
    clean_phone := regexp_replace(p_phone, '[^\d+]', '', 'g');
    
    -- If it starts with 07 (UK mobile), convert to +44
    IF clean_phone LIKE '07%' THEN
        clean_phone := '+44' || substr(clean_phone, 2);
    -- If it doesn't have a plus but has country code, prepend +
    ELSIF clean_phone NOT LIKE '+%' AND clean_phone ~ '^[1-9]' THEN
        clean_phone := '+' || clean_phone;
    END IF;
    
    RETURN clean_phone;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".on_employee_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.auth_user_id IS NOT NULL AND OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id THEN
    UPDATE "sales-pipe".profiles SET is_active = false WHERE id = OLD.auth_user_id;
  END IF;
  PERFORM "sales-pipe".sync_profile_from_matrix(NEW.id);
  RETURN NULL;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".on_matrix_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "sales-pipe".sync_profile_from_matrix(OLD.employee_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM "sales-pipe".sync_profile_from_matrix(NEW.employee_id);
  END IF;
  RETURN NULL;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".open_campaign_reply_in_leads(p_reply_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    r record;
    v_opp record;
    v_platform text;
    v_thread uuid;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    SELECT * INTO r FROM "sales-pipe".campaign_replies WHERE id = p_reply_id FOR UPDATE;
    IF r.id IS NULL THEN RAISE EXCEPTION 'This reply was not found'; END IF;
    IF r.thread_id IS NOT NULL THEN
        UPDATE "sales-pipe".campaign_replies SET status = 'in_leads', handled_by = coalesce(handled_by, auth.uid()), handled_at = coalesce(handled_at, now()) WHERE id = r.id;
        RETURN jsonb_build_object('opportunity_id', r.opportunity_id, 'thread_id', r.thread_id);
    END IF;
    IF r.business_id IS NULL THEN
        RAISE EXCEPTION 'This sender is not in Lead Management. Add them as a business first';
    END IF;

    -- The business's most relevant pitch: open ones first, then the newest
    SELECT * INTO v_opp FROM "sales-pipe".opportunities
    WHERE business_id = r.business_id
    ORDER BY (stage IN ('Active', 'Interested', 'Consultation')) DESC, created_at DESC LIMIT 1;
    IF v_opp.id IS NULL THEN RAISE EXCEPTION 'This business has no pitch yet'; END IF;
    IF v_opp.stage = 'Needs review' THEN
        RAISE EXCEPTION 'Approve this lead in the Approval queue first, then open the reply';
    END IF;
    IF v_opp.stage = 'Do not contact' THEN
        RAISE EXCEPTION 'This business is on Do not contact. Reopen it from the lead page first';
    END IF;

    v_platform := CASE r.channel WHEN 'email' THEN 'Email' ELSE 'WhatsApp' END;
    INSERT INTO "sales-pipe".threads (opportunity_id, platform, status, step)
    VALUES (v_opp.id, v_platform, 'Not contacted', 0)
    ON CONFLICT (opportunity_id, platform) DO NOTHING;
    SELECT id INTO v_thread FROM "sales-pipe".threads WHERE opportunity_id = v_opp.id AND platform = v_platform;

    INSERT INTO "sales-pipe".messages (thread_id, direction, body, subject, send_method, external_message_id, created_at)
    VALUES (v_thread, 'inbound', r.body, r.subject, 'webhook', NULL, r.received_at);

    IF v_opp.stage IN ('Went cold', 'No response', 'Declined') THEN
        -- Closed: mark the late reply, then reopen; the reopen starts a new round around it
        UPDATE "sales-pipe".threads SET last_inbound_at = r.received_at WHERE id = v_thread;
        UPDATE "sales-pipe".opportunities SET replied_after_close_at = r.received_at WHERE id = v_opp.id;
        PERFORM "sales-pipe".set_stage(v_opp.id, 'Interested', 'Replied to a campaign', auth.uid());
    ELSE
        PERFORM "sales-pipe".discard_drafts(v_opp.id);
        UPDATE "sales-pipe".threads
        SET status = 'Replied', next_due_on = NULL, last_inbound_at = greatest(coalesce(last_inbound_at, r.received_at), r.received_at), paused_reason = NULL
        WHERE id = v_thread;
        UPDATE "sales-pipe".threads
        SET status = 'Paused', paused_reason = 'Replied on ' || v_platform, next_due_on = NULL
        WHERE opportunity_id = v_opp.id AND id <> v_thread AND status IN ('Not contacted', 'Awaiting reply');
        IF v_opp.stage = 'Active' THEN
            PERFORM "sales-pipe".set_stage(v_opp.id, 'Interested', 'Replied to a campaign', auth.uid());
        END IF;
        PERFORM "sales-pipe".generate_draft(v_thread, 'Reply');
    END IF;

    UPDATE "sales-pipe".campaign_replies
    SET status = 'in_leads', opportunity_id = v_opp.id, thread_id = v_thread, handled_by = auth.uid(), handled_at = now()
    WHERE id = r.id;
    RETURN jsonb_build_object('opportunity_id', v_opp.id, 'thread_id', v_thread);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".record_audience_opt_out(p_customer_id uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_client text;
    v_already boolean;
BEGIN
    SELECT coalesce(a.sender_name, b.business_name), c.do_not_contact INTO v_client, v_already
    FROM "sales-pipe".customer_leads c
    JOIN "sales-pipe".businesses b ON b.id = c.business_id
    LEFT JOIN "sales-pipe".audience_clients a ON a.business_id = c.business_id
    WHERE c.id = p_customer_id AND lower(c.email) = lower(trim(p_email));
    IF v_client IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
    IF NOT v_already THEN
        UPDATE "sales-pipe".customer_leads
        SET do_not_contact = true, do_not_contact_at = now(), do_not_contact_reason = 'Opted out using the link in an email'
        WHERE id = p_customer_id;
        UPDATE "sales-pipe".campaign_recipients SET opted_out_at = now()
        WHERE id = (SELECT id FROM "sales-pipe".campaign_recipients WHERE customer_lead_id = p_customer_id AND status = 'sent'
                    ORDER BY sent_at DESC LIMIT 1);
    END IF;
    RETURN jsonb_build_object('client', v_client, 'already', v_already);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".record_email_events(p_events jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    e record;
    v_at timestamptz;
    v_count int := 0;
    v_n int;
    v_final text;   -- bounced / complained / failed, or NULL
    v_reason text;
BEGIN
    FOR e IN
        SELECT * FROM jsonb_to_recordset(p_events)
            AS r(id text, type text, "at" text, "to" text, reason text, permanent boolean)
        WHERE r.id IS NOT NULL
    LOOP
        v_at := coalesce(nullif(e."at", '')::timestamptz, now());
        v_final := CASE e.type WHEN 'bounced' THEN 'bounced' WHEN 'complained' THEN 'complained' WHEN 'failed' THEN 'failed' END;
        v_reason := CASE e.type
            WHEN 'bounced' THEN 'Bounced' || coalesce(': ' || nullif(e.reason, ''), '')
            WHEN 'complained' THEN 'Marked as spam by the recipient'
            WHEN 'failed' THEN 'Not sent' || coalesce(': ' || nullif(e.reason, ''), '')
        END;

        IF e.type NOT IN ('delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed') THEN
            CONTINUE;  -- sent / delivery_delayed change nothing we show
        END IF;

        UPDATE "sales-pipe".messages m
        SET delivery_status = CASE
                WHEN m.delivery_status IN ('bounced', 'complained') THEN m.delivery_status
                WHEN v_final IS NOT NULL THEN v_final
                WHEN coalesce(m.delivery_status, 'sent') IN ('queued', 'sent') THEN 'delivered'
                ELSE m.delivery_status END,
            delivered_at = CASE WHEN v_final IS NULL THEN coalesce(m.delivered_at, v_at) ELSE m.delivered_at END,
            opened_at = CASE WHEN e.type IN ('opened', 'clicked') THEN coalesce(m.opened_at, v_at) ELSE m.opened_at END,
            clicked_at = CASE WHEN e.type = 'clicked' THEN coalesce(m.clicked_at, v_at) ELSE m.clicked_at END,
            error_detail = CASE WHEN v_final IS NOT NULL AND coalesce(m.delivery_status, '') NOT IN ('bounced', 'complained') THEN left(v_reason, 500) ELSE m.error_detail END
        WHERE m.external_message_id = e.id;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_count := v_count + v_n;

        UPDATE "sales-pipe".campaign_recipients cr
        SET delivery_status = CASE
                WHEN cr.delivery_status IN ('bounced', 'complained') THEN cr.delivery_status
                WHEN v_final IS NOT NULL THEN v_final
                WHEN cr.delivery_status IS NULL OR cr.delivery_status = 'sent' THEN 'delivered'
                ELSE cr.delivery_status END,
            delivered_at = CASE WHEN v_final IS NULL THEN coalesce(cr.delivered_at, v_at) ELSE cr.delivered_at END,
            opened_at = CASE WHEN e.type IN ('opened', 'clicked') THEN coalesce(cr.opened_at, v_at) ELSE cr.opened_at END,
            clicked_at = CASE WHEN e.type = 'clicked' THEN coalesce(cr.clicked_at, v_at) ELSE cr.clicked_at END,
            -- The provider accepted it but it never arrived: show it as failed in the report
            status = CASE WHEN v_final IS NOT NULL THEN 'failed' ELSE cr.status END,
            error_detail = CASE WHEN v_final IS NOT NULL AND coalesce(cr.delivery_status, '') NOT IN ('bounced', 'complained') THEN left(v_reason, 500) ELSE cr.error_detail END,
            updated_at = now()
        WHERE cr.external_message_id = e.id AND cr.channel = 'email';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_count := v_count + v_n;

        -- Never email an address that hard-bounced or reported us as spam again
        IF (e.type = 'bounced' AND coalesce(e.permanent, true)) OR e.type = 'complained' THEN
            INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source)
            SELECT lower(trim(addr)), 'Email', left(v_reason, 300), CASE WHEN e.type = 'complained' THEN 'complaint' ELSE 'bounce' END
            FROM (
                SELECT coalesce(nullif(e."to", ''),
                    (SELECT cr.email FROM "sales-pipe".campaign_recipients cr WHERE cr.external_message_id = e.id LIMIT 1),
                    (SELECT b.email FROM "sales-pipe".messages m
                        JOIN "sales-pipe".threads t ON t.id = m.thread_id
                        JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
                        JOIN "sales-pipe".businesses b ON b.id = o.business_id
                     WHERE m.external_message_id = e.id LIMIT 1)) AS addr
            ) a
            WHERE addr IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM "sales-pipe".opt_outs o
                              WHERE lower(o.identifier) = lower(trim(a.addr)) AND lower(o.channel) IN ('all', 'email'));
        END IF;
    END LOOP;

    RETURN v_count;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".record_inbound(p_platform text, p_external_thread_id text, p_from text, p_body text, p_external_message_id text, p_media_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_thread_id uuid;
    v_opp_id uuid;
    v_stage text;
BEGIN
    IF p_external_message_id IS NOT NULL AND EXISTS (SELECT 1 FROM "sales-pipe".messages WHERE external_message_id = p_external_message_id) THEN
        RETURN;
    END IF;
    SELECT id, opportunity_id INTO v_thread_id, v_opp_id
    FROM "sales-pipe".threads
    WHERE p_external_thread_id IS NOT NULL AND external_thread_id = p_external_thread_id AND platform = p_platform
    LIMIT 1;
    IF v_thread_id IS NULL THEN
        SELECT t.id, t.opportunity_id INTO v_thread_id, v_opp_id
        FROM "sales-pipe".threads t
        JOIN "sales-pipe".opportunities o ON t.opportunity_id = o.id
        JOIN "sales-pipe".businesses b ON o.business_id = b.id
        WHERE t.platform = p_platform
          AND o.stage IN ('Active', 'Interested', 'Consultation', 'Went cold', 'No response', 'Declined', 'Do not contact')
          AND (b.phone_normalised = "sales-pipe".normalise_phone(p_from)
               OR "sales-pipe".normalise_phone(b.whatsapp_number) = "sales-pipe".normalise_phone(p_from)
               OR b.email_normalised = "sales-pipe".normalise_email(p_from)
               OR lower(b.instagram) = lower(trim(both '@' FROM p_from))
               OR lower(b.facebook) = lower(p_from))
        -- An open pitch wins over a closed one for the same business
        ORDER BY (o.stage IN ('Active', 'Interested', 'Consultation')) DESC, t.created_at DESC LIMIT 1;
        IF v_thread_id IS NOT NULL AND p_external_thread_id IS NOT NULL THEN
            UPDATE "sales-pipe".threads SET external_thread_id = p_external_thread_id WHERE id = v_thread_id;
        END IF;
    END IF;
    IF v_thread_id IS NULL THEN
        RETURN; -- not one of our leads
    END IF;
    INSERT INTO "sales-pipe".messages (thread_id, direction, body, send_method, external_message_id, media_url)
    VALUES (v_thread_id, 'inbound', p_body, 'webhook', p_external_message_id, p_media_url);
    PERFORM "sales-pipe".discard_drafts(v_opp_id);
    SELECT stage INTO v_stage FROM "sales-pipe".opportunities WHERE id = v_opp_id;

    IF upper(regexp_replace(trim(p_body), '[.!]+$', '')) IN ('STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPT-OUT', 'OPTOUT') THEN
        UPDATE "sales-pipe".threads SET status = 'Opted out', next_due_on = NULL, last_inbound_at = now() WHERE opportunity_id = v_opp_id;
        IF v_stage IS DISTINCT FROM 'Do not contact' THEN
            UPDATE "sales-pipe".opportunities SET stage = 'Do not contact', closed_at = now(), replied_after_close_at = NULL WHERE id = v_opp_id;
        END IF;
        RETURN;
    END IF;

    IF v_stage IN ('Went cold', 'No response', 'Declined', 'Do not contact') THEN
        -- Closed: keep it closed, mark it, tell the owner
        UPDATE "sales-pipe".threads SET last_inbound_at = now() WHERE id = v_thread_id;
        UPDATE "sales-pipe".opportunities SET replied_after_close_at = now() WHERE id = v_opp_id;
        INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
        SELECT coalesce(o.assigned_consultant_id, o.assigned_sales_id), 'new_reply',
               b.business_name || ' replied on ' || p_platform || ' after being closed (' || v_stage || ')',
               '/dashboard/' || o.id
        FROM "sales-pipe".opportunities o JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE o.id = v_opp_id AND coalesce(o.assigned_consultant_id, o.assigned_sales_id) IS NOT NULL;
        RETURN;
    END IF;

    UPDATE "sales-pipe".threads
    SET status = 'Replied', next_due_on = NULL, last_inbound_at = now(), paused_reason = NULL
    WHERE id = v_thread_id;
    UPDATE "sales-pipe".threads
    SET status = 'Paused', paused_reason = 'Replied on ' || p_platform, next_due_on = NULL
    WHERE opportunity_id = v_opp_id AND id <> v_thread_id AND status IN ('Not contacted', 'Awaiting reply');
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT coalesce(o.assigned_consultant_id, o.assigned_sales_id), 'new_reply',
           'New reply from ' || b.business_name || ' on ' || p_platform,
           '/dashboard/' || o.id || '/thread/' || v_thread_id
    FROM "sales-pipe".opportunities o JOIN "sales-pipe".businesses b ON b.id = o.business_id
    WHERE o.id = v_opp_id AND coalesce(o.assigned_consultant_id, o.assigned_sales_id) IS NOT NULL;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".record_outbound(p_thread_id uuid, p_body text, p_subject text, p_template_id uuid, p_send_method text, p_external_message_id text, p_sent_by uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_thread record;
    v_opp record;
    v_new_step int;
    v_days int;
BEGIN
    SELECT * INTO v_thread FROM "sales-pipe".threads WHERE id = p_thread_id;
    IF v_thread.id IS NULL THEN RAISE EXCEPTION 'Thread not found'; END IF;
    SELECT * INTO v_opp FROM "sales-pipe".opportunities WHERE id = v_thread.opportunity_id;
    PERFORM "sales-pipe".check_opp_access(v_opp.id);
    IF v_opp.stage = 'Do not contact' OR v_thread.status = 'Opted out' THEN
        RAISE EXCEPTION 'This business asked not to be contacted';
    END IF;
    IF v_opp.stage IN ('Went cold', 'No response', 'Declined') THEN
        RAISE EXCEPTION 'This lead is closed (%). Reopen it to send', v_opp.stage;
    END IF;
    IF v_opp.stage = 'Needs review' THEN
        RAISE EXCEPTION 'Approve this lead first';
    END IF;
    IF coalesce(trim(p_body), '') = '' THEN
        RAISE EXCEPTION 'The message is empty';
    END IF;
    v_new_step := least(v_thread.step + 1, 4);
    SELECT days_delay INTO v_days FROM "sales-pipe".cadence_rules
    WHERE step_name = CASE v_new_step WHEN 1 THEN 'Follow up 1' WHEN 2 THEN 'Follow up 2' WHEN 3 THEN 'Follow up 3' END;
    v_days := CASE WHEN v_new_step < 4 THEN coalesce(v_days, CASE v_new_step WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 14 END) END;
    IF v_thread.status = 'Replied' THEN
        INSERT INTO "sales-pipe".messages (thread_id, direction, body, subject, template_id, step_label, send_method, external_message_id, sent_by, delivery_status)
        VALUES (p_thread_id, 'outbound', p_body, p_subject, p_template_id, 'Reply', p_send_method, p_external_message_id, coalesce(p_sent_by, auth.uid()), 'sent');
        UPDATE "sales-pipe".threads SET last_outbound_at = now() WHERE id = p_thread_id;
        UPDATE "sales-pipe".drafts SET status = 'sent' WHERE thread_id = p_thread_id AND status IN ('ready', 'needs_data');
        RETURN;
    END IF;
    INSERT INTO "sales-pipe".messages (thread_id, direction, body, subject, template_id, step_label, send_method, external_message_id, sent_by, delivery_status)
    VALUES (
        p_thread_id, 'outbound', p_body, p_subject, p_template_id,
        CASE v_thread.step WHEN 0 THEN 'First contact' WHEN 1 THEN 'Follow-up 1' WHEN 2 THEN 'Follow-up 2' ELSE 'Final check' END,
        p_send_method, p_external_message_id, coalesce(p_sent_by, auth.uid()), 'sent'
    );
    UPDATE "sales-pipe".threads
    SET step = v_new_step,
        status = 'Awaiting reply',
        paused_reason = NULL,
        next_due_on = CASE WHEN v_days IS NULL
                           THEN "sales-pipe".add_working_days(CURRENT_DATE, 14)  -- after the final check: wait, then No reply
                           ELSE "sales-pipe".add_working_days(CURRENT_DATE, v_days) END,
        last_outbound_at = now()
    WHERE id = p_thread_id;
    UPDATE "sales-pipe".drafts SET status = 'sent'
    WHERE thread_id = p_thread_id AND status IN ('ready', 'needs_data');
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".record_outreach(p_lead_id uuid, p_action text, p_task_id uuid DEFAULT NULL::uuid, p_details text DEFAULT NULL::text, p_reply_channel text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_lead record;
    v_next_date date;
    v_new_stage text;
    v_channel text;
    v_won_at timestamptz;
    v_lost_at timestamptz;
BEGIN
    SELECT * INTO v_lead FROM "sales-pipe".leads WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    v_next_date := v_lead.next_follow_up;
    v_new_stage := v_lead.stage;
    v_channel := v_lead.channel;
    v_won_at := v_lead.won_at;
    v_lost_at := v_lead.lost_at;

    IF p_reply_channel IS NOT NULL AND p_reply_channel IN ('Email', 'WhatsApp', 'Instagram', 'Phone', 'Walk-in') THEN
        v_channel := p_reply_channel;
    END IF;

    IF p_action = 'sent' THEN
        v_new_stage := 'Contacted';
        IF v_lead.follow_up_count = 0 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 3);
        ELSIF v_lead.follow_up_count = 1 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 5);
        ELSIF v_lead.follow_up_count = 2 THEN
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 14);
        END IF;
        
        UPDATE "sales-pipe".leads 
        SET stage = v_new_stage,
            channel = v_channel,
            follow_up_count = follow_up_count + 1,
            next_follow_up = v_next_date
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'sent', COALESCE(p_details, 'Message sent via ' || v_channel), 'sales-1');

        INSERT INTO "sales-pipe".user_logs (action, entity_type, entity_id, details)
        VALUES ('record_outreach_sent', 'lead', p_lead_id::text, jsonb_build_object('channel', v_channel, 'follow_up_count', v_lead.follow_up_count + 1));

    ELSIF p_action = 'no_reply_final' THEN
        UPDATE "sales-pipe".leads 
        SET stage = 'Lost', 
            next_follow_up = NULL,
            lost_at = COALESCE(lost_at, NOW())
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'system', 'Final check: no reply. Marked as lost.', 'system');

        INSERT INTO "sales-pipe".app_logs (event, category, details)
        VALUES ('lead_auto_closed_lost', 'pipeline', jsonb_build_object('lead_id', p_lead_id));

    ELSIF p_action IN ('replied', 'interested', 'won', 'lost', 'do_not_contact', 'new') THEN
        IF p_action = 'new' THEN
            v_new_stage := 'New';
            v_next_date := CURRENT_DATE;
        ELSIF p_action = 'replied' THEN
            v_new_stage := 'Replied';
            v_next_date := NULL;
        ELSIF p_action = 'interested' THEN
            v_new_stage := 'Interested';
            v_next_date := "sales-pipe".add_working_days(CURRENT_DATE, 2);
        ELSIF p_action = 'won' THEN
            v_new_stage := 'Won';
            v_next_date := CURRENT_DATE + interval '30 days';
            v_won_at := COALESCE(v_won_at, NOW());
        ELSIF p_action = 'lost' THEN
            v_new_stage := 'Lost';
            v_next_date := NULL;
            v_lost_at := COALESCE(v_lost_at, NOW());
        ELSIF p_action = 'do_not_contact' THEN
            v_new_stage := 'Do not contact';
            v_next_date := NULL;
        END IF;

        UPDATE "sales-pipe".leads 
        SET stage = v_new_stage,
            channel = v_channel,
            next_follow_up = v_next_date,
            won_at = v_won_at,
            lost_at = v_lost_at
        WHERE id = p_lead_id;

        INSERT INTO "sales-pipe".activity_log (lead_id, action_type, details, created_by)
        VALUES (p_lead_id, 'note', 'Stage updated to ' || v_new_stage || CASE WHEN p_reply_channel IS NOT NULL THEN ' via ' || p_reply_channel ELSE '' END, 'sales-1');

        INSERT INTO "sales-pipe".user_logs (action, entity_type, entity_id, details)
        VALUES ('update_stage', 'lead', p_lead_id::text, jsonb_build_object('new_stage', v_new_stage, 'channel', v_channel));
    END IF;

    -- If a task was provided, mark it as completed
    IF p_task_id IS NOT NULL THEN
        UPDATE "sales-pipe".tasks SET status = 'completed' WHERE id = p_task_id;
    END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".record_unsubscribe(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_email text := lower(trim(p_email));
    v_id uuid;
    v_name text;
BEGIN
    IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+$' THEN
        RAISE EXCEPTION 'Not an email address';
    END IF;

    IF EXISTS (SELECT 1 FROM "sales-pipe".opt_outs
               WHERE lower(identifier) = v_email AND lower(channel) IN ('all', 'email')) THEN
        RETURN jsonb_build_object('already', true);
    END IF;

    INSERT INTO "sales-pipe".opt_outs (identifier, channel, reason, source)
    VALUES (v_email, 'Email', 'Opted out using the link in our email', 'unsubscribe')
    RETURNING id INTO v_id;

    SELECT string_agg(DISTINCT b.business_name, ', ') INTO v_name
    FROM "sales-pipe".businesses b WHERE lower(b.email) = v_email;

    -- Tell the admins and whoever owns the lead
    INSERT INTO "sales-pipe".notifications (user_id, type, title, link)
    SELECT DISTINCT ON (u.user_id) u.user_id, 'unsubscribed',
           coalesce(v_name, v_email) || ' opted out of emails',
           coalesce(u.link, '/dashboard/settings#do-not-contact')
    FROM (
        SELECT p.id AS user_id, NULL::text AS link
        FROM "sales-pipe".profiles p WHERE p.role = 'admin' AND p.is_active
        UNION ALL
        SELECT x.user_id, '/dashboard/' || o.id
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        CROSS JOIN LATERAL (VALUES (o.assigned_sales_id), (o.assigned_consultant_id)) x(user_id)
        WHERE lower(b.email) = v_email AND x.user_id IS NOT NULL
    ) u
    ORDER BY u.user_id, u.link NULLS LAST;

    INSERT INTO "sales-pipe".user_logs (user_name, action, entity_type, entity_id, details)
    VALUES ('Lead', 'opted_out', 'opt_out', v_id::text,
            jsonb_build_object('email', v_email, 'business', v_name));

    RETURN jsonb_build_object('already', false);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".record_whatsapp_status(p_statuses jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_count int := 0;
    v_n int;
BEGIN
    WITH s AS (
        SELECT DISTINCT ON (r.id, r.status)
            r.id, r.status, coalesce(to_timestamp(nullif(r."timestamp", '')::bigint), now()) AS at, left(r.error, 500) AS error,
            CASE r.status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END AS rank
        FROM jsonb_to_recordset(p_statuses) AS r(id text, status text, "timestamp" text, error text)
        WHERE r.id IS NOT NULL AND r.status IN ('sent', 'delivered', 'read', 'failed')
    ), best AS (
        -- Several updates for one message in a single call: keep the furthest along
        SELECT DISTINCT ON (id) * FROM s ORDER BY id, rank DESC, at DESC
    )
    UPDATE "sales-pipe".messages m
    SET delivery_status = CASE
            WHEN b.status = 'failed' THEN CASE WHEN m.delivery_status IN ('delivered', 'read') THEN m.delivery_status ELSE 'failed' END
            WHEN b.rank > CASE m.delivery_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END THEN b.status
            ELSE m.delivery_status END,
        delivered_at = CASE WHEN b.status IN ('delivered', 'read') THEN coalesce(m.delivered_at, b.at) ELSE m.delivered_at END,
        read_at = CASE WHEN b.status = 'read' THEN coalesce(m.read_at, b.at) ELSE m.read_at END,
        error_detail = CASE WHEN b.status = 'failed' AND coalesce(m.delivery_status, '') NOT IN ('delivered', 'read') THEN coalesce(b.error, 'Not delivered') ELSE m.error_detail END
    FROM best b
    WHERE m.external_message_id = b.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    WITH s AS (
        SELECT DISTINCT ON (r.id, r.status)
            r.id, r.status, coalesce(to_timestamp(nullif(r."timestamp", '')::bigint), now()) AS at, left(r.error, 500) AS error,
            CASE r.status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END AS rank
        FROM jsonb_to_recordset(p_statuses) AS r(id text, status text, "timestamp" text, error text)
        WHERE r.id IS NOT NULL AND r.status IN ('sent', 'delivered', 'read', 'failed')
    ), best AS (
        SELECT DISTINCT ON (id) * FROM s ORDER BY id, rank DESC, at DESC
    )
    UPDATE "sales-pipe".campaign_recipients cr
    SET delivery_status = CASE
            WHEN b.status = 'failed' THEN CASE WHEN cr.delivery_status IN ('delivered', 'read') THEN cr.delivery_status ELSE 'failed' END
            WHEN b.rank > CASE cr.delivery_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END THEN b.status
            ELSE cr.delivery_status END,
        delivered_at = CASE WHEN b.status IN ('delivered', 'read') THEN coalesce(cr.delivered_at, b.at) ELSE cr.delivered_at END,
        read_at = CASE WHEN b.status = 'read' THEN coalesce(cr.read_at, b.at) ELSE cr.read_at END,
        -- Meta accepted it but couldn't deliver it: show it as failed so it can be retried
        status = CASE WHEN b.status = 'failed' AND coalesce(cr.delivery_status, '') NOT IN ('delivered', 'read') THEN 'failed' ELSE cr.status END,
        error_detail = CASE WHEN b.status = 'failed' AND coalesce(cr.delivery_status, '') NOT IN ('delivered', 'read') THEN coalesce(b.error, 'Not delivered') ELSE cr.error_detail END,
        updated_at = now()
    FROM best b
    WHERE cr.external_message_id = b.id AND cr.channel = 'whatsapp';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    RETURN v_count;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".remove_opt_out(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_row "sales-pipe".opt_outs;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);

    DELETE FROM "sales-pipe".opt_outs WHERE id = p_id RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'This entry was already removed'; END IF;

    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, 'removed_opt_out', 'opt_out', v_row.id::text,
           jsonb_build_object('identifier', v_row.identifier, 'channel', v_row.channel,
                              'source', v_row.source, 'reason', v_row.reason, 'blocked_at', v_row.created_at)
    FROM (SELECT 1) one
    LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid();
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".reply_platform_counts(p_type text DEFAULT NULL::text)
 RETURNS TABLE(platform text, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    WITH platforms AS (
        SELECT unnest(ARRAY['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn']) AS p_name
    ),
    matching_threads AS (
        SELECT t.platform
        FROM "sales-pipe".threads t
        JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE NOT b.archived
          AND o.stage IN ('Active', 'Interested', 'Consultation')
          AND t.status = 'Replied'
          AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
    )
    SELECT p.p_name AS platform, count(m.platform)::bigint AS count
    FROM platforms p
    LEFT JOIN matching_threads m ON m.platform = p.p_name
    GROUP BY p.p_name
    ORDER BY array_position(ARRAY['WhatsApp', 'Instagram', 'Facebook', 'Email', 'LinkedIn'], p.p_name);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".retry_failed_campaign_sends(p_channel text, p_campaign_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_count int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales', 'consultant']);

    UPDATE "sales-pipe".campaign_recipients
    SET status = 'queued', attempts = 0, next_attempt_at = now(), error_detail = NULL, locked_at = NULL, updated_at = now()
    WHERE status = 'failed'
      AND ((p_channel = 'email' AND campaign_id = p_campaign_id)
        OR (p_channel = 'whatsapp' AND whatsapp_campaign_id = p_campaign_id));
    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count > 0 THEN
        IF p_channel = 'email' THEN
            UPDATE "sales-pipe".email_campaigns SET status = 'sending', updated_at = now() WHERE id = p_campaign_id;
        ELSE
            UPDATE "sales-pipe".whatsapp_campaigns SET status = 'sending', updated_at = now() WHERE id = p_campaign_id;
        END IF;
    END IF;

    RETURN v_count;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".set_audience_client(p_business_id uuid, p_dpa_signed_on date, p_sender_name text, p_reply_to text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    IF p_dpa_signed_on > CURRENT_DATE THEN RAISE EXCEPTION 'The signing date can''t be in the future'; END IF;
    INSERT INTO "sales-pipe".audience_clients (business_id, dpa_signed_on, sender_name, reply_to, updated_by, updated_at)
    VALUES (p_business_id, p_dpa_signed_on, nullif(trim(p_sender_name), ''), nullif(lower(trim(p_reply_to)), ''), auth.uid(), now())
    ON CONFLICT (business_id) DO UPDATE
    SET dpa_signed_on = EXCLUDED.dpa_signed_on, sender_name = EXCLUDED.sender_name, reply_to = EXCLUDED.reply_to,
        updated_by = EXCLUDED.updated_by, updated_at = now();
    INSERT INTO "sales-pipe".user_logs (user_id, user_name, action, entity_type, entity_id, details)
    SELECT auth.uid()::text, p.full_name, 'audience_client_updated', 'business', p_business_id::text,
           jsonb_build_object('dpa_signed_on', p_dpa_signed_on, 'sender_name', p_sender_name, 'reply_to', p_reply_to)
    FROM (SELECT 1) one LEFT JOIN "sales-pipe".profiles p ON p.id = auth.uid();
    PERFORM "sales-pipe".audience_sync_pause(p_business_id);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".set_cadence(p_step_name text, p_days integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin']);
    IF p_step_name IN ('Follow up 1', 'Follow up 2', 'Follow up 3') THEN
        IF p_days IS NULL OR p_days < 1 OR p_days > 60 THEN RAISE EXCEPTION 'Pick between 1 and 60 working days'; END IF;
    ELSIF p_step_name = 'Audience gap' THEN
        IF p_days IS NULL OR p_days < 1 OR p_days > 180 THEN RAISE EXCEPTION 'Pick between 1 and 180 days'; END IF;
    ELSE
        RAISE EXCEPTION 'Unknown step';
    END IF;
    UPDATE "sales-pipe".cadence_rules SET days_delay = p_days, updated_at = now() WHERE step_name = p_step_name;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".set_member_capacity(p_id uuid, p_capacity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
  PERFORM "sales-pipe".require_role(ARRAY['admin']);
  IF p_capacity IS NOT NULL AND (p_capacity < 1 OR p_capacity > 1000) THEN
    RAISE EXCEPTION 'Active leads must be between 1 and 1000';
  END IF;
  UPDATE "sales-pipe".profiles SET capacity = p_capacity WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Person not found';
  END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".set_stage(p_opportunity_id uuid, p_stage text, p_reason text, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_old text;
BEGIN
    PERFORM "sales-pipe".check_opp_access(p_opportunity_id);
    SELECT stage INTO v_old FROM "sales-pipe".opportunities WHERE id = p_opportunity_id;
    IF v_old = 'Needs review' AND p_stage NOT IN ('Needs review', 'Declined', 'Do not contact', 'Went cold', 'No response') THEN
        RAISE EXCEPTION 'Approve this lead from the Approval queue first';
    END IF;
    IF v_old IS DISTINCT FROM p_stage THEN
        UPDATE "sales-pipe".opportunities
        SET stage = p_stage,
            closed_at = CASE WHEN p_stage IN ('Declined', 'Do not contact', 'No response') THEN now() ELSE closed_at END
        WHERE id = p_opportunity_id;
        IF p_stage = 'Do not contact' THEN
            UPDATE "sales-pipe".threads SET status = 'Opted out', next_due_on = NULL WHERE opportunity_id = p_opportunity_id;
        END IF;
        INSERT INTO "sales-pipe".stage_changes (opportunity_id, from_stage, to_stage, reason, changed_by)
        VALUES (p_opportunity_id, v_old, p_stage, p_reason, coalesce(p_user_id, auth.uid()));
    END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".setup_email_sync_cron(p_app_url text, p_secret text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public', 'extensions'
AS $function$
    DECLARE
      v_url text;
      v_secret text;
      v_job_id bigint;
    BEGIN
      -- Strip trailing slash
      v_url := rtrim(p_app_url, '/') || '/api/email/sync';
      v_secret := coalesce(p_secret, current_setting('app.settings.service_role_key', true), '');

      -- Remove any existing job with this name
      PERFORM cron.unschedule('sync-emails-cron')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-emails-cron');

      -- Schedule every 1 minute
      SELECT cron.schedule(
        'sync-emails-cron',
        '* * * * *',
        format(
          $sql$
          SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || %L
            ),
            body := '{"unseenOnly": true}'::jsonb
          );
          $sql$,
          v_url,
          v_secret
        )
      ) INTO v_job_id;

      RETURN 'Email sync scheduled successfully every 1 minute (Job ID: ' || v_job_id || ') targeting ' || v_url;
    END;
    $function$;
CREATE OR REPLACE FUNCTION "sales-pipe".status_list(p_status text, p_type text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(opportunity_id uuid, business_id uuid, business_name text, business_type text, thread_id uuid, platform text, latest_message text, last_inbound_at timestamp with time zone, consultation_at timestamp with time zone, consultant_id uuid, consultant_name text, last_contact_at timestamp with time zone, platforms_tried text[], total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_status text := lower(trim(replace(replace(coalesce(p_status, ''), '_', '-'), ' ', '-')));
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    -- Needs reply flow
    IF v_status IN ('needs-reply', 'needsreply') THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                t.id AS r_thread_id,
                t.platform AS r_platform,
                (SELECT regexp_replace(replace(replace(m.body, E'\r', ' '), E'\n', ' '), '\s+', ' ', 'g')
                 FROM "sales-pipe".messages m
                 WHERE m.thread_id = t.id AND m.direction = 'inbound'
                 ORDER BY m.created_at DESC LIMIT 1) AS r_latest_message,
                t.last_inbound_at AS r_last_inbound_at,
                NULL::timestamptz AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".threads t
            JOIN "sales-pipe".opportunities o ON o.id = t.opportunity_id
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived
              AND o.stage IN ('Active', 'Interested', 'Consultation')
              AND t.status = 'Replied'
              AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
              AND (nullif(p_platform, '') IS NULL OR lower(t.platform) = lower(p_platform))
            ORDER BY t.last_inbound_at ASC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Interested flow
    IF v_status = 'interested' THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                coalesce(
                    (SELECT t.platform FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.status = 'Replied' ORDER BY t.last_inbound_at DESC NULLS LAST LIMIT 1),
                    (SELECT t.platform FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id AND t.last_inbound_at IS NOT NULL ORDER BY t.last_inbound_at DESC NULLS LAST LIMIT 1),
                    (SELECT t.platform FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id ORDER BY t.created_at ASC LIMIT 1)
                ) AS r_platform,
                NULL::text AS r_latest_message,
                coalesce(
                    (SELECT max(t.last_inbound_at) FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id),
                    (SELECT max(sc.created_at) FROM "sales-pipe".stage_changes sc WHERE sc.opportunity_id = o.id AND sc.to_stage = 'Interested'),
                    o.created_at
                ) AS r_last_inbound_at,
                NULL::timestamptz AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived
              AND o.stage = 'Interested'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY r_last_inbound_at DESC NULLS LAST, o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Consultation flow
    IF v_status = 'consultation' THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                NULL::text AS r_platform,
                NULL::text AS r_latest_message,
                NULL::timestamptz AS r_last_inbound_at,
                o.consultation_at AS r_consultation_at,
                o.assigned_consultant_id AS r_consultant_id,
                (SELECT p.full_name FROM "sales-pipe".profiles p WHERE p.id = o.assigned_consultant_id) AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived
              AND o.stage = 'Consultation'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY o.consultation_at ASC NULLS LAST, o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Needs consultant flow (admin only)
    IF v_status IN ('needs-consultant', 'needsconsultant') THEN
        IF v_role <> 'admin' AND auth.role() <> 'service_role' THEN
            RETURN;
        END IF;

        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                NULL::text AS r_platform,
                NULL::text AS r_latest_message,
                NULL::timestamptz AS r_last_inbound_at,
                coalesce(o.consultation_at, o.created_at) AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived
              AND o.stage = 'Consultation'
              AND o.assigned_consultant_id IS NULL
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY o.consultation_at ASC NULLS LAST, o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Went cold flow
    IF v_status IN ('went-cold', 'wentcold') THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                NULL::text AS r_platform,
                NULL::text AS r_latest_message,
                NULL::timestamptz AS r_last_inbound_at,
                NULL::timestamptz AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                coalesce(
                    (SELECT max(t.last_outbound_at) FROM "sales-pipe".threads t WHERE t.opportunity_id = o.id),
                    (SELECT max(m.created_at) FROM "sales-pipe".threads t JOIN "sales-pipe".messages m ON m.thread_id = t.id WHERE t.opportunity_id = o.id),
                    (SELECT max(sc.created_at) FROM "sales-pipe".stage_changes sc WHERE sc.opportunity_id = o.id AND sc.to_stage = 'Went cold'),
                    o.created_at
                ) AS r_last_contact_at,
                NULL::text[] AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived
              AND o.stage = 'Went cold'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY r_last_contact_at DESC NULLS LAST, o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- No response flow
    IF v_status IN ('no-response', 'noresponse') THEN
        RETURN QUERY
        WITH rows AS (
            SELECT
                o.id AS r_opportunity_id,
                b.id AS r_business_id,
                b.business_name AS r_business_name,
                "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
                NULL::uuid AS r_thread_id,
                NULL::text AS r_platform,
                NULL::text AS r_latest_message,
                NULL::timestamptz AS r_last_inbound_at,
                NULL::timestamptz AS r_consultation_at,
                NULL::uuid AS r_consultant_id,
                NULL::text AS r_consultant_name,
                NULL::timestamptz AS r_last_contact_at,
                coalesce(
                    (SELECT array_agg(DISTINCT t.platform ORDER BY t.platform)
                     FROM "sales-pipe".threads t
                     WHERE t.opportunity_id = o.id AND (t.last_outbound_at IS NOT NULL OR t.step > 0)),
                    (SELECT array_agg(DISTINCT t.platform ORDER BY t.platform)
                     FROM "sales-pipe".threads t
                     WHERE t.opportunity_id = o.id),
                    ARRAY[]::text[]
                ) AS r_platforms_tried
            FROM "sales-pipe".opportunities o
            JOIN "sales-pipe".businesses b ON b.id = o.business_id
            WHERE NOT b.archived
              AND o.stage = 'No response'
              AND (v_role = 'admin' OR auth.role() = 'service_role'
                   OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
                   OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
              AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
            ORDER BY o.created_at DESC
        )
        SELECT
            r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
            r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
            r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
            r.r_last_contact_at, r.r_platforms_tried,
            count(*) OVER () AS total_count
        FROM rows r
        LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
        RETURN;
    END IF;

    -- Fallback for any other stage
    RETURN QUERY
    WITH rows AS (
        SELECT
            o.id AS r_opportunity_id,
            b.id AS r_business_id,
            b.business_name AS r_business_name,
            "sales-pipe".canonical_business_type(b.business_type) AS r_business_type,
            NULL::uuid AS r_thread_id,
            NULL::text AS r_platform,
            NULL::text AS r_latest_message,
            NULL::timestamptz AS r_last_inbound_at,
            NULL::timestamptz AS r_consultation_at,
            NULL::uuid AS r_consultant_id,
            NULL::text AS r_consultant_name,
            NULL::timestamptz AS r_last_contact_at,
            NULL::text[] AS r_platforms_tried
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE NOT b.archived
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (nullif(p_type, '') IS NULL OR "sales-pipe".canonical_business_type(b.business_type) = "sales-pipe".canonical_business_type(p_type))
        ORDER BY o.created_at DESC
    )
    SELECT
        r.r_opportunity_id, r.r_business_id, r.r_business_name, r.r_business_type,
        r.r_thread_id, r.r_platform, r.r_latest_message, r.r_last_inbound_at,
        r.r_consultation_at, r.r_consultant_id, r.r_consultant_name,
        r.r_last_contact_at, r.r_platforms_tried,
        count(*) OVER () AS total_count
    FROM rows r
    LIMIT least(coalesce(p_limit, 25), 100) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".status_type_counts(p_status text)
 RETURNS TABLE(business_type text, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_status text := lower(trim(replace(replace(coalesce(p_status, ''), '_', '-'), ' ', '-')));
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    RETURN QUERY
    WITH types AS (
        SELECT unnest(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management']) AS b_type
    ),
    matching_opps AS (
        SELECT o.id, "sales-pipe".canonical_business_type(b.business_type) AS c_type
        FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id
        WHERE NOT b.archived
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid OR o.assigned_consultant_id = v_uid
               OR (v_role = 'sales' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
          AND (
              (v_status IN ('needs-reply', 'needsreply') AND o.stage IN ('Active', 'Interested', 'Consultation') AND EXISTS (
                  SELECT 1 FROM "sales-pipe".threads t
                  WHERE t.opportunity_id = o.id AND t.status = 'Replied'
                    AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')
              ))
              OR (v_status = 'interested' AND o.stage = 'Interested')
              OR (v_status = 'consultation' AND o.stage = 'Consultation')
              OR (v_status IN ('needs-consultant', 'needsconsultant') AND v_role = 'admin' AND o.stage = 'Consultation' AND o.assigned_consultant_id IS NULL)
              OR (v_status IN ('went-cold', 'wentcold') AND o.stage = 'Went cold')
              OR (v_status IN ('no-response', 'noresponse') AND o.stage = 'No response')
          )
    )
    SELECT t.b_type AS business_type, count(m.id)::bigint AS count
    FROM types t
    LEFT JOIN matching_opps m ON m.c_type = t.b_type
    GROUP BY t.b_type
    ORDER BY array_position(ARRAY['Hotel', 'Restaurant or cafe', 'Pub', 'Property management'], t.b_type);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".sync_profile_from_matrix(p_employee_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_emp  record;
  v_role text;
BEGIN
  SELECT e.auth_user_id, e.full_name, e.status INTO v_emp
  FROM hr.employees e WHERE e.id = p_employee_id;
  IF NOT FOUND OR v_emp.auth_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT CASE pr.code WHEN 'admin' THEN 'admin' WHEN 'consultant' THEN 'consultant' ELSE 'sales' END
  INTO v_role
  FROM public.user_product_access upa
  JOIN public.products p      ON p.product_id = upa.product_id AND p.code = 'sales_pipeline'
  JOIN public.product_roles pr ON pr.id = upa.product_role_id
  WHERE upa.employee_id = p_employee_id;

  -- Same rule as the Admin Panel's sign-in: only terminated employees are blocked
  IF v_role IS NOT NULL AND v_emp.status <> 'terminated' THEN
    INSERT INTO "sales-pipe".profiles (id, full_name, role, is_active)
    VALUES (v_emp.auth_user_id, v_emp.full_name, v_role, true)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
  ELSE
    UPDATE "sales-pipe".profiles SET is_active = false WHERE id = v_emp.auth_user_id;
  END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".trg_assign_open_pitch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    -- Runs at commit: look again, the transaction may already have assigned someone
    IF EXISTS (
        SELECT 1 FROM "sales-pipe".opportunities
        WHERE id = NEW.id AND stage IN ('Active', 'Interested') AND assigned_sales_id IS NULL
    ) THEN
        PERFORM "sales-pipe".auto_assign_sales(ARRAY[NEW.id]);
    END IF;
    RETURN NULL;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".trg_audience_whatsapp_result()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    IF NEW.delivery_status IN ('delivered', 'read') THEN
        UPDATE "sales-pipe".customer_leads SET whatsapp_status = 'confirmed'
        WHERE id = NEW.customer_lead_id AND whatsapp_status <> 'confirmed';
    ELSIF (NEW.delivery_status = 'failed' OR NEW.status = 'failed')
          AND coalesce(NEW.error_detail, '') ~* '(131026|not a whatsapp|not a valid whatsapp|isn''t on whatsapp|not on whatsapp)' THEN
        UPDATE "sales-pipe".customer_leads SET whatsapp_status = 'not_on_whatsapp'
        WHERE id = NEW.customer_lead_id AND whatsapp_status <> 'not_on_whatsapp';
    END IF;
    RETURN NULL;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".trg_audience_won_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    PERFORM "sales-pipe".audience_sync_pause(NEW.business_id);
    RETURN NULL;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".trg_businesses_compute_problems()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    NEW.problems := "sales-pipe".compute_business_problems(NEW);
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".trg_normalise_business_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    NEW.phone_normalised := "sales-pipe".normalise_phone(NEW.phone);
    NEW.email_normalised := "sales-pipe".normalise_email(NEW.email);
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".trg_opp_reopen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_reply_thread uuid;
    v_platform text;
    t record;
BEGIN
    -- Drafts are signed with the sales person's name, so make sure there is one
    IF NEW.assigned_sales_id IS NULL THEN
        PERFORM "sales-pipe".auto_assign_sales(ARRAY[NEW.id]);
    END IF;

    -- The late reply that brought the lead back, if any
    IF OLD.replied_after_close_at IS NOT NULL THEN
        SELECT id, platform INTO v_reply_thread, v_platform FROM "sales-pipe".threads
        WHERE opportunity_id = NEW.id AND last_inbound_at >= OLD.replied_after_close_at - interval '1 minute'
        ORDER BY last_inbound_at DESC LIMIT 1;
    END IF;

    -- The new round starts just before the late reply, so that reply shows as current
    UPDATE "sales-pipe".threads
    SET round = round + 1,
        round_started_at = CASE WHEN v_reply_thread IS NOT NULL THEN OLD.replied_after_close_at - interval '1 second' ELSE now() END,
        step = 0,
        status = CASE WHEN id = v_reply_thread THEN 'Replied'
                      WHEN v_reply_thread IS NOT NULL THEN 'Paused'
                      ELSE 'Not contacted' END,
        paused_reason = CASE WHEN v_reply_thread IS NOT NULL AND id <> v_reply_thread THEN 'Replied on ' || v_platform END,
        next_due_on = CASE WHEN v_reply_thread IS NULL THEN CURRENT_DATE END
    WHERE opportunity_id = NEW.id;

    UPDATE "sales-pipe".opportunities SET replied_after_close_at = NULL, closed_at = NULL WHERE id = NEW.id;

    FOR t IN SELECT id FROM "sales-pipe".threads WHERE opportunity_id = NEW.id AND status IN ('Not contacted', 'Replied') LOOP
        PERFORM "sales-pipe".generate_draft(t.id, CASE WHEN t.id = v_reply_thread THEN 'Reply' ELSE 'First contact' END);
    END LOOP;
    RETURN NULL;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".trg_opp_services_recompute_problems()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.services_pitched IS NOT DISTINCT FROM NEW.services_pitched THEN
        RETURN NEW;
    END IF;
    UPDATE "sales-pipe".businesses
    SET problems = "sales-pipe".lead_problems(NEW.business_id)
    WHERE id = NEW.business_id;
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".type_category(p_type text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT coalesce(
    (SELECT c.category_group FROM "sales-pipe".business_categories c
     WHERE c.name = "sales-pipe".canonical_business_type(p_type)
       AND nullif(trim(coalesce(p_type, '')), '') IS NOT NULL),
    p_type
  )
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".undo_customer_import(p_batch_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    b record;
    n int;
BEGIN
    PERFORM "sales-pipe".require_role(ARRAY['admin', 'sales']);
    SELECT * INTO b FROM "sales-pipe".customer_import_batches WHERE id = p_batch_id;
    IF b.id IS NULL THEN RAISE EXCEPTION 'This import was not found'; END IF;
    IF "sales-pipe".get_user_role() <> 'admin' AND b.created_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only an admin or the person who imported it can undo an import';
    END IF;
    -- Customers this file added (customers it only updated stay)
    DELETE FROM "sales-pipe".customer_leads WHERE import_batch_id = b.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    DELETE FROM "sales-pipe".customer_import_batches WHERE id = b.id;
    PERFORM "sales-pipe".audience_log('audience_import_undone', b.business_id, jsonb_build_object('file_name', b.file_name, 'removed', n));
    RETURN n;
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".update_lead_field(p_business_id uuid, p_field text, p_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := "sales-pipe".get_user_role();
    v_field text := lower(trim(p_field));
    v_val text := trim(coalesce(p_value, ''));
    v_clean_val text := nullif(v_val, '');
    v_services text[];
    v_new_problems text[];
    v_tp_type text;
    v_tp_name text;
BEGIN
    IF v_role IS NULL AND auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Your account is not set up';
    END IF;

    -- Access check
    IF NOT EXISTS (
        SELECT 1 FROM "sales-pipe".opportunities o
        WHERE o.business_id = p_business_id
          AND (v_role = 'admin' OR auth.role() = 'service_role'
               OR o.assigned_sales_id = v_uid
               OR o.assigned_consultant_id = v_uid
               OR (v_role IN ('sales', 'consultant') AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL))
    ) THEN
        RAISE EXCEPTION 'You cannot edit this business';
    END IF;

    -- Whitelisted fields
    IF v_field IN ('business_name', 'name') THEN
        UPDATE "sales-pipe".businesses SET business_name = coalesce(v_clean_val, '') WHERE id = p_business_id;
    ELSIF v_field IN ('business_type', 'category') THEN
        IF v_clean_val NOT IN ('Hotel', 'Restaurant or cafe', 'Pub', 'Property management') THEN
            RAISE EXCEPTION 'Category must be Hotel, Restaurant or cafe, Pub, or Property management';
        END IF;
        UPDATE "sales-pipe".businesses
        SET business_type = v_clean_val,
            category = "sales-pipe".type_category(v_clean_val)
        WHERE id = p_business_id;
    ELSIF v_field = 'existing_website' OR v_field = 'website' THEN
        UPDATE "sales-pipe".businesses
        SET existing_website = v_clean_val,
            has_no_website = false
        WHERE id = p_business_id;
    ELSIF v_field = 'has_no_website' THEN
        UPDATE "sales-pipe".businesses
        SET has_no_website = coalesce(v_val::boolean, false),
            existing_website = CASE WHEN coalesce(v_val::boolean, false) THEN NULL ELSE existing_website END
        WHERE id = p_business_id;
    ELSIF v_field = 'address' THEN
        UPDATE "sales-pipe".businesses SET address = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'postcode' THEN
        UPDATE "sales-pipe".businesses SET postcode = upper(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field IN ('services', 'services_pitched') THEN
        v_services := ARRAY(
            SELECT trim(s) FROM unnest(string_to_array(v_val, ',')) s
            WHERE trim(s) <> '' AND trim(s) = ANY("sales-pipe".valid_services())
        );
        UPDATE "sales-pipe".opportunities
        SET services_pitched = v_services
        WHERE business_id = p_business_id;
    ELSIF v_field IN ('contact_name', 'owner_name') THEN
        UPDATE "sales-pipe".businesses SET contact_name = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'owner_email' THEN
        UPDATE "sales-pipe".businesses SET owner_email = lower(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'owner_contact' THEN
        UPDATE "sales-pipe".businesses
        SET owner_contact = v_clean_val,
            owner_email = CASE WHEN v_clean_val ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN lower(v_clean_val) ELSE owner_email END
        WHERE id = p_business_id;
    ELSIF v_field = 'email' THEN
        UPDATE "sales-pipe".businesses SET email = lower(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'whatsapp_number' THEN
        UPDATE "sales-pipe".businesses SET whatsapp_number = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'instagram' THEN
        UPDATE "sales-pipe".businesses SET instagram = "sales-pipe".clean_handle(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'facebook' THEN
        UPDATE "sales-pipe".businesses SET facebook = "sales-pipe".clean_handle(v_clean_val) WHERE id = p_business_id;
    ELSIF v_field = 'linkedin' THEN
        UPDATE "sales-pipe".businesses SET linkedin = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'tech_partner_type' THEN
        IF v_clean_val NOT IN ('Agency', 'DIY', 'None') THEN
            RAISE EXCEPTION 'Tech partner type must be Agency, DIY, or None';
        END IF;
        UPDATE "sales-pipe".businesses
        SET tech_partner_type = v_clean_val,
            tech_partner_name = CASE WHEN v_clean_val = 'None' THEN NULL ELSE tech_partner_name END
        WHERE id = p_business_id;
    ELSIF v_field IN ('tech_partner', 'existing_tech_partner') THEN
        IF v_clean_val IS NOT NULL THEN
            IF lower(v_clean_val) = 'none' THEN
                v_tp_type := 'None';
                v_tp_name := NULL;
            ELSIF v_clean_val ~* '^Agency' THEN
                v_tp_type := 'Agency';
                v_tp_name := nullif(btrim(regexp_replace(v_clean_val, '^Agency\s*', '', 'i'), ' ()'), '');
                IF v_tp_name IS NULL THEN v_tp_name := 'Agency'; END IF;
            ELSIF v_clean_val ~* '^DIY' THEN
                v_tp_type := 'DIY';
                v_tp_name := nullif(btrim(regexp_replace(v_clean_val, '^DIY\s*', '', 'i'), ' ()'), '');
                IF v_tp_name IS NULL THEN v_tp_name := 'DIY'; END IF;
            ELSE
                v_tp_type := 'Agency';
                v_tp_name := v_clean_val;
            END IF;
        END IF;
        UPDATE "sales-pipe".businesses
        SET tech_partner_type = coalesce(v_tp_type, tech_partner_type),
            tech_partner_name = CASE WHEN v_tp_type = 'None' THEN NULL ELSE coalesce(v_tp_name, tech_partner_name) END
        WHERE id = p_business_id;
    ELSIF v_field = 'gaps_found' THEN
        UPDATE "sales-pipe".businesses SET gaps_found = v_clean_val WHERE id = p_business_id;
    ELSIF v_field = 'source' THEN
        UPDATE "sales-pipe".businesses SET source = v_clean_val WHERE id = p_business_id;
    ELSE
        RAISE EXCEPTION 'Unsupported field: %', p_field;
    END IF;

    -- Recompute problems
    v_new_problems := "sales-pipe".lead_problems(p_business_id);
    UPDATE "sales-pipe".businesses SET problems = v_new_problems WHERE id = p_business_id;

    RETURN jsonb_build_object(
        'ok', true,
        'business_id', p_business_id,
        'field', v_field,
        'problems', to_jsonb(v_new_problems)
    );
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".update_member(p_id uuid, p_full_name text, p_role text, p_capacity integer, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Roles and access are managed in the Admin Panel (Access page)';
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".v_business_cards(p_service text, p_type text, p_filter text, p_search text, p_limit integer, p_offset integer)
 RETURNS TABLE(opportunity_id uuid, business_name text, area text, google_rating numeric, stage text, threads jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role text := "sales-pipe".get_user_role();
begin
  return query
  select 
    o.id as opportunity_id,
    b.business_name,
    b.area,
    b.google_rating,
    o.stage,
    (
      select jsonb_agg(
        jsonb_build_object(
          'platform', t.platform,
          'status', t.status,
          'step', t.step
        )
      )
      from "sales-pipe".threads t
      where t.opportunity_id = o.id
    ) as threads
  from "sales-pipe".opportunities o
  join "sales-pipe".businesses b on b.id = o.business_id
  where (p_service = '' or p_service = any(o.services_pitched))
    and (p_type = '' or b.business_type = p_type)
    and (p_filter = 'all' or o.stage = p_filter)
    and (p_search = '' or b.business_name ilike '%' || p_search || '%')
    and (v_role = 'admin' or o.assigned_sales_id = v_uid or o.assigned_consultant_id = v_uid)
  order by o.created_at desc
  limit p_limit offset p_offset;
end;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".v_dashboard_status_counts(p_user uuid)
 RETURNS TABLE(needs_reply bigint, interested bigint, consultation bigint, went_cold bigint, no_response bigint, needs_consultant bigint, unmatched_bookings bigint, needs_review bigint, total_pitches bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'sales-pipe', 'public'
AS $function$
DECLARE
    v_role text;
BEGIN
    IF auth.role() <> 'service_role' AND p_user IS DISTINCT FROM auth.uid()
       AND coalesce("sales-pipe".get_user_role(), '') <> 'admin' THEN
        RAISE EXCEPTION 'You can only see your own numbers';
    END IF;
    SELECT role INTO v_role FROM "sales-pipe".profiles WHERE id = p_user;

    RETURN QUERY
    WITH mine AS (
        SELECT o.*, b.problems FROM "sales-pipe".opportunities o
        JOIN "sales-pipe".businesses b ON b.id = o.business_id AND NOT b.archived
        WHERE v_role = 'admin' OR o.assigned_sales_id = p_user OR o.assigned_consultant_id = p_user
           OR (v_role = 'sales' AND o.stage = 'Needs review' AND o.assigned_sales_id IS NULL AND o.assigned_consultant_id IS NULL)
    )
    SELECT
        (SELECT count(DISTINCT m.id) FROM mine m JOIN "sales-pipe".threads t ON t.opportunity_id = m.id
          WHERE m.stage IN ('Active', 'Interested', 'Consultation') AND t.status = 'Replied'
            AND t.last_inbound_at > coalesce(t.last_outbound_at, '-infinity')),
        (SELECT count(*) FROM mine WHERE stage = 'Interested'),
        (SELECT count(*) FROM mine WHERE stage = 'Consultation'),
        (SELECT count(*) FROM mine WHERE stage = 'Went cold'),
        (SELECT count(*) FROM mine WHERE stage = 'No response'),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM mine WHERE stage = 'Consultation' AND assigned_consultant_id IS NULL) ELSE 0 END),
        (CASE WHEN v_role = 'admin' THEN (SELECT count(*) FROM "sales-pipe".consultation_bookings WHERE match_status = 'unmatched') ELSE 0 END),
        (SELECT count(*) FROM mine WHERE stage = 'Needs review' AND problems = '{}'::text[]),
        (SELECT count(*) FROM mine);
END;
$function$;
CREATE OR REPLACE FUNCTION "sales-pipe".valid_services()
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT coalesce(array_agg(s.name ORDER BY s.sort_order, s.name), '{}')
  FROM "sales-pipe".services s
$function$;

-- ----------------------------------------------------------------------------
-- Views
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW "sales-pipe"."customer_lead_counts" WITH (security_invoker=true) AS
SELECT business_id,
    (count(*))::integer AS total,
    (count(*) FILTER (WHERE (is_ready AND (NOT do_not_contact))))::integer AS ready,
    (count(*) FILTER (WHERE ((NOT is_ready) AND (NOT do_not_contact))))::integer AS missing,
    (count(*) FILTER (WHERE do_not_contact))::integer AS do_not_contact,
    (count(*) FILTER (WHERE ((whatsapp_status = ANY (ARRAY['likely'::text, 'confirmed'::text])) AND (NOT do_not_contact))))::integer AS whatsapp,
    (count(*) FILTER (WHERE (country = 'India'::text)))::integer AS test,
    max(created_at) AS last_added_at
   FROM "sales-pipe".customer_leads
  GROUP BY business_id;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS "trg_businesses_compute_problems" ON "sales-pipe".businesses;
CREATE TRIGGER trg_businesses_compute_problems BEFORE INSERT OR UPDATE ON "sales-pipe".businesses FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_businesses_compute_problems();
DROP TRIGGER IF EXISTS "trg_audience_whatsapp_result" ON "sales-pipe".campaign_recipients;
CREATE TRIGGER trg_audience_whatsapp_result AFTER UPDATE OF delivery_status, status, error_detail ON "sales-pipe".campaign_recipients FOR EACH ROW WHEN (((new.customer_lead_id IS NOT NULL) AND (new.channel = 'whatsapp'::text))) EXECUTE FUNCTION "sales-pipe".trg_audience_whatsapp_result();
DROP TRIGGER IF EXISTS "customer_leads_touch" ON "sales-pipe".customer_leads;
CREATE TRIGGER customer_leads_touch BEFORE UPDATE ON "sales-pipe".customer_leads FOR EACH ROW EXECUTE FUNCTION "sales-pipe".customer_leads_touch();
DROP TRIGGER IF EXISTS "assign_open_pitch_on_insert" ON "sales-pipe".opportunities;
CREATE CONSTRAINT TRIGGER assign_open_pitch_on_insert AFTER INSERT ON "sales-pipe".opportunities DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (((new.stage = ANY (ARRAY['Active'::text, 'Interested'::text])) AND (new.assigned_sales_id IS NULL))) EXECUTE FUNCTION "sales-pipe".trg_assign_open_pitch();
DROP TRIGGER IF EXISTS "assign_open_pitch_on_stage" ON "sales-pipe".opportunities;
CREATE CONSTRAINT TRIGGER assign_open_pitch_on_stage AFTER UPDATE OF stage ON "sales-pipe".opportunities DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (((new.stage = ANY (ARRAY['Active'::text, 'Interested'::text])) AND (new.assigned_sales_id IS NULL) AND (old.stage IS DISTINCT FROM new.stage))) EXECUTE FUNCTION "sales-pipe".trg_assign_open_pitch();
DROP TRIGGER IF EXISTS "trg_audience_won_change" ON "sales-pipe".opportunities;
CREATE TRIGGER trg_audience_won_change AFTER UPDATE OF stage ON "sales-pipe".opportunities FOR EACH ROW WHEN (((old.stage = 'Won'::text) IS DISTINCT FROM (new.stage = 'Won'::text))) EXECUTE FUNCTION "sales-pipe".trg_audience_won_change();
DROP TRIGGER IF EXISTS "trg_opp_reopen" ON "sales-pipe".opportunities;
CREATE TRIGGER trg_opp_reopen AFTER UPDATE OF stage ON "sales-pipe".opportunities FOR EACH ROW WHEN (((old.stage = ANY (ARRAY['Went cold'::text, 'No response'::text, 'Declined'::text, 'Do not contact'::text])) AND (new.stage = ANY (ARRAY['Active'::text, 'Interested'::text])))) EXECUTE FUNCTION "sales-pipe".trg_opp_reopen();
DROP TRIGGER IF EXISTS "trg_opp_services_recompute_problems" ON "sales-pipe".opportunities;
CREATE TRIGGER trg_opp_services_recompute_problems AFTER INSERT OR UPDATE OF services_pitched ON "sales-pipe".opportunities FOR EACH ROW EXECUTE FUNCTION "sales-pipe".trg_opp_services_recompute_problems();
DROP TRIGGER IF EXISTS "sales_pipe_sync_profile" ON hr.employees;
CREATE TRIGGER sales_pipe_sync_profile AFTER UPDATE OF status, auth_user_id ON hr.employees FOR EACH ROW EXECUTE FUNCTION "sales-pipe".on_employee_change();
DROP TRIGGER IF EXISTS "sales_pipe_sync_profile" ON user_product_access;
CREATE TRIGGER sales_pipe_sync_profile AFTER INSERT OR DELETE OR UPDATE ON public.user_product_access FOR EACH ROW EXECUTE FUNCTION "sales-pipe".on_matrix_change();
-- People now get access from the Admin Panel access matrix, not on sign-up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row level security and policies
-- ----------------------------------------------------------------------------
ALTER TABLE "sales-pipe"."audience_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."business_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."campaign_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."campaign_replies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."customer_import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."customer_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."email_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."email_databases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."opt_outs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."outreach_platforms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."pipeline_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."whatsapp_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales-pipe"."whatsapp_databases" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_logs_full_access" ON "sales-pipe"."app_logs";
DROP POLICY IF EXISTS "error_logs_full_access" ON "sales-pipe"."error_logs";
DROP POLICY IF EXISTS "user_logs_full_access" ON "sales-pipe"."user_logs";
DROP POLICY IF EXISTS "app_logs_admin" ON "sales-pipe"."app_logs";
CREATE POLICY "app_logs_admin" ON "sales-pipe"."app_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() = 'admin'::text)) WITH CHECK (("sales-pipe".get_user_role() = 'admin'::text));
DROP POLICY IF EXISTS "audience_clients_read" ON "sales-pipe"."audience_clients";
CREATE POLICY "audience_clients_read" ON "sales-pipe"."audience_clients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text])));
DROP POLICY IF EXISTS "business_categories_read" ON "sales-pipe"."business_categories";
CREATE POLICY "business_categories_read" ON "sales-pipe"."business_categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "campaign_recipients_read" ON "sales-pipe"."campaign_recipients";
CREATE POLICY "campaign_recipients_read" ON "sales-pipe"."campaign_recipients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "campaign_replies_read" ON "sales-pipe"."campaign_replies";
CREATE POLICY "campaign_replies_read" ON "sales-pipe"."campaign_replies" AS PERMISSIVE FOR SELECT TO "authenticated" USING (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text])));
DROP POLICY IF EXISTS "customer_import_batches_access" ON "sales-pipe"."customer_import_batches";
CREATE POLICY "customer_import_batches_access" ON "sales-pipe"."customer_import_batches" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text]))) WITH CHECK (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text])));
DROP POLICY IF EXISTS "customer_leads_access" ON "sales-pipe"."customer_leads";
CREATE POLICY "customer_leads_access" ON "sales-pipe"."customer_leads" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text]))) WITH CHECK (("sales-pipe".get_user_role() = ANY (ARRAY['admin'::text, 'sales'::text])));
DROP POLICY IF EXISTS "email_campaigns_access" ON "sales-pipe"."email_campaigns";
CREATE POLICY "email_campaigns_access" ON "sales-pipe"."email_campaigns" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL)) WITH CHECK (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "email_databases_access" ON "sales-pipe"."email_databases";
CREATE POLICY "email_databases_access" ON "sales-pipe"."email_databases" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL)) WITH CHECK (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "error_logs_admin" ON "sales-pipe"."error_logs";
CREATE POLICY "error_logs_admin" ON "sales-pipe"."error_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() = 'admin'::text)) WITH CHECK (("sales-pipe".get_user_role() = 'admin'::text));
DROP POLICY IF EXISTS "import_batches_read" ON "sales-pipe"."import_batches";
CREATE POLICY "import_batches_read" ON "sales-pipe"."import_batches" AS PERMISSIVE FOR SELECT TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "opt_outs_read" ON "sales-pipe"."opt_outs";
CREATE POLICY "opt_outs_read" ON "sales-pipe"."opt_outs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "outreach_platforms_read" ON "sales-pipe"."outreach_platforms";
CREATE POLICY "outreach_platforms_read" ON "sales-pipe"."outreach_platforms" AS PERMISSIVE FOR SELECT TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "pipeline_settings_read" ON "sales-pipe"."pipeline_settings";
CREATE POLICY "pipeline_settings_read" ON "sales-pipe"."pipeline_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "services_read" ON "sales-pipe"."services";
CREATE POLICY "services_read" ON "sales-pipe"."services" AS PERMISSIVE FOR SELECT TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "tasks_staff" ON "sales-pipe"."tasks";
CREATE POLICY "tasks_staff" ON "sales-pipe"."tasks" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL)) WITH CHECK (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "user_logs_admin" ON "sales-pipe"."user_logs";
CREATE POLICY "user_logs_admin" ON "sales-pipe"."user_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() = 'admin'::text)) WITH CHECK (("sales-pipe".get_user_role() = 'admin'::text));
DROP POLICY IF EXISTS "whatsapp_campaigns_access" ON "sales-pipe"."whatsapp_campaigns";
CREATE POLICY "whatsapp_campaigns_access" ON "sales-pipe"."whatsapp_campaigns" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL)) WITH CHECK (("sales-pipe".get_user_role() IS NOT NULL));
DROP POLICY IF EXISTS "whatsapp_databases_access" ON "sales-pipe"."whatsapp_databases";
CREATE POLICY "whatsapp_databases_access" ON "sales-pipe"."whatsapp_databases" AS PERMISSIVE FOR ALL TO "authenticated" USING (("sales-pipe".get_user_role() IS NOT NULL)) WITH CHECK (("sales-pipe".get_user_role() IS NOT NULL));

-- ----------------------------------------------------------------------------
-- Permissions (402 statements)
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE "sales-pipe"."app_logs" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."app_logs" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."app_logs" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."audience_clients" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."audience_clients" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."audience_clients" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."business_categories" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."business_categories" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."business_categories" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."businesses" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."businesses" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."businesses" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."cadence_rules" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, DELETE, MAINTAIN ON TABLE "sales-pipe"."cadence_rules" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."cadence_rules" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."campaign_recipients" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."campaign_recipients" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."campaign_recipients" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."campaign_replies" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."campaign_replies" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."campaign_replies" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."consultation_bookings" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."consultation_bookings" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."consultation_bookings" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."customer_import_batches" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."customer_import_batches" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."customer_import_batches" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."customer_lead_counts" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."customer_lead_counts" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."customer_lead_counts" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."customer_leads" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."customer_leads" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."customer_leads" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."drafts" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."drafts" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."drafts" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."email_campaigns" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."email_campaigns" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."email_campaigns" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."email_databases" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."email_databases" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."email_databases" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."error_logs" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."error_logs" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."error_logs" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."import_batches" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."import_batches" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."import_batches" TO service_role;
REVOKE ALL ON SEQUENCE "sales-pipe"."leads_code_seq" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "sales-pipe"."leads_code_seq" TO anon;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "sales-pipe"."leads_code_seq" TO authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "sales-pipe"."leads_code_seq" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."messages" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."messages" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."messages" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."notes" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."notes" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."notes" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."notifications" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE, MAINTAIN ON TABLE "sales-pipe"."notifications" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."notifications" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."opportunities" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."opportunities" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."opportunities" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."opt_outs" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."opt_outs" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."opt_outs" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."outreach_platforms" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."outreach_platforms" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."outreach_platforms" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."pipeline_settings" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."pipeline_settings" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."pipeline_settings" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."profiles" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."profiles" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."profiles" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."services" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."services" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."services" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."stage_changes" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."stage_changes" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."stage_changes" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."tasks" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."tasks" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."tasks" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."templates" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."templates" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."templates" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."threads" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."threads" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."threads" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."user_logs" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."user_logs" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."user_logs" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."webhook_events" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."webhook_events" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."webhook_events" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."whatsapp_campaigns" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."whatsapp_campaigns" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."whatsapp_campaigns" TO service_role;
REVOKE ALL ON TABLE "sales-pipe"."whatsapp_databases" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE "sales-pipe"."whatsapp_databases" TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE "sales-pipe"."whatsapp_databases" TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."add_note"(p_opportunity_id uuid, p_body text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."add_note"(p_opportunity_id uuid, p_body text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."add_note"(p_opportunity_id uuid, p_body text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."add_pitch"(p_business_id uuid, p_services text[], p_demo_link text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."add_pitch"(p_business_id uuid, p_services text[], p_demo_link text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."add_pitch"(p_business_id uuid, p_services text[], p_demo_link text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."add_working_days"(start_date date, days integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."add_working_days"(start_date date, days integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."add_working_days"(start_date date, days integer) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."approve_customer_import"(p_batch_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."approve_customer_import"(p_batch_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."approve_customer_import"(p_batch_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."approve_import"(p_business_ids uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."approve_import"(p_business_ids uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."approve_import"(p_business_ids uuid[]) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."assign_consultant"(p_opportunity_id uuid, p_consultant_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."assign_consultant"(p_opportunity_id uuid, p_consultant_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."assign_consultant"(p_opportunity_id uuid, p_consultant_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."assign_sales"(p_opportunity_ids uuid[], p_sales_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."assign_sales"(p_opportunity_ids uuid[], p_sales_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."assign_sales"(p_opportunity_ids uuid[], p_sales_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."audience_log"(p_action text, p_business_id uuid, p_details jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."audience_log"(p_action text, p_business_id uuid, p_details jsonb) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."audience_opt_out_status"(p_customer_id uuid, p_email text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."audience_opt_out_status"(p_customer_id uuid, p_email text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."audience_preview"(p_business_id uuid, p_channel text, p_filter jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."audience_preview"(p_business_id uuid, p_channel text, p_filter jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."audience_preview"(p_business_id uuid, p_channel text, p_filter jsonb) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."audience_sync_pause"(p_business_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."audience_sync_pause"(p_business_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."audience_targets"(p_business_id uuid, p_channel text, p_filter jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."audience_targets"(p_business_id uuid, p_channel text, p_filter jsonb) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."audience_unlocked"(p_business_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."audience_unlocked"(p_business_id uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION "sales-pipe"."audience_unlocked"(p_business_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."audience_unlocked"(p_business_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."auto_assign_sales"(p_opportunity_ids uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."auto_assign_sales"(p_opportunity_ids uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."auto_assign_sales"(p_opportunity_ids uuid[]) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."bulk_set_field"(p_business_ids uuid[], p_field text, p_value text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."bulk_set_field"(p_business_ids uuid[], p_field text, p_value text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."bulk_set_field"(p_business_ids uuid[], p_field text, p_value text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."campaign_progress"(p_channel text, p_campaign_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."campaign_progress"(p_channel text, p_campaign_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."campaign_progress"(p_channel text, p_campaign_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."can_see_business"(p_business_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."can_see_business"(p_business_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."can_see_business"(p_business_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."canonical_business_type"(p_type text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."canonical_business_type"(p_type text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."canonical_business_type"(p_type text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."capture_campaign_reply"(p_channel text, p_from text, p_body text, p_subject text, p_external_message_id text, p_looks_like_reply boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."capture_campaign_reply"(p_channel text, p_from text, p_body text, p_subject text, p_external_message_id text, p_looks_like_reply boolean) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."check_duplicate_lead"(p_email text, p_phone text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."check_duplicate_lead"(p_email text, p_phone text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."check_duplicate_lead"(p_email text, p_phone text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."check_opp_access"(p_opportunity_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."check_opp_access"(p_opportunity_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."check_opp_access"(p_opportunity_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."claim_campaign_sends"(p_limit integer, p_campaign_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."claim_campaign_sends"(p_limit integer, p_campaign_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."clean_handle"(p text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."clean_handle"(p text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."clean_handle"(p text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."complete_campaign_sends"(p_results jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."complete_campaign_sends"(p_results jsonb) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."compute_business_problems"(b "sales-pipe".businesses) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."compute_business_problems"(b "sales-pipe".businesses) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."compute_business_problems"(b "sales-pipe".businesses) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."create_import_batch"(p_file_name text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."create_import_batch"(p_file_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."create_import_batch"(p_file_name text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."customer_leads_touch"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."customer_leads_touch"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "sales-pipe"."customer_leads_touch"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."customer_leads_touch"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."daily_update"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."daily_update"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."delete_audience"(p_business_id uuid, p_confirm_name text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."delete_audience"(p_business_id uuid, p_confirm_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."delete_audience"(p_business_id uuid, p_confirm_name text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."delete_leads"(p_business_ids uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."delete_leads"(p_business_ids uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."delete_leads"(p_business_ids uuid[]) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."discard_drafts"(p_opportunity_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."discard_drafts"(p_opportunity_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."discard_drafts"(p_opportunity_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."dismiss_campaign_reply"(p_reply_id uuid, p_undo boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."dismiss_campaign_reply"(p_reply_id uuid, p_undo boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."dismiss_campaign_reply"(p_reply_id uuid, p_undo boolean) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."dismiss_late_reply"(p_opportunity_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."dismiss_late_reply"(p_opportunity_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."dismiss_late_reply"(p_opportunity_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."enqueue_audience_campaign"(p_channel text, p_campaign_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."enqueue_audience_campaign"(p_channel text, p_campaign_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."enqueue_audience_campaign"(p_channel text, p_campaign_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."enqueue_campaign"(p_channel text, p_campaign_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."enqueue_campaign"(p_channel text, p_campaign_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."enqueue_campaign"(p_channel text, p_campaign_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."find_duplicates"(p_rows jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."find_duplicates"(p_rows jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."find_duplicates"(p_rows jsonb) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."generate_business_code"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."generate_business_code"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."generate_business_code"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."generate_draft"(p_thread_id uuid, p_step text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."generate_draft"(p_thread_id uuid, p_step text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."generate_opportunity_code"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."generate_opportunity_code"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."generate_opportunity_code"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."get_user_role"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."get_user_role"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."get_user_role"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."hand_over"(p_opportunity_id uuid, p_consultation_at timestamp with time zone, p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."hand_over"(p_opportunity_id uuid, p_consultation_at timestamp with time zone, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."hand_over"(p_opportunity_id uuid, p_consultation_at timestamp with time zone, p_user_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."import_businesses"(p_rows jsonb, p_batch_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."import_businesses"(p_rows jsonb, p_batch_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."import_businesses"(p_rows jsonb, p_batch_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."insights"(p_from date, p_to date, p_service text, p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."insights"(p_from date, p_to date, p_service text, p_user uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."insights"(p_from date, p_to date, p_service text, p_user uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."is_valid_uk_postcode"(p_pc text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."is_valid_uk_postcode"(p_pc text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."is_valid_uk_postcode"(p_pc text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."lead_problems"(p_business_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."lead_problems"(p_business_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."lead_problems"(p_business_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."link_booking"(p_booking_id uuid, p_opportunity_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."link_booking"(p_booking_id uuid, p_opportunity_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."link_booking"(p_booking_id uuid, p_opportunity_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."list_import_batches"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."list_import_batches"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."list_import_batches"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."list_pitches"(p_service text, p_type text, p_filter text, p_search text, p_platform text, p_assigned text, p_include_archived boolean, p_limit integer, p_offset integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."list_pitches"(p_service text, p_type text, p_filter text, p_search text, p_platform text, p_assigned text, p_include_archived boolean, p_limit integer, p_offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."list_pitches"(p_service text, p_type text, p_filter text, p_search text, p_platform text, p_assigned text, p_include_archived boolean, p_limit integer, p_offset integer) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."list_unmatched_bookings"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."list_unmatched_bookings"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."list_unmatched_bookings"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."log_audience_export"(p_business_id uuid, p_rows integer, p_filters jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."log_audience_export"(p_business_id uuid, p_rows integer, p_filters jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."log_audience_export"(p_business_id uuid, p_rows integer, p_filters jsonb) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."missing_counts"(p_type text, p_problem text, p_batch uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."missing_counts"(p_type text, p_problem text, p_batch uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."missing_counts"(p_type text, p_problem text, p_batch uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."missing_list"(p_type text, p_problem text, p_batch uuid, p_limit integer, p_offset integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."missing_list"(p_type text, p_problem text, p_batch uuid, p_limit integer, p_offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."missing_list"(p_type text, p_problem text, p_batch uuid, p_limit integer, p_offset integer) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."new_pitch"(p_business_id uuid, p_services text[], p_source_opportunity_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."new_pitch"(p_business_id uuid, p_services text[], p_source_opportunity_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."new_pitch"(p_business_id uuid, p_services text[], p_source_opportunity_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."normalise_email"(p_email text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."normalise_email"(p_email text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."normalise_email"(p_email text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."normalise_phone"(p_phone text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."normalise_phone"(p_phone text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."normalise_phone"(p_phone text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."on_employee_change"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."on_employee_change"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "sales-pipe"."on_employee_change"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."on_employee_change"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."on_matrix_change"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."on_matrix_change"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "sales-pipe"."on_matrix_change"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."on_matrix_change"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."open_campaign_reply_in_leads"(p_reply_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."open_campaign_reply_in_leads"(p_reply_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."open_campaign_reply_in_leads"(p_reply_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."record_audience_opt_out"(p_customer_id uuid, p_email text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_audience_opt_out"(p_customer_id uuid, p_email text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."record_email_events"(p_events jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_email_events"(p_events jsonb) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."record_inbound"(p_platform text, p_external_thread_id text, p_from text, p_body text, p_external_message_id text, p_media_url text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_inbound"(p_platform text, p_external_thread_id text, p_from text, p_body text, p_external_message_id text, p_media_url text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."record_outbound"(p_thread_id uuid, p_body text, p_subject text, p_template_id uuid, p_send_method text, p_external_message_id text, p_sent_by uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_outbound"(p_thread_id uuid, p_body text, p_subject text, p_template_id uuid, p_send_method text, p_external_message_id text, p_sent_by uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_outbound"(p_thread_id uuid, p_body text, p_subject text, p_template_id uuid, p_send_method text, p_external_message_id text, p_sent_by uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."record_outreach"(p_lead_id uuid, p_action text, p_task_id uuid, p_details text, p_reply_channel text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_outreach"(p_lead_id uuid, p_action text, p_task_id uuid, p_details text, p_reply_channel text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_outreach"(p_lead_id uuid, p_action text, p_task_id uuid, p_details text, p_reply_channel text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."record_unsubscribe"(p_email text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_unsubscribe"(p_email text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."record_whatsapp_status"(p_statuses jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_whatsapp_status"(p_statuses jsonb) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."record_win"(p_opportunity_id uuid, p_services_won text[], p_converted_through text, p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_win"(p_opportunity_id uuid, p_services_won text[], p_converted_through text, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."record_win"(p_opportunity_id uuid, p_services_won text[], p_converted_through text, p_user_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."remove_opt_out"(p_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."remove_opt_out"(p_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."remove_opt_out"(p_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."reply_platform_counts"(p_type text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."reply_platform_counts"(p_type text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."reply_platform_counts"(p_type text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."require_role"(p_roles text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."require_role"(p_roles text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."require_role"(p_roles text[]) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."retry_failed_campaign_sends"(p_channel text, p_campaign_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."retry_failed_campaign_sends"(p_channel text, p_campaign_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."retry_failed_campaign_sends"(p_channel text, p_campaign_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."save_template"(p_id uuid, p_step text, p_service text, p_platform text, p_subject text, p_body text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."save_template"(p_id uuid, p_step text, p_service text, p_platform text, p_subject text, p_body text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."save_template"(p_id uuid, p_step text, p_service text, p_platform text, p_subject text, p_body text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."set_archived"(p_business_ids uuid[], p_archived boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_archived"(p_business_ids uuid[], p_archived boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_archived"(p_business_ids uuid[], p_archived boolean) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."set_audience_client"(p_business_id uuid, p_dpa_signed_on date, p_sender_name text, p_reply_to text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_audience_client"(p_business_id uuid, p_dpa_signed_on date, p_sender_name text, p_reply_to text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_audience_client"(p_business_id uuid, p_dpa_signed_on date, p_sender_name text, p_reply_to text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."set_cadence"(p_step_name text, p_days integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_cadence"(p_step_name text, p_days integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_cadence"(p_step_name text, p_days integer) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."set_member_capacity"(p_id uuid, p_capacity integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_member_capacity"(p_id uuid, p_capacity integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_member_capacity"(p_id uuid, p_capacity integer) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."set_my_name"(p_full_name text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_my_name"(p_full_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_my_name"(p_full_name text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."set_services"(p_opportunity_ids uuid[], p_services text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_services"(p_opportunity_ids uuid[], p_services text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_services"(p_opportunity_ids uuid[], p_services text[]) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."set_stage"(p_opportunity_id uuid, p_stage text, p_reason text, p_user_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_stage"(p_opportunity_id uuid, p_stage text, p_reason text, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_stage"(p_opportunity_id uuid, p_stage text, p_reason text, p_user_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."set_template_active"(p_id uuid, p_active boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_template_active"(p_id uuid, p_active boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."set_template_active"(p_id uuid, p_active boolean) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."setup_email_sync_cron"(p_app_url text, p_secret text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."setup_email_sync_cron"(p_app_url text, p_secret text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."start_thread"(p_opportunity_id uuid, p_platform text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."start_thread"(p_opportunity_id uuid, p_platform text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."start_thread"(p_opportunity_id uuid, p_platform text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."status_list"(p_status text, p_type text, p_platform text, p_limit integer, p_offset integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."status_list"(p_status text, p_type text, p_platform text, p_limit integer, p_offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."status_list"(p_status text, p_type text, p_platform text, p_limit integer, p_offset integer) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."status_type_counts"(p_status text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."status_type_counts"(p_status text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."status_type_counts"(p_status text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."sync_profile_from_matrix"(p_employee_id integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."sync_profile_from_matrix"(p_employee_id integer) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."template_name"(p_step text, p_service text, p_platform text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."template_name"(p_step text, p_service text, p_platform text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."template_name"(p_step text, p_service text, p_platform text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."trg_assign_open_pitch"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_assign_open_pitch"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."trg_audience_whatsapp_result"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_audience_whatsapp_result"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."trg_audience_won_change"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_audience_won_change"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."trg_businesses_compute_problems"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_businesses_compute_problems"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_businesses_compute_problems"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."trg_match_booking"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_match_booking"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_match_booking"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."trg_normalise_business_contact"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_normalise_business_contact"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_normalise_business_contact"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."trg_opp_reopen"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_opp_reopen"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."trg_opp_services_recompute_problems"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_opp_services_recompute_problems"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_opp_services_recompute_problems"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."trg_opp_stage_cleanup"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_opp_stage_cleanup"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."trg_opp_stage_cleanup"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."type_category"(p_type text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."type_category"(p_type text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."type_category"(p_type text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."undo_customer_import"(p_batch_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."undo_customer_import"(p_batch_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."undo_customer_import"(p_batch_id uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."update_lead_field"(p_business_id uuid, p_field text, p_value text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."update_lead_field"(p_business_id uuid, p_field text, p_value text) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."update_lead_field"(p_business_id uuid, p_field text, p_value text) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."update_member"(p_id uuid, p_full_name text, p_role text, p_capacity integer, p_active boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."update_member"(p_id uuid, p_full_name text, p_role text, p_capacity integer, p_active boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."update_member"(p_id uuid, p_full_name text, p_role text, p_capacity integer, p_active boolean) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."update_updated_at_column"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."update_updated_at_column"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."update_updated_at_column"() TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."v_business_cards"(p_service text, p_type text, p_filter text, p_search text, p_limit integer, p_offset integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_business_cards"(p_service text, p_type text, p_filter text, p_search text, p_limit integer, p_offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_business_cards"(p_service text, p_type text, p_filter text, p_search text, p_limit integer, p_offset integer) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."v_business_type_counts"(p_service text, p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_business_type_counts"(p_service text, p_user uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_business_type_counts"(p_service text, p_user uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."v_dashboard_status_counts"(p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_dashboard_status_counts"(p_user uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_dashboard_status_counts"(p_user uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."v_due_today"(p_tab text, p_limit integer, p_offset integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_due_today"(p_tab text, p_limit integer, p_offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_due_today"(p_tab text, p_limit integer, p_offset integer) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."v_service_counts"(p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_service_counts"(p_user uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."v_service_counts"(p_user uuid) TO service_role;
REVOKE ALL ON FUNCTION "sales-pipe"."valid_services"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "sales-pipe"."valid_services"() TO authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe"."valid_services"() TO service_role;
