/*
 * FILE:     supabase/tests/database/team_ui_support.test.sql
 * PURPOSE:  Phase 3 regression coverage for rename authorization and validation.
 * FLOWS:    G team settings (docs/prompts/team-collab.md sections 8.1 and 13).
 * SECURITY: S2, S5, S9, S10, S12.
 * DEBUG:    Run as a rollback-only query against the linked project when Docker is unavailable.
 */
begin;
set local search_path = extensions, public;
select extensions.plan(4);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at
) values
  ('51000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rename-owner@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('51000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rename-manager@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('51000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rename-outsider@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now())
on conflict (id) do nothing;

insert into public.teams (id, name, owner_id)
values ('5aaaaaaa-0000-0000-0000-000000000001', 'Rename Team', '51000000-0000-0000-0000-000000000001');
insert into public.team_members (team_id, user_id, role) values
  ('5aaaaaaa-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'admin'),
  ('5aaaaaaa-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', 'manager');

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","email":"rename-owner@example.test","role":"authenticated"}', true);
select extensions.lives_ok($$select public.rename_team('5aaaaaaa-0000-0000-0000-000000000001', '  New Name  ')$$,
  'Admin can rename a team and input is trimmed');
select extensions.is((select name from public.teams where id = '5aaaaaaa-0000-0000-0000-000000000001'),
  'New Name', 'rename stores normalized team name');
select extensions.throws_ok($$select public.rename_team('5aaaaaaa-0000-0000-0000-000000000001', '   ')$$,
  'P0001', 'INVALID_INPUT', 'blank team name is rejected');

select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000002","email":"rename-manager@example.test","role":"authenticated"}', true);
select extensions.throws_ok($$select public.rename_team('5aaaaaaa-0000-0000-0000-000000000001', 'Manager Name')$$,
  'P0001', 'FORBIDDEN', 'Manager cannot rename a team');

select * from extensions.finish();
rollback;
