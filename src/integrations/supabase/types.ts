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
      arcade_game_titles: {
        Row: {
          created_at: string
          description: string | null
          game_type: string
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          game_type: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          game_type?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      divisions: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          icon: string | null
          id: string
          name: string
          slug: string
          status: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          status?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          location: string
          machines_deployed: number
          name: string
          notes: string | null
          revenue: number | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          location: string
          machines_deployed?: number
          name: string
          notes?: string | null
          revenue?: number | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          location?: string
          machines_deployed?: number
          name?: string
          notes?: string | null
          revenue?: number | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          division_id: string | null
          id: string
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          division_id?: string | null
          id?: string
          transaction_date: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          division_id?: string | null
          id?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          id: string
          last_restocked: string | null
          location: string
          min_stock_level: number
          product_name: string
          quantity: number
          sku: string
          supplier: string | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          last_restocked?: string | null
          location: string
          min_stock_level?: number
          product_name: string
          quantity?: number
          sku: string
          supplier?: string | null
          unit_cost: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          last_restocked?: string | null
          location?: string
          min_stock_level?: number
          product_name?: string
          quantity?: number
          sku?: string
          supplier?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applicant_name: string
          applied_at: string
          cover_letter: string | null
          created_at: string
          email: string
          id: string
          job_id: string | null
          notes: string | null
          phone: string | null
          resume_url: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applicant_name: string
          applied_at?: string
          cover_letter?: string | null
          created_at?: string
          email: string
          id?: string
          job_id?: string | null
          notes?: string | null
          phone?: string | null
          resume_url?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_name?: string
          applied_at?: string
          cover_letter?: string | null
          created_at?: string
          email?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          phone?: string | null
          resume_url?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          department: string
          description: string
          id: string
          location: string
          posted_at: string
          requirements: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department: string
          description: string
          id?: string
          location: string
          posted_at?: string
          requirements?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          description?: string
          id?: string
          location?: string
          posted_at?: string
          requirements?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      location_arcade_games: {
        Row: {
          arcade_game_id: string
          created_at: string
          id: string
          is_active: boolean | null
          location_id: string
          machine_count: number | null
        }
        Insert: {
          arcade_game_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_id: string
          machine_count?: number | null
        }
        Update: {
          arcade_game_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_id?: string
          machine_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "location_arcade_games_arcade_game_id_fkey"
            columns: ["arcade_game_id"]
            isOneToOne: false
            referencedRelation: "arcade_game_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_arcade_games_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_assignments: {
        Row: {
          assigned_at: string
          business_owner_id: string
          created_at: string
          id: string
          is_active: boolean
          location_id: string
        }
        Insert: {
          assigned_at?: string
          business_owner_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_id: string
        }
        Update: {
          assigned_at?: string
          business_owner_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          arcade_machine_count: number | null
          city: string
          combo_machine_count: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string
          created_at: string
          drink_machine_count: number | null
          id: string
          is_visible: boolean
          latitude: number | null
          location_category: string | null
          location_type: string | null
          longitude: number | null
          machine_count: number
          name: string | null
          snack_machine_count: number | null
          specialty_machine_count: number | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          arcade_machine_count?: number | null
          city: string
          combo_machine_count?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country: string
          created_at?: string
          drink_machine_count?: number | null
          id?: string
          is_visible?: boolean
          latitude?: number | null
          location_category?: string | null
          location_type?: string | null
          longitude?: number | null
          machine_count?: number
          name?: string | null
          snack_machine_count?: number | null
          specialty_machine_count?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          arcade_machine_count?: number | null
          city?: string
          combo_machine_count?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          drink_machine_count?: number | null
          id?: string
          is_visible?: boolean
          latitude?: number | null
          location_category?: string | null
          location_type?: string | null
          longitude?: number | null
          machine_count?: number
          name?: string | null
          snack_machine_count?: number | null
          specialty_machine_count?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      machine_inventory: {
        Row: {
          category: string | null
          cost_of_goods: number | null
          created_at: string
          id: string
          last_restocked: string | null
          machine_id: string
          max_capacity: number
          product_name: string
          quantity: number
          sku: string
          slot_number: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_of_goods?: number | null
          created_at?: string
          id?: string
          last_restocked?: string | null
          machine_id: string
          max_capacity?: number
          product_name: string
          quantity?: number
          sku: string
          slot_number?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_of_goods?: number | null
          created_at?: string
          id?: string
          last_restocked?: string | null
          machine_id?: string
          max_capacity?: number
          product_name?: string
          quantity?: number
          sku?: string
          slot_number?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_inventory_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_kiosk_categories: {
        Row: {
          base_price: number
          category_name: string
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          machine_id: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          category_name: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          machine_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_name?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          machine_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_kiosk_categories_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_profit_splits: {
        Row: {
          business_owner_percentage: number
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          machine_id: string
          updated_at: string
          vendx_percentage: number
        }
        Insert: {
          business_owner_percentage?: number
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          machine_id: string
          updated_at?: string
          vendx_percentage?: number
        }
        Update: {
          business_owner_percentage?: number
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          machine_id?: string
          updated_at?: string
          vendx_percentage?: number
        }
        Relationships: []
      }
      machine_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          machine_id: string
          session_code: string
          session_type: string
          status: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          machine_id: string
          session_code: string
          session_type: string
          status?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          machine_id?: string
          session_code?: string
          session_type?: string
          status?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          item_name: string | null
          machine_id: string
          points_earned: number
          session_id: string | null
          user_id: string | null
          wallet_transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          item_name?: string | null
          machine_id: string
          points_earned?: number
          session_id?: string | null
          user_id?: string | null
          wallet_transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          item_name?: string | null
          machine_id?: string
          points_earned?: number
          session_id?: string | null
          user_id?: string | null
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_transactions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "machine_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_transactions_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          budget: number
          conversions: number
          created_at: string
          end_date: string | null
          id: string
          impressions: number
          name: string
          spend: number
          start_date: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          budget?: number
          conversions?: number
          created_at?: string
          end_date?: string | null
          id?: string
          impressions?: number
          name: string
          spend?: number
          start_date: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          budget?: number
          conversions?: number
          created_at?: string
          end_date?: string | null
          id?: string
          impressions?: number
          name?: string
          spend?: number
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      metrics: {
        Row: {
          display_order: number | null
          id: string
          metric_label: string
          metric_type: string
          metric_value: number
          updated_at: string
        }
        Insert: {
          display_order?: number | null
          id?: string
          metric_label: string
          metric_type: string
          metric_value: number
          updated_at?: string
        }
        Update: {
          display_order?: number | null
          id?: string
          metric_label?: string
          metric_type?: string
          metric_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_offers: {
        Row: {
          created_at: string
          current_redemptions: number
          description: string | null
          discount_code: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_redemptions: number | null
          offer_name: string
          partner_name: string
          points_cost: number
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          current_redemptions?: number
          description?: string | null
          discount_code: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          offer_name: string
          partner_name: string
          points_cost: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          current_redemptions?: number
          description?: string | null
          discount_code?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          offer_name?: string
          partner_name?: string
          points_cost?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      payout_line_items: {
        Row: {
          created_at: string
          gross_revenue: number
          id: string
          location_id: string
          machine_id: string
          owner_share: number
          payout_id: string
          transaction_count: number
          vendx_percentage: number
          vendx_share: number
        }
        Insert: {
          created_at?: string
          gross_revenue: number
          id?: string
          location_id: string
          machine_id: string
          owner_share: number
          payout_id: string
          transaction_count?: number
          vendx_percentage: number
          vendx_share: number
        }
        Update: {
          created_at?: string
          gross_revenue?: number
          id?: string
          location_id?: string
          machine_id?: string
          owner_share?: number
          payout_id?: string
          transaction_count?: number
          vendx_percentage?: number
          vendx_share?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_line_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_settings: {
        Row: {
          bank_account_last4: string | null
          bank_name: string | null
          bank_routing_last4: string | null
          created_at: string
          id: string
          minimum_payout_amount: number
          payment_method: string
          payout_frequency: string
          stripe_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_last4?: string | null
          bank_name?: string | null
          bank_routing_last4?: string | null
          created_at?: string
          id?: string
          minimum_payout_amount?: number
          payment_method?: string
          payout_frequency?: string
          stripe_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_last4?: string | null
          bank_name?: string | null
          bank_routing_last4?: string | null
          created_at?: string
          id?: string
          minimum_payout_amount?: number
          payment_method?: string
          payout_frequency?: string
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          business_owner_id: string
          created_at: string
          gross_revenue: number
          id: string
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          status: string
          updated_at: string
          vendx_share: number
        }
        Insert: {
          amount: number
          business_owner_id: string
          created_at?: string
          gross_revenue: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          status?: string
          updated_at?: string
          vendx_share: number
        }
        Update: {
          amount?: number
          business_owner_id?: string
          created_at?: string
          gross_revenue?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          status?: string
          updated_at?: string
          vendx_share?: number
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          points: number
          reference_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          points: number
          reference_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          stripe_customer_id: string | null
          tier_level: string
          totp_secret: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          stripe_customer_id?: string | null
          tier_level?: string
          totp_secret?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          tier_level?: string
          totp_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          points_spent: number
          reward_id: string
          shipping_address_id: string | null
          status: string
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          points_spent: number
          reward_id: string
          shipping_address_id?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          points_spent?: number
          reward_id?: string
          shipping_address_id?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "reward_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "shipping_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          active_machines: number
          country: string
          created_at: string
          growth_rate: number
          id: string
          manager_id: string | null
          monthly_revenue: number
          monthly_transactions: number
          name: string
          updated_at: string
        }
        Insert: {
          active_machines?: number
          country: string
          created_at?: string
          growth_rate?: number
          id?: string
          manager_id?: string | null
          monthly_revenue?: number
          monthly_transactions?: number
          name: string
          updated_at?: string
        }
        Update: {
          active_machines?: number
          country?: string
          created_at?: string
          growth_rate?: number
          id?: string
          manager_id?: string | null
          monthly_revenue?: number
          monthly_transactions?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      restock_logs: {
        Row: {
          created_at: string
          id: string
          items_restocked: Json
          machine_id: string
          notes: string | null
          performed_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          items_restocked?: Json
          machine_id: string
          notes?: string | null
          performed_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          items_restocked?: Json
          machine_id?: string
          notes?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_catalog: {
        Row: {
          created_at: string
          credit_amount: number | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          points_cost: number
          requires_shipping: boolean
          reward_type: string
          stock: number | null
          tier_required: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          points_cost: number
          requires_shipping?: boolean
          reward_type: string
          stock?: number | null
          tier_required?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          points_cost?: number
          requires_shipping?: boolean
          reward_type?: string
          stock?: number | null
          tier_required?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rewards_points: {
        Row: {
          balance: number
          created_at: string
          id: string
          lifetime_points: number
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_points?: number
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_points?: number
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          address: string | null
          auto_scheduled: boolean | null
          completed_at: string | null
          created_at: string
          estimated_duration_minutes: number | null
          id: string
          location_id: string | null
          machine_id: string | null
          notes: string | null
          priority: string | null
          route_id: string
          scheduled_date: string | null
          source_ticket_id: string | null
          status: string
          stop_name: string
          stop_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          auto_scheduled?: boolean | null
          completed_at?: string | null
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          location_id?: string | null
          machine_id?: string | null
          notes?: string | null
          priority?: string | null
          route_id: string
          scheduled_date?: string | null
          source_ticket_id?: string | null
          status?: string
          stop_name: string
          stop_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          auto_scheduled?: boolean | null
          completed_at?: string | null
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          location_id?: string | null
          machine_id?: string | null
          notes?: string | null
          priority?: string | null
          route_id?: string
          scheduled_date?: string | null
          source_ticket_id?: string | null
          status?: string
          stop_name?: string
          stop_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "service_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_source_ticket_id_fkey"
            columns: ["source_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_routes: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_serviced_at: string | null
          name: string
          next_service_due: string | null
          service_frequency_days: number | null
          status: string
          updated_at: string
          zone_area: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_serviced_at?: string | null
          name: string
          next_service_due?: string | null
          service_frequency_days?: number | null
          status?: string
          updated_at?: string
          zone_area?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_serviced_at?: string | null
          name?: string
          next_service_due?: string | null
          service_frequency_days?: number | null
          status?: string
          updated_at?: string
          zone_area?: string | null
        }
        Relationships: []
      }
      shipping_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          state: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          state: string
          updated_at?: string
          user_id: string
          zip_code: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          state?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      store_cart_items: {
        Row: {
          addon_ids: string[] | null
          cart_id: string | null
          created_at: string | null
          id: string
          product_id: string | null
          quantity: number
        }
        Insert: {
          addon_ids?: string[] | null
          cart_id?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
        }
        Update: {
          addon_ids?: string[] | null
          cart_id?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "store_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_carts: {
        Row: {
          created_at: string | null
          id: string
          session_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          session_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      store_order_items: {
        Row: {
          addon_details: Json | null
          created_at: string | null
          id: string
          order_id: string | null
          product_id: string | null
          product_name: string
          product_price: number
          quantity: number
          total: number
        }
        Insert: {
          addon_details?: Json | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          product_name: string
          product_price: number
          quantity?: number
          total: number
        }
        Update: {
          addon_details?: Json | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          product_name?: string
          product_price?: number
          quantity?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_number: string
          shipping_address_id: string | null
          shipping_cost: number | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax: number | null
          total: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_number: string
          shipping_address_id?: string | null
          shipping_cost?: number | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          shipping_address_id?: string | null
          shipping_cost?: number | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "shipping_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_addons: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          product_id: string | null
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          product_id?: string | null
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          product_id?: string | null
          stripe_price_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_addons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          category: string
          compare_at_price: number | null
          created_at: string | null
          description: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          is_subscription: boolean | null
          metadata: Json | null
          name: string
          price: number
          short_description: string | null
          slug: string
          stock: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          subcategory: string | null
          subscription_interval: string | null
          subscription_price: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_subscription?: boolean | null
          metadata?: Json | null
          name: string
          price?: number
          short_description?: string | null
          slug: string
          stock?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subcategory?: string | null
          subscription_interval?: string | null
          subscription_price?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_subscription?: boolean | null
          metadata?: Json | null
          name?: string
          price?: number
          short_description?: string | null
          slug?: string
          stock?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subcategory?: string | null
          subscription_interval?: string | null
          subscription_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      store_subscriptions: {
        Row: {
          addon_ids: string[] | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          product_id: string | null
          shipping_address_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          addon_ids?: string[] | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          product_id?: string | null
          shipping_address_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          addon_ids?: string[] | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          product_id?: string | null
          shipping_address_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "shipping_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          id: string
          issue_type: string
          location: string
          machine_id: string
          priority: string
          resolution: string | null
          resolved_at: string | null
          status: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          id?: string
          issue_type: string
          location: string
          machine_id: string
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          ticket_number: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          issue_type?: string
          location?: string
          machine_id?: string
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendx_machines: {
        Row: {
          api_key: string
          created_at: string
          current_period_revenue: number | null
          id: string
          installed_at: string | null
          last_revenue_sync: string | null
          last_seen: string | null
          lifetime_revenue: number | null
          location_id: string | null
          machine_code: string
          machine_type: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          vendx_pay_enabled: boolean
        }
        Insert: {
          api_key: string
          created_at?: string
          current_period_revenue?: number | null
          id?: string
          installed_at?: string | null
          last_revenue_sync?: string | null
          last_seen?: string | null
          lifetime_revenue?: number | null
          location_id?: string | null
          machine_code: string
          machine_type: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          vendx_pay_enabled?: boolean
        }
        Update: {
          api_key?: string
          created_at?: string
          current_period_revenue?: number | null
          id?: string
          installed_at?: string | null
          last_revenue_sync?: string | null
          last_seen?: string | null
          lifetime_revenue?: number | null
          location_id?: string | null
          machine_code?: string
          machine_type?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          vendx_pay_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vendx_machines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      video_games: {
        Row: {
          amazon_app_store_url: string | null
          apple_store_url: string | null
          browser_play_url: string | null
          cover_image_url: string | null
          created_at: string
          display_order: number | null
          full_description: string | null
          google_play_url: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          itch_io_url: string | null
          microsoft_store_url: string | null
          nintendo_eshop_url: string | null
          platforms: Json
          playstation_store_url: string | null
          release_status: string
          screenshots: Json | null
          short_description: string | null
          slug: string
          steam_url: string | null
          title: string
          trailer_url: string | null
          updated_at: string
          xbox_store_url: string | null
        }
        Insert: {
          amazon_app_store_url?: string | null
          apple_store_url?: string | null
          browser_play_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          display_order?: number | null
          full_description?: string | null
          google_play_url?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          itch_io_url?: string | null
          microsoft_store_url?: string | null
          nintendo_eshop_url?: string | null
          platforms?: Json
          playstation_store_url?: string | null
          release_status?: string
          screenshots?: Json | null
          short_description?: string | null
          slug: string
          steam_url?: string | null
          title: string
          trailer_url?: string | null
          updated_at?: string
          xbox_store_url?: string | null
        }
        Update: {
          amazon_app_store_url?: string | null
          apple_store_url?: string | null
          browser_play_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          display_order?: number | null
          full_description?: string | null
          google_play_url?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          itch_io_url?: string | null
          microsoft_store_url?: string | null
          nintendo_eshop_url?: string | null
          platforms?: Json
          playstation_store_url?: string | null
          release_status?: string
          screenshots?: Json | null
          short_description?: string | null
          slug?: string
          steam_url?: string | null
          title?: string
          trailer_url?: string | null
          updated_at?: string
          xbox_store_url?: string | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          machine_id: string | null
          stripe_payment_intent_id: string | null
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          machine_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          machine_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_loaded: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_loaded?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_loaded?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_totp_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "global_operations_manager"
        | "event_manager"
        | "tech_support_lead"
        | "finance_accounting"
        | "marketing_sales"
        | "warehouse_logistics"
        | "regional_manager"
        | "employee_operator"
        | "customer"
        | "business_owner"
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
      app_role: [
        "super_admin",
        "global_operations_manager",
        "event_manager",
        "tech_support_lead",
        "finance_accounting",
        "marketing_sales",
        "warehouse_logistics",
        "regional_manager",
        "employee_operator",
        "customer",
        "business_owner",
      ],
    },
  },
} as const
