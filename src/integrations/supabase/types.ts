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
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          away_team: string
          city: string | null
          competition: string
          created_at: string
          event_date: string
          home_team: string
          id: string
          match_code: string
          venue: string | null
        }
        Insert: {
          away_team: string
          city?: string | null
          competition?: string
          created_at?: string
          event_date: string
          home_team: string
          id?: string
          match_code: string
          venue?: string | null
        }
        Update: {
          away_team?: string
          city?: string | null
          competition?: string
          created_at?: string
          event_date?: string
          home_team?: string
          id?: string
          match_code?: string
          venue?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          category: string
          created_at: string
          event_id: string
          id: string
          purchase_id: string
          row_name: string | null
          seat: string | null
          section: string | null
          status: Database["public"]["Enums"]["inventory_status"]
        }
        Insert: {
          category?: string
          created_at?: string
          event_id: string
          id?: string
          purchase_id: string
          row_name?: string | null
          seat?: string | null
          section?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
        }
        Update: {
          category?: string
          created_at?: string
          event_id?: string
          id?: string
          purchase_id?: string
          row_name?: string | null
          seat?: string | null
          section?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          created_at: string
          id: string
          inventory_id: string
          order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_id: string
          order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_ref: string | null
          category: string
          contacted: boolean
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          delivery_status: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          device_type: string | null
          event_id: string
          exchange_rate: number
          fees: number
          id: string
          net_received: number | null
          notes: string | null
          order_date: string
          order_ref: string | null
          payment_received: boolean
          platform_id: string | null
          quantity: number
          sale_price: number
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_ref?: string | null
          category?: string
          contacted?: boolean
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          delivery_status?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          device_type?: string | null
          event_id: string
          exchange_rate?: number
          fees?: number
          id?: string
          net_received?: number | null
          notes?: string | null
          order_date?: string
          order_ref?: string | null
          payment_received?: boolean
          platform_id?: string | null
          quantity?: number
          sale_price: number
          status?: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_ref?: string | null
          category?: string
          contacted?: boolean
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          delivery_status?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          device_type?: string | null
          event_id?: string
          exchange_rate?: number
          fees?: number
          id?: string
          net_received?: number | null
          notes?: string | null
          order_date?: string
          order_ref?: string | null
          payment_received?: boolean
          platform_id?: string | null
          quantity?: number
          sale_price?: number
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          notes: string | null
          payout_date: string | null
          platform_id: string
          reference: string | null
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          notes?: string | null
          payout_date?: string | null
          platform_id: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          notes?: string | null
          payout_date?: string | null
          platform_id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payouts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          created_at: string
          fee_type: string | null
          fee_value: number | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          fee_type?: string | null
          fee_value?: number | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          fee_type?: string | null
          fee_value?: number | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          category: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          event_id: string
          exchange_rate: number
          fees: number
          id: string
          notes: string | null
          purchase_date: string
          quantity: number
          section: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string
          supplier_order_id: string | null
          supplier_paid: boolean
          total_cost: number | null
          total_cost_gbp: number | null
          unit_cost: number
        }
        Insert: {
          category?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          event_id: string
          exchange_rate?: number
          fees?: number
          id?: string
          notes?: string | null
          purchase_date?: string
          quantity?: number
          section?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string
          supplier_order_id?: string | null
          supplier_paid?: boolean
          total_cost?: number | null
          total_cost_gbp?: number | null
          unit_cost: number
        }
        Update: {
          category?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          event_id?: string
          exchange_rate?: number
          fees?: number
          id?: string
          notes?: string | null
          purchase_date?: string
          quantity?: number
          section?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id?: string
          supplier_order_id?: string | null
          supplier_paid?: boolean
          total_cost?: number | null
          total_cost_gbp?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          reason: string | null
          refund_date: string | null
          status: Database["public"]["Enums"]["refund_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          reason?: string | null
          refund_date?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          reason?: string | null
          refund_date?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
        }
        Relationships: []
      }
      transactions_ledger: {
        Row: {
          amount: number
          amount_gbp: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string
          event_id: string | null
          exchange_rate: number
          id: string
          platform_id: string | null
          reference_id: string | null
          supplier_id: string | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          amount_gbp: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description: string
          event_id?: string | null
          exchange_rate?: number
          id?: string
          platform_id?: string | null
          reference_id?: string | null
          supplier_id?: string | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          amount_gbp?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          event_id?: string | null
          exchange_rate?: number
          id?: string
          platform_id?: string | null
          reference_id?: string | null
          supplier_id?: string | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_ledger_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ledger_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ledger_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      app_role: "admin" | "viewer"
      currency_code: "GBP" | "USD" | "EUR"
      delivery_type:
        | "email"
        | "physical"
        | "mobile_transfer"
        | "will_call"
        | "instant"
      inventory_status: "available" | "reserved" | "sold" | "cancelled"
      order_status:
        | "pending"
        | "fulfilled"
        | "delivered"
        | "refunded"
        | "cancelled"
      payout_status: "pending" | "processing" | "completed" | "failed"
      purchase_status: "pending" | "confirmed" | "received" | "cancelled"
      refund_status: "pending" | "approved" | "completed" | "rejected"
      transaction_type:
        | "sale"
        | "purchase"
        | "fee"
        | "refund"
        | "payout"
        | "supplier_payment"
        | "adjustment"
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
      app_role: ["admin", "viewer"],
      currency_code: ["GBP", "USD", "EUR"],
      delivery_type: [
        "email",
        "physical",
        "mobile_transfer",
        "will_call",
        "instant",
      ],
      inventory_status: ["available", "reserved", "sold", "cancelled"],
      order_status: [
        "pending",
        "fulfilled",
        "delivered",
        "refunded",
        "cancelled",
      ],
      payout_status: ["pending", "processing", "completed", "failed"],
      purchase_status: ["pending", "confirmed", "received", "cancelled"],
      refund_status: ["pending", "approved", "completed", "rejected"],
      transaction_type: [
        "sale",
        "purchase",
        "fee",
        "refund",
        "payout",
        "supplier_payment",
        "adjustment",
      ],
    },
  },
} as const
