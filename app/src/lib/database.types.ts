// Tipi generati a mano per lo schema in supabase/migrations/0001_init.sql.
// Una volta collegato un progetto reale, rigenerarli con:
//   supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type TripMemberRole = 'organizer' | 'member'
export type TripMemberStatus = 'invited' | 'joined'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; created_at: string }
        Insert: { id: string; display_name?: string }
        Update: { display_name?: string }
      }
      trips: {
        Row: {
          id: string
          name: string
          start_date: string | null
          end_date: string | null
          cover_color_id: string
          cover_photo_url: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          start_date?: string | null
          end_date?: string | null
          cover_color_id?: string
          cover_photo_url?: string | null
          created_by: string
        }
        Update: Partial<Database['public']['Tables']['trips']['Insert']>
      }
      trip_members: {
        Row: {
          id: string
          trip_id: string
          user_id: string | null
          display_name: string
          color: string
          emoji: string
          vibe: string
          role: TripMemberRole
          status: TripMemberStatus
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          user_id?: string | null
          display_name: string
          color?: string
          emoji?: string
          vibe?: string
          role?: TripMemberRole
          status?: TripMemberStatus
        }
        Update: Partial<Database['public']['Tables']['trip_members']['Insert']>
      }
      invites: {
        Row: { id: string; trip_id: string; code: string; created_at: string }
        Insert: { id?: string; trip_id: string; code: string }
        Update: Partial<Database['public']['Tables']['invites']['Insert']>
      }
      stops: {
        Row: {
          id: string
          trip_id: string
          name: string
          start_date: string
          end_date: string
          mood_id: string
          mood_line: string
          photo_url: string | null
          gradient: string | null
          highlight: boolean
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          name: string
          start_date: string
          end_date: string
          mood_id?: string
          mood_line?: string
          photo_url?: string | null
          gradient?: string | null
          highlight?: boolean
          position?: number
        }
        Update: Partial<Database['public']['Tables']['stops']['Insert']>
      }
      stop_stays: {
        Row: { id: string; stop_id: string; name: string; link: string; night_date: string | null; created_at: string }
        Insert: { id?: string; stop_id: string; name?: string; link?: string; night_date?: string | null }
        Update: Partial<Database['public']['Tables']['stop_stays']['Insert']>
      }
      stop_categories: {
        Row: { id: string; stop_id: string; icon: string; label: string; position: number; created_at: string }
        Insert: { id?: string; stop_id: string; icon?: string; label: string; position?: number }
        Update: Partial<Database['public']['Tables']['stop_categories']['Insert']>
      }
      stop_items: {
        Row: {
          id: string
          category_id: string
          label: string
          link: string
          starred: boolean
          item_date: string | null
          icon: string | null
          item_time: string | null
          useful_link: string
          booking: string
          notes: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          label: string
          link?: string
          starred?: boolean
          item_date?: string | null
          icon?: string | null
          item_time?: string | null
          useful_link?: string
          booking?: string
          notes?: string
          position?: number
        }
        Update: Partial<Database['public']['Tables']['stop_items']['Insert']>
      }
      stop_item_checklist: {
        Row: { id: string; item_id: string; label: string; done: boolean; position: number }
        Insert: { id?: string; item_id: string; label: string; done?: boolean; position?: number }
        Update: Partial<Database['public']['Tables']['stop_item_checklist']['Insert']>
      }
      schedule_orders: {
        Row: { trip_id: string; schedule_date: string; ordered_item_ids: string[]; updated_at: string }
        Insert: { trip_id: string; schedule_date: string; ordered_item_ids?: string[] }
        Update: Partial<Database['public']['Tables']['schedule_orders']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          trip_id: string
          title: string
          icon: string
          amount: number
          paid_by_member_id: string | null
          note: string
          expense_date: string
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          title: string
          icon?: string
          amount: number
          paid_by_member_id?: string | null
          note?: string
          expense_date?: string
        }
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      expense_splits: {
        Row: { expense_id: string; member_id: string }
        Insert: { expense_id: string; member_id: string }
        Update: Partial<Database['public']['Tables']['expense_splits']['Insert']>
      }
      settlements: {
        Row: { id: string; trip_id: string; from_member_id: string; to_member_id: string; amount: number; settlement_date: string; created_at: string }
        Insert: { id?: string; trip_id: string; from_member_id: string; to_member_id: string; amount: number; settlement_date?: string }
        Update: Partial<Database['public']['Tables']['settlements']['Insert']>
      }
      cassa_contributions: {
        Row: { id: string; trip_id: string; member_id: string; amount: number; contribution_date: string; created_at: string }
        Insert: { id?: string; trip_id: string; member_id: string; amount: number; contribution_date?: string }
        Update: Partial<Database['public']['Tables']['cassa_contributions']['Insert']>
      }
      checklist_categories: {
        Row: { id: string; trip_id: string; emoji: string; name: string; position: number; created_at: string }
        Insert: { id?: string; trip_id: string; emoji?: string; name: string; position?: number }
        Update: Partial<Database['public']['Tables']['checklist_categories']['Insert']>
      }
      checklist_items: {
        Row: { id: string; category_id: string; label: string; done: boolean; assignee_member_id: string | null; position: number; created_at: string }
        Insert: { id?: string; category_id: string; label: string; done?: boolean; assignee_member_id?: string | null; position?: number }
        Update: Partial<Database['public']['Tables']['checklist_items']['Insert']>
      }
      personal_checklist_sections: {
        Row: { id: string; trip_id: string; member_id: string; emoji: string; name: string; position: number; created_at: string }
        Insert: { id?: string; trip_id: string; member_id: string; emoji?: string; name: string; position?: number }
        Update: Partial<Database['public']['Tables']['personal_checklist_sections']['Insert']>
      }
      personal_checklist_items: {
        Row: { id: string; section_id: string; label: string; done: boolean; position: number; created_at: string }
        Insert: { id?: string; section_id: string; label: string; done?: boolean; position?: number }
        Update: Partial<Database['public']['Tables']['personal_checklist_items']['Insert']>
      }
      essentials_categories: {
        Row: { id: string; trip_id: string; emoji: string; name: string; gradient: string | null; position: number; created_at: string }
        Insert: { id?: string; trip_id: string; emoji?: string; name: string; gradient?: string | null; position?: number }
        Update: Partial<Database['public']['Tables']['essentials_categories']['Insert']>
      }
      essentials_entries: {
        Row: { id: string; category_id: string; title: string; subtitle: string; tag: string; href: string; attachment_url: string | null; position: number; created_at: string }
        Insert: { id?: string; category_id: string; title: string; subtitle?: string; tag?: string; href?: string; attachment_url?: string | null; position?: number }
        Update: Partial<Database['public']['Tables']['essentials_entries']['Insert']>
      }
      emergency_contacts: {
        Row: { id: string; trip_id: string; title: string; subtitle: string; href: string; position: number; created_at: string }
        Insert: { id?: string; trip_id: string; title: string; subtitle?: string; href?: string; position?: number }
        Update: Partial<Database['public']['Tables']['emergency_contacts']['Insert']>
      }
      trip_links: {
        Row: { id: string; trip_id: string; emoji: string; label: string; subtitle: string; url: string; position: number; created_at: string }
        Insert: { id?: string; trip_id: string; emoji?: string; label: string; subtitle?: string; url: string; position?: number }
        Update: Partial<Database['public']['Tables']['trip_links']['Insert']>
      }
      memory_days: {
        Row: { id: string; trip_id: string; label: string; memory_date: string; cover_url: string | null; position: number; created_at: string }
        Insert: { id?: string; trip_id: string; label: string; memory_date: string; cover_url?: string | null; position?: number }
        Update: Partial<Database['public']['Tables']['memory_days']['Insert']>
      }
      memories: {
        Row: {
          id: string
          trip_id: string
          day_id: string | null
          url: string
          is_video: boolean
          is_favorite: boolean
          caption: string
          author_member_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          day_id?: string | null
          url: string
          is_video?: boolean
          is_favorite?: boolean
          caption?: string
          author_member_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['memories']['Insert']>
      }
      activity_log: {
        Row: { id: string; trip_id: string; member_id: string | null; action: string; created_at: string }
        Insert: { id?: string; trip_id: string; member_id?: string | null; action: string }
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
      }
    }
  }
}
