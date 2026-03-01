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
          metadata: Json | null
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
          metadata?: Json | null
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
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      balance_payments: {
        Row: {
          amount: number
          contact_name: string | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          org_id: string | null
          party_id: string | null
          party_type: string | null
          payment_date: string
          type: string
        }
        Insert: {
          amount: number
          contact_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          party_id?: string | null
          party_type?: string | null
          payment_date?: string
          type?: string
        }
        Update: {
          amount?: number
          contact_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          party_id?: string | null
          party_type?: string | null
          payment_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_rules: {
        Row: {
          body_template: string
          created_at: string
          enabled: boolean
          id: string
          name: string
          org_id: string
          recipient_user_ids: string[]
          subject_template: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          body_template: string
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          org_id: string
          recipient_user_ids?: string[]
          subject_template: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          org_id?: string
          recipient_user_ids?: string[]
          subject_template?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          android_pass_link: string | null
          block: string | null
          category: string
          created_at: string
          email: string | null
          event_id: string
          face_value: number | null
          first_name: string | null
          id: string
          iphone_pass_link: string | null
          last_name: string | null
          org_id: string | null
          password: string | null
          pk_pass_url: string | null
          purchase_id: string | null
          row_name: string | null
          seat: string | null
          section: string | null
          source: string
          split_type: string | null
          status: Database["public"]["Enums"]["inventory_status"]
          supporter_id: string | null
          ticket_name: string | null
        }
        Insert: {
          android_pass_link?: string | null
          block?: string | null
          category?: string
          created_at?: string
          email?: string | null
          event_id: string
          face_value?: number | null
          first_name?: string | null
          id?: string
          iphone_pass_link?: string | null
          last_name?: string | null
          org_id?: string | null
          password?: string | null
          pk_pass_url?: string | null
          purchase_id?: string | null
          row_name?: string | null
          seat?: string | null
          section?: string | null
          source?: string
          split_type?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          supporter_id?: string | null
          ticket_name?: string | null
        }
        Update: {
          android_pass_link?: string | null
          block?: string | null
          category?: string
          created_at?: string
          email?: string | null
          event_id?: string
          face_value?: number | null
          first_name?: string | null
          id?: string
          iphone_pass_link?: string | null
          last_name?: string | null
          org_id?: string | null
          password?: string | null
          pk_pass_url?: string | null
          purchase_id?: string | null
          row_name?: string | null
          seat?: string | null
          section?: string | null
          source?: string
          split_type?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          supporter_id?: string | null
          ticket_name?: string | null
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
            foreignKeyName: "inventory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          business_address: string | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string
          iban: string | null
          id: string
          notes: string | null
          org_id: string
          payment_terms: string | null
          signature_url: string | null
          sort_code: string | null
          swift_bic: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          notes?: string | null
          org_id: string
          payment_terms?: string | null
          signature_url?: string | null
          sort_code?: string | null
          swift_bic?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          payment_terms?: string | null
          signature_url?: string | null
          sort_code?: string | null
          swift_bic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          due_date: string | null
          iban: string | null
          id: string
          invoice_date: string
          invoice_number: number
          line_items: Json
          notes: string | null
          org_id: string
          payment_terms: string | null
          recipient_address: string | null
          recipient_email: string | null
          recipient_name: string | null
          sender_address: string | null
          sender_email: string | null
          sender_name: string | null
          sender_phone: string | null
          sort_code: string | null
          status: string
          subtotal: number
          swift_bic: string | null
          tax_amount: number | null
          tax_rate: number | null
          total: number
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          due_date?: string | null
          iban?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: number
          line_items?: Json
          notes?: string | null
          org_id: string
          payment_terms?: string | null
          recipient_address?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sender_address?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sort_code?: string | null
          status?: string
          subtotal?: number
          swift_bic?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          due_date?: string | null
          iban?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: number
          line_items?: Json
          notes?: string | null
          org_id?: string
          payment_terms?: string | null
          recipient_address?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sender_address?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sort_code?: string | null
          status?: string
          subtotal?: number
          swift_bic?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          created_at: string
          event_id: string
          external_listing_id: string | null
          face_value: number | null
          id: string
          last_synced_at: string | null
          org_id: string
          platform: string
          price: number
          quantity: number
          row: string | null
          seat_from: string | null
          seat_to: string | null
          section: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          external_listing_id?: string | null
          face_value?: number | null
          id?: string
          last_synced_at?: string | null
          org_id: string
          platform: string
          price: number
          quantity?: number
          row?: string | null
          seat_from?: string | null
          seat_to?: string | null
          section?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          external_listing_id?: string | null
          face_value?: number | null
          id?: string
          last_synced_at?: string | null
          org_id?: string
          platform?: string
          price?: number
          quantity?: number
          row?: string | null
          seat_from?: string | null
          seat_to?: string | null
          section?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          email_password: string | null
          first_name: string
          id: string
          last_name: string
          member_password: string | null
          org_id: string | null
          pass_link: string | null
          phone_number: string | null
          platform_login_url: string | null
          postcode: string | null
          supporter_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          email_password?: string | null
          first_name: string
          id?: string
          last_name: string
          member_password?: string | null
          org_id?: string | null
          pass_link?: string | null
          phone_number?: string | null
          platform_login_url?: string | null
          postcode?: string | null
          supporter_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          email_password?: string | null
          first_name?: string
          id?: string
          last_name?: string
          member_password?: string | null
          org_id?: string | null
          pass_link?: string | null
          phone_number?: string | null
          platform_login_url?: string | null
          postcode?: string | null
          supporter_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      order_status_history: {
        Row: {
          created_at: string
          id: string
          order_id: string
          org_id: string | null
          reached_at: string
          stage: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          org_id?: string | null
          reached_at?: string
          stage: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          org_id?: string | null
          reached_at?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          block: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_ref: string | null
          category: string
          contact_id: string | null
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
          org_id: string | null
          payment_received: boolean
          platform_id: string | null
          quantity: number
          sale_price: number
          split_type: string | null
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          block?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_ref?: string | null
          category?: string
          contact_id?: string | null
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
          org_id?: string | null
          payment_received?: boolean
          platform_id?: string | null
          quantity?: number
          sale_price: number
          split_type?: string | null
          status?: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          block?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_ref?: string | null
          category?: string
          contact_id?: string | null
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
          org_id?: string | null
          payment_received?: boolean
          platform_id?: string | null
          quantity?: number
          sale_price?: number
          split_type?: string | null
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          finance_pin: string | null
          id: string
          name: string
          owner_user_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          finance_pin?: string | null
          id?: string
          name: string
          owner_user_id: string
          slug: string
        }
        Update: {
          created_at?: string
          finance_pin?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          slug?: string
        }
        Relationships: []
      }
      password_vault: {
        Row: {
          created_at: string
          icon_color: string
          id: string
          org_id: string
          password: string
          site_name: string
          updated_at: string
          url: string | null
          username: string
        }
        Insert: {
          created_at?: string
          icon_color?: string
          id?: string
          org_id: string
          password: string
          site_name: string
          updated_at?: string
          url?: string | null
          username: string
        }
        Update: {
          created_at?: string
          icon_color?: string
          id?: string
          org_id?: string
          password?: string
          site_name?: string
          updated_at?: string
          url?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_vault_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          payout_date?: string | null
          platform_id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payouts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_virtual_cards: {
        Row: {
          card_name: string
          card_number: string
          created_at: string
          expiry: string | null
          id: string
          notes: string | null
          org_id: string | null
          platform_id: string
          updated_at: string
        }
        Insert: {
          card_name?: string
          card_number?: string
          created_at?: string
          expiry?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          platform_id: string
          updated_at?: string
        }
        Update: {
          card_name?: string
          card_number?: string
          created_at?: string
          expiry?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          platform_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_virtual_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_virtual_cards_platform_id_fkey"
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
          logo_url: string | null
          name: string
          notes: string | null
          org_id: string | null
          payout_days: number
        }
        Insert: {
          created_at?: string
          fee_type?: string | null
          fee_value?: number | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          org_id?: string | null
          payout_days?: number
        }
        Update: {
          created_at?: string
          fee_type?: string | null
          fee_value?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          org_id?: string | null
          payout_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "platforms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
          purchase_date: string
          quantity: number
          section: string | null
          split_type: string | null
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
          org_id?: string | null
          purchase_date?: string
          quantity?: number
          section?: string | null
          split_type?: string | null
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
          org_id?: string | null
          purchase_date?: string
          quantity?: number
          section?: string | null
          split_type?: string | null
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
            foreignKeyName: "purchases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
          reason: string | null
          refund_date: string | null
          status: Database["public"]["Enums"]["refund_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          org_id?: string | null
          reason?: string | null
          refund_date?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          org_id?: string | null
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
          {
            foreignKeyName: "refunds_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          body: string
          created_at: string
          id: string
          org_id: string | null
          recipient_user_ids: string[]
          sent_by: string | null
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          org_id?: string | null
          recipient_user_ids?: string[]
          sent_by?: string | null
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          org_id?: string | null
          recipient_user_ids?: string[]
          sent_by?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          display_id: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          org_id: string | null
          payment_terms: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          display_id?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          org_id?: string | null
          payment_terms?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          display_id?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          org_id?: string | null
          payment_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          org_id: string | null
          priority: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          priority?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          priority?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "transactions_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      vault_settings: {
        Row: {
          created_at: string
          id: string
          org_id: string
          updated_at: string
          vault_pin: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          updated_at?: string
          vault_pin: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          updated_at?: string
          vault_pin?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
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
        | "outstanding"
        | "partially_delivered"
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
        "outstanding",
        "partially_delivered",
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
