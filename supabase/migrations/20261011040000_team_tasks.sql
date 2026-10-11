/*
 * FILE:     supabase/migrations/20261011040000_team_tasks.sql
 * PURPOSE:  Add team groups/tasks, read access, manager writes, and secure assignment.
 * FLOWS:    Team task board and assignment (docs/prompts/team-collab.md sections 5, 7, 8.3, 10).
 * SECURITY: S1, S2, S5, S6, S7, S9, S10, S11, S12, S17, S20, S22.
 * DEBUG:    Check team role RLS, task creator trigger, composite FKs, and assignment RPC.
 */

create type public.team_task_status as enum ('todo', 'pending_review', 'done');

create table public.team_groups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  group_name text not null check (char_length(btrim(group_name)) between 1 and 60),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  position double precision not null,
  created_at timestamptz not null default now(),
  unique (id, team_id)
);
create index team_groups_team_position_idx on public.team_groups (team_id, position, created_at);

create table public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  group_id uuid,
  task_name text not null check (char_length(btrim(task_name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 5000),
  difficulty public.task_difficulty not null default 'MEDIUM',
  due_at timestamptz,
  status public.team_task_status not null default 'todo',
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  position double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  foreign key (group_id, team_id) references public.team_groups (id, team_id) on delete set null (group_id),
  check ((status = 'done') = (completed_at is not null))
);
create index team_tasks_team_status_idx on public.team_tasks (team_id, status);
create index team_tasks_team_due_idx on public.team_tasks (team_id, due_at);
create index team_tasks_group_idx on public.team_tasks (group_id);

create table public.task_assignees (
  task_id uuid not null,
  team_id uuid not null,
  user_id uuid not null,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id),
  foreign key (task_id, team_id) references public.team_tasks (id, team_id) on delete cascade,
  foreign key (team_id, user_id) references public.team_members (team_id, user_id) on delete cascade
);
create index task_assignees_user_team_idx on public.task_assignees (user_id, team_id);

create or replace function private.set_team_task_server_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  else
    new.created_by := old.created_by;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger team_tasks_server_fields before insert or update on public.team_tasks
for each row execute function private.set_team_task_server_fields();

alter table public.team_groups enable row level security;
alter table public.team_tasks enable row level security;
alter table public.task_assignees enable row level security;

create policy team_groups_select_member on public.team_groups
for select to authenticated using (private.is_team_member(team_id));
create policy team_groups_insert_manager on public.team_groups
for insert to authenticated with check (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));
create policy team_groups_update_manager on public.team_groups
for update to authenticated using (private.has_team_role(team_id, array['admin','manager']::public.team_role[]))
with check (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));
create policy team_groups_delete_manager on public.team_groups
for delete to authenticated using (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));

create policy team_tasks_select_member on public.team_tasks
for select to authenticated using (private.is_team_member(team_id));
create policy team_tasks_insert_manager on public.team_tasks
for insert to authenticated with check (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));
create policy team_tasks_update_manager on public.team_tasks
for update to authenticated using (private.has_team_role(team_id, array['admin','manager']::public.team_role[]))
with check (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));
create policy team_tasks_delete_manager on public.team_tasks
for delete to authenticated using (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));

create policy task_assignees_select_member on public.task_assignees
for select to authenticated using (private.is_team_member(team_id));

revoke all on public.team_groups, public.team_tasks, public.task_assignees from public, anon, authenticated;
grant select, delete on public.team_groups to authenticated;
grant insert (team_id, group_name, color, position) on public.team_groups to authenticated;
grant update (group_name, color, position) on public.team_groups to authenticated;
grant select, delete on public.team_tasks to authenticated;
grant insert (team_id, group_id, task_name, description, difficulty, due_at, position) on public.team_tasks to authenticated;
grant update (group_id, task_name, description, difficulty, due_at, position) on public.team_tasks to authenticated;
grant select on public.task_assignees to authenticated;
revoke execute on function private.set_team_task_server_fields() from public, anon, authenticated;

/*
 * FILE:     supabase/migrations/20261011040000_team_tasks.sql
 * PURPOSE:  Replace assignees atomically with same-team and role validation.
 * FLOWS:    D task assignment (docs/prompts/team-collab.md section 10).
 * SECURITY: S2, S5, S9, S10, S11, S12, S17, S20, S22.
 * DEBUG:    Verify task lock, team role, todo status, member set and activity log.
 */
create or replace function private.impl_assign_task_members(p_task_id uuid, p_user_ids uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_team_id uuid;
  v_status public.team_task_status;
  v_user_ids uuid[] := coalesce(p_user_ids, array[]::uuid[]);
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_task_id is null or cardinality(v_user_ids) > private.team_limit('max_assignees_per_task')
     or cardinality(v_user_ids) <> (select count(distinct x) from unnest(v_user_ids) as x) then
    raise exception 'INVALID_INPUT';
  end if;
  select t.team_id, t.status into v_team_id, v_status from public.team_tasks t where t.id = p_task_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(v_team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_status <> 'todo' then raise exception 'INVALID_STATE'; end if;
  if (select count(*) from public.team_members tm where tm.team_id = v_team_id and tm.user_id = any(v_user_ids)) <> cardinality(v_user_ids) then
    raise exception 'INVALID_INPUT';
  end if;
  delete from public.task_assignees where task_id = p_task_id;
  insert into public.task_assignees(task_id, team_id, user_id, assigned_by)
  select p_task_id, v_team_id, x, (select auth.uid()) from unnest(v_user_ids) as x;
  insert into public.team_activity_log(team_id, actor_id, action, target_type, target_id, meta)
  values (v_team_id, (select auth.uid()), 'task.assigned', 'task', p_task_id, jsonb_build_object('user_ids', to_jsonb(v_user_ids)));
end;
$$;

create or replace function private.impl_delete_team_group(p_group_id uuid, p_mode text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_team_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_group_id is null or p_mode is null or p_mode not in ('delete','ungroup') then raise exception 'INVALID_INPUT'; end if;
  select g.team_id into v_team_id from public.team_groups g where g.id = p_group_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(v_team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_mode = 'delete' then delete from public.team_tasks where group_id = p_group_id; end if;
  delete from public.team_groups where id = p_group_id;
end;
$$;

create or replace function public.assign_task_members(p_task_id uuid, p_user_ids uuid[])
returns void language sql security invoker set search_path = ''
as $$ select private.impl_assign_task_members(p_task_id, p_user_ids) $$;
create or replace function public.delete_team_group(p_group_id uuid, p_mode text)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_delete_team_group(p_group_id, p_mode) $$;

revoke execute on function private.impl_assign_task_members(uuid, uuid[]) from public, anon, authenticated;
grant execute on function private.impl_assign_task_members(uuid, uuid[]) to authenticated;
revoke execute on function private.impl_delete_team_group(uuid, text) from public, anon, authenticated;
grant execute on function private.impl_delete_team_group(uuid, text) to authenticated;
revoke execute on function public.assign_task_members(uuid, uuid[]) from public, anon;
grant execute on function public.assign_task_members(uuid, uuid[]) to authenticated;
revoke execute on function public.delete_team_group(uuid, text) from public, anon;
grant execute on function public.delete_team_group(uuid, text) to authenticated;
