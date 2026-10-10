-- Task completion + removal of the content-blocks ("Contents") feature.
--
-- 1) tasks.completed_at: null = active, timestamp = completed (checkbox).
--    Toggling is a single-column write protected by the existing tasks_update RLS policy.
-- 2) task_content_blocks + content_block_type dropped; create/update RPCs are
--    recreated without the p_blocks argument (renamed to create_task/update_task).

-- ---------------------------------------------------------------------------
-- Completion support
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists completed_at timestamptz;

create index tasks_owner_completed_idx
  on public.tasks (owner_id, completed_at desc)
  where completed_at is not null;

-- ---------------------------------------------------------------------------
-- Drop the content-blocks feature
-- ---------------------------------------------------------------------------
drop table if exists public.task_content_blocks;
drop type if exists public.content_block_type;

drop function if exists public.create_task_with_blocks(text, text, public.task_difficulty, timestamptz, uuid, jsonb);
drop function if exists public.update_task_with_blocks(uuid, text, text, public.task_difficulty, timestamptz, uuid, jsonb);

-- ---------------------------------------------------------------------------
-- create_task: insert a task atomically (fractional index append, advisory lock).
-- ---------------------------------------------------------------------------
create or replace function public.create_task(
  p_task_name text,
  p_description text default null,
  p_difficulty public.task_difficulty default 'MEDIUM',
  p_due_date timestamptz default null,
  p_group_id uuid default null
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
  if p_due_date is not null and p_due_date < now() then
    raise exception 'due date cannot be in the past' using errcode = '22023';
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

  insert into public.tasks (owner_id, group_id, task_name, description, difficulty, due_date, position)
  values (v_uid, p_group_id, v_name, v_description, p_difficulty, p_due_date, v_position)
  returning id into v_task_id;

  return jsonb_build_object('id', v_task_id, 'groupId', p_group_id, 'position', v_position);
end;
$$;

revoke execute on function public.create_task(text, text, public.task_difficulty, timestamptz, uuid) from public;
grant execute on function public.create_task(text, text, public.task_difficulty, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_task: update a task row (group may only move to a group the caller owns).
-- Past due dates are allowed on edit (only creation rejects them).
-- ---------------------------------------------------------------------------
create or replace function public.update_task(
  p_task_id uuid,
  p_task_name text,
  p_description text default null,
  p_difficulty public.task_difficulty default 'MEDIUM',
  p_due_date timestamptz default null,
  p_group_id uuid default null
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
      due_date = p_due_date,
      group_id = p_group_id
  where id = p_task_id and owner_id = v_uid;

  return jsonb_build_object(
    'id', p_task_id,
    'groupId', p_group_id,
    'position', (select position from public.tasks where id = p_task_id)
  );
end;
$$;

revoke execute on function public.update_task(uuid, text, text, public.task_difficulty, timestamptz, uuid) from public;
grant execute on function public.update_task(uuid, text, text, public.task_difficulty, timestamptz, uuid) to authenticated;
