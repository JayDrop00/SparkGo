alter table public.tasks
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists deadline_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_schedule_range_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks add constraint tasks_schedule_range_check check (
      (start_at is null and end_at is null)
      or (start_at is not null and end_at is not null and end_at > start_at)
    );
  end if;
end;
$$;

-- Preserve old manually entered due dates as independent deadlines. Going
-- forward, due_date mirrors the scheduled end time and stays null when unscheduled.
update public.tasks
set deadline_at = coalesce(deadline_at, due_date),
    due_date = null
where due_date is not null;

update public.tasks
set due_date = end_at
where end_at is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_due_date_matches_schedule_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks add constraint tasks_due_date_matches_schedule_check
      check (due_date is not distinct from end_at);
  end if;
end;
$$;

create index if not exists tasks_owner_schedule_idx
  on public.tasks (owner_id, start_at)
  where start_at is not null;

-- Keep task creation atomic with the existing board position allocation while
-- allowing a task to carry an optional scheduled time range.
drop function if exists public.create_task(text, text, public.task_difficulty, timestamptz, uuid);
drop function if exists public.update_task(uuid, text, text, public.task_difficulty, timestamptz, uuid);

create or replace function public.create_task(
  p_task_name text,
  p_description text default null,
  p_difficulty public.task_difficulty default 'MEDIUM',
  p_group_id uuid default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_deadline_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_task_id uuid;
  v_position double precision;
  v_name text := btrim(coalesce(p_task_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'task name must be 1-120 characters' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'description must be at most 2000 characters' using errcode = '22023';
  end if;
  if p_deadline_at is not null and p_deadline_at < now() then
    raise exception 'deadline cannot be in the past' using errcode = '22023';
  end if;
  if (p_start_at is null) <> (p_end_at is null) or (p_start_at is not null and p_end_at <= p_start_at) then
    raise exception 'scheduled start and end must form a valid time range' using errcode = '22023';
  end if;
  if p_group_id is not null and not exists (
    select 1 from public.task_groups g where g.id = p_group_id and g.owner_id = v_uid
  ) then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sparkgo.board:' || v_uid::text, 0));
  if p_group_id is null then
    select coalesce(max(position), 0) + 1024 into v_position
    from public.tasks where owner_id = v_uid and group_id is null;
  else
    select coalesce(max(position), 0) + 1024 into v_position
    from public.tasks where owner_id = v_uid and group_id = p_group_id;
  end if;
  insert into public.tasks (
    owner_id, group_id, task_name, description, difficulty, due_date,
    deadline_at, start_at, end_at, position
  ) values (
    v_uid, p_group_id, v_name, v_description, p_difficulty, p_end_at,
    p_deadline_at, p_start_at, p_end_at, v_position
  ) returning id into v_task_id;
  return jsonb_build_object('id', v_task_id, 'groupId', p_group_id, 'position', v_position);
end;
$$;

revoke execute on function public.create_task(text, text, public.task_difficulty, uuid, timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.create_task(text, text, public.task_difficulty, uuid, timestamptz, timestamptz, timestamptz) to authenticated;

create or replace function public.update_task(
  p_task_id uuid,
  p_task_name text,
  p_description text default null,
  p_difficulty public.task_difficulty default 'MEDIUM',
  p_group_id uuid default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_deadline_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_task_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'task name must be 1-120 characters' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'description must be at most 2000 characters' using errcode = '22023';
  end if;
  if (p_start_at is null) <> (p_end_at is null) or (p_start_at is not null and p_end_at <= p_start_at) then
    raise exception 'scheduled start and end must form a valid time range' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sparkgo.board:' || v_uid::text, 0));
  if not exists (select 1 from public.tasks t where t.id = p_task_id and t.owner_id = v_uid) then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if p_group_id is not null and not exists (
    select 1 from public.task_groups g where g.id = p_group_id and g.owner_id = v_uid
  ) then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  update public.tasks
  set task_name = v_name,
      description = v_description,
      difficulty = p_difficulty,
      due_date = p_end_at,
      deadline_at = p_deadline_at,
      group_id = p_group_id,
      start_at = p_start_at,
      end_at = p_end_at
  where id = p_task_id and owner_id = v_uid;
  return jsonb_build_object(
    'id', p_task_id,
    'groupId', p_group_id,
    'position', (select position from public.tasks where id = p_task_id)
  );
end;
$$;

revoke execute on function public.update_task(uuid, text, text, public.task_difficulty, uuid, timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.update_task(uuid, text, text, public.task_difficulty, uuid, timestamptz, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
