// Generated-style Supabase database types for the SparkGo schema.
// Regenerate (after `supabase login` + `supabase link`) with: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2";
  };
  public: {
    Tables: {
      task_groups: {
        Row: {
          id: string;
          owner_id: string;
          group_name: string;
          color: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          group_name: string;
          color?: string | null;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          group_name?: string;
          color?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          owner_id: string;
          group_id: string | null;
          task_name: string;
          description: string | null;
          difficulty: Database["public"]["Enums"]["task_difficulty"];
          due_date: string | null;
          deadline_at: string | null;
          start_at: string | null;
          end_at: string | null;
          position: number;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          group_id?: string | null;
          task_name: string;
          description?: string | null;
          difficulty?: Database["public"]["Enums"]["task_difficulty"];
          due_date?: string | null;
          deadline_at?: string | null;
          start_at?: string | null;
          end_at?: string | null;
          position: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          group_id?: string | null;
          task_name?: string;
          description?: string | null;
          difficulty?: Database["public"]["Enums"]["task_difficulty"];
          due_date?: string | null;
          deadline_at?: string | null;
          start_at?: string | null;
          end_at?: string | null;
          position?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "task_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: { id: string; name: string; owner_id: string; created_at: string };
        Insert: { id?: string; name: string; owner_id: string; created_at?: string };
        Update: { id?: string; name?: string; owner_id?: string; created_at?: string };
        Relationships: [];
      };
      team_members: {
        Row: {
          team_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["team_role"];
          joined_at: string;
        };
        Insert: {
          team_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["team_role"];
          joined_at?: string;
        };
        Update: {
          team_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["team_role"];
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_invites: {
        Row: {
          id: string;
          team_id: string;
          team_name: string;
          email: string;
          role: Database["public"]["Enums"]["team_role"];
          status: Database["public"]["Enums"]["invite_status"];
          invited_by: string;
          expires_at: string;
          created_at: string;
          responded_at: string | null;
          responded_by: string | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          team_name: string;
          email: string;
          role?: Database["public"]["Enums"]["team_role"];
          status?: Database["public"]["Enums"]["invite_status"];
          invited_by: string;
          expires_at?: string;
          created_at?: string;
          responded_at?: string | null;
          responded_by?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          team_name?: string;
          email?: string;
          role?: Database["public"]["Enums"]["team_role"];
          status?: Database["public"]["Enums"]["invite_status"];
          invited_by?: string;
          expires_at?: string;
          created_at?: string;
          responded_at?: string | null;
          responded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_activity_log: {
        Row: {
          id: number;
          team_id: string;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: never;
          team_id: string;
          actor_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Update: {
          id?: never;
          team_id?: string;
          actor_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_activity_log_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_tags: {
        Row: { id: string; team_id: string; name: string; color: string | null; created_at: string };
        Insert: { id?: string; team_id: string; name: string; color?: string | null; created_at?: string };
        Update: { id?: string; team_id?: string; name?: string; color?: string | null; created_at?: string };
        Relationships: [];
      };
      member_tags: {
        Row: { team_id: string; user_id: string; tag_id: string; assigned_by: string | null; created_at: string };
        Insert: { team_id: string; user_id: string; tag_id: string; assigned_by?: string | null; created_at?: string };
        Update: { team_id?: string; user_id?: string; tag_id?: string; assigned_by?: string | null; created_at?: string };
        Relationships: [];
      };
      team_groups: {
        Row: { id: string; team_id: string; group_name: string; color: string | null; position: number; created_at: string };
        Insert: { id?: string; team_id: string; group_name: string; color?: string | null; position: number; created_at?: string };
        Update: { id?: string; team_id?: string; group_name?: string; color?: string | null; position?: number; created_at?: string };
        Relationships: [];
      };
      team_tasks: {
        Row: { id: string; team_id: string; group_id: string | null; task_name: string; description: string | null; difficulty: Database["public"]["Enums"]["task_difficulty"]; due_at: string | null; status: Database["public"]["Enums"]["team_task_status"]; completed_at: string | null; completed_by: string | null; created_by: string | null; position: number; created_at: string; updated_at: string };
        Insert: { id?: string; team_id: string; group_id?: string | null; task_name: string; description?: string | null; difficulty?: Database["public"]["Enums"]["task_difficulty"]; due_at?: string | null; status?: Database["public"]["Enums"]["team_task_status"]; completed_at?: string | null; completed_by?: string | null; created_by?: string | null; position: number; created_at?: string; updated_at?: string };
        Update: { id?: string; team_id?: string; group_id?: string | null; task_name?: string; description?: string | null; difficulty?: Database["public"]["Enums"]["task_difficulty"]; due_at?: string | null; status?: Database["public"]["Enums"]["team_task_status"]; completed_at?: string | null; completed_by?: string | null; created_by?: string | null; position?: number; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      task_assignees: {
        Row: { task_id: string; team_id: string; user_id: string; assigned_by: string | null; assigned_at: string };
        Insert: { task_id: string; team_id: string; user_id: string; assigned_by?: string | null; assigned_at?: string };
        Update: { task_id?: string; team_id?: string; user_id?: string; assigned_by?: string | null; assigned_at?: string };
        Relationships: [];
      };
      completion_requests: {
        Row: { id: string; task_id: string; team_id: string; requested_by: string; note: string | null; status: Database["public"]["Enums"]["completion_status"]; auto_approved: boolean; reviewed_by: string | null; review_note: string | null; created_at: string; reviewed_at: string | null };
        Insert: { id?: string; task_id: string; team_id: string; requested_by: string; note?: string | null; status?: Database["public"]["Enums"]["completion_status"]; auto_approved?: boolean; reviewed_by?: string | null; review_note?: string | null; created_at?: string; reviewed_at?: string | null };
        Update: { id?: string; task_id?: string; team_id?: string; requested_by?: string; note?: string | null; status?: Database["public"]["Enums"]["completion_status"]; auto_approved?: boolean; reviewed_by?: string | null; review_note?: string | null; created_at?: string; reviewed_at?: string | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_task: {
        Args: {
          p_task_name: string;
          p_description?: string;
          p_difficulty?: Database["public"]["Enums"]["task_difficulty"];
          p_group_id?: string;
          p_start_at?: string;
          p_end_at?: string;
          p_deadline_at?: string;
        };
        Returns: Json;
      };
      update_task: {
        Args: {
          p_task_id: string;
          p_task_name: string;
          p_description?: string;
          p_difficulty?: Database["public"]["Enums"]["task_difficulty"];
          p_group_id?: string;
          p_start_at?: string;
          p_end_at?: string;
          p_deadline_at?: string;
        };
        Returns: Json;
      };
      move_task: {
        Args: {
          p_task_id: string;
          p_target_group_id?: string;
          p_before_task_id?: string;
          p_after_task_id?: string;
        };
        Returns: Json;
      };
      reorder_groups: {
        Args: {
          p_ordered_ids: string[];
        };
        Returns: undefined;
      };
      delete_group: {
        Args: {
          p_group_id: string;
          p_task_action?: string;
        };
        Returns: Json;
      };
      create_team: {
        Args: { p_name: string };
        Returns: string;
      };
      rename_team: {
        Args: { p_team_id: string; p_name: string };
        Returns: undefined;
      };
      set_member_tags: {
        Args: { p_team_id: string; p_user_id: string; p_tag_ids: string[] };
        Returns: undefined;
      };
      assign_task_members: { Args: { p_task_id: string; p_user_ids: string[] }; Returns: undefined };
      delete_team_group: { Args: { p_group_id: string; p_mode: string }; Returns: undefined };
      submit_completion_request: { Args: { p_task_id: string; p_note?: string | null }; Returns: undefined };
      cancel_completion_request: { Args: { p_request_id: string }; Returns: undefined };
      review_completion_request: { Args: { p_request_id: string; p_approve: boolean; p_review_note?: string | null }; Returns: undefined };
      dashboard_stats: { Args: { p_scope: string; p_tz: string }; Returns: { due_today: number; overdue: number; completed_this_week: number; active: number }[] };
      dashboard_up_next: { Args: { p_scope: string; p_tz: string; p_limit?: number }; Returns: { id: string; source: string; team_id: string | null; team_name: string | null; title: string; due_at: string | null; difficulty: Database["public"]["Enums"]["task_difficulty"]; group_name: string | null; group_color: string | null; status: string }[] };
      dashboard_group_progress: { Args: { p_scope: string }; Returns: { source: string; team_id: string | null; group_id: string; name: string; color: string | null; done_count: number; total_count: number }[] };
      dashboard_week: { Args: { p_scope: string; p_tz: string; p_week_start: string }; Returns: { day: string; group_colors: string[] }[] };
      dashboard_trend: { Args: { p_scope: string; p_tz: string; p_days?: number }; Returns: { day: string; completions: number }[] };
      dashboard_spark: { Args: { p_scope: string; p_tz: string }; Returns: { points_this_week: number; streak_days: number }[] };
      team_workload: { Args: { p_team_id: string }; Returns: { user_id: string; display_name: string | null; open_task_count: number; tags: string[] }[] };
      team_activity_recent: { Args: { p_team_id: string; p_limit?: number }; Returns: { activity_id: number; action: string }[] };
      transfer_team_ownership: {
        Args: { p_team_id: string; p_new_owner_id: string };
        Returns: undefined;
      };
      delete_team: {
        Args: { p_team_id: string; p_confirm_name: string };
        Returns: undefined;
      };
      change_member_role: {
        Args: {
          p_team_id: string;
          p_user_id: string;
          p_new_role: Database["public"]["Enums"]["team_role"];
        };
        Returns: undefined;
      };
      remove_member: {
        Args: { p_team_id: string; p_user_id: string };
        Returns: undefined;
      };
      leave_team: {
        Args: { p_team_id: string };
        Returns: undefined;
      };
      invite_to_team: {
        Args: {
          p_team_id: string;
          p_email: string;
          p_role: Database["public"]["Enums"]["team_role"];
        };
        Returns: string;
      };
      respond_to_invite: {
        Args: { p_invite_id: string; p_accept: boolean };
        Returns: undefined;
      };
      revoke_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      list_my_team_invites: {
        Args: { p_team_id: string };
        Returns: {
          id: string;
          email: string;
          role: Database["public"]["Enums"]["team_role"];
          status: Database["public"]["Enums"]["invite_status"];
          expires_at: string;
          created_at: string;
        }[];
      };
    };
    Enums: {
      task_difficulty: "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
      team_role: "admin" | "manager" | "member";
      invite_status: "pending" | "accepted" | "declined" | "revoked";
      team_task_status: "todo" | "pending_review" | "done";
      completion_status: "pending" | "approved" | "rejected" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
