-- Keep completion requests separate from task progress, and preserve task and
-- help history independently of the current task state.

alter table public.team_tasks drop constraint if exists team_tasks_check;
drop index if exists public.team_tasks_completed_by_idx;
alter table public.team_tasks alter column status drop default;
alter table public.team_tasks alter column status type text using (
  case status::text
    when 'pending_review' then 'in_progress'
    else status::text
  end
);
alter table public.team_tasks alter column status set default 'todo';
alter table public.team_tasks add constraint team_tasks_status_check
  check (status in ('todo', 'in_progress', 'done'));
alter table public.team_tasks add constraint team_tasks_completion_check
  check ((status = 'done') = (completed_at is not null));
alter table public.team_tasks
  add column started_at timestamptz,
  add column archived_at timestamptz;

create index team_tasks_team_archive_status_idx
  on public.team_tasks (team_id, archived_at, status);
create index team_tasks_team_active_due_idx
  on public.team_tasks (team_id, due_at)
  where archived_at is null and status <> 'done';
create index team_tasks_completed_by_idx
  on public.team_tasks (completed_by, completed_at)
  where status = 'done';

create table public.team_task_events (
  id bigint generated always as identity primary key,
  team_id uuid not null,
  task_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'created', 'started', 'completed', 'reopened',
    'archived', 'restored', 'help_requested', 'help_resolved', 'help_cancelled'
  )),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (task_id, team_id) references public.team_tasks (id, team_id) on delete cascade
);
create index team_task_events_team_time_idx
  on public.team_task_events (team_id, created_at desc);
create index team_task_events_task_time_idx
  on public.team_task_events (task_id, created_at desc);

create table public.team_task_help_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  task_id uuid not null,
  requester_id uuid references auth.users(id) on delete set null,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  foreign key (task_id, team_id) references public.team_tasks (id, team_id) on delete cascade,
  check ((status = 'open') = (resolved_at is null))
);
create unique index team_task_help_one_open_per_requester_idx
  on public.team_task_help_requests (task_id, requester_id)
  where status = 'open';
create index team_task_help_team_status_idx
  on public.team_task_help_requests (team_id, status, created_at desc);

alter table public.team_task_events enable row level security;
alter table public.team_task_help_requests enable row level security;
create policy team_task_events_select_member on public.team_task_events
  for select to authenticated using (private.is_team_member(team_id));
create policy team_task_help_select_member on public.team_task_help_requests
  for select to authenticated using (private.is_team_member(team_id));
revoke all on public.team_task_events, public.team_task_help_requests from public, anon, authenticated;
grant select on public.team_task_events, public.team_task_help_requests to authenticated;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('team_invite', 'task_assigned', 'team_role_changed', 'team_help_requested'));
alter table public.notifications drop constraint if exists notifications_target_check;
alter table public.notifications add constraint notifications_target_check check (
  (kind = 'team_invite' and invite_id is not null)
  or kind in ('task_assigned', 'team_role_changed', 'team_help_requested')
);

create or replace function private.log_team_task_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    insert into public.team_task_events (team_id, task_id, actor_id, event_type, created_at)
    values (new.team_id, new.id, (select auth.uid()), 'created', new.created_at);
    return new;
  end if;

  if new.status is distinct from old.status then
    v_event_type := case
      when new.status = 'in_progress' and old.status = 'todo' then 'started'
      when new.status = 'in_progress' and old.status = 'done' then 'reopened'
      when new.status = 'done' then 'completed'
      else null
    end;
    if v_event_type is not null then
      insert into public.team_task_events (team_id, task_id, actor_id, event_type, meta)
      values (new.team_id, new.id, (select auth.uid()), v_event_type,
              pg_catalog.jsonb_build_object('from_status', old.status, 'to_status', new.status));
    end if;
  end if;

  if new.archived_at is distinct from old.archived_at then
    insert into public.team_task_events (team_id, task_id, actor_id, event_type)
    values (new.team_id, new.id, (select auth.uid()),
            case when new.archived_at is null then 'restored' else 'archived' end);
  end if;
  return new;
end;
$$;
create trigger team_task_event_log
  after insert or update of status, archived_at on public.team_tasks
  for each row execute function private.log_team_task_event();
revoke execute on function private.log_team_task_event() from public, anon, authenticated;

-- Existing creation and current-completion timestamps are reliable history;
-- earlier start transitions were not recorded, so they are deliberately omitted.
insert into public.team_task_events (team_id, task_id, actor_id, event_type, created_at)
select t.team_id, t.id, t.created_by, 'created', t.created_at
from public.team_tasks as t;
insert into public.team_task_events (team_id, task_id, actor_id, event_type, created_at)
select t.team_id, t.id, t.completed_by, 'completed', t.completed_at
from public.team_tasks as t
where t.status = 'done' and t.completed_at is not null;

-- Keep assignment notifications and allow additions after work has started.
create or replace function private.impl_assign_task_members(p_task_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_status text;
  v_archived_at timestamptz;
  v_user_ids uuid[] := coalesce(p_user_ids, array[]::uuid[]);
  v_removed_user_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_task_id is null or cardinality(v_user_ids) > private.team_limit('max_assignees_per_task')
     or cardinality(v_user_ids) <> (select count(distinct x) from unnest(v_user_ids) as x) then
    raise exception 'INVALID_INPUT';
  end if;
  select t.team_id, t.status, t.archived_at into v_team_id, v_status, v_archived_at
  from public.team_tasks as t where t.id = p_task_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(v_team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_status not in ('todo', 'in_progress') or v_archived_at is not null then raise exception 'INVALID_STATE'; end if;
  if (select count(*) from public.team_members as tm
      where tm.team_id = v_team_id and tm.user_id = any(v_user_ids)) <> cardinality(v_user_ids) then
    raise exception 'INVALID_INPUT';
  end if;

  for v_removed_user_id in
    select a.user_id from public.task_assignees as a
    where a.task_id = p_task_id and not (a.user_id = any(v_user_ids))
  loop
    update public.team_task_help_requests as h
    set status = 'cancelled', updated_at = now(), resolved_at = now(), resolved_by = v_uid
    where h.task_id = p_task_id and h.requester_id = v_removed_user_id and h.status = 'open';
    if found then
      insert into public.team_task_events (team_id, task_id, actor_id, event_type, meta)
      values (v_team_id, p_task_id, v_uid, 'help_cancelled',
              pg_catalog.jsonb_build_object('requester_id', v_removed_user_id, 'reason', 'assignment_removed'));
    end if;
  end loop;

  delete from public.task_assignees as a
  where a.task_id = p_task_id and not (a.user_id = any(v_user_ids));
  insert into public.task_assignees (task_id, team_id, user_id, assigned_by)
  select p_task_id, v_team_id, requested.user_id, v_uid
  from unnest(v_user_ids) as requested(user_id)
  where not exists (
    select 1 from public.task_assignees as existing
    where existing.task_id = p_task_id and existing.user_id = requested.user_id
  );
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id, meta)
  values (v_team_id, v_uid, 'task.assigned', 'task', p_task_id,
          pg_catalog.jsonb_build_object('user_ids', pg_catalog.to_jsonb(v_user_ids)));
end;
$$;
revoke execute on function private.impl_assign_task_members(uuid, uuid[]) from public, anon, authenticated;
grant execute on function private.impl_assign_task_members(uuid, uuid[]) to authenticated;

create or replace function private.impl_set_team_task_status(p_task_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_current_status text;
  v_archived_at timestamptz;
  v_manager boolean;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_task_id is null or p_status is null or p_status not in ('in_progress', 'done') then raise exception 'INVALID_INPUT'; end if;
  select t.team_id, t.status, t.archived_at into v_team_id, v_current_status, v_archived_at
  from public.team_tasks as t where t.id = p_task_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  v_manager := private.has_team_role(v_team_id, array['admin','manager']::public.team_role[]);
  if v_archived_at is not null then raise exception 'INVALID_STATE'; end if;
  if v_current_status = p_status then return; end if;

  if p_status = 'in_progress' and v_current_status = 'todo' then
    if not exists (select 1 from public.task_assignees as a where a.task_id = p_task_id and a.team_id = v_team_id and a.user_id = v_uid) then
      raise exception 'FORBIDDEN';
    end if;
    update public.team_tasks set status = 'in_progress', started_at = coalesce(started_at, now()), updated_at = now()
    where id = p_task_id and team_id = v_team_id and status = 'todo';
  elsif p_status = 'in_progress' and v_current_status = 'done' then
    if not v_manager then raise exception 'FORBIDDEN'; end if;
    update public.team_tasks set status = 'in_progress', completed_at = null, completed_by = null, updated_at = now()
    where id = p_task_id and team_id = v_team_id and status = 'done';
  elsif p_status = 'done' and v_current_status in ('todo', 'in_progress') then
    if not v_manager then raise exception 'FORBIDDEN'; end if;
    update public.team_tasks set status = 'done', completed_at = now(), completed_by = v_uid, updated_at = now()
    where id = p_task_id and team_id = v_team_id and status = v_current_status;
  else
    raise exception 'INVALID_STATE';
  end if;
  if not found then raise exception 'INVALID_STATE'; end if;

  if p_status = 'done' then
    update public.team_task_help_requests as h
    set status = 'resolved',
        updated_at = now(), resolved_at = now(), resolved_by = v_uid
    where h.task_id = p_task_id and h.status = 'open';
    if found then
      insert into public.team_task_events (team_id, task_id, actor_id, event_type, meta)
      values (v_team_id, p_task_id, v_uid, 'help_resolved',
              pg_catalog.jsonb_build_object('reason', 'task_status_changed'));
    end if;
  end if;
end;
$$;

create or replace function public.set_team_task_status(p_task_id uuid, p_status text)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_set_team_task_status(p_task_id, p_status) $$;
revoke execute on function private.impl_set_team_task_status(uuid, text) from public, anon, authenticated;
grant execute on function private.impl_set_team_task_status(uuid, text) to authenticated;
revoke execute on function public.set_team_task_status(uuid, text) from public, anon;
grant execute on function public.set_team_task_status(uuid, text) to authenticated;

create or replace function private.impl_create_team_task_with_assignees(
  p_team_id uuid,
  p_group_id uuid,
  p_task_name text,
  p_description text,
  p_difficulty public.task_difficulty,
  p_due_at timestamptz,
  p_assignee_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_task_id uuid;
  v_position double precision;
  v_user_ids uuid[] := coalesce(p_assignee_ids, array[]::uuid[]);
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_team_id is null or p_task_name is null or char_length(btrim(p_task_name)) not between 1 and 200 or p_difficulty is null
     or (p_description is not null and char_length(p_description) > 5000)
     or cardinality(v_user_ids) > private.team_limit('max_assignees_per_task')
     or cardinality(v_user_ids) <> (select count(distinct item) from unnest(v_user_ids) as item) then
    raise exception 'INVALID_INPUT';
  end if;
  if not private.is_team_member(p_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(p_team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_group_id is not null and not exists (
    select 1 from public.team_groups as g where g.id = p_group_id and g.team_id = p_team_id
  ) then raise exception 'INVALID_INPUT'; end if;
  if (select count(*) from public.team_members as tm where tm.team_id = p_team_id and tm.user_id = any(v_user_ids)) <> cardinality(v_user_ids) then
    raise exception 'INVALID_INPUT';
  end if;
  perform 1 from public.teams as tm where tm.id = p_team_id for update;
  select coalesce(max(t.position), 0) + 1024 into v_position from public.team_tasks as t
  where t.team_id = p_team_id and t.group_id is not distinct from p_group_id;
  insert into public.team_tasks (team_id, group_id, task_name, description, difficulty, due_at, position)
  values (p_team_id, p_group_id, btrim(p_task_name), nullif(btrim(coalesce(p_description, '')), ''), p_difficulty, p_due_at, v_position)
  returning id into v_task_id;
  perform private.impl_assign_task_members(v_task_id, v_user_ids);
  return v_task_id;
end;
$$;
create or replace function public.create_team_task_with_assignees(
  p_team_id uuid,
  p_group_id uuid,
  p_task_name text,
  p_description text,
  p_difficulty public.task_difficulty,
  p_due_at timestamptz,
  p_assignee_ids uuid[]
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.impl_create_team_task_with_assignees(p_team_id, p_group_id, p_task_name, p_description, p_difficulty, p_due_at, p_assignee_ids) $$;
revoke execute on function private.impl_create_team_task_with_assignees(uuid, uuid, text, text, public.task_difficulty, timestamptz, uuid[]) from public, anon, authenticated;
grant execute on function private.impl_create_team_task_with_assignees(uuid, uuid, text, text, public.task_difficulty, timestamptz, uuid[]) to authenticated;
revoke execute on function public.create_team_task_with_assignees(uuid, uuid, text, text, public.task_difficulty, timestamptz, uuid[]) from public, anon;
grant execute on function public.create_team_task_with_assignees(uuid, uuid, text, text, public.task_difficulty, timestamptz, uuid[]) to authenticated;

create or replace function private.impl_archive_team_task(p_task_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_archived_at timestamptz;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_task_id is null or p_archived is null then raise exception 'INVALID_INPUT'; end if;
  select t.team_id, t.archived_at into v_team_id, v_archived_at
  from public.team_tasks as t where t.id = p_task_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(v_team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  if (p_archived and v_archived_at is not null) or (not p_archived and v_archived_at is null) then return; end if;
  if p_archived then
    update public.completion_requests set status = 'cancelled'
    where task_id = p_task_id and team_id = v_team_id and status = 'pending';
    update public.team_task_help_requests as h
    set status = 'cancelled', updated_at = now(), resolved_at = now(), resolved_by = v_uid
    where h.task_id = p_task_id and h.status = 'open';
  end if;
  update public.team_tasks set archived_at = case when p_archived then now() else null end, updated_at = now()
  where id = p_task_id and team_id = v_team_id;
end;
$$;
create or replace function public.archive_team_task(p_task_id uuid, p_archived boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_archive_team_task(p_task_id, p_archived) $$;
revoke execute on function private.impl_archive_team_task(uuid, boolean) from public, anon, authenticated;
grant execute on function private.impl_archive_team_task(uuid, boolean) to authenticated;
revoke execute on function public.archive_team_task(uuid, boolean) from public, anon;
grant execute on function public.archive_team_task(uuid, boolean) to authenticated;

create or replace function private.impl_move_team_task(
  p_task_id uuid, p_group_id uuid, p_before_task_id uuid default null, p_after_task_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_archived_at timestamptz;
  v_before_position double precision;
  v_after_position double precision;
  v_position double precision;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_task_id is null or (p_before_task_id is not null and p_before_task_id = p_task_id)
     or (p_after_task_id is not null and p_after_task_id = p_task_id) then raise exception 'INVALID_INPUT'; end if;
  select t.team_id, t.archived_at into v_team_id, v_archived_at
  from public.team_tasks as t where t.id = p_task_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(v_team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_archived_at is not null then raise exception 'INVALID_STATE'; end if;
  perform 1 from public.teams as tm where tm.id = v_team_id for update;
  if p_group_id is not null and not exists (
    select 1 from public.team_groups as g where g.id = p_group_id and g.team_id = v_team_id
  ) then raise exception 'INVALID_INPUT'; end if;

  if p_before_task_id is not null then
    select t.position into v_before_position from public.team_tasks as t
    where t.id = p_before_task_id and t.team_id = v_team_id and t.group_id is not distinct from p_group_id
      and t.archived_at is null;
    if not found then raise exception 'INVALID_INPUT'; end if;
  end if;
  if p_after_task_id is not null then
    select t.position into v_after_position from public.team_tasks as t
    where t.id = p_after_task_id and t.team_id = v_team_id and t.group_id is not distinct from p_group_id
      and t.archived_at is null;
    if not found then raise exception 'INVALID_INPUT'; end if;
  end if;

  if v_before_position is not null and v_after_position is not null then
    v_position := (v_before_position + v_after_position) / 2;
  elsif v_before_position is not null then
    v_position := v_before_position - 1024;
  elsif v_after_position is not null then
    v_position := v_after_position + 1024;
  else
    select coalesce(max(t.position), 0) + 1024 into v_position
    from public.team_tasks as t
    where t.team_id = v_team_id and t.group_id is not distinct from p_group_id
      and t.id <> p_task_id and t.archived_at is null;
  end if;

  update public.team_tasks set group_id = p_group_id, position = v_position, updated_at = now()
  where id = p_task_id and team_id = v_team_id;
end;
$$;
create or replace function public.move_team_task(
  p_task_id uuid, p_group_id uuid, p_before_task_id uuid default null, p_after_task_id uuid default null
)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_move_team_task(p_task_id, p_group_id, p_before_task_id, p_after_task_id) $$;
revoke execute on function private.impl_move_team_task(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.impl_move_team_task(uuid, uuid, uuid, uuid) to authenticated;
revoke execute on function public.move_team_task(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.move_team_task(uuid, uuid, uuid, uuid) to authenticated;

create or replace function private.impl_reorder_team_groups(p_team_id uuid, p_group_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_count integer;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_team_id is null or p_group_ids is null
     or cardinality(p_group_ids) <> (select count(distinct item) from unnest(p_group_ids) as item) then
    raise exception 'INVALID_INPUT';
  end if;
  if not private.is_team_member(p_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(p_team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.teams as tm where tm.id = p_team_id for update;
  select count(*) into v_group_count from public.team_groups as g where g.team_id = p_team_id;
  if v_group_count <> cardinality(p_group_ids)
     or exists (select 1 from unnest(p_group_ids) as requested(id)
                where not exists (select 1 from public.team_groups as g where g.id = requested.id and g.team_id = p_team_id)) then
    raise exception 'INVALID_INPUT';
  end if;
  update public.team_groups as g set position = requested.ordinality * 1024
  from unnest(p_group_ids) with ordinality as requested(id, ordinality)
  where g.id = requested.id and g.team_id = p_team_id;
end;
$$;
create or replace function public.reorder_team_groups(p_team_id uuid, p_group_ids uuid[])
returns void language sql security invoker set search_path = ''
as $$ select private.impl_reorder_team_groups(p_team_id, p_group_ids) $$;
revoke execute on function private.impl_reorder_team_groups(uuid, uuid[]) from public, anon, authenticated;
grant execute on function private.impl_reorder_team_groups(uuid, uuid[]) to authenticated;
revoke execute on function public.reorder_team_groups(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_team_groups(uuid, uuid[]) to authenticated;

create or replace function private.impl_request_team_task_help(p_task_id uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_task_name text;
  v_status text;
  v_archived_at timestamptz;
  v_request_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_task_id is null or (p_message is not null and char_length(p_message) > 500) then raise exception 'INVALID_INPUT'; end if;
  select t.team_id, t.task_name, t.status, t.archived_at
  into v_team_id, v_task_name, v_status, v_archived_at
  from public.team_tasks as t where t.id = p_task_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not exists (select 1 from public.task_assignees as a where a.task_id = p_task_id and a.team_id = v_team_id and a.user_id = v_uid) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status not in ('todo', 'in_progress') or v_archived_at is not null then raise exception 'INVALID_STATE'; end if;

  select h.id into v_request_id from public.team_task_help_requests as h
  where h.task_id = p_task_id and h.requester_id = v_uid and h.status = 'open' for update;
  if found then
    update public.team_task_help_requests set message = nullif(btrim(coalesce(p_message, '')), ''), updated_at = now()
    where id = v_request_id;
    return v_request_id;
  end if;

  insert into public.team_task_help_requests (team_id, task_id, requester_id, message)
  values (v_team_id, p_task_id, v_uid, nullif(btrim(coalesce(p_message, '')), ''))
  returning id into v_request_id;
  insert into public.team_task_events (team_id, task_id, actor_id, event_type, meta)
  values (v_team_id, p_task_id, v_uid, 'help_requested', pg_catalog.jsonb_build_object('request_id', v_request_id));
  insert into public.notifications (user_id, kind, title, body, team_id, task_id)
  select tm.user_id, 'team_help_requested', 'A teammate needs help', v_task_name || ' needs help.', v_team_id, p_task_id
  from public.team_members as tm
  where tm.team_id = v_team_id and tm.user_id <> v_uid;
  return v_request_id;
end;
$$;

create or replace function private.impl_update_team_task_help(p_request_id uuid, p_resolve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_request public.team_task_help_requests%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_request_id is null or p_resolve is null then raise exception 'INVALID_INPUT'; end if;
  select * into v_request from public.team_task_help_requests as h where h.id = p_request_id for update;
  if not found or not private.is_team_member(v_request.team_id) then raise exception 'NOT_FOUND'; end if;
  if v_request.status <> 'open' then raise exception 'INVALID_STATE'; end if;
  if p_resolve then
    if v_request.requester_id <> v_uid
       and not private.has_team_role(v_request.team_id, array['admin','manager']::public.team_role[])
       and not exists (select 1 from public.task_assignees as a where a.task_id = v_request.task_id and a.team_id = v_request.team_id and a.user_id = v_uid) then
      raise exception 'FORBIDDEN';
    end if;
  elsif v_request.requester_id <> v_uid then
    raise exception 'FORBIDDEN';
  end if;
  update public.team_task_help_requests
  set status = case when p_resolve then 'resolved' else 'cancelled' end,
      updated_at = now(), resolved_at = now(), resolved_by = v_uid
  where id = p_request_id and status = 'open';
  if not found then raise exception 'INVALID_STATE'; end if;
  insert into public.team_task_events (team_id, task_id, actor_id, event_type, meta)
  values (v_request.team_id, v_request.task_id, v_uid,
          case when p_resolve then 'help_resolved' else 'help_cancelled' end,
          pg_catalog.jsonb_build_object('request_id', p_request_id));
end;
$$;

create or replace function public.request_team_task_help(p_task_id uuid, p_message text default null)
returns uuid language sql security invoker set search_path = ''
as $$ select private.impl_request_team_task_help(p_task_id, p_message) $$;
create or replace function public.update_team_task_help(p_request_id uuid, p_resolve boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_update_team_task_help(p_request_id, p_resolve) $$;
revoke execute on function private.impl_request_team_task_help(uuid, text), private.impl_update_team_task_help(uuid, boolean) from public, anon, authenticated;
grant execute on function private.impl_request_team_task_help(uuid, text), private.impl_update_team_task_help(uuid, boolean) to authenticated;
revoke execute on function public.request_team_task_help(uuid, text), public.update_team_task_help(uuid, boolean) from public, anon;
grant execute on function public.request_team_task_help(uuid, text), public.update_team_task_help(uuid, boolean) to authenticated;

create or replace function public.get_team_task_activity(
  p_team_id uuid, p_start_at timestamptz default null, p_end_at timestamptz default null
)
returns table (tasks_created bigint, tasks_completed bigint, tasks_started bigint, help_requests bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_team_id is null or ((p_start_at is null) <> (p_end_at is null))
     or (p_start_at is not null and p_end_at <= p_start_at) then raise exception 'INVALID_INPUT'; end if;
  if not private.is_team_member(p_team_id) then raise exception 'NOT_FOUND'; end if;
  return query
  select
    count(*) filter (where e.event_type = 'created'),
    count(*) filter (where e.event_type = 'completed'),
    count(*) filter (where e.event_type = 'started'),
    count(*) filter (where e.event_type = 'help_requested')
  from public.team_task_events as e
  where e.team_id = p_team_id
    and (p_start_at is null or e.created_at >= p_start_at)
    and (p_end_at is null or e.created_at < p_end_at);
end;
$$;
revoke execute on function public.get_team_task_activity(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_team_task_activity(uuid, timestamptz, timestamptz) to authenticated;

create or replace function private.impl_delete_team_group(p_group_id uuid, p_mode text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_group_id is null or p_mode <> 'ungroup' then raise exception 'INVALID_INPUT'; end if;
  select g.team_id into v_team_id from public.team_groups as g where g.id = p_group_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(v_team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  update public.team_tasks set group_id = null, updated_at = now() where group_id = p_group_id and team_id = v_team_id;
  delete from public.team_groups where id = p_group_id and team_id = v_team_id;
end;
$$;
revoke execute on function private.impl_delete_team_group(uuid, text) from public, anon, authenticated;
grant execute on function private.impl_delete_team_group(uuid, text) to authenticated;

-- A completion request records review state; it no longer replaces task progress.
create or replace function private.impl_submit_completion_request(p_task_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_status text;
  v_archived_at timestamptz;
  v_role public.team_role;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_request_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_task_id is null or (v_note is not null and char_length(v_note) > 500) then raise exception 'INVALID_INPUT'; end if;
  select t.team_id, t.status, t.archived_at into v_team_id, v_status, v_archived_at
  from public.team_tasks as t where t.id = p_task_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not exists (select 1 from public.task_assignees as a where a.task_id = p_task_id and a.team_id = v_team_id and a.user_id = v_uid) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'in_progress' or v_archived_at is not null then raise exception 'INVALID_STATE'; end if;
  if exists (select 1 from public.completion_requests as r where r.task_id = p_task_id and r.status = 'pending') then
    raise exception 'INVALID_STATE';
  end if;
  select tm.role into v_role from public.team_members as tm where tm.team_id = v_team_id and tm.user_id = v_uid;
  insert into public.completion_requests (task_id, team_id, requested_by, note, status, auto_approved, reviewed_by, reviewed_at)
  values (p_task_id, v_team_id, v_uid, v_note,
          case when v_role in ('admin', 'manager') then 'approved'::public.completion_status else 'pending'::public.completion_status end,
          v_role in ('admin', 'manager'), case when v_role in ('admin', 'manager') then v_uid else null end,
          case when v_role in ('admin', 'manager') then now() else null end)
  returning id into v_request_id;
  if v_role in ('admin', 'manager') then
    perform private.impl_set_team_task_status(p_task_id, 'done');
  end if;
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id, meta)
  values (v_team_id, v_uid, case when v_role in ('admin', 'manager') then 'task.completed_directly' else 'completion.requested' end,
          'task', p_task_id, pg_catalog.jsonb_build_object('request_id', v_request_id));
end;
$$;

create or replace function private.impl_cancel_completion_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_request public.completion_requests%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_request from public.completion_requests as r where r.id = p_request_id for update;
  if not found or v_request.requested_by <> v_uid then raise exception 'NOT_FOUND'; end if;
  if v_request.status <> 'pending' then raise exception 'INVALID_STATE'; end if;
  update public.completion_requests set status = 'cancelled' where id = v_request.id and status = 'pending';
  if not found then raise exception 'INVALID_STATE'; end if;
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id, meta)
  values (v_request.team_id, v_uid, 'completion.cancelled', 'task', v_request.task_id,
          pg_catalog.jsonb_build_object('request_id', v_request.id));
end;
$$;

create or replace function private.impl_review_completion_request(p_request_id uuid, p_approve boolean, p_review_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_request public.completion_requests%rowtype;
  v_note text := nullif(btrim(coalesce(p_review_note, '')), '');
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_approve is null or (v_note is not null and char_length(v_note) > 500) then raise exception 'INVALID_INPUT'; end if;
  select * into v_request from public.completion_requests as r where r.id = p_request_id for update;
  if not found or not private.is_team_member(v_request.team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(v_request.team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_request.status <> 'pending' then raise exception 'INVALID_STATE'; end if;
  if v_request.requested_by = v_uid then raise exception 'SELF_REVIEW'; end if;
  if p_approve then
    update public.completion_requests set status = 'approved', reviewed_by = v_uid, reviewed_at = now(), review_note = v_note
    where id = v_request.id and status = 'pending';
    perform private.impl_set_team_task_status(v_request.task_id, 'done');
  else
    update public.completion_requests set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), review_note = v_note
    where id = v_request.id and status = 'pending';
  end if;
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id, meta)
  values (v_request.team_id, v_uid, case when p_approve then 'completion.approved' else 'completion.rejected' end,
          'task', v_request.task_id, pg_catalog.jsonb_build_object('request_id', v_request.id));
end;
$$;

create or replace function private.cleanup_member_state(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_request record;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  for v_request in
    select r.id, r.task_id from public.completion_requests as r
    where r.team_id = p_team_id and r.requested_by = p_user_id and r.status = 'pending'
    order by r.task_id for update
  loop
    update public.completion_requests set status = 'cancelled'
    where id = v_request.id and status = 'pending';
  end loop;
  update public.team_task_help_requests as h
  set status = 'cancelled', updated_at = now(), resolved_at = now(), resolved_by = (select auth.uid())
  where h.team_id = p_team_id and h.requester_id = p_user_id and h.status = 'open';
end;
$$;

-- Make archived tasks durable: ordinary UI users cannot permanently delete a task.
revoke delete on public.team_tasks from authenticated;
drop policy if exists team_tasks_delete_manager on public.team_tasks;
