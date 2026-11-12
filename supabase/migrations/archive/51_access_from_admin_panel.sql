-- ==============================================================================
-- 51_access_from_admin_panel.sql
-- Who can use the Sales Pipeline, and as what, now comes from the Admin
-- Panel's Access matrix (public.user_product_access, product 'sales_pipeline').
--
-- "sales-pipe".profiles stays (capacity, and everything that reads role or
-- is_active keeps working), but role and is_active are kept in step with the
-- matrix by triggers. Nothing in this app sets them any more.
--
--   Matrix role  -> profiles.role
--   admin        -> admin
--   consultant   -> consultant
--   anything else (sales, member) -> sales
--
-- Run after the Admin Panel's 047_user_product_access.sql.
-- ==============================================================================

-- ── 1. Stop giving every new sign-in account a Sales profile ─────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ── 2. Matrix -> profile ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "sales-pipe".sync_profile_from_matrix(p_employee_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

REVOKE ALL ON FUNCTION "sales-pipe".sync_profile_from_matrix(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "sales-pipe".sync_profile_from_matrix(integer) TO service_role;

-- A grant, role change or removal in the Access matrix
CREATE OR REPLACE FUNCTION "sales-pipe".on_matrix_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "sales-pipe".sync_profile_from_matrix(OLD.employee_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM "sales-pipe".sync_profile_from_matrix(NEW.employee_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sales_pipe_sync_profile ON public.user_product_access;
CREATE TRIGGER sales_pipe_sync_profile
AFTER INSERT OR UPDATE OR DELETE ON public.user_product_access
FOR EACH ROW EXECUTE FUNCTION "sales-pipe".on_matrix_change();

-- An employee is terminated, reinstated, or their sign-in account changes
CREATE OR REPLACE FUNCTION "sales-pipe".on_employee_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.auth_user_id IS NOT NULL AND OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id THEN
    UPDATE "sales-pipe".profiles SET is_active = false WHERE id = OLD.auth_user_id;
  END IF;
  PERFORM "sales-pipe".sync_profile_from_matrix(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sales_pipe_sync_profile ON hr.employees;
CREATE TRIGGER sales_pipe_sync_profile
AFTER UPDATE OF status, auth_user_id ON hr.employees
FOR EACH ROW EXECUTE FUNCTION "sales-pipe".on_employee_change();

-- ── 3. Team screen: only capacity is edited here ──────────────────────────────
CREATE OR REPLACE FUNCTION "sales-pipe".set_member_capacity(p_id uuid, p_capacity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $$
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
$$;

REVOKE ALL ON FUNCTION "sales-pipe".set_member_capacity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "sales-pipe".set_member_capacity(uuid, integer) TO authenticated, service_role;

-- Names, roles and access are managed in the Admin Panel now
CREATE OR REPLACE FUNCTION "sales-pipe".update_member(p_id uuid, p_full_name text, p_role text, p_capacity integer, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'sales-pipe', 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Roles and access are managed in the Admin Panel (Access page)';
END;
$$;

-- ── 4. Bring existing profiles in line with the matrix ────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM hr.employees WHERE auth_user_id IS NOT NULL LOOP
    PERFORM "sales-pipe".sync_profile_from_matrix(r.id);
  END LOOP;
END $$;

-- Profiles with no Sales access in the matrix (e.g. accounts created for
-- other products) are switched off. Rows are kept for lead history.
UPDATE "sales-pipe".profiles sp SET is_active = false
WHERE sp.is_active IS DISTINCT FROM false
  AND NOT EXISTS (
    SELECT 1
    FROM hr.employees e
    JOIN public.user_product_access upa ON upa.employee_id = e.id
    JOIN public.products p ON p.product_id = upa.product_id AND p.code = 'sales_pipeline'
    WHERE e.auth_user_id = sp.id AND e.status <> 'terminated'
  );
