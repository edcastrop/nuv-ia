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
      apoderados_nuvex: {
        Row: {
          activo: boolean
          bancos_asignados: string[]
          cedula: string
          celular: string | null
          ciudad: string | null
          correo: string | null
          created_at: string
          id: string
          lugar_expedicion: string | null
          nombre: string
          predeterminado_fna: boolean
          predeterminado_general: boolean
          updated_at: string
        }
        Insert: {
          activo?: boolean
          bancos_asignados?: string[]
          cedula: string
          celular?: string | null
          ciudad?: string | null
          correo?: string | null
          created_at?: string
          id?: string
          lugar_expedicion?: string | null
          nombre: string
          predeterminado_fna?: boolean
          predeterminado_general?: boolean
          updated_at?: string
        }
        Update: {
          activo?: boolean
          bancos_asignados?: string[]
          cedula?: string
          celular?: string | null
          ciudad?: string | null
          correo?: string | null
          created_at?: string
          id?: string
          lugar_expedicion?: string | null
          nombre?: string
          predeterminado_fna?: boolean
          predeterminado_general?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      contratacion_destinatarios: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          id?: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          id?: string
          nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      envios_contratacion: {
        Row: {
          asunto: string
          created_at: string
          destinatarios: string[]
          documentos: Json
          error: string | null
          estado_envio: string
          expediente_id: string
          id: string
          proveedor_message_id: string | null
          user_id: string | null
        }
        Insert: {
          asunto: string
          created_at?: string
          destinatarios?: string[]
          documentos?: Json
          error?: string | null
          estado_envio?: string
          expediente_id: string
          id?: string
          proveedor_message_id?: string | null
          user_id?: string | null
        }
        Update: {
          asunto?: string
          created_at?: string
          destinatarios?: string[]
          documentos?: Json
          error?: string | null
          estado_envio?: string
          expediente_id?: string
          id?: string
          proveedor_message_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "envios_contratacion_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      expediente_historial: {
        Row: {
          created_at: string
          estado_anterior:
            | Database["public"]["Enums"]["expediente_estado"]
            | null
          estado_nuevo: Database["public"]["Enums"]["expediente_estado"]
          expediente_id: string
          id: string
          nota: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          estado_anterior?:
            | Database["public"]["Enums"]["expediente_estado"]
            | null
          estado_nuevo: Database["public"]["Enums"]["expediente_estado"]
          expediente_id: string
          id?: string
          nota?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          estado_anterior?:
            | Database["public"]["Enums"]["expediente_estado"]
            | null
          estado_nuevo?: Database["public"]["Enums"]["expediente_estado"]
          expediente_id?: string
          id?: string
          nota?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expediente_historial_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      expediente_maestro: {
        Row: {
          apoderado: Json
          asesor: Json
          asesor_id: string
          cedula_cliente: string | null
          cliente: Json
          cotitular: Json
          created_at: string
          credito: Json
          fresh: Json
          id: string
          licenciado: Json
          nombre_cliente: string
          updated_at: string
        }
        Insert: {
          apoderado?: Json
          asesor?: Json
          asesor_id: string
          cedula_cliente?: string | null
          cliente?: Json
          cotitular?: Json
          created_at?: string
          credito?: Json
          fresh?: Json
          id?: string
          licenciado?: Json
          nombre_cliente?: string
          updated_at?: string
        }
        Update: {
          apoderado?: Json
          asesor?: Json
          asesor_id?: string
          cedula_cliente?: string | null
          cliente?: Json
          cotitular?: Json
          created_at?: string
          credito?: Json
          fresh?: Json
          id?: string
          licenciado?: Json
          nombre_cliente?: string
          updated_at?: string
        }
        Relationships: []
      }
      expedientes: {
        Row: {
          acertividad_global: number | null
          aprobado_data: Json | null
          asesor_id: string
          banco: string | null
          cedula: string | null
          cliente_data: Json
          cliente_nombre: string
          created_at: string
          credito_data: Json
          descuento: number | null
          discount_data: Json
          estado: Database["public"]["Enums"]["expediente_estado"]
          fecha_simulacion: string
          honorarios_base: number | null
          honorarios_final: number | null
          id: string
          modo: Database["public"]["Enums"]["expediente_modo"]
          numero_credito: string | null
          producto: string | null
          propuesta_data: Json
          updated_at: string
        }
        Insert: {
          acertividad_global?: number | null
          aprobado_data?: Json | null
          asesor_id: string
          banco?: string | null
          cedula?: string | null
          cliente_data?: Json
          cliente_nombre: string
          created_at?: string
          credito_data?: Json
          descuento?: number | null
          discount_data?: Json
          estado?: Database["public"]["Enums"]["expediente_estado"]
          fecha_simulacion?: string
          honorarios_base?: number | null
          honorarios_final?: number | null
          id?: string
          modo: Database["public"]["Enums"]["expediente_modo"]
          numero_credito?: string | null
          producto?: string | null
          propuesta_data?: Json
          updated_at?: string
        }
        Update: {
          acertividad_global?: number | null
          aprobado_data?: Json | null
          asesor_id?: string
          banco?: string | null
          cedula?: string | null
          cliente_data?: Json
          cliente_nombre?: string
          created_at?: string
          credito_data?: Json
          descuento?: number | null
          discount_data?: Json
          estado?: Database["public"]["Enums"]["expediente_estado"]
          fecha_simulacion?: string
          honorarios_base?: number | null
          honorarios_final?: number | null
          id?: string
          modo?: Database["public"]["Enums"]["expediente_modo"]
          numero_credito?: string | null
          producto?: string | null
          propuesta_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string | null
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
      app_role:
        | "admin"
        | "asesor"
        | "gerencia"
        | "licenciado"
        | "super_admin"
        | "juridica"
        | "operaciones"
        | "cartera"
      expediente_estado:
        | "SIMULADO"
        | "FIRMADO"
        | "RADICADO"
        | "APROBADO"
        | "FACTURADO"
        | "PAGADO"
        | "ENVIADO_CONTRATACION"
      expediente_modo: "pesos" | "uvr"
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
        "admin",
        "asesor",
        "gerencia",
        "licenciado",
        "super_admin",
        "juridica",
        "operaciones",
        "cartera",
      ],
      expediente_estado: [
        "SIMULADO",
        "FIRMADO",
        "RADICADO",
        "APROBADO",
        "FACTURADO",
        "PAGADO",
        "ENVIADO_CONTRATACION",
      ],
      expediente_modo: ["pesos", "uvr"],
    },
  },
} as const
