-- ==============================================================================
-- 28_seed_data.sql
-- Default configuration seed data: categories, services, platforms, and cadence rules
-- ==============================================================================

SET search_path TO "sales-pipe", public;

-- 1. Business Categories
INSERT INTO "sales-pipe".business_categories (name, slug, icon_name, description, synonyms, sort_order) VALUES
('Hotel', 'hotel', 'Building2', 'Hotels, boutique hotels, B&Bs, and guest accommodation', ARRAY['hotel', 'hotels', 'boutique hotel', 'b&b', 'guesthouse', 'hostel'], 1),
('Restaurant or cafe', 'restaurant-or-cafe', 'UtensilsCrossed', 'Restaurants, cafes, bistros, bakeries, and dining venues', ARRAY['restaurant', 'cafe', 'bistro', 'bakery', 'coffee shop', 'diner'], 2),
('Pub', 'pub', 'Beer', 'Pubs, bars, taverns, and social taprooms', ARRAY['pub', 'bar', 'tavern', 'taproom', 'brewery'], 3),
('Property management', 'property-management', 'Home', 'Property management companies, short-let and Airbnb operators', ARRAY['property management', 'short-let', 'airbnb', 'serviced apartments'], 4)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    icon_name = EXCLUDED.icon_name,
    description = EXCLUDED.description,
    synonyms = EXCLUDED.synonyms,
    sort_order = EXCLUDED.sort_order;

-- 2. Services
INSERT INTO "sales-pipe".services (name, code, description, sort_order) VALUES
('Website', 'website', 'High-converting custom website design and booking engine integration', 1),
('Micro Automation', 'micro-automation', 'Targeted automated workflows, lead capture, and notifications', 2),
('End-to-End Automation', 'e2e-automation', 'Full-cycle operational and CRM automation suites', 3),
('Custom Dashboard', 'custom-dashboard', 'Real-time performance analytics and operational reporting portals', 4),
('Cold Outreach', 'cold-outreach', 'Multi-channel outbound lead generation and campaign management', 5)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- 3. Outreach Platforms
INSERT INTO "sales-pipe".outreach_platforms (name, slug, is_direct_send, daily_limit, sort_order) VALUES
('Email', 'email', true, 200, 1),
('WhatsApp', 'whatsapp', true, 100, 2),
('Instagram', 'instagram', false, 50, 3),
('Facebook', 'facebook', false, 50, 4),
('LinkedIn', 'linkedin', false, 50, 5),
('Phone', 'phone', false, 100, 6),
('Walk-in', 'walk-in', false, 100, 7)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    is_direct_send = EXCLUDED.is_direct_send,
    daily_limit = EXCLUDED.daily_limit,
    sort_order = EXCLUDED.sort_order;

-- 4. Cadence Rules
INSERT INTO "sales-pipe".cadence_rules (step_name, days_delay, description) VALUES
('Initial Outreach', 0, 'Triggered immediately when opportunity enters outreach queue'),
('Follow-up 1', 3, 'Follow-up step triggered after 3 days without response'),
('Follow-up 2', 5, 'Final follow-up attempt triggered after 5 days without response'),
('Audit Delivered', 2, 'Delivering requested digital gap audit report')
ON CONFLICT (step_name) DO UPDATE SET
    days_delay = EXCLUDED.days_delay,
    description = EXCLUDED.description;

-- 5. Default Pipeline Settings
INSERT INTO "sales-pipe".pipeline_settings (key, value, description) VALUES
('auto_assign_leads', 'true'::jsonb, 'Automatically round-robin new approved leads to active sales reps'),
('lead_capacity_limit', '50'::jsonb, 'Default maximum active leads per sales rep'),
('company_name', '"Selfera Sales"'::jsonb, 'Brand name used across outreach signatures')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;
