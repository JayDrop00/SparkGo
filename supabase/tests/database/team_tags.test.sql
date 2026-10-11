/*
 * FILE:     supabase/tests/database/team_tags.test.sql
 * PURPOSE:  Verify tag role gates, same-team assignment, and tag/permission separation.
 * FLOWS:    Tags panel (docs/prompts/team-collab.md sections 7, 9, 13).
 * SECURITY: S1, S2, S5, S7, S9, S10, S12, S17, S20, S22.
 * DEBUG:    Inspect RLS policies, private.has_team_role and composite foreign keys.
 */
begin;
select extensions.plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at
) values
  ('52000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated','authenticated','tag-manager@example.test','','{}','{}',now(),now(),now()),
  ('52000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated','authenticated','tag-member@example.test','','{}','{}',now(),now(),now()),
  ('52000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated','authenticated','tag-outsider@example.test','','{}','{}',now(),now(),now())
on conflict (id) do nothing;
insert into public.teams(id,name,owner_id) values
 ('5bbbbbbb-0000-0000-0000-000000000001','Tag Team','52000000-0000-0000-0000-000000000001');
insert into public.team_members(team_id,user_id,role) values
 ('5bbbbbbb-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000001','admin'),
 ('5bbbbbbb-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000002','member');

set local role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"52000000-0000-0000-0000-000000000001","email":"tag-manager@example.test","role":"authenticated"}',true);
insert into public.team_tags(id,team_id,name,color) values
 ('5ccccccc-0000-0000-0000-000000000001','5bbbbbbb-0000-0000-0000-000000000001','Design','#123456');
select extensions.lives_ok($$select public.set_member_tags('5bbbbbbb-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000002',array['5ccccccc-0000-0000-0000-000000000001']::uuid[])$$,
 'Admin can assign a same-team tag');
select extensions.is((select count(*)::integer from public.member_tags where team_id='5bbbbbbb-0000-0000-0000-000000000001' and user_id='52000000-0000-0000-0000-000000000002'),1,'assignment is saved');

select set_config('request.jwt.claim.sub','52000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"52000000-0000-0000-0000-000000000002","email":"tag-member@example.test","role":"authenticated"}',true);
select extensions.throws_ok($$select public.set_member_tags('5bbbbbbb-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000002',array[]::uuid[])$$,
 'P0001','FORBIDDEN','tag membership does not grant tag-management permission');
select extensions.is((select role::text from public.team_members where team_id='5bbbbbbb-0000-0000-0000-000000000001' and user_id='52000000-0000-0000-0000-000000000002'),'member','tag assignment does not change the member role');
select extensions.throws_ok($$select public.set_member_tags('5bbbbbbb-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000002',array['5ddddddd-0000-0000-0000-000000000001']::uuid[])$$,
 'P0001','FORBIDDEN','Member cannot use tag assignments to grant permissions');

select * from extensions.finish(false);
rollback;
