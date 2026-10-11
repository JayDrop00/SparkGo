/*
 * FILE:     supabase/tests/database/team_core.test.sql
 * PURPOSE:  Phase 1 pgTAP coverage for isolation, grants, role boundaries and ownership.
 * FLOWS:    Team creation and core membership management (team-collab.md sections 5, 8, 13).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17, S22.
 * DEBUG:    Run through `npx supabase db query --linked --file` after temporarily enabling pgTAP; the file rolls back all seeded rows.
 */
begin;
set local search_path = extensions, public;

select extensions.plan(41);

-- Fixtures are inserted as the migration test's database owner, before role impersonation.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner1@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin1@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'manager1@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'member1@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner2@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outsider@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now())
on conflict (id) do nothing;

insert into public.teams (id, name, owner_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Team One', '10000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Team Two', '20000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'manager'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'member'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'admin')
on conflict (team_id, user_id) do nothing;

-- T1: users outside Team One see none of its protected records.
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000001","email":"outsider@example.test","role":"authenticated"}', true);
select extensions.is((select count(*)::bigint from public.teams), 0::bigint, 'outsider sees no teams');
select extensions.is((select count(*)::bigint from public.team_members), 0::bigint, 'outsider sees no memberships');
select extensions.is((select count(*)::bigint from public.profiles), 1::bigint, 'outsider sees only own profile');
select extensions.is((select count(*)::bigint from public.team_activity_log), 0::bigint, 'outsider sees no activity');

select extensions.throws_ok($$select public.transfer_team_ownership(
  'aaaaaaaa-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004')$$,
  'P0001', 'NOT_FOUND', 'outsider cannot transfer another team');
select extensions.throws_ok($$select public.delete_team(
  'aaaaaaaa-0000-0000-0000-000000000001', 'Team One')$$,
  'P0001', 'NOT_FOUND', 'outsider cannot delete another team');
select extensions.throws_ok($$select public.change_member_role(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004', 'manager')$$,
  'P0001', 'NOT_FOUND', 'outsider cannot change another team role');
select extensions.throws_ok($$select public.remove_member(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004')$$,
  'P0001', 'NOT_FOUND', 'outsider cannot remove another team member');
select extensions.throws_ok($$select public.leave_team('aaaaaaaa-0000-0000-0000-000000000001')$$,
  'P0001', 'NOT_FOUND', 'outsider cannot leave a team they do not belong to');

-- A member of another team has the same isolation boundary.
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","email":"owner2@example.test","role":"authenticated"}', true);
select extensions.is((select count(*)::bigint from public.teams
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'Team Two user cannot read Team One');
select extensions.is((select count(*)::bigint from public.team_members
  where team_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'Team Two user cannot read Team One members');
select extensions.is((select count(*)::bigint from public.team_activity_log
  where team_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'Team Two user cannot read Team One activity');
select extensions.is((select count(*)::bigint from public.profiles
  where id = '10000000-0000-0000-0000-000000000001'), 0::bigint, 'Team Two user cannot read Team One profiles');
select extensions.throws_ok($$select email from public.profiles$$,
  '42703', null, 'profile table does not expose email columns');
select extensions.throws_ok($$select public.delete_team(
  'aaaaaaaa-0000-0000-0000-000000000001', 'Team One')$$,
  'P0001', 'NOT_FOUND', 'Team Two user cannot delete Team One');

-- T3: clients cannot mutate membership, team ownership, or activity tables directly.
select extensions.throws_ok($$insert into public.team_members(team_id,user_id,role)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000001','admin')$$,
  '42501', null, 'direct membership insert is denied');
select extensions.throws_ok($$update public.team_members set role = 'admin'
  where team_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null, 'direct membership update is denied');
select extensions.throws_ok($$delete from public.team_members
  where team_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null, 'direct membership delete is denied');
select extensions.throws_ok($$insert into public.team_activity_log(team_id, action)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'team.created')$$,
  '42501', null, 'direct activity write is denied');
select extensions.throws_ok($$update public.teams set owner_id = '30000000-0000-0000-0000-000000000001'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null, 'direct team ownership update is denied');
select extensions.throws_ok($$delete from public.teams where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null, 'direct team deletion is denied');

-- Managers may read the team but cannot change membership or administer roles.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","email":"manager1@example.test","role":"authenticated"}', true);
select extensions.is((select count(*)::bigint from public.teams), 1::bigint, 'manager sees own team');
select extensions.lives_ok($$select public.create_team('  Manager owned  ')$$,
  'authenticated Manager can create a team');
select extensions.is((select name from public.teams
  where owner_id = '10000000-0000-0000-0000-000000000003'),
  'Manager owned', 'team creation trims the name and makes creator an owner');
select extensions.is((select role from public.team_members
  where team_id = (select id from public.teams
    where owner_id = '10000000-0000-0000-0000-000000000003'
      and name = 'Manager owned')
    and user_id = '10000000-0000-0000-0000-000000000003'),
  'admin'::public.team_role, 'team creator is inserted as an Admin member');
select extensions.throws_ok($$select public.create_team('   ')$$,
  'P0001', 'INVALID_INPUT', 'team creation rejects a blank name');
select extensions.lives_ok($$do $body$ begin
  for i in 1..4 loop
    perform public.create_team('Limit team ' || i);
  end loop;
end $body$;$$, 'team owner limit allows remaining slots');
select extensions.throws_ok($$select public.create_team('One too many')$$,
  'P0001', 'LIMIT_REACHED', 'team owner limit is enforced');
select extensions.throws_ok($$select public.change_member_role(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004', 'member')$$,
  'P0001', 'FORBIDDEN', 'manager cannot change roles');
select extensions.throws_ok($$select public.remove_member(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004')$$,
  'P0001', 'FORBIDDEN', 'manager cannot remove members');

-- A non-owner Admin may manage non-Admin members but cannot change/remove Admins.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","email":"admin1@example.test","role":"authenticated"}', true);
select extensions.lives_ok($$select public.change_member_role(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003', 'member')$$,
  'non-owner Admin can change a Manager role');
select extensions.throws_ok($$select public.change_member_role(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'manager')$$,
  'P0001', 'OWNER_PROTECTED', 'owner cannot be demoted');
select extensions.throws_ok($$select public.change_member_role(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'admin')$$,
  'P0001', 'OWNER_PROTECTED', 'owner role cannot be changed');
select extensions.throws_ok($$select public.remove_member(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001')$$,
  'P0001', 'OWNER_PROTECTED', 'owner cannot be removed');
select extensions.throws_ok($$select public.change_member_role(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002', 'member')$$,
  'P0001', 'FORBIDDEN', 'non-owner Admin cannot demote an Admin');
select extensions.throws_ok($$select public.remove_member(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002')$$,
  'P0001', 'FORBIDDEN', 'non-owner Admin cannot remove an Admin');

-- Owner transfer preserves the old owner's Admin membership and protects the new owner.
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","email":"owner1@example.test","role":"authenticated"}', true);
select extensions.is((select count(*)::bigint from public.profiles
  where id in ('10000000-0000-0000-0000-000000000001',
               '10000000-0000-0000-0000-000000000002',
               '10000000-0000-0000-0000-000000000003',
               '10000000-0000-0000-0000-000000000004')),
  4::bigint, 'team member can read teammate profiles');
select extensions.lives_ok($$select public.transfer_team_ownership(
  'aaaaaaaa-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004')$$, 'owner can transfer ownership to a member');
select extensions.is((select owner_id from public.teams
  where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000004'::uuid, 'ownership moved to selected member');
select extensions.is((select role from public.team_members
  where team_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    and user_id = '10000000-0000-0000-0000-000000000001'),
  'admin'::public.team_role, 'previous owner remains an Admin');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","email":"member1@example.test","role":"authenticated"}', true);
select extensions.throws_ok($$select public.leave_team('aaaaaaaa-0000-0000-0000-000000000001')$$,
  'P0001', 'OWNER_PROTECTED', 'current owner cannot leave');

select * from extensions.finish();
rollback;


