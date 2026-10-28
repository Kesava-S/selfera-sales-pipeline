// Structure snapshot queries for the "sales-pipe" schema (shared by snapshot.cjs and applysync.cjs)
module.exports = {
  tables: `select c.relname n, c.relkind k from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='sales-pipe' and c.relkind in ('r','v','m','p') order by 1`,
  columns: `select table_name||'.'||column_name n, data_type||coalesce('('||character_maximum_length||')','')||' null='||is_nullable||' def='||coalesce(column_default,'')||' gen='||coalesce(generation_expression,'') d from information_schema.columns where table_schema='sales-pipe' order by 1`,
  constraints: `select conrelid::regclass::text||' '||conname n, pg_get_constraintdef(oid) d from pg_constraint where connamespace='"sales-pipe"'::regnamespace order by 1`,
  indexes: `select indexname n, indexdef d from pg_indexes where schemaname='sales-pipe' order by 1`,
  functions: `select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' n, md5(pg_get_functiondef(p.oid)) d from pg_proc p where p.pronamespace='"sales-pipe"'::regnamespace and p.prokind in ('f','p') order by 1`,
  triggers: `select tgrelid::regclass::text||' '||tgname n, pg_get_triggerdef(oid) d from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace='"sales-pipe"'::regnamespace) order by 1`,
  policies: `select tablename||' '||policyname n, cmd||' '||array_to_string(roles,',')||' using='||coalesce(qual,'')||' check='||coalesce(with_check,'') d from pg_policies where schemaname='sales-pipe' order by 1`,
  views: `select viewname n, md5(definition) d from pg_views where schemaname='sales-pipe' order by 1`,
  rls: `select relname n, relrowsecurity::text d from pg_class where relnamespace='"sales-pipe"'::regnamespace and relkind='r' order by 1`,
  table_acl: `select relname n, coalesce(relacl::text,'') d from pg_class where relnamespace='"sales-pipe"'::regnamespace and relkind in ('r','v','S') order by 1`,
  function_acl: `select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' n, coalesce(p.proacl::text,'default') d from pg_proc p where p.pronamespace='"sales-pipe"'::regnamespace order by 1`,
  auth_trigger: `select tgname n, '' d from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal`,
  counts: `select relname n, n_live_tup::text d from pg_stat_user_tables where schemaname='sales-pipe' order by 1`,
  extra_schemas: `select nspname n, '' d from pg_namespace where nspname in ('hr','public') order by 1`,
  admin_tables: `select table_schema||'.'||table_name n, '' d from information_schema.tables where (table_schema='public' and table_name in ('user_product_access','products','product_roles','roles')) or (table_schema='hr' and table_name='employees') order by 1`,
}
