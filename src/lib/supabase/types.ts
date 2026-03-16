export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          avatar_url: string | null
          push_subscription: Json | null
          notify_expiry_days: number
          notify_low_qty: boolean
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          avatar_url?: string | null
          push_subscription?: Json | null
          notify_expiry_days?: number
          notify_low_qty?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          avatar_url?: string | null
          push_subscription?: Json | null
          notify_expiry_days?: number
          notify_low_qty?: boolean
          created_at?: string
        }
      }
      households: {
        Row: {
          id: string
          name: string
          icon: string
          owner_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          icon?: string
          owner_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string
          owner_id?: string | null
          created_at?: string
        }
      }
      household_members: {
        Row: {
          id: string
          household_id: string
          user_id: string
          role: 'owner' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
      }
      invites: {
        Row: {
          id: string
          household_id: string
          token: string
          created_by: string | null
          expires_at: string
          used_by: string | null
          used_at: string | null
        }
        Insert: {
          id?: string
          household_id: string
          token: string
          created_by?: string | null
          expires_at?: string
          used_by?: string | null
          used_at?: string | null
        }
        Update: {
          id?: string
          household_id?: string
          token?: string
          created_by?: string | null
          expires_at?: string
          used_by?: string | null
          used_at?: string | null
        }
      }
      medicines: {
        Row: {
          id: string
          household_id: string
          name: string
          substance: string | null
          purpose: string | null
          category: string | null
          form: string | null
          quantity: number
          quantity_unit: string
          low_qty_threshold: number
          location: string | null
          expires_at: string | null
          barcode: string | null
          notes: string | null
          added_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          substance?: string | null
          purpose?: string | null
          category?: string | null
          form?: string | null
          quantity?: number
          quantity_unit?: string
          low_qty_threshold?: number
          location?: string | null
          expires_at?: string | null
          barcode?: string | null
          notes?: string | null
          added_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          substance?: string | null
          purpose?: string | null
          category?: string | null
          form?: string | null
          quantity?: number
          quantity_unit?: string
          low_qty_threshold?: number
          location?: string | null
          expires_at?: string | null
          barcode?: string | null
          notes?: string | null
          added_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      medicine_log: {
        Row: {
          id: string
          medicine_id: string
          household_id: string | null
          user_id: string | null
          action: 'added' | 'updated' | 'taken' | 'removed' | 'expired'
          quantity_change: number | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          medicine_id: string
          household_id?: string | null
          user_id?: string | null
          action: 'added' | 'updated' | 'taken' | 'removed' | 'expired'
          quantity_change?: number | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          medicine_id?: string
          household_id?: string | null
          user_id?: string | null
          action?: 'added' | 'updated' | 'taken' | 'removed' | 'expired'
          quantity_change?: number | null
          note?: string | null
          created_at?: string
        }
      }
      medicine_catalog: {
        Row: {
          id: string
          query: string
          name: string
          substance: string | null
          purpose: string | null
          category: string | null
          form: string | null
          typical_quantity_unit: string | null
          created_at: string
        }
        Insert: {
          id?: string
          query: string
          name: string
          substance?: string | null
          purpose?: string | null
          category?: string | null
          form?: string | null
          typical_quantity_unit?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          query?: string
          name?: string
          substance?: string | null
          purpose?: string | null
          category?: string | null
          form?: string | null
          typical_quantity_unit?: string | null
          created_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Household = Database['public']['Tables']['households']['Row']
export type HouseholdMember = Database['public']['Tables']['household_members']['Row']
export type Invite = Database['public']['Tables']['invites']['Row']
export type Medicine = Database['public']['Tables']['medicines']['Row']
export type MedicineLog = Database['public']['Tables']['medicine_log']['Row']
