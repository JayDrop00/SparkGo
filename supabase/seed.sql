-- Sample data for the MyTask board.
-- Runs as postgres (RLS bypassed). Targets the most recently created user;
-- if the database has no users, the script is a no-op.
-- Local:  npx supabase db reset
-- Remote: run this file manually in the SQL editor or via psql
--         (`supabase db push` does NOT apply seed.sql).

with owner as (
  select id from auth.users order by created_at desc limit 1
),
groups as (
  select *
  from owner,
  unnest(array[
    row('Deep Work', '#2dd4bf', 1024.0)::record,
    row('Errands',   '#f97316', 2048.0)::record,
    row('Learning',  '#c084fc', 3072.0)::record
  ]) as g(name, color, pos)
)
insert into public.task_groups (owner_id, group_name, color, position)
select id, g.name, g.color, g.pos from groups g;

with owner as (
  select id from auth.users order by created_at desc limit 1
),
g as (
  select id, group_name from public.task_groups where owner_id = (select id from owner)
),
tasks as (
  select *
  from owner, g,
  (values
    -- Deep Work
    ('Deep Work', 'Draft Q4 roadmap outline',     'MEDIUM',    null::timestamptz, 1024.0),
    ('Deep Work', 'Refactor auth callback',       'HARD',      now() + interval '2 days', 2048.0),
    -- Errands
    ('Errands',   'Renew gym membership',         'EASY',      now() - interval '1 day', 1024.0), -- overdue demo
    ('Errands',   'Buy groceries',                'EASY',      null::timestamptz, 2048.0),
    -- Learning
    ('Learning',  'Finish Postgres RLS course',   'VERY_HARD', now() + interval '7 days', 1024.0),
    ('Learning',  'Read "Designing Data-Intensive Applications"', 'HARD', now() + interval '14 days', 2048.0),
    -- Ungrouped
    (null,        'Water the plants',             'EASY',      null::timestamptz, 1024.0)
  ) as t(gname, name, diff, due, pos)
)
insert into public.tasks (owner_id, group_id, task_name, difficulty, due_date, position)
select t.id,
       (select id from g where g.group_name = t.gname),
       t.name,
       t.diff::public.task_difficulty,
       t.due,
       t.pos
from tasks t;

with owner as (
  select id from auth.users order by created_at desc limit 1
),
task as (
  select id from public.tasks
  where owner_id = (select id from owner) and task_name = 'Draft Q4 roadmap outline'
)
insert into public.task_content_blocks (task_id, block_type, text, is_checked, position)
select task.id, b.type, b.text, b.checked, b.pos
from task,
unnest(array[
  row('CHECKBOX',  'Collect stakeholder inputs', true::boolean,  0.0)::record,
  row('CHECKBOX',  'Outline milestones',         false::boolean, 1024.0)::record,
  row('LIST_ITEM', 'Share draft with the team',  null,           2048.0)::record,
  row('NOTE',      'Deadline moved to Friday',   null,           3072.0)::record
]) as b(type, text, checked, pos);
