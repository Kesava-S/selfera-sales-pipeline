-- ==============================================================================
-- 52_lists_from_tables.sql
-- Services and business categories come from their tables, not fixed lists:
--   "sales-pipe".services             -> valid_services()
--   "sales-pipe".business_categories  -> canonical_business_type(), type_category()
-- The app reads the same tables (src/lib/dynamicData.ts), so adding,
-- renaming, reordering or switching off a row changes both together.
--
-- Platforms stay limited to the channels the app can send on (threads and
-- templates check them); outreach_platforms sets their order and which are on.
-- ==============================================================================

-- ── 1. Categories: group, and every spelling the app and imports understand ──
ALTER TABLE "sales-pipe".business_categories
  ADD COLUMN IF NOT EXISTS category_group text;

-- What a category is filed under in reports (was fixed in type_category())
UPDATE "sales-pipe".business_categories SET category_group = 'Accommodation'
WHERE category_group IS NULL AND name IN ('Hotel', 'Property management');
UPDATE "sales-pipe".business_categories SET category_group = 'Food & Drink'
WHERE category_group IS NULL AND name IN ('Restaurant or cafe', 'Pub');

-- Spellings that were fixed in canonical_business_type() and the CSV import
UPDATE "sales-pipe".business_categories c
SET synonyms = ARRAY(SELECT DISTINCT lower(x) FROM unnest(c.synonyms || extra.words) AS x)
FROM (VALUES
  ('Hotel', ARRAY['hotel', 'hotels', 'boutique hotel', 'b&b', 'b b', 'bnb', 'b&b / guesthouse', 'guesthouse',
                  'guest house', 'inn', 'pub with rooms', 'barge b b', 'hostel', 'resort', 'motel', 'lodging',
                  'accommodation']),
  ('Restaurant or cafe', ARRAY['restaurant or cafe', 'restaurants and cafes', 'restaurants & cafes', 'restaurant',
                  'restaurants', 'cafe', 'cafes', 'coffee shop', 'coffee', 'park cafe', 'cafe bar', 'tea room',
                  'bistro', 'bakery', 'takeaway', 'diner', 'eatery', 'food & drink', 'food']),
  ('Pub', ARRAY['pub', 'pubs', 'bar', 'bars', 'pub bar', 'pub / bar', 'public house', 'tavern', 'gastropub']),
  ('Property management', ARRAY['property management', 'property manager', 'property', 'properties', 'airbnb',
                  'airbnb host', 'short let', 'short-let', 'short-let / airbnb host', 'serviced apartments',
                  'serviced apartment', 'apartment', 'apartments', 'co living', 'aparthotel', 'estate agent', 'letting agent', 'real estate'])
) AS extra(name, words)
WHERE c.name = extra.name;

-- Unknown types used to be filed as 'Restaurant or cafe'; that default is now a setting
INSERT INTO "sales-pipe".pipeline_settings (key, value, description)
VALUES ('default_business_category', to_jsonb('Restaurant or cafe'::text),
        'Category used when a lead''s business type matches no category')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Functions read the tables ─────────────────────────────────────────────
-- Every service ever offered stays valid (old leads keep theirs); the app only
-- offers the ones switched on.
CREATE OR REPLACE FUNCTION "sales-pipe".valid_services()
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(s.name ORDER BY s.sort_order, s.name), '{}')
  FROM "sales-pipe".services s
$$;

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
    (SELECT ps.value #>> '{}' FROM "sales-pipe".pipeline_settings ps WHERE ps.key = 'default_business_category')
  )
$$;

CREATE OR REPLACE FUNCTION "sales-pipe".type_category(p_type text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT c.category_group FROM "sales-pipe".business_categories c
     WHERE c.name = "sales-pipe".canonical_business_type(p_type)
       AND nullif(trim(coalesce(p_type, '')), '') IS NOT NULL),
    p_type
  )
$$;
