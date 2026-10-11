/*
 * FILE:     supabase/tests/database/team_dashboard.test.sql
 * PURPOSE:  Verify dashboard scopes, Manila day boundaries, sparks, workload and access checks.
 * FLOWS:    H dashboard load (docs/prompts/team-collab.md sections 8.5, 13).
 * SECURITY: S1, S2, S5, S6, S9, S12, S16, S17, S20, S22.
 * DEBUG:    Compare local-date windows, assigned-only team joins, points weights and role gates.
 */
begin;
create temp table dashboard_test_output(seq bigint generated always as identity,line text) on commit drop;
grant insert,select on dashboard_test_output to authenticated;
insert into dashboard_test_output(line) select extensions.plan(18);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at) values
 ('55000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dashboard-admin@example.test','','{}','{}',now(),now(),now()),
 ('55000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dashboard-member@example.test','','{}','{}',now(),now(),now())
on conflict(id) do nothing;
insert into public.teams(id,name,owner_id) values ('5eeeeeee-3333-0000-0000-000000000001','Dashboard Team','55000000-0000-0000-0000-000000000001');
insert into public.team_members(team_id,user_id,role) values
 ('5eeeeeee-3333-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','admin'),
 ('5eeeeeee-3333-0000-0000-000000000001','55000000-0000-0000-0000-000000000002','member');
insert into public.task_groups(id,owner_id,group_name,color,position) values
 ('5fffffff-3333-0000-0000-000000000001','55000000-0000-0000-0000-000000000002','Personal group','#112233',0);
insert into public.tasks(id,owner_id,group_id,task_name,difficulty,deadline_at,position,completed_at) values
 ('5aaaaaaa-3333-0000-0000-000000000001','55000000-0000-0000-0000-000000000002','5fffffff-3333-0000-0000-000000000001','Personal due', 'MEDIUM',((now() at time zone 'Asia/Manila')::date::timestamp + interval '12 hours') at time zone 'Asia/Manila',0,null),
 ('5aaaaaaa-3333-0000-0000-000000000002','55000000-0000-0000-0000-000000000002','5fffffff-3333-0000-0000-000000000001','Personal done','EASY',null,1,now());
insert into public.team_groups(id,team_id,group_name,color,position) values
 ('5fffffff-3333-0000-0000-000000000002','5eeeeeee-3333-0000-0000-000000000001','Team group','#445566',0);
insert into public.team_tasks(id,team_id,group_id,task_name,difficulty,due_at,status,completed_at,completed_by,created_by,position) values
 ('5aaaaaaa-3333-0000-0000-000000000003','5eeeeeee-3333-0000-0000-000000000001','5fffffff-3333-0000-0000-000000000002','Assigned due','HARD',((now() at time zone 'Asia/Manila')::date::timestamp + interval '30 minutes') at time zone 'Asia/Manila','todo',null,null,'55000000-0000-0000-0000-000000000001',0),
 ('5aaaaaaa-3333-0000-0000-000000000004','5eeeeeee-3333-0000-0000-000000000001','5fffffff-3333-0000-0000-000000000002','Assigned done','VERY_HARD',null,'done',now(),'55000000-0000-0000-0000-000000000002','55000000-0000-0000-0000-000000000001',1),
 ('5aaaaaaa-3333-0000-0000-000000000005','5eeeeeee-3333-0000-0000-000000000001','5fffffff-3333-0000-0000-000000000002','Unassigned due','EASY',((now() at time zone 'Asia/Manila')::date::timestamp + interval '30 minutes') at time zone 'Asia/Manila','todo',null,null,'55000000-0000-0000-0000-000000000001',2);
insert into public.task_assignees(task_id,team_id,user_id) values
 ('5aaaaaaa-3333-0000-0000-000000000003','5eeeeeee-3333-0000-0000-000000000001','55000000-0000-0000-0000-000000000002'),
 ('5aaaaaaa-3333-0000-0000-000000000004','5eeeeeee-3333-0000-0000-000000000001','55000000-0000-0000-0000-000000000002');
insert into public.team_activity_log(team_id,actor_id,action,target_type,target_id) values
 ('5eeeeeee-3333-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','task.assigned','task','5aaaaaaa-3333-0000-0000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub','55000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"55000000-0000-0000-0000-000000000002","email":"dashboard-member@example.test","role":"authenticated"}',true);
insert into dashboard_test_output(line) select extensions.throws_ok($$select * from public.dashboard_stats('bad','UTC')$$,'P0001','INVALID_INPUT','invalid scope is rejected');
insert into dashboard_test_output(line) select extensions.throws_ok($$select * from public.dashboard_stats('team','Not/AZone')$$,'P0001','INVALID_INPUT','invalid timezone is rejected');
insert into dashboard_test_output(line) select extensions.is((select due_today::integer from public.dashboard_stats('team','Asia/Manila')),1,'team scope counts only assigned team tasks due on Manila day');
insert into dashboard_test_output(line) select extensions.is((select due_today::integer from public.dashboard_stats('team','UTC')),0,'timezone boundary excludes Manila 00:30 task from previous UTC day');
insert into dashboard_test_output(line) select extensions.is((select due_today::integer from public.dashboard_stats('personal','Asia/Manila')),1,'personal scope counts caller personal tasks');
insert into dashboard_test_output(line) select extensions.is((select due_today::integer from public.dashboard_stats('all','Asia/Manila')),2,'all scope combines personal and assigned team tasks');
insert into dashboard_test_output(line) select extensions.is((select active::integer from public.dashboard_stats('all','Asia/Manila')),2,'active excludes done tasks and unassigned team tasks');
insert into dashboard_test_output(line) select extensions.is((select completed_this_week::integer from public.dashboard_stats('all','Asia/Manila')),2,'completed this week includes own team completions');
insert into dashboard_test_output(line) select extensions.is((select count(*)::integer from public.dashboard_up_next('all','Asia/Manila',10)),2,'up next includes assigned team task and personal task only');
insert into dashboard_test_output(line) select extensions.is((select count(*)::integer from public.dashboard_week('all','Asia/Manila',date_trunc('week',now() at time zone 'Asia/Manila')::date)),7,'week strip returns Monday through Sunday');
insert into dashboard_test_output(line) select extensions.is((select completions::integer from public.dashboard_trend('all','Asia/Manila',7) where day=(now() at time zone 'Asia/Manila')::date),2,'trend counts local-day completions');
insert into dashboard_test_output(line) select extensions.is((select points_this_week::integer from public.dashboard_spark('all','Asia/Manila')),6,'spark applies Easy and Very hard weights');
insert into dashboard_test_output(line) select extensions.is((select streak_days from public.dashboard_spark('all','Asia/Manila')),1,'streak starts on a completion today');
insert into dashboard_test_output(line) select extensions.is((select total_count::integer from public.dashboard_group_progress('team') where source='team' and group_id='5fffffff-3333-0000-0000-000000000002'),2,'team progress excludes unassigned tasks');
insert into dashboard_test_output(line) select extensions.throws_ok($$select * from public.team_workload('5eeeeeee-3333-0000-0000-000000000001')$$,'P0001','FORBIDDEN','Member cannot read manager workload');
select set_config('request.jwt.claim.sub','55000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"55000000-0000-0000-0000-000000000001","email":"dashboard-admin@example.test","role":"authenticated"}',true);
insert into dashboard_test_output(line) select extensions.is((select open_task_count::integer from public.team_workload('5eeeeeee-3333-0000-0000-000000000001') where user_id='55000000-0000-0000-0000-000000000002'),1,'workload counts only open assigned tasks');
insert into dashboard_test_output(line) select extensions.is((select count(*)::integer from public.team_activity_recent('5eeeeeee-3333-0000-0000-000000000001',8)),1,'activity feed returns id/action rows');
insert into dashboard_test_output(line) select extensions.throws_ok($$select * from public.dashboard_week('all','Asia/Manila',(date_trunc('week',now() at time zone 'Asia/Manila')::date+1))$$,'P0001','INVALID_INPUT','non-Monday week start is rejected');

insert into dashboard_test_output(line) select extensions.finish(false);
select string_agg(line,E'\n' order by seq) from dashboard_test_output;
rollback;
