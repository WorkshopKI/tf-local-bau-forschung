export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_usage_log: {
        Row: {
          completion_tokens: number
          created_at: string
          estimated_cost: number
          id: string
          model: string
          prompt_tokens: number
          request_type: string
          total_tokens: number
          user_id: string
        }
        Insert: {
          completion_tokens?: number
          created_at?: string
          estimated_cost?: number
          id?: string
          model?: string
          prompt_tokens?: number
          request_type?: string
          total_tokens?: number
          user_id: string
        }
        Update: {
          completion_tokens?: number
          created_at?: string
          estimated_cost?: number
          id?: string
          model?: string
          prompt_tokens?: number
          request_type?: string
          total_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          created_at: string
          default_key_budget: number
          enrollment_open: boolean
          id: string
          max_participants: number
          name: string
        }
        Insert: {
          created_at?: string
          default_key_budget?: number
          enrollment_open?: boolean
          id: string
          max_participants?: number
          name: string
        }
        Update: {
          created_at?: string
          default_key_budget?: number
          enrollment_open?: boolean
          id?: string
          max_participants?: number
          name?: string
        }
        Relationships: []
      }
      enrollment_whitelist: {
        Row: {
          course_id: string
          email: string
          id: string
          invited_at: string
          is_active: boolean
          registered_at: string | null
        }
        Insert: {
          course_id: string
          email: string
          id?: string
          invited_at?: string
          is_active?: boolean
          registered_at?: string | null
        }
        Update: {
          course_id?: string
          email?: string
          id?: string
          invited_at?: string
          is_active?: boolean
          registered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_whitelist_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          admin_notes: string | null
          admin_priority: number | null
          admin_status: string
          category: string
          context: Json
          created_at: string
          generated_prompt: string | null
          id: string
          llm_classification: Json | null
          llm_summary: string | null
          screen_ref: string | null
          stars: number | null
          text: string
          user_confirmed: boolean | null
          user_display_name: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          admin_priority?: number | null
          admin_status?: string
          category?: string
          context?: Json
          created_at?: string
          generated_prompt?: string | null
          id: string
          llm_classification?: Json | null
          llm_summary?: string | null
          screen_ref?: string | null
          stars?: number | null
          text?: string
          user_confirmed?: boolean | null
          user_display_name?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          admin_priority?: number | null
          admin_status?: string
          category?: string
          context?: Json
          created_at?: string
          generated_prompt?: string | null
          id?: string
          llm_classification?: Json | null
          llm_summary?: string | null
          screen_ref?: string | null
          stars?: number | null
          text?: string
          user_confirmed?: boolean | null
          user_display_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedback_config: {
        Row: {
          id: number
          llm_model: string
          max_chatbot_turns: number
          proactive_triggers: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          llm_model?: string
          max_chatbot_turns?: number
          proactive_triggers?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          llm_model?: string
          max_chatbot_turns?: number
          proactive_triggers?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      guest_tokens: {
        Row: {
          course_id: string
          created_at: string
          display_name: string
          expires_at: string
          id: string
          is_active: boolean
          token: string
          upgraded_to_email: string | null
          user_id: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          display_name: string
          expires_at?: string
          id?: string
          is_active?: boolean
          token: string
          upgraded_to_email?: string | null
          user_id?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          display_name?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          token?: string
          upgraded_to_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_tokens_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          active_key_source: string
          created_at: string
          custom_key_active: boolean
          custom_key_encrypted: string | null
          id: string
          provisioned_key_budget: number
          provisioned_key_encrypted: string | null
          provisioned_key_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_key_source?: string
          created_at?: string
          custom_key_active?: boolean
          custom_key_encrypted?: string | null
          id?: string
          provisioned_key_budget?: number
          provisioned_key_encrypted?: string | null
          provisioned_key_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_key_source?: string
          created_at?: string
          custom_key_active?: boolean
          custom_key_encrypted?: string | null
          id?: string
          provisioned_key_budget?: number
          provisioned_key_encrypted?: string | null
          provisioned_key_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          auth_method: string
          course_id: string | null
          display_name: string | null
          enrolled_at: string
          id: string
          preferred_model: string | null
          updated_at: string
        }
        Insert: {
          auth_method?: string
          course_id?: string | null
          display_name?: string | null
          enrolled_at?: string
          id: string
          preferred_model?: string | null
          updated_at?: string
        }
        Update: {
          auth_method?: string
          course_id?: string | null
          display_name?: string | null
          enrolled_at?: string
          id?: string
          preferred_model?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          challenge_cards_completed: string[]
          completed_lessons: string[]
          id: string
          last_visited: string | null
          quiz_scores: Json
          updated_at: string
          user_id: string
          werkstatt_progress: Json
        }
        Insert: {
          challenge_cards_completed?: string[]
          completed_lessons?: string[]
          id?: string
          last_visited?: string | null
          quiz_scores?: Json
          updated_at?: string
          user_id: string
          werkstatt_progress?: Json
        }
        Update: {
          challenge_cards_completed?: string[]
          completed_lessons?: string[]
          id?: string
          last_visited?: string | null
          quiz_scores?: Json
          updated_at?: string
          user_id?: string
          werkstatt_progress?: Json
        }
        Relationships: []
      }
      user_projects: {
        Row: {
          created_at: string
          dataset_ref: string | null
          evaluation_results: Json
          id: string
          pipeline_config: Json
          project_name: string
          project_type: string | null
          trained_models: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dataset_ref?: string | null
          evaluation_results?: Json
          id?: string
          pipeline_config?: Json
          project_name: string
          project_type?: string | null
          trained_models?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dataset_ref?: string | null
          evaluation_results?: Json
          id?: string
          pipeline_config?: Json
          project_name?: string
          project_type?: string | null
          trained_models?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
