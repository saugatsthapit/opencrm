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
      leads: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          email: string | null
          mobile_phone1: string | null
          mobile_phone2: string | null
          title: string | null
          linkedin: string | null
          location: string | null
          company_name: string | null
          company_domain: string | null
          company_website: string | null
          company_employee_count: number | null
          company_employee_count_range: string | null
          company_founded: number | null
          company_industry: string | null
          company_type: string | null
          company_headquarters: string | null
          company_revenue_range: string | null
          company_linkedin_url: string | null
          created_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          mobile_phone1?: string | null
          mobile_phone2?: string | null
          title?: string | null
          linkedin?: string | null
          location?: string | null
          company_name?: string | null
          company_domain?: string | null
          company_website?: string | null
          company_employee_count?: number | null
          company_employee_count_range?: string | null
          company_founded?: number | null
          company_industry?: string | null
          company_type?: string | null
          company_headquarters?: string | null
          company_revenue_range?: string | null
          company_linkedin_url?: string | null
          created_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          mobile_phone1?: string | null
          mobile_phone2?: string | null
          title?: string | null
          linkedin?: string | null
          location?: string | null
          company_name?: string | null
          company_domain?: string | null
          company_website?: string | null
          company_employee_count?: number | null
          company_employee_count_range?: string | null
          company_founded?: number | null
          company_industry?: string | null
          company_type?: string | null
          company_headquarters?: string | null
          company_revenue_range?: string | null
          company_linkedin_url?: string | null
          created_at?: string | null
          user_id?: string | null
        }
      }
      sequences: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string | null
          user_id?: string | null
        }
      }
      sequence_steps: {
        Row: {
          id: string
          sequence_id: string | null
          step_type: string
          step_order: number
          configuration: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          sequence_id?: string | null
          step_type: string
          step_order: number
          configuration?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          sequence_id?: string | null
          step_type?: string
          step_order?: number
          configuration?: Json | null
          created_at?: string | null
        }
      }
      lead_sequences: {
        Row: {
          id: string
          lead_id: string | null
          sequence_id: string | null
          current_step: number | null
          status: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lead_id?: string | null
          sequence_id?: string | null
          current_step?: number | null
          status?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string | null
          sequence_id?: string | null
          current_step?: number | null
          status?: string | null
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}