/*
 * FILE:     supabase/tests/database/team_hardening.test.sql
 * PURPOSE:  Verify the external event-trigger function is not executable through the API.
 * FLOWS:    Phase 8 hardening (docs/prompts/team-collab.md sections 6, 13, 14).
 * SECURITY: S1, S5, S20.
 * DEBUG:    Check function ACLs, event-trigger attachment, and RLS on a temporary public table.
 */
begin;
create temp table hardening_test_output(seq bigint generated always as identity,line text) on commit drop;
grant insert,select on hardening_test_output to authenticated;
insert into hardening_test_output(line) select extensions.plan(4);
create table public.__team_collab_rls_probe(id integer);

set local role authenticated;
insert into hardening_test_output(line) select extensions.ok(not has_function_privilege('anon','public.rls_auto_enable()','EXECUTE'),'anon cannot execute rls_auto_enable');
insert into hardening_test_output(line) select extensions.ok(not has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE'),'authenticated cannot execute rls_auto_enable');
insert into hardening_test_output(line) select extensions.ok(exists(select 1 from pg_catalog.pg_event_trigger where evtname='ensure_rls' and evtenabled='O'),'DDL event trigger remains enabled');
insert into hardening_test_output(line) select extensions.is((select relrowsecurity from pg_catalog.pg_class where oid='public.__team_collab_rls_probe'::regclass),true,'event trigger still enables RLS on public tables');
insert into hardening_test_output(line) select extensions.finish(false);
select string_agg(line,E'\n' order by seq) from hardening_test_output;
rollback;
