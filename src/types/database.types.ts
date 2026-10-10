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
    };
    Views: Record<string, never>;
    Functions: {
      create_task: {
        Args: {
          p_task_name: string;
          p_description?: string;
          p_difficulty?: Database["public"]["Enums"]["task_difficulty"];
          p_due_date?: string;
          p_group_id?: string;
        };
        Returns: Json;
      };
      update_task: {
        Args: {
          p_task_id: string;
          p_task_name: string;
          p_description?: string;
          p_difficulty?: Database["public"]["Enums"]["task_difficulty"];
          p_due_date?: string;
          p_group_id?: string;
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
    };
    Enums: {
      task_difficulty: "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
