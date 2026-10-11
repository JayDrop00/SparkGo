/*
 * FILE:     supabase/migrations/20261011050000_team_completion.sql
 * PURPOSE:  Add completion requests, secure state transitions, reviewer reads, and removal cleanup.
 * FLOWS:    E, F, G cleanup (docs/prompts/team-collab.md sections 5, 7, 8.4, 9, 10).
 * SECURITY: S1, S2, S5, S6, S7, S9, S10, S11, S12, S16, S17, S19, S20, S22.
 * DEBUG:    Verify task/request locks, assignees, team roles, reviewer identity, and invariant queries.
 */

create type public.completion_status as enum ('pending','approved','rejected','cancelled');

create table public.completion_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  team_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  note text check (note is null or char_length(note) <= 500),
  status public.completion_status not null default 'pending',
  auto_approved boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  foreign key (task_id, team_id) references public.team_tasks (id, team_id) on delete cascade
);
create unique index completion_one_pending_per_task on public.completion_requests (task_id) where status = 'pending';
create index completion_team_status_idx on public.completion_requests (team_id, status);
create index completion_requester_status_idx on public.completion_requests (requested_by, status);

alter table public.completion_requests enable row level security;
create policy completion_requests_select_requester_or_reviewer on public.completion_requests
for select to authenticated using (
  requested_by = (select auth.uid())
  or private.has_team_role(team_id, array['admin','manager']::public.team_role[])
);
revoke all on public.completion_requests from public, anon, authenticated;
grant select on public.completion_requests to authenticated;

/* [FLOW E.3] Submit a request, or auto-approve an assigned Admin/Manager. */
create or replace function private.impl_submit_completion_request(p_task_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_status public.team_task_status;
  v_role public.team_role;
  v_note text := nullif(btrim(coalesce(p_note,'')), '');
  v_request_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_task_id is null or (v_note is not null and char_length(v_note) > 500) then raise exception 'INVALID_INPUT'; end if;
  select t.team_id, t.status into v_team_id, v_status from public.team_tasks t where t.id = p_task_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not exists (select 1 from public.task_assignees a where a.task_id = p_task_id and a.team_id = v_team_id and a.user_id = v_uid) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'todo' then raise exception 'INVALID_STATE'; end if;
  select tm.role into v_role from public.team_members tm where tm.team_id = v_team_id and tm.user_id = v_uid;
  insert into public.completion_requests(task_id,team_id,requested_by,note,status,auto_approved,reviewed_by,reviewed_at)
  values (p_task_id,v_team_id,v_uid,v_note,
    case when v_role in ('admin','manager') then 'approved'::public.completion_status else 'pending'::public.completion_status end,
    v_role in ('admin','manager'), case when v_role in ('admin','manager') then v_uid else null end,
    case when v_role in ('admin','manager') then now() else null end)
  returning id into v_request_id;
  if v_role in ('admin','manager') then
    update public.team_tasks set status='done', completed_at=now(), completed_by=v_uid, updated_at=now()
    where id=p_task_id and team_id=v_team_id and status='todo';
  else
    update public.team_tasks set status='pending_review', updated_at=now()
    where id=p_task_id and team_id=v_team_id and status='todo';
  end if;
  if not found then raise exception 'INVALID_STATE'; end if;
  insert into public.team_activity_log(team_id,actor_id,action,target_type,target_id,meta)
  values (v_team_id,v_uid,case when v_role in ('admin','manager') then 'task.completed_directly' else 'completion.requested' end,
    'task',p_task_id,jsonb_build_object('request_id',v_request_id));
end;
$$;

/* [FLOW E.6] Cancel only the caller's pending request and restore the task to todo. */
create or replace function private.impl_cancel_completion_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_req public.completion_requests%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_req from public.completion_requests r where r.id=p_request_id for update;
  if not found or v_req.requested_by <> v_uid then raise exception 'NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'INVALID_STATE'; end if;
  perform 1 from public.team_tasks t where t.id=v_req.task_id and t.team_id=v_req.team_id for update;
  update public.completion_requests set status='cancelled' where id=v_req.id and status='pending';
  update public.team_tasks set status='todo',updated_at=now()
  where id=v_req.task_id and team_id=v_req.team_id and status='pending_review';
  if not found then raise exception 'INVALID_STATE'; end if;
  insert into public.team_activity_log(team_id,actor_id,action,target_type,target_id,meta)
  values (v_req.team_id,v_uid,'completion.cancelled','task',v_req.task_id,jsonb_build_object('request_id',v_req.id));
end;
$$;

/* [FLOW F.3-6] One reviewer wins; callers cannot review their own request. */
create or replace function private.impl_review_completion_request(p_request_id uuid,p_approve boolean,p_review_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.completion_requests%rowtype;
  v_note text := nullif(btrim(coalesce(p_review_note,'')), '');
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_approve is null or (v_note is not null and char_length(v_note)>500) then raise exception 'INVALID_INPUT'; end if;
  select * into v_req from public.completion_requests r where r.id=p_request_id for update;
  if not found or not private.is_team_member(v_req.team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(v_req.team_id,array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_req.status <> 'pending' then raise exception 'INVALID_STATE'; end if;
  if v_req.requested_by = v_uid then raise exception 'SELF_REVIEW'; end if;
  if p_approve then
    update public.completion_requests set status='approved',reviewed_by=v_uid,reviewed_at=now(),review_note=v_note where id=v_req.id and status='pending';
    update public.team_tasks set status='done',completed_at=now(),completed_by=v_req.requested_by,updated_at=now()
    where id=v_req.task_id and team_id=v_req.team_id and status='pending_review';
  else
    update public.completion_requests set status='rejected',reviewed_by=v_uid,reviewed_at=now(),review_note=v_note where id=v_req.id and status='pending';
    update public.team_tasks set status='todo',updated_at=now() where id=v_req.task_id and team_id=v_req.team_id and status='pending_review';
  end if;
  if not found then raise exception 'INVALID_STATE'; end if;
  insert into public.team_activity_log(team_id,actor_id,action,target_type,target_id,meta)
  values (v_req.team_id,v_uid,case when p_approve then 'completion.approved' else 'completion.rejected' end,
    'task',v_req.task_id,jsonb_build_object('request_id',v_req.id));
end;
$$;

/* [FLOW G] Cancel outstanding requests and reset their tasks before the membership cascade. */
create or replace function private.cleanup_member_state(p_team_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_req record;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  for v_req in
    select r.id,r.task_id from public.completion_requests r
    where r.team_id=p_team_id and r.requested_by=p_user_id and r.status='pending'
    order by r.task_id for update
  loop
    perform 1 from public.team_tasks t where t.id=v_req.task_id and t.team_id=p_team_id for update;
    update public.completion_requests set status='cancelled' where id=v_req.id and status='pending';
    update public.team_tasks set status='todo',updated_at=now()
    where id=v_req.task_id and team_id=p_team_id and status='pending_review';
    if not found then raise exception 'INVALID_STATE'; end if;
  end loop;
end;
$$;

create or replace function public.submit_completion_request(p_task_id uuid,p_note text default null)
returns void language sql security invoker set search_path = '' as $$ select private.impl_submit_completion_request(p_task_id,p_note) $$;
create or replace function public.cancel_completion_request(p_request_id uuid)
returns void language sql security invoker set search_path = '' as $$ select private.impl_cancel_completion_request(p_request_id) $$;
create or replace function public.review_completion_request(p_request_id uuid,p_approve boolean,p_review_note text default null)
returns void language sql security invoker set search_path = '' as $$ select private.impl_review_completion_request(p_request_id,p_approve,p_review_note) $$;

revoke execute on function private.impl_submit_completion_request(uuid,text) from public,anon,authenticated;
grant execute on function private.impl_submit_completion_request(uuid,text) to authenticated;
revoke execute on function private.impl_cancel_completion_request(uuid) from public,anon,authenticated;
grant execute on function private.impl_cancel_completion_request(uuid) to authenticated;
revoke execute on function private.impl_review_completion_request(uuid,boolean,text) from public,anon,authenticated;
grant execute on function private.impl_review_completion_request(uuid,boolean,text) to authenticated;
revoke execute on function private.cleanup_member_state(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.submit_completion_request(uuid,text) from public,anon;
grant execute on function public.submit_completion_request(uuid,text) to authenticated;
revoke execute on function public.cancel_completion_request(uuid) from public,anon;
grant execute on function public.cancel_completion_request(uuid) to authenticated;
revoke execute on function public.review_completion_request(uuid,boolean,text) from public,anon;
grant execute on function public.review_completion_request(uuid,boolean,text) to authenticated;
