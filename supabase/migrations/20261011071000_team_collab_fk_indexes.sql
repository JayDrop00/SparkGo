/*
 * FILE:     supabase/migrations/20261011071000_team_collab_fk_indexes.sql
 * PURPOSE:  Index remaining team collaboration foreign-key lookup columns.
 * FLOWS:    Phase 8 advisor follow-up (docs/prompts/team-collab.md sections 6, 14).
 * SECURITY: S6, S20.
 * DEBUG:    Re-run linked advisors and verify unindexed_foreign_keys no longer includes these columns.
 */
create index completion_requests_task_team_idx on public.completion_requests (task_id, team_id);
create index member_tags_assigned_by_idx on public.member_tags (assigned_by);
create index task_assignees_assigned_by_idx on public.task_assignees (assigned_by);
create index task_assignees_task_team_idx on public.task_assignees (task_id, team_id);
create index task_assignees_team_user_idx on public.task_assignees (team_id, user_id);
create index team_tasks_created_by_idx on public.team_tasks (created_by);
create index team_tasks_group_team_idx on public.team_tasks (group_id, team_id);
