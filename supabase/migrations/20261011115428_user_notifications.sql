create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('team_invite', 'task_assigned', 'team_role_changed')),
  title text not null,
  body text not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  task_id uuid references public.team_tasks(id) on delete set null,
  invite_id uuid references public.team_invites(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_target_check check (
    (kind = 'team_invite' and invite_id is not null)
    or kind in ('task_assigned', 'team_role_changed')
  )
);

create unique index notifications_invite_unique_idx
  on public.notifications (invite_id) where invite_id is not null;
create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notifications_update_own
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function private.notify_team_invite_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select u.id into v_user_id
  from auth.users as u
  where lower(btrim(u.email)) = new.email
  limit 1;

  if v_user_id is not null and v_user_id <> new.invited_by then
    insert into public.notifications (user_id, kind, title, body, team_id, invite_id)
    values (
      v_user_id,
      'team_invite',
      'Team invitation',
      'You were invited to ' || new.team_name || ' as ' || new.role::text || '.',
      new.team_id,
      new.id
    )
    on conflict (invite_id) where invite_id is not null do nothing;
  end if;

  return new;
end;
$$;

create trigger team_invite_notification
  after insert on public.team_invites
  for each row when (new.status = 'pending')
  execute function private.notify_team_invite_recipient();

insert into public.notifications (user_id, kind, title, body, team_id, invite_id, created_at)
select u.id,
       'team_invite',
       'Team invitation',
       'You were invited to ' || i.team_name || ' as ' || i.role::text || '.',
       i.team_id,
       i.id,
       i.created_at
from public.team_invites as i
join auth.users as u on lower(btrim(u.email)) = i.email
where i.status = 'pending'
  and i.expires_at > now()
  and u.id <> i.invited_by
on conflict (invite_id) where invite_id is not null do nothing;

create or replace function private.impl_sync_my_team_invite_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select lower(btrim(u.email)) into v_email
  from auth.users as u
  where u.id = v_user_id;

  if v_email is null or v_email = '' then return; end if;

  insert into public.notifications (user_id, kind, title, body, team_id, invite_id, created_at)
  select v_user_id,
         'team_invite',
         'Team invitation',
         'You were invited to ' || i.team_name || ' as ' || i.role::text || '.',
         i.team_id,
         i.id,
         i.created_at
  from public.team_invites as i
  where i.email = v_email
    and i.invited_by <> v_user_id
    and i.status = 'pending'
    and i.expires_at > now()
  on conflict (invite_id) where invite_id is not null do nothing;
end;
$$;

create or replace function public.sync_my_team_invite_notifications()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.impl_sync_my_team_invite_notifications()
$$;

create or replace function private.notify_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_name text;
  v_team_name text;
begin
  select t.task_name, teams.name
    into v_task_name, v_team_name
  from public.team_tasks as t
  join public.teams on teams.id = t.team_id
  where t.id = new.task_id and t.team_id = new.team_id;

  if v_task_name is not null and v_team_name is not null then
    insert into public.notifications (user_id, kind, title, body, team_id, task_id)
    values (
      new.user_id,
      'task_assigned',
      'Task assigned to you',
      'You were assigned to "' || v_task_name || '" in ' || v_team_name || '.',
      new.team_id,
      new.task_id
    );
  end if;

  return new;
end;
$$;

create trigger task_assignee_notification
  after insert on public.task_assignees
  for each row execute function private.notify_task_assignee();

create or replace function private.notify_team_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_name text;
begin
  select t.name into v_team_name
  from public.teams as t
  where t.id = new.team_id;

  if v_team_name is not null then
    insert into public.notifications (user_id, kind, title, body, team_id)
    values (
      new.user_id,
      'team_role_changed',
      'Team role changed',
      'Your role in ' || v_team_name || ' changed from ' || old.role::text || ' to ' || new.role::text || '.',
      new.team_id
    );
  end if;

  return new;
end;
$$;

create trigger team_member_role_notification
  after update of role on public.team_members
  for each row
  when (old.role is distinct from new.role)
  execute function private.notify_team_role_change();

revoke execute on function private.notify_team_invite_recipient() from public, anon, authenticated;
revoke execute on function private.notify_task_assignee() from public, anon, authenticated;
revoke execute on function private.notify_team_role_change() from public, anon, authenticated;
revoke execute on function private.impl_sync_my_team_invite_notifications() from public, anon, authenticated;
grant execute on function private.impl_sync_my_team_invite_notifications() to authenticated;
revoke execute on function public.sync_my_team_invite_notifications() from public, anon;
grant execute on function public.sync_my_team_invite_notifications() to authenticated;

-- Preserve existing assignee rows so notifications fire only for newly added assignees.
create or replace function private.impl_assign_task_members(p_task_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_status public.team_task_status;
  v_user_ids uuid[] := coalesce(p_user_ids, array[]::uuid[]);
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_task_id is null or cardinality(v_user_ids) > private.team_limit('max_assignees_per_task')
     or cardinality(v_user_ids) <> (select count(distinct x) from unnest(v_user_ids) as x) then
    raise exception 'INVALID_INPUT';
  end if;
  select t.team_id, t.status into v_team_id, v_status
  from public.team_tasks as t where t.id = p_task_id for update;
  if not found or not private.is_team_member(v_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(v_team_id, array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  if v_status <> 'todo' then raise exception 'INVALID_STATE'; end if;
  if (select count(*) from public.team_members as tm
      where tm.team_id = v_team_id and tm.user_id = any(v_user_ids)) <> cardinality(v_user_ids) then
    raise exception 'INVALID_INPUT';
  end if;

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
