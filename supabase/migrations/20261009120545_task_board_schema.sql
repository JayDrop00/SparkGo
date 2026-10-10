-- MyTask board: task_groups (personal grouping), tasks, task_content_blocks.
-- Access model: per-user ownership (owner_id = auth.uid()), no teams/workspaces.

create type public.task_difficulty as enum ('EASY', 'MEDIUM', 'HARD', 'VERY_HARD');
create type public.content_block_type as enum ('CHECKBOX', 'LIST_ITEM', 'NOTE');

create table public.task_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_name text not null check (char_length(btrim(group_name)) between 1 and 60),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  position double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- NULL group_id = built-in "Ungrouped" bucket; on delete set null so a group can
  -- never silently destroy tasks (deleting tasks is always an explicit action).
  group_id uuid references public.task_groups (id) on delete set null,
  task_name text not null check (char_length(btrim(task_name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  difficulty public.task_difficulty not null default 'MEDIUM',
  due_date timestamptz,
  position double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_content_blocks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  block_type public.content_block_type not null,
  text text not null default '' check (char_length(text) <= 2000),
  is_checked boolean,
  position double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- CHECKBOX carries is_checked; other block types must not.
  constraint task_content_blocks_shape check (
    (block_type = 'CHECKBOX' and is_checked is not null)
    or (block_type <> 'CHECKBOX' and is_checked is null)
  )
);

-- Unique group name per owner: trimmed + case-insensitive (mirrors Zod rules).
create unique index task_groups_owner_name_key
  on public.task_groups (owner_id, lower(btrim(group_name)));

create index task_groups_owner_position_idx
  on public.task_groups (owner_id, position);

create index tasks_owner_idx
  on public.tasks (owner_id);

create index tasks_group_position_idx
  on public.tasks (group_id, position);

create index tasks_due_date_idx
  on public.tasks (due_date)
  where due_date is not null;

create index task_content_blocks_task_position_idx
  on public.task_content_blocks (task_id, position);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.task_groups
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.task_content_blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: rows are visible/mutable only by their owner.
-- ---------------------------------------------------------------------------
alter table public.task_groups enable row level security;
alter table public.tasks enable row level security;
alter table public.task_content_blocks enable row level security;

create policy "task_groups_select" on public.task_groups
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "task_groups_insert" on public.task_groups
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "task_groups_update" on public.task_groups
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "task_groups_delete" on public.task_groups
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "tasks_select" on public.tasks
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      group_id is null
      or exists (
        select 1 from public.task_groups g
        where g.id = group_id and g.owner_id = (select auth.uid())
      )
    )
  );

create policy "tasks_update" on public.tasks
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (
      group_id is null
      or exists (
        select 1 from public.task_groups g
        where g.id = group_id and g.owner_id = (select auth.uid())
      )
    )
  );

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Content blocks are authorized through their parent task.
create policy "task_content_blocks_select" on public.task_content_blocks
  for select to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = (select auth.uid())
  ));

create policy "task_content_blocks_insert" on public.task_content_blocks
  for insert to authenticated
  with check (exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = (select auth.uid())
  ));

create policy "task_content_blocks_update" on public.task_content_blocks
  for update to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = (select auth.uid())
  ));

create policy "task_content_blocks_delete" on public.task_content_blocks
  for delete to authenticated
  using (exists (
    select 1 from public.tasks t
    where t.id = task_id and t.owner_id = (select auth.uid())
  ));

-- Explicit Data API grants for SQL-created tables.
grant select, insert, update, delete on public.task_groups to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_content_blocks to authenticated;
