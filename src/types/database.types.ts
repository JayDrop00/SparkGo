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
      task_content_blocks: {
        Row: {
          id: string;
          task_id: string;
          block_type: Database["public"]["Enums"]["content_block_type"];
          text: string;
          is_checked: boolean | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          block_type: Database["public"]["Enums"]["content_block_type"];
          text?: string;
          is_checked?: boolean | null;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          block_type?: Database["public"]["Enums"]["content_block_type"];
          text?: string;
          is_checked?: boolean | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_content_blocks_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_task_with_blocks: {
        Args: {
          p_task_name: string;
          p_description?: string;
          p_difficulty?: Database["public"]["Enums"]["task_difficulty"];
          p_due_date?: string;
          p_group_id?: string;
          p_blocks?: Json;
        };
        Returns: Json;
      };
      update_task_with_blocks: {
        Args: {
          p_task_id: string;
          p_task_name: string;
          p_description?: string;
          p_difficulty?: Database["public"]["Enums"]["task_difficulty"];
          p_due_date?: string;
          p_group_id?: string;
          p_blocks?: Json;
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
      content_block_type: "CHECKBOX" | "LIST_ITEM" | "NOTE";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
