/*
 * FILE:     supabase/tests/database/team_tasks.test.sql
 * PURPOSE:  Verify team task write roles, creator assignment, member assignment, and isolation.
 * FLOWS:    Team task board (docs/prompts/team-collab.md sections 7, 8.3, 10, 13).
 * SECURITY: S1, S2, S5, S6, S7, S9, S10, S11, S12, S17, S20, S22.
 * DEBUG:    Inspect grants, manager policies, created_by trigger, assignment RPC and composite FK.
 */
begin;
create temp table team_task_test_output(seq bigint generated always as identity, line text) on commit drop;
grant insert, select on team_task_test_output to authenticated;
insert into team_task_test_output(line) select extensions.plan(7);

insert into auth.users (
 id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at
) values
 ('53000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task-admin@example.test','','{}','{}',now(),now(),now()),
 ('53000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task-member@example.test','','{}','{}',now(),now(),now()),
 ('53000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task-outsider@example.test','','{}','{}',now(),now(),now())
on conflict (id) do nothing;
insert into public.teams(id,name,owner_id) values
 ('5eeeeeee-0000-0000-0000-000000000001','Task Team','53000000-0000-0000-0000-000000000001'),
 ('5eeeeeee-0000-0000-0000-000000000002','Other Task Team','53000000-0000-0000-0000-000000000003');
insert into public.team_members(team_id,user_id,role) values
 ('5eeeeeee-0000-0000-0000-000000000001','53000000-0000-0000-0000-000000000001','admin'),
 ('5eeeeeee-0000-0000-0000-000000000001','53000000-0000-0000-0000-000000000002','member'),
 ('5eeeeeee-0000-0000-0000-000000000002','53000000-0000-0000-0000-000000000003','admin');
insert into public.team_groups(id,team_id,group_name,position) values
 ('5fffffff-0000-0000-0000-000000000001','5eeeeeee-0000-0000-0000-000000000001','Valid Group',0),
 ('5fffffff-0000-0000-0000-000000000002','5eeeeeee-0000-0000-0000-000000000002','Other Group',0);

set local role authenticated;
select set_config('request.jwt.claim.sub','53000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"53000000-0000-0000-0000-000000000001","email":"task-admin@example.test","role":"authenticated"}',true);
insert into team_task_test_output(line) select extensions.lives_ok($$insert into public.team_tasks(id,team_id,group_id,task_name,position) values ('5aaaaaaa-1111-0000-0000-000000000001','5eeeeeee-0000-0000-0000-000000000001','5fffffff-0000-0000-0000-000000000001','Task',0)$$,
 'Admin can create a task in a same-team group');
insert into team_task_test_output(line) select extensions.is((select created_by from public.team_tasks where id='5aaaaaaa-1111-0000-0000-000000000001'),'53000000-0000-0000-0000-000000000001'::uuid,'task creator is derived from auth.uid');
insert into team_task_test_output(line) select extensions.throws_ok($$insert into public.team_tasks(team_id,group_id,task_name,position) values ('5eeeeeee-0000-0000-0000-000000000001','5fffffff-0000-0000-0000-000000000002','Cross-team group',1)$$,
 '23503','insert or update on table "team_tasks" violates foreign key constraint "team_tasks_group_id_team_id_fkey"','cross-team group reference is rejected');
insert into team_task_test_output(line) select extensions.lives_ok($$select public.assign_task_members('5aaaaaaa-1111-0000-0000-000000000001',array['53000000-0000-0000-0000-000000000002']::uuid[])$$,
 'Admin can assign a task to an existing team member');
insert into team_task_test_output(line) select extensions.is((select count(*)::integer from public.task_assignees where task_id='5aaaaaaa-1111-0000-0000-000000000001'),1,'assignee row is stored');
insert into team_task_test_output(line) select extensions.throws_ok($$select public.assign_task_members('5aaaaaaa-1111-0000-0000-000000000001',array['53000000-0000-0000-0000-000000000003']::uuid[])$$,
 'P0001','INVALID_INPUT','cross-team task assignment is rejected');

select set_config('request.jwt.claim.sub','53000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"53000000-0000-0000-0000-000000000002","email":"task-member@example.test","role":"authenticated"}',true);
insert into team_task_test_output(line) select extensions.throws_ok($$update public.team_tasks set status='done' where id='5aaaaaaa-1111-0000-0000-000000000001'$$,
 '42501','permission denied for table team_tasks','member cannot write task status directly');

insert into team_task_test_output(line) select extensions.finish(false);
select string_agg(line, E'\n' order by seq) from team_task_test_output;
rollback;
