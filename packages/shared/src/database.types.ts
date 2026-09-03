/**
 * Generated from the Supabase schema — do not edit by hand.
 * Regenerate after every migration with the Supabase MCP `generate_typescript_types`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          profile_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          profile_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          profile_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversation_participants_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversation_participants_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_body: string | null
          last_message_sender_id: string | null
          pair_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_body?: string | null
          last_message_sender_id?: string | null
          pair_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_body?: string | null
          last_message_sender_id?: string | null
          pair_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_last_message_sender_id_fkey'
            columns: ['last_message_sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      material_steps: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          material_id: string
          position: number
          title: string | null
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          material_id: string
          position: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          material_id?: string
          position?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'material_steps_material_id_fkey'
            columns: ['material_id']
            isOneToOne: false
            referencedRelation: 'materials'
            referencedColumns: ['id']
          },
        ]
      }
      materials: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          estimated_minutes: number | null
          id: string
          level: Database['public']['Enums']['cefr_level']
          owner_id: string
          source_material_id: string | null
          status: Database['public']['Enums']['material_status']
          tags: string[]
          title: string
          updated_at: string
          visibility: Database['public']['Enums']['material_visibility']
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          level: Database['public']['Enums']['cefr_level']
          owner_id: string
          source_material_id?: string | null
          status?: Database['public']['Enums']['material_status']
          tags?: string[]
          title: string
          updated_at?: string
          visibility?: Database['public']['Enums']['material_visibility']
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          level?: Database['public']['Enums']['cefr_level']
          owner_id?: string
          source_material_id?: string | null
          status?: Database['public']['Enums']['material_status']
          tags?: string[]
          title?: string
          updated_at?: string
          visibility?: Database['public']['Enums']['material_visibility']
        }
        Relationships: [
          {
            foreignKeyName: 'materials_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'materials_source_material_id_fkey'
            columns: ['source_material_id']
            isOneToOne: false
            referencedRelation: 'materials'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      lesson_attendees: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          note: string | null
          status: Database['public']['Enums']['attendance_status']
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          note?: string | null
          status?: Database['public']['Enums']['attendance_status']
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          note?: string | null
          status?: Database['public']['Enums']['attendance_status']
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lesson_attendees_lesson_id_fkey'
            columns: ['lesson_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lesson_attendees_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          scheduled_at: string
          status: Database['public']['Enums']['lesson_status']
          teacher_id: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          scheduled_at: string
          status?: Database['public']['Enums']['lesson_status']
          teacher_id: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          scheduled_at?: string
          status?: Database['public']['Enums']['lesson_status']
          teacher_id?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lessons_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      platform_settings: {
        Row: {
          brand_color: string
          default_locale: string
          id: boolean
          monthly_price_amount: number | null
          monthly_price_currency: string
          trial_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand_color?: string
          default_locale?: string
          id?: boolean
          monthly_price_amount?: number | null
          monthly_price_currency?: string
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand_color?: string
          default_locale?: string
          id?: boolean
          monthly_price_amount?: number | null
          monthly_price_currency?: string
          trial_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'platform_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          locale: string
          role: Database['public']['Enums']['user_role']
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          locale?: string
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          locale?: string
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          profile_id: string
          type: Database['public']['Enums']['subscription_event_type']
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          profile_id: string
          type: Database['public']['Enums']['subscription_event_type']
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          profile_id?: string
          type?: Database['public']['Enums']['subscription_event_type']
        }
        Relationships: [
          {
            foreignKeyName: 'subscription_events_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'subscription_events_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      teacher_students: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          status: Database['public']['Enums']['teacher_student_status']
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          status?: Database['public']['Enums']['teacher_student_status']
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          status?: Database['public']['Enums']['teacher_student_status']
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_students_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_students_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      subscriptions: {
        Row: {
          access_ends_at: string | null
          created_at: string
          current_period_end: string | null
          profile_id: string
          status: Database['public']['Enums']['subscription_status']
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          access_ends_at?: string | null
          created_at?: string
          current_period_end?: string | null
          profile_id: string
          status?: Database['public']['Enums']['subscription_status']
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          access_ends_at?: string | null
          created_at?: string
          current_period_end?: string | null
          profile_id?: string
          status?: Database['public']['Enums']['subscription_status']
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reorder_material_steps: {
        Args: { ids: string[]; material: string }
        Returns: undefined
      }
    }
    Enums: {
      attendance_status: 'expected' | 'present' | 'absent' | 'excused'
      cefr_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
      lesson_status: 'scheduled' | 'held' | 'canceled'
      material_status: 'draft' | 'published'
      material_visibility: 'platform' | 'private'
      subscription_event_type:
        'trial_started' | 'extended' | 'suspended' | 'reactivated' | 'canceled'
      subscription_status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled'
      teacher_student_status: 'active' | 'ended'
      user_role: 'admin' | 'teacher' | 'student'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attendance_status: ['expected', 'present', 'absent', 'excused'],
      cefr_level: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      lesson_status: ['scheduled', 'held', 'canceled'],
      material_status: ['draft', 'published'],
      material_visibility: ['platform', 'private'],
      subscription_event_type: [
        'trial_started',
        'extended',
        'suspended',
        'reactivated',
        'canceled',
      ],
      subscription_status: ['trialing', 'active', 'past_due', 'suspended', 'canceled'],
      teacher_student_status: ['active', 'ended'],
      user_role: ['admin', 'teacher', 'student'],
    },
  },
} as const
