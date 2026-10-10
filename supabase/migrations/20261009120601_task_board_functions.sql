-- Transactional RPCs for the MyTask board.
-- supabase-js cannot run multi-statement transactions, so multi-step writes
-- live here. All functions are SECURITY INVOKER: RLS still applies, and the
-- authenticated user always comes from auth.uid() — never from the client.
--
-- Position strategy: fractional indexing on double precision.
--   * gap unit 1024 (append = max + 1024, insert = midpoint of neighbors)
--   * when a gap collapses below 1e-6 the bucket is rebalanced
--     (row_number() * 1024) and the midpoint recomputed
--   * every write takes a per-owner advisory lock, so concurrent reorders
--     serialize instead of racing.

-- ---------------------------------------------------------------------------
-- create_task_with_blocks: insert a task and its ordered content blocks atomically.
-- ---------------------------------------------------------------------------
create or replace function public.create_task_with_blocks(
  p_task_name text,
  p_description text default null,
  p_difficulty public.task_difficulty default 'MEDIUM',
  p_due_date timestamptz default null,
  p_group_id uuid default null,
  p_blocks jsonb default '[]'
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
  v_blocks jsonb := coalesce(p_blocks, '[]'::jsonb);
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
  if jsonb_typeof(v_blocks) <> 'array' or jsonb_array_length(v_blocks) > 100 then
    raise exception 'blocks must be an array of at most 100 items' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_blocks) b
    where b ->> 'type' not in ('CHECKBOX', 'LIST_ITEM', 'NOTE')
       or char_length(coalesce(b ->> 'text', '')) > 2000
  ) then
    raise exception 'invalid content block' using errcode = '22023';
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

  insert into public.task_content_blocks (task_id, block_type, text, is_checked, position)
  select
    v_task_id,
    (b ->> 'type')::public.content_block_type,
    coalesce(b ->> 'text', ''),
    case
      when b ->> 'type' = 'CHECKBOX'
        then coalesce(nullif(b ->> 'isChecked', '')::boolean, false)
      else null
    end,
    (ord - 1) * 1024
  from jsonb_array_elements(v_blocks) with ordinality as t(b, ord);

  return jsonb_build_object('id', v_task_id, 'groupId', p_group_id, 'position', v_position);
end;
$$;

revoke execute on function public.create_task_with_blocks(text, text, public.task_difficulty, timestamptz, uuid, jsonb) from public;
grant execute on function public.create_task_with_blocks(text, text, public.task_difficulty, timestamptz, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- update_task_with_blocks: update the task row and replace its blocks atomically.
-- Past due dates are allowed on edit (only creation rejects them).
-- ---------------------------------------------------------------------------
create or replace function public.update_task_with_blocks(
  p_task_id uuid,
  p_task_name text,
  p_description text default null,
  p_difficulty public.task_difficulty default 'MEDIUM',
  p_due_date timestamptz default null,
  p_group_id uuid default null,
  p_blocks jsonb default '[]'
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
  v_blocks jsonb := coalesce(p_blocks, '[]'::jsonb);
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
  if jsonb_typeof(v_blocks) <> 'array' or jsonb_array_length(v_blocks) > 100 then
    raise exception 'blocks must be an array of at most 100 items' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_blocks) b
    where b ->> 'type' not in ('CHECKBOX', 'LIST_ITEM', 'NOTE')
       or char_length(coalesce(b ->> 'text', '')) > 2000
  ) then
    raise exception 'invalid content block' using errcode = '22023';
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

  delete from public.task_content_blocks where task_id = p_task_id;

  insert into public.task_content_blocks (task_id, block_type, text, is_checked, position)
  select
    p_task_id,
    (b ->> 'type')::public.content_block_type,
    coalesce(b ->> 'text', ''),
    case
      when b ->> 'type' = 'CHECKBOX'
        then coalesce(nullif(b ->> 'isChecked', '')::boolean, false)
      else null
    end,
    (ord - 1) * 1024
  from jsonb_array_elements(v_blocks) with ordinality as t(b, ord);

  return jsonb_build_object(
    'id', p_task_id,
    'groupId', p_group_id,
    'position', (select position from public.tasks where id = p_task_id)
  );
end;
$$;

revoke execute on function public.update_task_with_blocks(uuid, text, text, public.task_difficulty, timestamptz, uuid, jsonb) from public;
grant execute on function public.update_task_with_blocks(uuid, text, text, public.task_difficulty, timestamptz, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- move_task: set a task's group and position between two neighbor tasks.
-- Neighbors are ids, never positions — the server resolves positions so a
-- stale client can't corrupt the order (stale neighbors => error => rollback).
-- ---------------------------------------------------------------------------
create or replace function public.move_task(
  p_task_id uuid,
  p_target_group_id uuid default null,
  p_before_task_id uuid default null,
  p_after_task_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_prev double precision;
  v_next double precision;
  v_new double precision;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sparkgo.board:' || v_uid::text, 0));

  select owner_id into v_owner from public.tasks where id = p_task_id;
  if v_owner is distinct from v_uid then
    raise exception 'task not found' using errcode = 'P0002';
  end if;

  if p_target_group_id is not null and not exists (
    select 1 from public.task_groups g where g.id = p_target_group_id and g.owner_id = v_uid
  ) then
    raise exception 'group not found' using errcode = 'P0002';
  end if;

  -- Resolved neighbor must be a real task in the target bucket (same owner),
  -- otherwise the client's board view is stale.
  if p_before_task_id is not null then
    if p_target_group_id is null then
      select position into v_next from public.tasks
      where id = p_before_task_id and owner_id = v_uid and group_id is null;
    else
      select position into v_next from public.tasks
      where id = p_before_task_id and owner_id = v_uid and group_id = p_target_group_id;
    end if;
    if v_next is null then
      raise exception 'stale board order' using errcode = 'P0002';
    end if;
  end if;

  if p_after_task_id is not null then
    if p_target_group_id is null then
      select position into v_prev from public.tasks
      where id = p_after_task_id and owner_id = v_uid and group_id is null;
    else
      select position into v_prev from public.tasks
      where id = p_after_task_id and owner_id = v_uid and group_id = p_target_group_id;
    end if;
    if v_prev is null then
      raise exception 'stale board order' using errcode = 'P0002';
    end if;
  end if;

  if v_prev is null and v_next is null then
    -- Append to an empty bucket (or no anchors given): end of the bucket,
    -- excluding the task being moved.
    if p_target_group_id is null then
      select coalesce(max(position), 0) + 1024 into v_new
      from public.tasks where owner_id = v_uid and id <> p_task_id and group_id is null;
    else
      select coalesce(max(position), 0) + 1024 into v_new
      from public.tasks where owner_id = v_uid and id <> p_task_id and group_id = p_target_group_id;
    end if;
  elsif v_prev is null then
    v_new := v_next - 1024;
  elsif v_next is null then
    v_new := v_prev + 1024;
  else
    v_new := (v_prev + v_next) / 2;
  end if;

  -- Gap collapsed (repeated inserts between the same pair): rebalance the
  -- target bucket, then re-resolve neighbors and recompute the midpoint.
  if (v_prev is not null and v_new - v_prev < 1e-6)
     or (v_next is not null and v_next - v_new < 1e-6)
     or v_new > 1e15 then
    if p_target_group_id is null then
      update public.tasks t
      set position = s.rn * 1024
      from (
        select id, row_number() over (order by position, created_at, id) as rn
        from public.tasks
        where owner_id = v_uid and id <> p_task_id and group_id is null
      ) s
      where t.id = s.id;
      select position into v_next from public.tasks
      where id = p_before_task_id and owner_id = v_uid and group_id is null;
      select position into v_prev from public.tasks
      where id = p_after_task_id and owner_id = v_uid and group_id is null;
    else
      update public.tasks t
      set position = s.rn * 1024
      from (
        select id, row_number() over (order by position, created_at, id) as rn
        from public.tasks
        where owner_id = v_uid and id <> p_task_id and group_id = p_target_group_id
      ) s
      where t.id = s.id;
      select position into v_next from public.tasks
      where id = p_before_task_id and owner_id = v_uid and group_id = p_target_group_id;
      select position into v_prev from public.tasks
      where id = p_after_task_id and owner_id = v_uid and group_id = p_target_group_id;
    end if;

    if v_prev is null and v_next is null then
      v_new := 1024;
    elsif v_prev is null then
      v_new := v_next - 1024;
    elsif v_next is null then
      v_new := v_prev + 1024;
    else
      v_new := (v_prev + v_next) / 2;
    end if;
  end if;

  update public.tasks
  set group_id = p_target_group_id, position = v_new
  where id = p_task_id and owner_id = v_uid;

  return jsonb_build_object('id', p_task_id, 'groupId', p_target_group_id, 'position', v_new);
end;
$$;

revoke execute on function public.move_task(uuid, uuid, uuid, uuid) from public;
grant execute on function public.move_task(uuid, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reorder_groups: apply a full, authoritative ordering of all of the caller's
-- groups. Validates completeness/uniqueness so stale arrays fail loudly
-- (client rolls back and resyncs) instead of corrupting the order.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_groups(p_ordered_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sparkgo.board:' || v_uid::text, 0));

  select count(*) into v_count from public.task_groups where owner_id = v_uid;

  if p_ordered_ids is null
     or coalesce(array_length(p_ordered_ids, 1), 0) <> v_count
     or (select count(distinct id) from unnest(p_ordered_ids) id)
        <> coalesce(array_length(p_ordered_ids, 1), 0)
     or exists (
       select 1
       from unnest(p_ordered_ids) with ordinality as t(id, ord)
       where not exists (
         select 1 from public.task_groups g where g.id = t.id and g.owner_id = v_uid
       )
     ) then
    raise exception 'incomplete or invalid group ordering' using errcode = 'P0002';
  end if;

  update public.task_groups g
  set position = t.ord * 1024
  from unnest(p_ordered_ids) with ordinality as t(id, ord)
  where g.id = t.id and g.owner_id = v_uid;
end;
$$;

revoke execute on function public.reorder_groups(uuid[]) from public;
grant execute on function public.reorder_groups(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_group: delete a group and, per task_action, either move its tasks to
-- "Ungrouped" (group_id = null) or delete them too. Never deletes silently —
-- the client always asks first. Atomic: no data-loss window.
-- ---------------------------------------------------------------------------
create or replace function public.delete_group(
  p_group_id uuid,
  p_task_action text default 'ungroup'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted integer := 0;
  v_moved integer := 0;
  v_ungrouped_max double precision;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_task_action not in ('ungroup', 'delete') then
    raise exception 'task_action must be ''ungroup'' or ''delete''' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sparkgo.board:' || v_uid::text, 0));

  if not exists (
    select 1 from public.task_groups g where g.id = p_group_id and g.owner_id = v_uid
  ) then
    raise exception 'group not found' using errcode = 'P0002';
  end if;

  if p_task_action = 'delete' then
    delete from public.tasks t
    where t.group_id = p_group_id and t.owner_id = v_uid;
    get diagnostics v_deleted = row_count;
  else
    select coalesce(max(position), 0) into v_ungrouped_max
    from public.tasks where owner_id = v_uid and group_id is null;

    with moved as (
      update public.tasks t
      set group_id = null,
          position = v_ungrouped_max + s.rn * 1024
      from (
        select id, row_number() over (order by position, created_at, id) as rn
        from public.tasks
        where group_id = p_group_id and owner_id = v_uid
      ) s
      where t.id = s.id
      returning 1
    )
    select count(*) into v_moved from moved;

    -- Rebalance the ungrouped bucket so positions stay spread out.
    update public.tasks t
    set position = s.rn * 1024
    from (
      select id, row_number() over (order by position, created_at, id) as rn
      from public.tasks
      where owner_id = v_uid and group_id is null
    ) s
    where t.id = s.id;
  end if;

  delete from public.task_groups
  where id = p_group_id and owner_id = v_uid;

  return jsonb_build_object('deletedTasks', v_deleted, 'movedTasks', v_moved);
end;
$$;

revoke execute on function public.delete_group(uuid, text) from public;
grant execute on function public.delete_group(uuid, text) to authenticated;
