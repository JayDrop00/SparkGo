/*
 * FILE:     supabase/migrations/20261011041000_team_task_insert_id_grant.sql
 * PURPOSE:  Permit clients to provide the non-sensitive task UUID on insert.
 * FLOWS:    Team task creation (docs/prompts/team-collab.md section 10).
 * SECURITY: S7, S9, S10, S22.
 * DEBUG:    Verify only the task id insert privilege is added; server fields/status stay protected.
 */
grant insert (id) on public.team_tasks to authenticated;
