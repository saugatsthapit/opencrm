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
          company_name: string | null
          email: string | null
          phone: string | null
          mobile_phone1: string | null
          mobile_phone2: string | null
          title: string | null
          created_at: string
          called: boolean
        }
        Insert: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          company_name?: string | null
          email?: string | null
          phone?: string | null
          mobile_phone1?: string | null
          mobile_phone2?: string | null
          title?: string | null
          created_at?: string
          called?: boolean
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          company_name?: string | null
          email?: string | null
          phone?: string | null
          mobile_phone1?: string | null
          mobile_phone2?: string | null
          title?: string | null
          created_at?: string
          called?: boolean
        }
      }
      call_scripts: {
        Row: {
          id: string
          name: string
          greeting: string
          introduction: string
          talking_points: string[]
          questions: string[]
          closing: string
          voice?: string
          ai_model?: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          greeting: string
          introduction: string
          talking_points: string[]
          questions: string[]
          closing: string
          voice?: string
          ai_model?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          greeting?: string
          introduction?: string
          talking_points?: string[]
          questions?: string[]
          closing?: string
          voice?: string
          ai_model?: string
          created_at?: string
        }
      }
    }
  }
} 