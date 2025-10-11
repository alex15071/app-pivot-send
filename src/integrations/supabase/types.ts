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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          access_token_encrypted: string
          app_key: string | null
          created_at: string | null
          fb_user_id: string
          id: string
          name: string | null
          photo_url: string | null
          updated_at: string | null
        }
        Insert: {
          access_token_encrypted: string
          app_key?: string | null
          created_at?: string | null
          fb_user_id: string
          id?: string
          name?: string | null
          photo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token_encrypted?: string
          app_key?: string | null
          created_at?: string | null
          fb_user_id?: string
          id?: string
          name?: string | null
          photo_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_app_key_fkey"
            columns: ["app_key"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["key"]
          },
        ]
      }
      apps: {
        Row: {
          created_at: string | null
          fb_app_id: string
          fb_app_secret_encrypted: string
          id: string
          is_default: boolean | null
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fb_app_id: string
          fb_app_secret_encrypted: string
          id?: string
          is_default?: boolean | null
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fb_app_id?: string
          fb_app_secret_encrypted?: string
          id?: string
          is_default?: boolean | null
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_fanpages: {
        Row: {
          campaign_id: string
          page_id: string
        }
        Insert: {
          campaign_id: string
          page_id: string
        }
        Update: {
          campaign_id?: string
          page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_fanpages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_fanpages_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "fanpages"
            referencedColumns: ["page_id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active_app_key: string | null
          created_at: string | null
          current_offset: number | null
          current_page_stats: Json | null
          current_sequence_step: number | null
          delivered: number | null
          failed: number | null
          id: string
          is_sequence: boolean | null
          name: string
          pacing_profile_id: string | null
          processed: number | null
          sequence_start_at: string | null
          status: Database["public"]["Enums"]["campaign_status"] | null
          total_recipients: number | null
          updated_at: string | null
        }
        Insert: {
          active_app_key?: string | null
          created_at?: string | null
          current_offset?: number | null
          current_page_stats?: Json | null
          current_sequence_step?: number | null
          delivered?: number | null
          failed?: number | null
          id?: string
          is_sequence?: boolean | null
          name: string
          pacing_profile_id?: string | null
          processed?: number | null
          sequence_start_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          total_recipients?: number | null
          updated_at?: string | null
        }
        Update: {
          active_app_key?: string | null
          created_at?: string | null
          current_offset?: number | null
          current_page_stats?: Json | null
          current_sequence_step?: number | null
          delivered?: number | null
          failed?: number | null
          id?: string
          is_sequence?: boolean | null
          name?: string
          pacing_profile_id?: string | null
          processed?: number | null
          sequence_start_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          total_recipients?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_active_app_key_fkey"
            columns: ["active_app_key"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "campaigns_pacing_profile_id_fkey"
            columns: ["pacing_profile_id"]
            isOneToOne: false
            referencedRelation: "pacing_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fanpage_app_tokens: {
        Row: {
          app_key: string | null
          created_at: string | null
          id: string
          page_access_token_encrypted: string
          page_id: string | null
          updated_at: string | null
          webhook_subscribed: boolean | null
        }
        Insert: {
          app_key?: string | null
          created_at?: string | null
          id?: string
          page_access_token_encrypted: string
          page_id?: string | null
          updated_at?: string | null
          webhook_subscribed?: boolean | null
        }
        Update: {
          app_key?: string | null
          created_at?: string | null
          id?: string
          page_access_token_encrypted?: string
          page_id?: string | null
          updated_at?: string | null
          webhook_subscribed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fanpage_app_tokens_app_key_fkey"
            columns: ["app_key"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "fanpage_app_tokens_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "fanpages"
            referencedColumns: ["page_id"]
          },
        ]
      }
      fanpage_conversations: {
        Row: {
          created_at: string | null
          page_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          page_id: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          page_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fanpage_conversations_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "fanpages"
            referencedColumns: ["page_id"]
          },
        ]
      }
      fanpages: {
        Row: {
          account_id: string | null
          active_app_key: string | null
          conversations: number | null
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          page_id: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          active_app_key?: string | null
          conversations?: number | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          page_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          active_app_key?: string | null
          conversations?: number | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          page_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fanpages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fanpages_active_app_key_fkey"
            columns: ["active_app_key"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["key"]
          },
        ]
      }
      message_sequences: {
        Row: {
          campaign_id: string
          created_at: string | null
          delay_minutes: number
          delivered_count: number | null
          failed_count: number | null
          id: string
          message_arguments: Json
          message_type: string
          scheduled_for: string | null
          sent_count: number | null
          sequence_order: number
          status: string
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          delay_minutes?: number
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          message_arguments?: Json
          message_type: string
          scheduled_for?: string | null
          sent_count?: number | null
          sequence_order: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          delay_minutes?: number
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          message_arguments?: Json
          message_type?: string
          scheduled_for?: string | null
          sent_count?: number | null
          sequence_order?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          arguments: Json
          campaign_id: string | null
          created_at: string | null
          id: string
          sent: number | null
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          arguments: Json
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          sent?: number | null
          type: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          arguments?: Json
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          sent?: number | null
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      pacing_profiles: {
        Row: {
          backoff_multiplier: number | null
          batch_size: number | null
          cooldown_on_error_sec: number | null
          created_at: string | null
          error_ratio_threshold: number | null
          id: string
          jitter_pct: number | null
          max_retries_per_pool: number | null
          name: string
          parallel_batches: number | null
          sleep_between_pools_sec: number | null
          updated_at: string | null
        }
        Insert: {
          backoff_multiplier?: number | null
          batch_size?: number | null
          cooldown_on_error_sec?: number | null
          created_at?: string | null
          error_ratio_threshold?: number | null
          id?: string
          jitter_pct?: number | null
          max_retries_per_pool?: number | null
          name: string
          parallel_batches?: number | null
          sleep_between_pools_sec?: number | null
          updated_at?: string | null
        }
        Update: {
          backoff_multiplier?: number | null
          batch_size?: number | null
          cooldown_on_error_sec?: number | null
          created_at?: string | null
          error_ratio_threshold?: number | null
          id?: string
          jitter_pct?: number | null
          max_retries_per_pool?: number | null
          name?: string
          parallel_batches?: number | null
          sleep_between_pools_sec?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      processed_urls: {
        Row: {
          created_at: string | null
          page_id: string
          url_hash: string
        }
        Insert: {
          created_at?: string | null
          page_id: string
          url_hash: string
        }
        Update: {
          created_at?: string | null
          page_id?: string
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_urls_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "fanpages"
            referencedColumns: ["page_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      send_results: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          fb_body_json: Json | null
          http_code: number | null
          id: string
          page_id: string | null
          sender_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          fb_body_json?: Json | null
          http_code?: number | null
          id?: string
          page_id?: string | null
          sender_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          fb_body_json?: Json | null
          http_code?: number | null
          id?: string
          page_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "send_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_results_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "fanpages"
            referencedColumns: ["page_id"]
          },
        ]
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
      get_campaign_fanpage_stats: {
        Args: { p_campaign_id: string }
        Returns: {
          failed: number
          fanpage_name: string
          image_url: string
          page_id: string
          successful: number
          total_sent: number
        }[]
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      campaign_status: "draft" | "running" | "paused" | "finished" | "scheduled"
      message_type:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "generic"
        | "media"
        | "button"
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
      campaign_status: ["draft", "running", "paused", "finished", "scheduled"],
      message_type: [
        "text",
        "image",
        "audio",
        "video",
        "generic",
        "media",
        "button",
      ],
    },
  },
} as const
