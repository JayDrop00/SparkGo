/*
 * FILE:     supabase/tests/database/team_completion.test.sql
 * PURPOSE:  Exercise completion state transitions, review safety, and member cleanup.
 * FLOWS:    E, F, and G (docs/prompts/team-collab.md sections 8.4, 9, 13).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S12, S16, S17, S20, S22.
 * DEBUG:    Check request/task lock order, role checks, partial unique index and cleanup helper.
 */
begin;
create temp table completion_test_output(seq bigint generated always as identity, line text) on commit drop;
grant insert, select on completion_test_output to authenticated;
insert into completion_test_output(line) select extensions.plan(22);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at) values
 ('54000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','completion-owner@example.test','','{}','{}',now(),now(),now()),
 ('54000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','completion-manager@example.test','','{}','{}',now(),now(),now()),
 ('54000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','completion-member@example.test','','{}','{}',now(),now(),now())
on conflict(id) do nothing;
insert into public.teams(id,name,owner_id) values ('5eeeeeee-1111-0000-0000-000000000001','Completion Team','54000000-0000-0000-0000-000000000001');
insert into public.team_members(team_id,user_id,role) values
 ('5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','admin'),
 ('5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000002','manager'),
 ('5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000003','member');
insert into public.team_tasks(id,team_id,task_name,position,status,started_at,completed_at,completed_by,created_by) values
 ('5aaaaaaa-2222-0000-0000-000000000001','5eeeeeee-1111-0000-0000-000000000001','Cancel task',1,'in_progress',now(),null,null,'54000000-0000-0000-0000-000000000001'),
 ('5aaaaaaa-2222-0000-0000-000000000002','5eeeeeee-1111-0000-0000-000000000001','Reject task',2,'in_progress',now(),null,null,'54000000-0000-0000-0000-000000000001'),
 ('5aaaaaaa-2222-0000-0000-000000000003','5eeeeeee-1111-0000-0000-000000000001','Approve task',3,'in_progress',now(),null,null,'54000000-0000-0000-0000-000000000001'),
 ('5aaaaaaa-2222-0000-0000-000000000004','5eeeeeee-1111-0000-0000-000000000001','Manager task',4,'in_progress',now(),null,null,'54000000-0000-0000-0000-000000000001'),
 ('5aaaaaaa-2222-0000-0000-000000000005','5eeeeeee-1111-0000-0000-000000000001','Removal task',5,'in_progress',now(),null,null,'54000000-0000-0000-0000-000000000001'),
 ('5aaaaaaa-2222-0000-0000-000000000006','5eeeeeee-1111-0000-0000-000000000001','Self review fixture',6,'in_progress',now(),null,null,'54000000-0000-0000-0000-000000000001');
insert into public.task_assignees(task_id,team_id,user_id) values
 ('5aaaaaaa-2222-0000-0000-000000000001','5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000003'),
 ('5aaaaaaa-2222-0000-0000-000000000002','5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000003'),
 ('5aaaaaaa-2222-0000-0000-000000000003','5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000003'),
 ('5aaaaaaa-2222-0000-0000-000000000004','5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000002'),
 ('5aaaaaaa-2222-0000-0000-000000000005','5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000003'),
 ('5aaaaaaa-2222-0000-0000-000000000006','5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000001');
insert into public.completion_requests(id,task_id,team_id,requested_by,status) values
 ('5bbbbbbb-1111-0000-0000-000000000006','5aaaaaaa-2222-0000-0000-000000000006','5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','pending');

set local role authenticated;
select set_config('request.jwt.claim.sub','54000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000003","email":"completion-member@example.test","role":"authenticated"}',true);
insert into completion_test_output(line) select extensions.lives_ok($$select public.submit_completion_request('5aaaaaaa-2222-0000-0000-000000000001','done')$$,'Member submission creates a request');
insert into completion_test_output(line) select extensions.is((select status::text from public.team_tasks where id='5aaaaaaa-2222-0000-0000-000000000001'),'in_progress','completion review leaves task in progress');
insert into completion_test_output(line) select extensions.is((select count(*)::integer from public.completion_requests where task_id='5aaaaaaa-2222-0000-0000-000000000001' and status='pending'),1,'one pending request exists');
insert into completion_test_output(line) select extensions.throws_ok($$select public.submit_completion_request('5aaaaaaa-2222-0000-0000-000000000001',null)$$,'P0001','INVALID_STATE','duplicate submission is rejected');
insert into completion_test_output(line) select extensions.lives_ok($$select public.cancel_completion_request((select id from public.completion_requests where task_id='5aaaaaaa-2222-0000-0000-000000000001' and status='pending'))$$,'Requester can cancel their pending request');
insert into completion_test_output(line) select extensions.is((select status::text from public.team_tasks where id='5aaaaaaa-2222-0000-0000-000000000001'),'in_progress','cancel leaves the task in progress');
insert into completion_test_output(line) select extensions.lives_ok($$select public.submit_completion_request('5aaaaaaa-2222-0000-0000-000000000002',null)$$,'Member can submit another assigned task');

select set_config('request.jwt.claim.sub','54000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000002","email":"completion-manager@example.test","role":"authenticated"}',true);
insert into completion_test_output(line) select extensions.lives_ok($$select public.review_completion_request((select id from public.completion_requests where task_id='5aaaaaaa-2222-0000-0000-000000000002' and status='pending'),false,'needs more work')$$,'Manager can reject with note');
insert into completion_test_output(line) select extensions.is((select status::text from public.team_tasks where id='5aaaaaaa-2222-0000-0000-000000000002'),'in_progress','rejection leaves task in progress');
insert into completion_test_output(line) select extensions.is((select review_note from public.completion_requests where task_id='5aaaaaaa-2222-0000-0000-000000000002'),'needs more work','review note is retained');

select set_config('request.jwt.claim.sub','54000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000003","email":"completion-member@example.test","role":"authenticated"}',true);
insert into completion_test_output(line) select extensions.lives_ok($$select public.submit_completion_request('5aaaaaaa-2222-0000-0000-000000000003',null)$$,'Member can request approval');
select set_config('request.jwt.claim.sub','54000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000002","email":"completion-manager@example.test","role":"authenticated"}',true);
insert into completion_test_output(line) select extensions.lives_ok($$select public.review_completion_request((select id from public.completion_requests where task_id='5aaaaaaa-2222-0000-0000-000000000003' and status='pending'),true,null)$$,'Manager can approve request');
insert into completion_test_output(line) select extensions.is((select status::text||':'||completed_by::text from public.team_tasks where id='5aaaaaaa-2222-0000-0000-000000000003'),'done:54000000-0000-0000-0000-000000000003','approved task records requester as completer');
insert into completion_test_output(line) select extensions.is((select status::text from public.completion_requests where task_id='5aaaaaaa-2222-0000-0000-000000000003'),'approved','request reaches approved terminal state');
insert into completion_test_output(line) select extensions.throws_ok($$select public.review_completion_request((select id from public.completion_requests where task_id='5aaaaaaa-2222-0000-0000-000000000003'),false,null)$$,'P0001','INVALID_STATE','second review of a terminal request is rejected');

insert into completion_test_output(line) select extensions.lives_ok($$select public.submit_completion_request('5aaaaaaa-2222-0000-0000-000000000004',null)$$,'assigned Manager completion auto-approves');
insert into completion_test_output(line) select extensions.is((select status::text||':'||auto_approved::text from public.completion_requests where task_id='5aaaaaaa-2222-0000-0000-000000000004'),'approved:true','manager completion records auto-approved');

select set_config('request.jwt.claim.sub','54000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000001","email":"completion-owner@example.test","role":"authenticated"}',true);
insert into completion_test_output(line) select extensions.throws_ok($$select public.review_completion_request('5bbbbbbb-1111-0000-0000-000000000006',true,null)$$,'P0001','SELF_REVIEW','requester cannot review their own request');
select set_config('request.jwt.claim.sub','54000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000003","email":"completion-member@example.test","role":"authenticated"}',true);
insert into completion_test_output(line) select extensions.lives_ok($$select public.submit_completion_request('5aaaaaaa-2222-0000-0000-000000000005',null)$$,'request exists before member removal');
select set_config('request.jwt.claim.sub','54000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"54000000-0000-0000-0000-000000000001","email":"completion-owner@example.test","role":"authenticated"}',true);
insert into completion_test_output(line) select extensions.lives_ok($$select public.remove_member('5eeeeeee-1111-0000-0000-000000000001','54000000-0000-0000-0000-000000000003')$$,'Admin removal runs pending request cleanup');
insert into completion_test_output(line) select extensions.is((select status::text from public.team_tasks where id='5aaaaaaa-2222-0000-0000-000000000005'),'in_progress','member removal preserves task progress');
insert into completion_test_output(line) select extensions.is((select status::text from public.completion_requests where task_id='5aaaaaaa-2222-0000-0000-000000000005'),'cancelled','member removal cancels the request');

insert into completion_test_output(line) select extensions.finish(false);
select string_agg(line,E'\n' order by seq) from completion_test_output;
rollback;
