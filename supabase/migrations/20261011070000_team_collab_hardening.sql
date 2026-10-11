/*
 * FILE:     supabase/migrations/20261011070000_team_collab_hardening.sql
 * PURPOSE:  Revoke direct Data API execution of the project's public RLS event-trigger function.
 * FLOWS:    Final security hardening (docs/prompts/team-collab.md sections 6 and 14).
 * SECURITY: S1, S5, S20.
 * DEBUG:    Check direct EXECUTE grants are gone and public table DDL still enables RLS.
 */
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
