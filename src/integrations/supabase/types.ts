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
      arcade_play_sessions: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          machine_id: string
          payment_method: string
          plays_purchased: number
          plays_used: number
          pricing_type: string | null
          status: string
          used_at: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string
          id?: string
          machine_id: string
          payment_method?: string
          plays_purchased?: number
          plays_used?: number
          pricing_type?: string | null
          status?: string
          used_at?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          machine_id?: string
          payment_method?: string
          plays_purchased?: number
          plays_used?: number
          pricing_type?: string | null
          status?: string
          used_at?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_play_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_play_sessions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_pricing_templates: {
        Row: {
          bundles: Json | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          price_per_play: number
          updated_at: string
        }
        Insert: {
          bundles?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          price_per_play?: number
          updated_at?: string
        }
        Update: {
          bundles?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          price_per_play?: number
          updated_at?: string
        }
        Relationships: []
      }
      arcade_waitlist: {
        Row: {
          converted_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          notes: string | null
          notified_at: string | null
          phone: string | null
          preferred_plan: string | null
          referral_source: string | null
          status: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          phone?: string | null
          preferred_plan?: string | null
          referral_source?: string | null
          status?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          phone?: string | null
          preferred_plan?: string | null
          referral_source?: string | null
          status?: string | null
        }
        Relationships: []
      }
      beat_purchases: {
        Row: {
          amount: number
          beat_id: string
          created_at: string
          download_count: number | null
          download_expires_at: string | null
          download_token: string | null
          email: string
          id: string
          payment_method: string
          payment_status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          beat_id: string
          created_at?: string
          download_count?: number | null
          download_expires_at?: string | null
          download_token?: string | null
          email: string
          id?: string
          payment_method?: string
          payment_status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          beat_id?: string
          created_at?: string
          download_count?: number | null
          download_expires_at?: string | null
          download_token?: string | null
          email?: string
          id?: string
          payment_method?: string
          payment_status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beat_purchases_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beat_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      beat_tracks: {
        Row: {
          bpm: number | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_order: number | null
          duration_seconds: number | null
          full_file_url: string | null
          genre: string[] | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          key: string | null
          license_type: string | null
          play_count: number | null
          preview_url: string | null
          price: number
          producer: string | null
          purchase_count: number | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          bpm?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          full_file_url?: string | null
          genre?: string[] | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          key?: string | null
          license_type?: string | null
          play_count?: number | null
          preview_url?: string | null
          price?: number
          producer?: string | null
          purchase_count?: number | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          bpm?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          full_file_url?: string | null
          genre?: string[] | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          key?: string | null
          license_type?: string | null
          play_count?: number | null
          preview_url?: string | null
          price?: number
          producer?: string | null
          purchase_count?: number | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_benefits: {
        Row: {
          created_at: string
          description: string
          display_order: number | null
          icon: string
          id: string
          is_active: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number | null
          icon?: string
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number | null
          icon?: string
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_inquiries: {
        Row: {
          business_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          interested_services: string | null
          location_type: string | null
          message: string | null
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          business_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          interested_services?: string | null
          location_type?: string | null
          message?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          interested_services?: string | null
          location_type?: string | null
          message?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_services: {
        Row: {
          created_at: string
          description: string
          display_order: number | null
          features: string[] | null
          icon: string
          id: string
          is_active: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number | null
          features?: string[] | null
          icon?: string
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number | null
          features?: string[] | null
          icon?: string
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_testimonials: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          location: string
          name: string
          quote: string
          rating: number | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          location: string
          name: string
          quote: string
          rating?: number | null
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          location?: string
          name?: string
          quote?: string
          rating?: number | null
          role?: string
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
      ecosnack_locker_purchases: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          item_name: string
          locker_code: string
          locker_number: string
          machine_code: string
          machine_id: string | null
          payment_method: string
          payment_status: string
          redeemed_at: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string
          id?: string
          item_name: string
          locker_code: string
          locker_number: string
          machine_code: string
          machine_id?: string | null
          payment_method?: string
          payment_status?: string
          redeemed_at?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          item_name?: string
          locker_code?: string
          locker_number?: string
          machine_code?: string
          machine_id?: string | null
          payment_method?: string
          payment_status?: string
          redeemed_at?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecosnack_locker_purchases_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
        ]
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
      location_change_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          details: Json
          id: string
          location_id: string | null
          request_type: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          details?: Json
          id?: string
          location_id?: string | null
          request_type: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          details?: Json
          id?: string
          location_id?: string | null
          request_type?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_change_requests_location_id_fkey"
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
      machine_activity_log: {
        Row: {
          activity_type: string
          amount: number | null
          created_at: string
          credits_used: number | null
          id: string
          item_name: string | null
          machine_id: string
          metadata: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          amount?: number | null
          created_at?: string
          credits_used?: number | null
          id?: string
          item_name?: string | null
          machine_id: string
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          amount?: number | null
          created_at?: string
          credits_used?: number | null
          id?: string
          item_name?: string | null
          machine_id?: string
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_activity_log_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_inventory: {
        Row: {
          category: string | null
          cost_of_goods: number | null
          created_at: string
          id: string
          last_restocked: string | null
          locker_code: string | null
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
          locker_code?: string | null
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
          locker_code?: string | null
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
      machine_ticket_config: {
        Row: {
          base_payout: number
          cooldown_seconds: number | null
          created_at: string
          daily_limit_per_user: number | null
          id: string
          is_active: boolean
          jackpot_amount: number | null
          jackpot_enabled: boolean
          jackpot_odds: number | null
          machine_id: string
          max_payout: number
          payout_multiplier: number
          updated_at: string
        }
        Insert: {
          base_payout?: number
          cooldown_seconds?: number | null
          created_at?: string
          daily_limit_per_user?: number | null
          id?: string
          is_active?: boolean
          jackpot_amount?: number | null
          jackpot_enabled?: boolean
          jackpot_odds?: number | null
          machine_id: string
          max_payout?: number
          payout_multiplier?: number
          updated_at?: string
        }
        Update: {
          base_payout?: number
          cooldown_seconds?: number | null
          created_at?: string
          daily_limit_per_user?: number | null
          id?: string
          is_active?: boolean
          jackpot_amount?: number | null
          jackpot_enabled?: boolean
          jackpot_odds?: number | null
          machine_id?: string
          max_payout?: number
          payout_multiplier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_ticket_config_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: true
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
      media_releases: {
        Row: {
          amazon_music_url: string | null
          apple_music_url: string | null
          apple_tv_url: string | null
          artist_director: string | null
          bandcamp_url: string | null
          cover_image_url: string | null
          created_at: string
          deezer_url: string | null
          disney_plus_url: string | null
          display_order: number | null
          full_description: string | null
          genre: string[] | null
          google_play_url: string | null
          hulu_url: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          itunes_url: string | null
          media_type: string
          music_release_type: string | null
          netflix_url: string | null
          paramount_plus_url: string | null
          peacock_url: string | null
          prime_video_url: string | null
          release_date: string | null
          release_status: string
          short_description: string | null
          slug: string
          soundcloud_url: string | null
          spotify_url: string | null
          tidal_url: string | null
          title: string
          tracklist: Json | null
          trailer_url: string | null
          tubi_url: string | null
          updated_at: string
          vudu_url: string | null
          youtube_music_url: string | null
          youtube_url: string | null
        }
        Insert: {
          amazon_music_url?: string | null
          apple_music_url?: string | null
          apple_tv_url?: string | null
          artist_director?: string | null
          bandcamp_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          deezer_url?: string | null
          disney_plus_url?: string | null
          display_order?: number | null
          full_description?: string | null
          genre?: string[] | null
          google_play_url?: string | null
          hulu_url?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          itunes_url?: string | null
          media_type: string
          music_release_type?: string | null
          netflix_url?: string | null
          paramount_plus_url?: string | null
          peacock_url?: string | null
          prime_video_url?: string | null
          release_date?: string | null
          release_status?: string
          short_description?: string | null
          slug: string
          soundcloud_url?: string | null
          spotify_url?: string | null
          tidal_url?: string | null
          title: string
          tracklist?: Json | null
          trailer_url?: string | null
          tubi_url?: string | null
          updated_at?: string
          vudu_url?: string | null
          youtube_music_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          amazon_music_url?: string | null
          apple_music_url?: string | null
          apple_tv_url?: string | null
          artist_director?: string | null
          bandcamp_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          deezer_url?: string | null
          disney_plus_url?: string | null
          display_order?: number | null
          full_description?: string | null
          genre?: string[] | null
          google_play_url?: string | null
          hulu_url?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          itunes_url?: string | null
          media_type?: string
          music_release_type?: string | null
          netflix_url?: string | null
          paramount_plus_url?: string | null
          peacock_url?: string | null
          prime_video_url?: string | null
          release_date?: string | null
          release_status?: string
          short_description?: string | null
          slug?: string
          soundcloud_url?: string | null
          spotify_url?: string | null
          tidal_url?: string | null
          title?: string
          tracklist?: Json | null
          trailer_url?: string | null
          tubi_url?: string | null
          updated_at?: string
          vudu_url?: string | null
          youtube_music_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      media_shop_products: {
        Row: {
          compare_at_price: number | null
          created_at: string
          description: string | null
          display_order: number | null
          file_url: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          media_release_id: string | null
          price: number
          product_type: string
          slug: string
          stock_quantity: number | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          media_release_id?: string | null
          price?: number
          product_type: string
          slug: string
          stock_quantity?: number | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          media_release_id?: string | null
          price?: number
          product_type?: string
          slug?: string
          stock_quantity?: number | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_shop_products_media_release_id_fkey"
            columns: ["media_release_id"]
            isOneToOne: false
            referencedRelation: "media_releases"
            referencedColumns: ["id"]
          },
        ]
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
      news_articles: {
        Row: {
          author_id: string | null
          category_id: string | null
          content: string
          created_at: string | null
          excerpt: string | null
          featured_image: string | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content: string
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "news_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "news_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      news_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
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
      partner_support_requests: {
        Row: {
          assigned_to: string | null
          business_owner_id: string
          created_at: string
          description: string
          id: string
          location_id: string | null
          machine_id: string | null
          priority: string
          request_type: string
          resolution: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          business_owner_id: string
          created_at?: string
          description: string
          id?: string
          location_id?: string | null
          machine_id?: string | null
          priority?: string
          request_type: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          business_owner_id?: string
          created_at?: string
          description?: string
          id?: string
          location_id?: string | null
          machine_id?: string | null
          priority?: string
          request_type?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_support_requests_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_support_requests_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
        ]
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
      prize_inventory: {
        Row: {
          created_at: string
          id: string
          last_restocked: string | null
          location_id: string
          low_stock_threshold: number | null
          prize_id: string
          quantity: number
          reserved_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_restocked?: string | null
          location_id: string
          low_stock_threshold?: number | null
          prize_id: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_restocked?: string | null
          location_id?: string
          low_stock_threshold?: number | null
          prize_id?: string
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_inventory_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "ticket_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_reservations: {
        Row: {
          claimed_at: string | null
          created_at: string
          expires_at: string
          id: string
          location_id: string
          prize_id: string
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          location_id: string
          prize_id: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          location_id?: string
          prize_id?: string
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_reservations_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "ticket_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_wins: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          machine_id: string | null
          metadata: Json | null
          notes: string | null
          photo_url: string | null
          prize_name: string
          prize_type: string | null
          prize_value: number | null
          session_id: string | null
          updated_at: string
          user_id: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          machine_id?: string | null
          metadata?: Json | null
          notes?: string | null
          photo_url?: string | null
          prize_name: string
          prize_type?: string | null
          prize_value?: number | null
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          machine_id?: string | null
          metadata?: Json | null
          notes?: string | null
          photo_url?: string | null
          prize_name?: string
          prize_type?: string | null
          prize_value?: number | null
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_wins_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_wins_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_wins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "arcade_play_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_waitlist: {
        Row: {
          converted_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          notes: string | null
          notified_at: string | null
          phone: string | null
          product_id: string | null
          referral_source: string | null
          status: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          phone?: string | null
          product_id?: string | null
          referral_source?: string | null
          status?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          phone?: string | null
          product_id?: string | null
          referral_source?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_waitlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
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
      quest_badges: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          icon_url: string | null
          id: string
          is_hidden: boolean | null
          name: string
          requirement_type: string
          requirement_value: number | null
          xp_reward: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_hidden?: boolean | null
          name: string
          requirement_type: string
          requirement_value?: number | null
          xp_reward?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_hidden?: boolean | null
          name?: string
          requirement_type?: string
          requirement_value?: number | null
          xp_reward?: number | null
        }
        Relationships: []
      }
      quest_chain_claims: {
        Row: {
          bonus_credits_awarded: number | null
          bonus_xp_awarded: number | null
          chain_id: string
          claimed_at: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          bonus_credits_awarded?: number | null
          bonus_xp_awarded?: number | null
          chain_id: string
          claimed_at?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          bonus_credits_awarded?: number | null
          bonus_xp_awarded?: number | null
          chain_id?: string
          claimed_at?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_chain_claims_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "quest_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_chain_steps: {
        Row: {
          chain_id: string
          created_at: string | null
          id: string
          quest_id: string
          step_order: number
        }
        Insert: {
          chain_id: string
          created_at?: string | null
          id?: string
          quest_id: string
          step_order: number
        }
        Update: {
          chain_id?: string
          created_at?: string | null
          id?: string
          quest_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quest_chain_steps_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "quest_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_chain_steps_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_chains: {
        Row: {
          bonus_credits: number | null
          bonus_xp: number | null
          created_at: string | null
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean | null
          name: string
          total_quests: number | null
          updated_at: string | null
        }
        Insert: {
          bonus_credits?: number | null
          bonus_xp?: number | null
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          total_quests?: number | null
          updated_at?: string | null
        }
        Update: {
          bonus_credits?: number | null
          bonus_xp?: number | null
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          total_quests?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quest_completions: {
        Row: {
          checkin_latitude: number | null
          checkin_longitude: number | null
          claimed_at: string | null
          completed_at: string | null
          created_at: string | null
          credits_earned: number | null
          id: string
          node_id: string | null
          points_earned: number | null
          progress_data: Json | null
          quest_id: string
          rewards_data: Json | null
          status: Database["public"]["Enums"]["quest_completion_status"]
          updated_at: string | null
          user_id: string
          verified_via: string | null
          xp_earned: number | null
        }
        Insert: {
          checkin_latitude?: number | null
          checkin_longitude?: number | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_earned?: number | null
          id?: string
          node_id?: string | null
          points_earned?: number | null
          progress_data?: Json | null
          quest_id: string
          rewards_data?: Json | null
          status?: Database["public"]["Enums"]["quest_completion_status"]
          updated_at?: string | null
          user_id: string
          verified_via?: string | null
          xp_earned?: number | null
        }
        Update: {
          checkin_latitude?: number | null
          checkin_longitude?: number | null
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          credits_earned?: number | null
          id?: string
          node_id?: string | null
          points_earned?: number | null
          progress_data?: Json | null
          quest_id?: string
          rewards_data?: Json | null
          status?: Database["public"]["Enums"]["quest_completion_status"]
          updated_at?: string | null
          user_id?: string
          verified_via?: string | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quest_completions_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "quest_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_completions_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_daily_claims: {
        Row: {
          challenges_claimed: string[] | null
          claim_date: string
          created_at: string
          id: string
          total_xp_awarded: number | null
          user_id: string
        }
        Insert: {
          challenges_claimed?: string[] | null
          claim_date: string
          created_at?: string
          id?: string
          total_xp_awarded?: number | null
          user_id: string
        }
        Update: {
          challenges_claimed?: string[] | null
          claim_date?: string
          created_at?: string
          id?: string
          total_xp_awarded?: number | null
          user_id?: string
        }
        Relationships: []
      }
      quest_leaderboards: {
        Row: {
          created_at: string | null
          id: string
          nodes_visited: number | null
          period: string
          period_start: string
          quests_completed: number | null
          rank: number | null
          region: string | null
          updated_at: string | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nodes_visited?: number | null
          period: string
          period_start: string
          quests_completed?: number | null
          rank?: number | null
          region?: string | null
          updated_at?: string | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nodes_visited?: number | null
          period?: string
          period_start?: string
          quests_completed?: number | null
          rank?: number | null
          region?: string | null
          updated_at?: string | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: []
      }
      quest_node_assignments: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          node_id: string
          quest_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          node_id: string
          quest_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          node_id?: string
          quest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_node_assignments_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "quest_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_node_assignments_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_node_discoveries: {
        Row: {
          discovered_at: string | null
          id: string
          last_visited_at: string | null
          node_id: string
          user_id: string
          visit_count: number | null
        }
        Insert: {
          discovered_at?: string | null
          id?: string
          last_visited_at?: string | null
          node_id: string
          user_id: string
          visit_count?: number | null
        }
        Update: {
          discovered_at?: string | null
          id?: string
          last_visited_at?: string | null
          node_id?: string
          user_id?: string
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quest_node_discoveries_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "quest_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_nodes: {
        Row: {
          available_from: string | null
          available_until: string | null
          color: string | null
          cooldown_hours: number | null
          created_at: string | null
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean | null
          is_virtual: boolean | null
          latitude: number | null
          location_id: string | null
          longitude: number | null
          machine_id: string | null
          name: string
          node_type: string
          radius_meters: number | null
          rarity: Database["public"]["Enums"]["quest_node_rarity"]
          updated_at: string | null
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          color?: string | null
          cooldown_hours?: number | null
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          is_virtual?: boolean | null
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          machine_id?: string | null
          name: string
          node_type?: string
          radius_meters?: number | null
          rarity?: Database["public"]["Enums"]["quest_node_rarity"]
          updated_at?: string | null
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          color?: string | null
          cooldown_hours?: number | null
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          is_virtual?: boolean | null
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          machine_id?: string | null
          name?: string
          node_type?: string
          radius_meters?: number | null
          rarity?: Database["public"]["Enums"]["quest_node_rarity"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quest_nodes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_nodes_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_player_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_player_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "quest_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_player_progress: {
        Row: {
          created_at: string | null
          current_level: number | null
          current_streak: number | null
          id: string
          last_quest_date: string | null
          longest_streak: number | null
          nodes_discovered: number | null
          quests_completed: number | null
          total_credits_earned: number | null
          total_distance_traveled: number | null
          total_points_earned: number | null
          total_xp: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_level?: number | null
          current_streak?: number | null
          id?: string
          last_quest_date?: string | null
          longest_streak?: number | null
          nodes_discovered?: number | null
          quests_completed?: number | null
          total_credits_earned?: number | null
          total_distance_traveled?: number | null
          total_points_earned?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_level?: number | null
          current_streak?: number | null
          id?: string
          last_quest_date?: string | null
          longest_streak?: number | null
          nodes_discovered?: number | null
          quests_completed?: number | null
          total_credits_earned?: number | null
          total_distance_traveled?: number | null
          total_points_earned?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quest_rewards: {
        Row: {
          created_at: string | null
          drop_chance: number | null
          id: string
          is_guaranteed: boolean | null
          quest_id: string
          rarity_multiplier: number | null
          reward_code: string | null
          reward_item_id: string | null
          reward_type: string
          reward_value: number | null
        }
        Insert: {
          created_at?: string | null
          drop_chance?: number | null
          id?: string
          is_guaranteed?: boolean | null
          quest_id: string
          rarity_multiplier?: number | null
          reward_code?: string | null
          reward_item_id?: string | null
          reward_type: string
          reward_value?: number | null
        }
        Update: {
          created_at?: string | null
          drop_chance?: number | null
          id?: string
          is_guaranteed?: boolean | null
          quest_id?: string
          rarity_multiplier?: number | null
          reward_code?: string | null
          reward_item_id?: string | null
          reward_type?: string
          reward_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quest_rewards_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          created_at: string | null
          credits_reward: number | null
          current_completions: number | null
          description: string
          difficulty: string | null
          end_date: string | null
          estimated_time_minutes: number | null
          icon_url: string | null
          id: string
          is_featured: boolean | null
          max_completions_per_user: number | null
          max_total_completions: number | null
          points_reward: number | null
          quest_type: Database["public"]["Enums"]["quest_type"]
          required_achievement: string | null
          required_game_id: string | null
          required_product_id: string | null
          required_purchase_amount: number | null
          required_score: number | null
          requires_checkin: boolean | null
          requires_qr_scan: boolean | null
          requires_transaction: boolean | null
          short_description: string | null
          sort_order: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["quest_status"]
          title: string
          updated_at: string | null
          xp_reward: number
        }
        Insert: {
          created_at?: string | null
          credits_reward?: number | null
          current_completions?: number | null
          description: string
          difficulty?: string | null
          end_date?: string | null
          estimated_time_minutes?: number | null
          icon_url?: string | null
          id?: string
          is_featured?: boolean | null
          max_completions_per_user?: number | null
          max_total_completions?: number | null
          points_reward?: number | null
          quest_type?: Database["public"]["Enums"]["quest_type"]
          required_achievement?: string | null
          required_game_id?: string | null
          required_product_id?: string | null
          required_purchase_amount?: number | null
          required_score?: number | null
          requires_checkin?: boolean | null
          requires_qr_scan?: boolean | null
          requires_transaction?: boolean | null
          short_description?: string | null
          sort_order?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["quest_status"]
          title: string
          updated_at?: string | null
          xp_reward?: number
        }
        Update: {
          created_at?: string | null
          credits_reward?: number | null
          current_completions?: number | null
          description?: string
          difficulty?: string | null
          end_date?: string | null
          estimated_time_minutes?: number | null
          icon_url?: string | null
          id?: string
          is_featured?: boolean | null
          max_completions_per_user?: number | null
          max_total_completions?: number | null
          points_reward?: number | null
          quest_type?: Database["public"]["Enums"]["quest_type"]
          required_achievement?: string | null
          required_game_id?: string | null
          required_product_id?: string | null
          required_purchase_amount?: number | null
          required_score?: number | null
          requires_checkin?: boolean | null
          requires_qr_scan?: boolean | null
          requires_transaction?: boolean | null
          short_description?: string | null
          sort_order?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["quest_status"]
          title?: string
          updated_at?: string | null
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "quests_required_game_id_fkey"
            columns: ["required_game_id"]
            isOneToOne: false
            referencedRelation: "arcade_game_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quests_required_product_id_fkey"
            columns: ["required_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
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
      revenue_collections: {
        Row: {
          cash_amount: number | null
          coins_amount: number | null
          collected_by: string | null
          collection_date: string
          created_at: string
          id: string
          location_id: string | null
          machine_id: string
          notes: string | null
          route_stop_id: string | null
          total_amount: number | null
          updated_at: string
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          cash_amount?: number | null
          coins_amount?: number | null
          collected_by?: string | null
          collection_date?: string
          created_at?: string
          id?: string
          location_id?: string | null
          machine_id: string
          notes?: string | null
          route_stop_id?: string | null
          total_amount?: number | null
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          cash_amount?: number | null
          coins_amount?: number | null
          collected_by?: string | null
          collection_date?: string
          created_at?: string
          id?: string
          location_id?: string | null
          machine_id?: string
          notes?: string | null
          route_stop_id?: string | null
          total_amount?: number | null
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_collections_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_collections_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_collections_route_stop_id_fkey"
            columns: ["route_stop_id"]
            isOneToOne: false
            referencedRelation: "route_stops"
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
      site_policies: {
        Row: {
          content: string
          created_at: string
          id: string
          last_updated_by: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          last_updated_by?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          last_updated_by?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      stand_events: {
        Row: {
          created_at: string
          event_date: string
          event_end_date: string | null
          event_location: string
          event_name: string
          id: string
          notes: string | null
          stand_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_date: string
          event_end_date?: string | null
          event_location: string
          event_name: string
          id?: string
          notes?: string | null
          stand_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_end_date?: string | null
          event_location?: string
          event_name?: string
          id?: string
          notes?: string | null
          stand_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stand_events_stand_id_fkey"
            columns: ["stand_id"]
            isOneToOne: false
            referencedRelation: "stands"
            referencedColumns: ["id"]
          },
        ]
      }
      stand_menu_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          price: number | null
          stand_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          price?: number | null
          stand_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          price?: number | null
          stand_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stand_menu_items_stand_id_fkey"
            columns: ["stand_id"]
            isOneToOne: false
            referencedRelation: "stands"
            referencedColumns: ["id"]
          },
        ]
      }
      stands: {
        Row: {
          brand_future_focus: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          name: string
          slug: string | null
          status: string
          story: string | null
          updated_at: string
        }
        Insert: {
          brand_future_focus?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          name: string
          slug?: string | null
          status?: string
          story?: string | null
          updated_at?: string
        }
        Update: {
          brand_future_focus?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          name?: string
          slug?: string | null
          status?: string
          story?: string | null
          updated_at?: string
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
      store_funnel_addons: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          funnel_step_id: string
          id: string
          is_active: boolean | null
          name: string
          price: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          funnel_step_id: string
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          funnel_step_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_funnel_addons_funnel_step_id_fkey"
            columns: ["funnel_step_id"]
            isOneToOne: false
            referencedRelation: "store_funnel_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      store_funnel_analytics: {
        Row: {
          completed: boolean | null
          created_at: string | null
          funnel_id: string
          id: string
          session_id: string | null
          step_reached: number | null
          total_value: number | null
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          funnel_id: string
          id?: string
          session_id?: string | null
          step_reached?: number | null
          total_value?: number | null
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          funnel_id?: string
          id?: string
          session_id?: string | null
          step_reached?: number | null
          total_value?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_funnel_analytics_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "store_funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      store_funnel_products: {
        Row: {
          created_at: string | null
          custom_name: string | null
          custom_price: number | null
          discount_percentage: number | null
          display_order: number | null
          funnel_step_id: string
          id: string
          is_featured: boolean | null
          product_id: string
          quantity_limit: number | null
        }
        Insert: {
          created_at?: string | null
          custom_name?: string | null
          custom_price?: number | null
          discount_percentage?: number | null
          display_order?: number | null
          funnel_step_id: string
          id?: string
          is_featured?: boolean | null
          product_id: string
          quantity_limit?: number | null
        }
        Update: {
          created_at?: string | null
          custom_name?: string | null
          custom_price?: number | null
          discount_percentage?: number | null
          display_order?: number | null
          funnel_step_id?: string
          id?: string
          is_featured?: boolean | null
          product_id?: string
          quantity_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_funnel_products_funnel_step_id_fkey"
            columns: ["funnel_step_id"]
            isOneToOne: false
            referencedRelation: "store_funnel_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_funnel_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_funnel_steps: {
        Row: {
          created_at: string | null
          description: string | null
          funnel_id: string
          id: string
          is_required: boolean | null
          settings: Json | null
          step_order: number
          step_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          funnel_id: string
          id?: string
          is_required?: boolean | null
          settings?: Json | null
          step_order?: number
          step_type?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          funnel_id?: string
          id?: string
          is_required?: boolean | null
          settings?: Json | null
          step_order?: number
          step_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_funnel_steps_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "store_funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      store_funnels: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          funnel_type: string
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          funnel_type?: string
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          funnel_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
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
          admin_notes: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          delivered_at: string | null
          estimated_delivery: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          paypal_order_id: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_address_id: string | null
          shipping_cost: number | null
          shopify_order_id: string | null
          shopify_order_number: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax: number | null
          total: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
          user_id: string | null
          wallet_credit_applied: number | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          paypal_order_id?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_address_id?: string | null
          shipping_cost?: number | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_credit_applied?: number | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          paypal_order_id?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_address_id?: string | null
          shipping_cost?: number | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_credit_applied?: number | null
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
          game_id: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          is_subscription: boolean | null
          metadata: Json | null
          name: string
          price: number
          retail_links: Json | null
          retail_status: string | null
          short_description: string | null
          slug: string
          stock: number | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          subcategory: string | null
          subscription_interval: string | null
          subscription_price: number | null
          updated_at: string | null
          waitlist_enabled: boolean | null
        }
        Insert: {
          category: string
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          game_id?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_subscription?: boolean | null
          metadata?: Json | null
          name: string
          price?: number
          retail_links?: Json | null
          retail_status?: string | null
          short_description?: string | null
          slug: string
          stock?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subcategory?: string | null
          subscription_interval?: string | null
          subscription_price?: number | null
          updated_at?: string | null
          waitlist_enabled?: boolean | null
        }
        Update: {
          category?: string
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          game_id?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_subscription?: boolean | null
          metadata?: Json | null
          name?: string
          price?: number
          retail_links?: Json | null
          retail_status?: string | null
          short_description?: string | null
          slug?: string
          stock?: number | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subcategory?: string | null
          subscription_interval?: string | null
          subscription_price?: number | null
          updated_at?: string | null
          waitlist_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "store_products_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "video_games"
            referencedColumns: ["id"]
          },
        ]
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
      support_ticket_responses: {
        Row: {
          created_at: string
          id: string
          is_internal_note: boolean | null
          message: string
          partner_request_id: string | null
          responder_id: string
          responder_name: string | null
          responder_role: string | null
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          message: string
          partner_request_id?: string | null
          responder_id: string
          responder_name?: string | null
          responder_role?: string | null
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          message?: string
          partner_request_id?: string | null
          responder_id?: string
          responder_name?: string | null
          responder_role?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_responses_partner_request_id_fkey"
            columns: ["partner_request_id"]
            isOneToOne: false
            referencedRelation: "partner_support_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
      synced_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          description: string | null
          id: string
          metadata: Json | null
          provider: string
          provider_transaction_id: string
          status: string
          synced_at: string
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          provider_transaction_id: string
          status: string
          synced_at?: string
          transaction_date: string
          transaction_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          provider_transaction_id?: string
          status?: string
          synced_at?: string
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: []
      }
      ticket_prizes: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          min_age: number | null
          name: string
          requires_approval: boolean | null
          requires_shipping: boolean | null
          shipping_fee_amount: number | null
          shipping_fee_type: string | null
          ticket_cost: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_age?: number | null
          name: string
          requires_approval?: boolean | null
          requires_shipping?: boolean | null
          shipping_fee_amount?: number | null
          shipping_fee_type?: string | null
          ticket_cost: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_age?: number | null
          name?: string
          requires_approval?: boolean | null
          requires_shipping?: boolean | null
          shipping_fee_amount?: number | null
          shipping_fee_type?: string | null
          ticket_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticket_redemptions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          location_id: string | null
          metadata: Json | null
          notes: string | null
          prize_id: string
          redemption_code: string | null
          redemption_type: string | null
          rejection_reason: string | null
          shipping_address_id: string | null
          status: string | null
          tickets_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          metadata?: Json | null
          notes?: string | null
          prize_id: string
          redemption_code?: string | null
          redemption_type?: string | null
          rejection_reason?: string | null
          shipping_address_id?: string | null
          status?: string | null
          tickets_spent: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          metadata?: Json | null
          notes?: string | null
          prize_id?: string
          redemption_code?: string | null
          redemption_type?: string | null
          rejection_reason?: string | null
          shipping_address_id?: string | null
          status?: string | null
          tickets_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_redemptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_redemptions_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "ticket_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_redemptions_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "shipping_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          game_name: string | null
          id: string
          idempotency_key: string | null
          location_id: string | null
          machine_id: string | null
          metadata: Json | null
          multiplier: number | null
          score: number | null
          session_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          game_name?: string | null
          id?: string
          idempotency_key?: string | null
          location_id?: string | null
          machine_id?: string | null
          metadata?: Json | null
          multiplier?: number | null
          score?: number | null
          session_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          game_name?: string | null
          id?: string
          idempotency_key?: string | null
          location_id?: string | null
          machine_id?: string | null
          metadata?: Json | null
          multiplier?: number | null
          score?: number | null
          session_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_transactions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "vendx_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "machine_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_sync_status: {
        Row: {
          error_message: string | null
          id: string
          last_sync_at: string | null
          last_sync_cursor: string | null
          provider: string
          sync_status: string
          transactions_synced: number | null
          updated_at: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_cursor?: string | null
          provider: string
          sync_status?: string
          transactions_synced?: number | null
          updated_at?: string
        }
        Update: {
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_cursor?: string | null
          provider?: string
          sync_status?: string
          transactions_synced?: number | null
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
      user_tickets: {
        Row: {
          balance: number
          created_at: string
          id: string
          lifetime_earned: number
          lifetime_redeemed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_redeemed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          lifetime_redeemed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendx_machines: {
        Row: {
          accepts_cards: boolean | null
          accepts_cash: boolean | null
          accepts_coins: boolean | null
          api_key: string
          bundle_price: number | null
          created_at: string
          current_period_revenue: number | null
          id: string
          installed_at: string | null
          last_activity_at: string | null
          last_revenue_sync: string | null
          last_seen: string | null
          lifetime_revenue: number | null
          location_id: string | null
          machine_code: string
          machine_type: string
          name: string
          notes: string | null
          plays_per_bundle: number | null
          price_per_play: number | null
          pricing_template_id: string | null
          status: string
          total_plays: number | null
          total_vends: number | null
          updated_at: string
          vendx_pay_enabled: boolean
        }
        Insert: {
          accepts_cards?: boolean | null
          accepts_cash?: boolean | null
          accepts_coins?: boolean | null
          api_key: string
          bundle_price?: number | null
          created_at?: string
          current_period_revenue?: number | null
          id?: string
          installed_at?: string | null
          last_activity_at?: string | null
          last_revenue_sync?: string | null
          last_seen?: string | null
          lifetime_revenue?: number | null
          location_id?: string | null
          machine_code: string
          machine_type: string
          name: string
          notes?: string | null
          plays_per_bundle?: number | null
          price_per_play?: number | null
          pricing_template_id?: string | null
          status?: string
          total_plays?: number | null
          total_vends?: number | null
          updated_at?: string
          vendx_pay_enabled?: boolean
        }
        Update: {
          accepts_cards?: boolean | null
          accepts_cash?: boolean | null
          accepts_coins?: boolean | null
          api_key?: string
          bundle_price?: number | null
          created_at?: string
          current_period_revenue?: number | null
          id?: string
          installed_at?: string | null
          last_activity_at?: string | null
          last_revenue_sync?: string | null
          last_seen?: string | null
          lifetime_revenue?: number | null
          location_id?: string | null
          machine_code?: string
          machine_type?: string
          name?: string
          notes?: string | null
          plays_per_bundle?: number | null
          price_per_play?: number | null
          pricing_template_id?: string | null
          status?: string
          total_plays?: number | null
          total_vends?: number | null
          updated_at?: string
          vendx_pay_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_pricing_template"
            columns: ["pricing_template_id"]
            isOneToOne: false
            referencedRelation: "arcade_pricing_templates"
            referencedColumns: ["id"]
          },
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
          epic_games_store_url: string | null
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
          release_date: string | null
          release_status: string
          roblox_url: string | null
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
          epic_games_store_url?: string | null
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
          release_date?: string | null
          release_status?: string
          roblox_url?: string | null
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
          epic_games_store_url?: string | null
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
          release_date?: string | null
          release_status?: string
          roblox_url?: string | null
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
          reference_id: string | null
          status: string | null
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
          reference_id?: string | null
          status?: string | null
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
          reference_id?: string | null
          status?: string | null
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
          child_name: string | null
          created_at: string
          daily_limit: number | null
          guest_expires_at: string | null
          id: string
          is_guest: boolean | null
          last_loaded: string | null
          parent_wallet_id: string | null
          spending_limit_per_transaction: number | null
          status: string
          updated_at: string
          user_id: string
          wallet_type: string
        }
        Insert: {
          balance?: number
          child_name?: string | null
          created_at?: string
          daily_limit?: number | null
          guest_expires_at?: string | null
          id?: string
          is_guest?: boolean | null
          last_loaded?: string | null
          parent_wallet_id?: string | null
          spending_limit_per_transaction?: number | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_type?: string
        }
        Update: {
          balance?: number
          child_name?: string | null
          created_at?: string
          daily_limit?: number | null
          guest_expires_at?: string | null
          id?: string
          is_guest?: boolean | null
          last_loaded?: string | null
          parent_wallet_id?: string | null
          spending_limit_per_transaction?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          wallet_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_parent_wallet_id_fkey"
            columns: ["parent_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_tickets: {
        Args: {
          p_amount: number
          p_game_name?: string
          p_idempotency_key?: string
          p_machine_id: string
          p_metadata?: Json
          p_score?: number
          p_session_id: string
          p_user_id: string
        }
        Returns: {
          message: string
          new_balance: number
          success: boolean
          transaction_id: string
        }[]
      }
      calculate_quest_level: { Args: { xp: number }; Returns: number }
      check_wallet_spending_limits: {
        Args: { p_amount: number; p_wallet_id: string }
        Returns: {
          allowed: boolean
          reason: string
          remaining_daily: number
        }[]
      }
      complete_redemption: {
        Args: { p_redemption_id: string; p_staff_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      generate_totp_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_player_xp: {
        Args: { p_user_id: string; p_xp: number }
        Returns: undefined
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_machine_activity: {
        Args: {
          p_activity_type: string
          p_amount?: number
          p_credits_used?: number
          p_item_name?: string
          p_machine_id: string
          p_metadata?: Json
          p_session_id?: string
          p_user_id?: string
        }
        Returns: string
      }
      process_ticket_redemption: {
        Args: {
          p_location_id?: string
          p_prize_id: string
          p_redemption_type?: string
          p_shipping_address_id?: string
          p_user_id: string
        }
        Returns: {
          message: string
          new_balance: number
          redemption_code: string
          redemption_id: string
          success: boolean
        }[]
      }
      redeem_tickets: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_reason?: string
          p_user_id: string
        }
        Returns: {
          message: string
          new_balance: number
          success: boolean
          transaction_id: string
        }[]
      }
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
      quest_completion_status:
        | "in_progress"
        | "completed"
        | "claimed"
        | "expired"
      quest_node_rarity: "common" | "rare" | "epic" | "legendary"
      quest_status: "active" | "inactive" | "scheduled" | "expired"
      quest_type: "free" | "game" | "paid" | "order"
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
      quest_completion_status: [
        "in_progress",
        "completed",
        "claimed",
        "expired",
      ],
      quest_node_rarity: ["common", "rare", "epic", "legendary"],
      quest_status: ["active", "inactive", "scheduled", "expired"],
      quest_type: ["free", "game", "paid", "order"],
    },
  },
} as const
