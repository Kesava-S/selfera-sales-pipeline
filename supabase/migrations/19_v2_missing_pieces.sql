-- 19_v2_missing_pieces.sql

-- 1. Sequences for codes (replacing COUNT(*) + 1)
create sequence if not exists "sales-pipe".business_code_seq start 1000;
create sequence if not exists "sales-pipe".opportunity_code_seq start 1000;

-- 2. Revoke anon access from future tables in the schema
alter default privileges in schema "sales-pipe" revoke all on tables from anon;
alter default privileges in schema "sales-pipe" revoke all on routines from anon;

-- 3. Update the insert triggers/functions to use the sequences
create or replace function "sales-pipe".generate_business_code()
returns trigger as $$
begin
  if NEW.business_code is null then
    NEW.business_code := 'B' || nextval('"sales-pipe".business_code_seq')::text;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create or replace function "sales-pipe".generate_opportunity_code()
returns trigger as $$
begin
  if NEW.opportunity_code is null then
    NEW.opportunity_code := 'OPP' || nextval('"sales-pipe".opportunity_code_seq')::text;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;


-- 4. Admin function to link booking to opportunity
create or replace function "sales-pipe".link_booking(p_booking_id uuid, p_opportunity_id uuid)
returns void as $$
declare
  v_role text;
begin
  select role into v_role from "sales-pipe".profiles where id = auth.uid();
  if v_role != 'admin' then
    raise exception 'Unauthorized: Only admins can link bookings';
  end if;

  update "sales-pipe".bookings
  set opportunity_id = p_opportunity_id
  where id = p_booking_id;
end;
$$ language plpgsql security definer;

-- 5. Helper function for auth scoping
create or replace function "sales-pipe".get_user_role()
returns text as $$
declare
  v_role text;
begin
  select role into v_role from "sales-pipe".profiles where id = auth.uid();
  return coalesce(v_role, 'sales');
end;
$$ language plpgsql security definer;

-- 6. v_business_cards
create or replace function "sales-pipe".v_business_cards(
  p_service text,
  p_type text,
  p_filter text,
  p_search text,
  p_limit int,
  p_offset int
)
returns table (
  opportunity_id uuid,
  business_name text,
  area text,
  google_rating numeric,
  stage text,
  threads jsonb
) as $$
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
$$ language plpgsql security definer;

-- 7. v_due_today: final version is in 23_v2_app_functions.sql

-- 8. Assign consultant (admin only check)
create or replace function "sales-pipe".assign_consultant(p_opportunity_id uuid, p_consultant_id uuid)
returns void as $$
declare
  v_role text;
begin
  select role into v_role from "sales-pipe".profiles where id = auth.uid();
  if v_role != 'admin' then
    raise exception 'Unauthorized: Only admins can assign consultants';
  end if;

  update "sales-pipe".opportunities
  set assigned_consultant_id = p_consultant_id
  where id = p_opportunity_id;
end;
$$ language plpgsql security definer;

-- 9. Seed Templates: moved to 22_v2_fixes.sql (the old insert used a table that doesn't exist)
