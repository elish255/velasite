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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      chat_reward_transactions: {
        Row: {
          id: string
          user_id: string
          session_id: string
          foreigner_id: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          foreigner_id: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          foreigner_id?: string
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          id: string
          user_id: string
          phone: string
          amount: number
          status: string
          created_at: string
          approved_at: string | null
          approved_by: string | null
          provider: string
          provider_reference: string | null
          provider_status: string | null
          provider_checkout_url: string | null
          provider_payload: Json | null
          paid_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          phone: string
          amount?: number
          status?: string
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
          provider?: string
          provider_reference?: string | null
          provider_status?: string | null
          provider_checkout_url?: string | null
          provider_payload?: Json | null
          paid_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          phone?: string
          amount?: number
          status?: string
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
          provider?: string
          provider_reference?: string | null
          provider_status?: string | null
          provider_checkout_url?: string | null
          provider_payload?: Json | null
          paid_at?: string | null
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          id: string
          user_id: string
          amount: number
          phone: string
          status: string
          created_at: string
          processed_at: string | null
          processed_by: string | null
          fee: number
          payout_amount: number | null
          provider: string
          provider_reference: string | null
          provider_status: string | null
          provider_payload: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          phone: string
          status?: string
          created_at?: string
          processed_at?: string | null
          processed_by?: string | null
          fee?: number
          payout_amount?: number | null
          provider?: string
          provider_reference?: string | null
          provider_status?: string | null
          provider_payload?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          phone?: string
          status?: string
          created_at?: string
          processed_at?: string | null
          processed_by?: string | null
          fee?: number
          payout_amount?: number | null
          provider?: string
          provider_reference?: string | null
          provider_status?: string | null
          provider_payload?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activated: boolean
          balance: number
          country: string
          created_at: string
          full_name: string
          id: string
          phone: string
          banned: boolean
          ban_reason: string | null
        }
        Insert: {
          activated?: boolean
          balance?: number
          country?: string
          created_at?: string
          full_name?: string
          id: string
          phone?: string
          banned?: boolean
          ban_reason?: string | null
        }
        Update: {
          activated?: boolean
          balance?: number
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          banned?: boolean
          ban_reason?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          title: string
          message: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          message: string
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          message?: string
          created_at?: string
          read_at?: string | null
        }
        Relationships: []
      }
      balance_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          kind: string
          description: string
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          kind: string
          description?: string
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          kind?: string
          description?: string
          reference_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      credit_chat_reward: {
        Args: {
          p_session_id: string
          p_foreigner_id: string
          p_amount: number
        }
        Returns: number
      }
      review_activation_payment: {
        Args: {
          p_request_id: string
          p_status: string
        }
        Returns: Database["public"]["Tables"]["payment_requests"]["Row"]
      }
      request_withdrawal: {
        Args: {
          p_amount: number
          p_phone: string
        }
        Returns: Database["public"]["Tables"]["withdrawal_requests"]["Row"]
      }
      review_withdrawal: {
        Args: {
          p_request_id: string
          p_status: string
        }
        Returns: Database["public"]["Tables"]["withdrawal_requests"]["Row"]
      }
      admin_adjust_balance: {
        Args: { p_user_id: string; p_amount: number; p_reason: string }
        Returns: number
      }
      admin_set_user_ban: {
        Args: { p_user_id: string; p_banned: boolean; p_reason?: string | null }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      admin_set_user_activation: {
        Args: { p_user_id: string; p_activated: boolean }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      admin_send_notification: {
        Args: { p_user_id: string | null; p_title: string; p_message: string }
        Returns: string
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      get_public_payment_activity: {
        Args: Record<PropertyKey, never>
        Returns: {
          first_name: string
          location: string
          amount: number
          approved_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
