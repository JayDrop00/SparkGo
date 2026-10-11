/*
 * FILE:     supabase/tests/database/team_invites.test.sql
 * PURPOSE:  Phase 2 pgTAP coverage for invite authority, privacy, and responses.
 * FLOWS:    B and C (docs/prompts/team-collab.md sections 8.2, 10, and 13).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S12, S17, S21, S22.
 * DEBUG:    Run through `npx supabase db query --linked --file` after temporarily enabling pgTAP; all fixtures roll back.
 */
begin;
set local search_path = extensions, public;
select extensions.plan(20);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at
) values
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'invite-owner@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('41000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'invite-manager@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('41000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'invitee@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('41000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'unconfirmed@example.test', '', '{}'::jsonb, '{}'::jsonb, null, now(), now()),
  ('41000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'declinee@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('41000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outsider@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now())
on conflict (id) do nothing;

insert into public.teams (id, name, owner_id)
values ('4aaaaaaa-0000-0000-0000-000000000001', 'Invite Test Team', '41000000-0000-0000-0000-000000000001');
insert into public.team_members (team_id, user_id, role) values
  ('4aaaaaaa-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'admin'),
  ('4aaaaaaa-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'manager');

-- Seed an expired pending invite; response must identify expiry without accepting it.
insert into public.team_invites (
  id, team_id, team_name, email, role, invited_by, expires_at
) values (
  '4bbbbbbb-0000-0000-0000-000000000001',
  '4aaaaaaa-0000-0000-0000-000000000001', 'Invite Test Team',
  'expired@example.test', 'member', '41000000-0000-0000-0000-000000000001', now() - interval '1 minute'
);
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at
) values (
  '41000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'expired@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","email":"invite-owner@example.test","role":"authenticated"}', true);

select extensions.throws_ok($$select public.invite_to_team(
  '4aaaaaaa-0000-0000-0000-000000000001', 'badrole@example.test', 'admin')$$,
  'P0001', 'INVALID_INPUT', 'admin cannot be granted through an invite');
select extensions.lives_ok($$select set_config('test.invite_id', public.invite_to_team(
  '4aaaaaaa-0000-0000-0000-000000000001', '  Invitee@Example.Test  ', 'member')::text, true)$$,
  'admin creates an invite with normalized email');
select extensions.throws_ok($$select public.invite_to_team(
  '4aaaaaaa-0000-0000-0000-000000000001', 'invitee@example.test', 'member')$$,
  'P0001', 'ALREADY_INVITED', 'duplicate pending invite is rejected');
select extensions.throws_ok($$insert into public.team_invites(team_id,team_name,email,role,invited_by)
  values ('4aaaaaaa-0000-0000-0000-000000000001','Invite Test Team','direct@example.test',
          'member','41000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'clients cannot insert invitations directly');
select extensions.throws_ok($$select email from public.team_invites$$,
  '42501', null, 'clients cannot read invite email columns directly');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000006', true);
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000006","email":"outsider@example.test","role":"authenticated"}', true);
select extensions.is((select count(*)::bigint from public.team_invites), 0::bigint,
  'outsider cannot see team invitations');
select extensions.throws_ok($$select public.respond_to_invite(current_setting('test.invite_id')::uuid, true)$$,
  'P0001', 'NOT_FOUND', 'wrong email cannot respond to invite');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000004","email":"unconfirmed@example.test","role":"authenticated"}', true);
select extensions.throws_ok($$select public.respond_to_invite(
  current_setting('test.invite_id')::uuid, true)$$,
  'P0001', 'NOT_FOUND', 'an invite addressed to a different email is hidden');

-- The invitee can see only the invitation addressed to the JWT email.
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000003","email":"invitee@example.test","role":"authenticated"}', true);
select extensions.is((select count(*)::bigint from public.team_invites
  where id = current_setting('test.invite_id')::uuid), 1::bigint,
  'matching invitee sees their invite');
select extensions.lives_ok($$select public.respond_to_invite(current_setting('test.invite_id')::uuid, true)$$,
  'confirmed matching invitee accepts invitation');
select extensions.is((select role from public.team_members
  where team_id = '4aaaaaaa-0000-0000-0000-000000000001'
    and user_id = '41000000-0000-0000-0000-000000000003'),
  'member'::public.team_role, 'acceptance adds the invited role');
select extensions.throws_ok($$select public.respond_to_invite(
  current_setting('test.invite_id')::uuid, true)$$,
  'P0001', 'INVALID_STATE', 'second response is rejected');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000007', true);
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000007","email":"expired@example.test","role":"authenticated"}', true);
select extensions.throws_ok($$select public.respond_to_invite(
  '4bbbbbbb-0000-0000-0000-000000000001', true)$$,
  'P0001', 'INVITE_EXPIRED', 'expired invite cannot be accepted');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000004","email":"unconfirmed@example.test","role":"authenticated"}', true);
-- Seed an invite specifically for the unconfirmed account and ensure confirmation is required.
reset role;
insert into public.team_invites (id, team_id, team_name, email, role, invited_by)
values ('4bbbbbbb-0000-0000-0000-000000000002',
  '4aaaaaaa-0000-0000-0000-000000000001', 'Invite Test Team', 'unconfirmed@example.test',
  'member', '41000000-0000-0000-0000-000000000001');
set local role authenticated;
select extensions.throws_ok($$select public.respond_to_invite(
  '4bbbbbbb-0000-0000-0000-000000000002', true)$$,
  'P0001', 'EMAIL_NOT_CONFIRMED', 'unconfirmed account cannot accept invitation');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000005","email":"declinee@example.test","role":"authenticated"}', true);
reset role;
insert into public.team_invites (id, team_id, team_name, email, role, invited_by)
values ('4bbbbbbb-0000-0000-0000-000000000003',
  '4aaaaaaa-0000-0000-0000-000000000001', 'Invite Test Team', 'declinee@example.test',
  'member', '41000000-0000-0000-0000-000000000001');
set local role authenticated;
select extensions.lives_ok($$select public.respond_to_invite(
  '4bbbbbbb-0000-0000-0000-000000000003', false)$$,
  'invitee can decline');
select extensions.is((select status from public.team_invites
  where id = '4bbbbbbb-0000-0000-0000-000000000003'),
  'declined'::public.invite_status, 'decline records the declined status');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000002","email":"invite-manager@example.test","role":"authenticated"}', true);
select extensions.throws_ok($$select public.invite_to_team(
  '4aaaaaaa-0000-0000-0000-000000000001', 'manager-role@example.test', 'manager')$$,
  'P0001', 'FORBIDDEN', 'manager cannot invite another manager');
select extensions.lives_ok($$select set_config('test.manager_invite_id', public.invite_to_team(
  '4aaaaaaa-0000-0000-0000-000000000001', 'manager-own@example.test', 'member')::text, true)$$,
  'manager can invite a member');
select extensions.throws_ok($$select public.revoke_invite(current_setting('test.invite_id')::uuid)$$,
  'P0001', 'FORBIDDEN', 'manager cannot revoke another creator invitation');
select extensions.lives_ok($$select public.revoke_invite(current_setting('test.manager_invite_id')::uuid)$$,
  'manager can revoke their own invite');

select * from extensions.finish();
rollback;

