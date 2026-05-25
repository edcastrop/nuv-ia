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
      brand_config: {
        Row: {
          color_azul: string
          color_negro: string
          color_verde: string
          correo_contratacion: string
          correo_juridica: string
          direccion_bogota: string
          direccion_bucaramanga: string
          id: boolean
          logo_url: string
          nombre_comercial: string
          sitio_web: string
          tagline: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color_azul?: string
          color_negro?: string
          color_verde?: string
          correo_contratacion?: string
          correo_juridica?: string
          direccion_bogota?: string
          direccion_bucaramanga?: string
          id?: boolean
          logo_url?: string
          nombre_comercial?: string
          sitio_web?: string
          tagline?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color_azul?: string
          color_negro?: string
          color_verde?: string
          correo_contratacion?: string
          correo_juridica?: string
          direccion_bogota?: string
          direccion_bucaramanga?: string
          id?: boolean
          logo_url?: string
          nombre_comercial?: string
          sitio_web?: string
          tagline?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cartera: {
        Row: {
          created_at: string
          created_by: string | null
          estado_cartera: Database["public"]["Enums"]["cartera_estado"]
          expediente_id: string
          fecha_aplicacion_banco: string
          fecha_cuenta_cobro: string | null
          fecha_resultado_final: string | null
          fecha_vencimiento: string
          forma_pago: string
          honorarios_totales: number
          id: string
          observaciones: string | null
          pagado: number
          responsable_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estado_cartera?: Database["public"]["Enums"]["cartera_estado"]
          expediente_id: string
          fecha_aplicacion_banco: string
          fecha_cuenta_cobro?: string | null
          fecha_resultado_final?: string | null
          fecha_vencimiento: string
          forma_pago?: string
          honorarios_totales?: number
          id?: string
          observaciones?: string | null
          pagado?: number
          responsable_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estado_cartera?: Database["public"]["Enums"]["cartera_estado"]
          expediente_id?: string
          fecha_aplicacion_banco?: string
          fecha_cuenta_cobro?: string | null
          fecha_resultado_final?: string | null
          fecha_vencimiento?: string
          forma_pago?: string
          honorarios_totales?: number
          id?: string
          observaciones?: string | null
          pagado?: number
          responsable_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cartera_acuerdos: {
        Row: {
          cartera_id: string
          created_at: string
          estado: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          numero_cuotas: number
          observaciones: string | null
          user_id: string | null
          valor_total: number
        }
        Insert: {
          cartera_id: string
          created_at?: string
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          numero_cuotas: number
          observaciones?: string | null
          user_id?: string | null
          valor_total: number
        }
        Update: {
          cartera_id?: string
          created_at?: string
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          numero_cuotas?: number
          observaciones?: string | null
          user_id?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartera_acuerdos_cartera_id_fkey"
            columns: ["cartera_id"]
            isOneToOne: false
            referencedRelation: "cartera"
            referencedColumns: ["id"]
          },
        ]
      }
      cartera_auditoria: {
        Row: {
          accion: string
          canal: string | null
          cartera_id: string
          created_at: string
          id: string
          observacion: string | null
          user_id: string | null
        }
        Insert: {
          accion: string
          canal?: string | null
          cartera_id: string
          created_at?: string
          id?: string
          observacion?: string | null
          user_id?: string | null
        }
        Update: {
          accion?: string
          canal?: string | null
          cartera_id?: string
          created_at?: string
          id?: string
          observacion?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cartera_auditoria_cartera_id_fkey"
            columns: ["cartera_id"]
            isOneToOne: false
            referencedRelation: "cartera"
            referencedColumns: ["id"]
          },
        ]
      }
      cartera_comunicaciones: {
        Row: {
          asunto: string | null
          body: string | null
          canal: string
          cartera_id: string
          created_at: string
          destinatario: string | null
          estado: string
          id: string
          proveedor_msg_id: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          asunto?: string | null
          body?: string | null
          canal: string
          cartera_id: string
          created_at?: string
          destinatario?: string | null
          estado?: string
          id?: string
          proveedor_msg_id?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          asunto?: string | null
          body?: string | null
          canal?: string
          cartera_id?: string
          created_at?: string
          destinatario?: string | null
          estado?: string
          id?: string
          proveedor_msg_id?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cartera_comunicaciones_cartera_id_fkey"
            columns: ["cartera_id"]
            isOneToOne: false
            referencedRelation: "cartera"
            referencedColumns: ["id"]
          },
        ]
      }
      cartera_cuotas: {
        Row: {
          cartera_id: string
          created_at: string
          estado: string
          fecha_vencimiento: string
          id: string
          numero: number
          pagado: number
          valor: number
        }
        Insert: {
          cartera_id: string
          created_at?: string
          estado?: string
          fecha_vencimiento: string
          id?: string
          numero: number
          pagado?: number
          valor: number
        }
        Update: {
          cartera_id?: string
          created_at?: string
          estado?: string
          fecha_vencimiento?: string
          id?: string
          numero?: number
          pagado?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartera_cuotas_cartera_id_fkey"
            columns: ["cartera_id"]
            isOneToOne: false
            referencedRelation: "cartera"
            referencedColumns: ["id"]
          },
        ]
      }
      cartera_pagos: {
        Row: {
          banco_receptor: string | null
          cartera_id: string
          comprobante_num: string | null
          comprobante_url: string | null
          created_at: string
          fecha: string
          id: string
          metodo: string | null
          observaciones: string | null
          user_id: string | null
          valor: number
        }
        Insert: {
          banco_receptor?: string | null
          cartera_id: string
          comprobante_num?: string | null
          comprobante_url?: string | null
          created_at?: string
          fecha?: string
          id?: string
          metodo?: string | null
          observaciones?: string | null
          user_id?: string | null
          valor: number
        }
        Update: {
          banco_receptor?: string | null
          cartera_id?: string
          comprobante_num?: string | null
          comprobante_url?: string | null
          created_at?: string
          fecha?: string
          id?: string
          metodo?: string | null
          observaciones?: string | null
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartera_pagos_cartera_id_fkey"
            columns: ["cartera_id"]
            isOneToOne: false
            referencedRelation: "cartera"
            referencedColumns: ["id"]
          },
        ]
      }
      caso_alertas: {
        Row: {
          created_at: string
          dias_estancado: number
          expediente_id: string
          id: string
          leida: boolean
          tipo: string
        }
        Insert: {
          created_at?: string
          dias_estancado?: number
          expediente_id: string
          id?: string
          leida?: boolean
          tipo: string
        }
        Update: {
          created_at?: string
          dias_estancado?: number
          expediente_id?: string
          id?: string
          leida?: boolean
          tipo?: string
        }
        Relationships: []
      }
      caso_submotivos: {
        Row: {
          created_at: string
          estado: string
          expediente_id: string
          id: string
          observacion: string | null
          submotivo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          estado: string
          expediente_id: string
          id?: string
          observacion?: string | null
          submotivo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          estado?: string
          expediente_id?: string
          id?: string
          observacion?: string | null
          submotivo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      comisiones: {
        Row: {
          base: number
          created_at: string
          cuenta_cobro_id: string | null
          estado: string
          expediente_id: string
          id: string
          porcentaje: number
          rol: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          base?: number
          created_at?: string
          cuenta_cobro_id?: string | null
          estado?: string
          expediente_id: string
          id?: string
          porcentaje?: number
          rol?: string
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          base?: number
          created_at?: string
          cuenta_cobro_id?: string | null
          estado?: string
          expediente_id?: string
          id?: string
          porcentaje?: number
          rol?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      comisiones_reglas: {
        Row: {
          activo: boolean
          banco: string | null
          created_at: string
          id: string
          porcentaje: number
          rol: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          banco?: string | null
          created_at?: string
          id?: string
          porcentaje?: number
          rol?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          banco?: string | null
          created_at?: string
          id?: string
          porcentaje?: number
          rol?: string
          updated_at?: string
          user_id?: string | null
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
      cuentas_cobro: {
        Row: {
          created_at: string
          estado: string
          fecha_aprobacion: string | null
          fecha_envio: string | null
          fecha_pago: string | null
          id: string
          numero: string
          observaciones: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_aprobacion?: string | null
          fecha_envio?: string | null
          fecha_pago?: string | null
          id?: string
          numero?: string
          observaciones?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_aprobacion?: string | null
          fecha_envio?: string | null
          fecha_pago?: string | null
          id?: string
          numero?: string
          observaciones?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cuentas_cobro_historial: {
        Row: {
          accion: string
          created_at: string
          cuenta_cobro_id: string
          id: string
          observacion: string | null
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          cuenta_cobro_id: string
          id?: string
          observacion?: string | null
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          cuenta_cobro_id?: string
          id?: string
          observacion?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_cobro_historial_cuenta_cobro_id_fkey"
            columns: ["cuenta_cobro_id"]
            isOneToOne: false
            referencedRelation: "cuentas_cobro"
            referencedColumns: ["id"]
          },
        ]
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
          accion_origen: string | null
          created_at: string
          estado_anterior:
            | Database["public"]["Enums"]["expediente_estado"]
            | null
          estado_caso_anterior:
            | Database["public"]["Enums"]["caso_estado"]
            | null
          estado_caso_nuevo: Database["public"]["Enums"]["caso_estado"] | null
          estado_nuevo: Database["public"]["Enums"]["expediente_estado"] | null
          expediente_id: string
          id: string
          nota: string | null
          observacion: string | null
          user_id: string | null
        }
        Insert: {
          accion_origen?: string | null
          created_at?: string
          estado_anterior?:
            | Database["public"]["Enums"]["expediente_estado"]
            | null
          estado_caso_anterior?:
            | Database["public"]["Enums"]["caso_estado"]
            | null
          estado_caso_nuevo?: Database["public"]["Enums"]["caso_estado"] | null
          estado_nuevo?: Database["public"]["Enums"]["expediente_estado"] | null
          expediente_id: string
          id?: string
          nota?: string | null
          observacion?: string | null
          user_id?: string | null
        }
        Update: {
          accion_origen?: string | null
          created_at?: string
          estado_anterior?:
            | Database["public"]["Enums"]["expediente_estado"]
            | null
          estado_caso_anterior?:
            | Database["public"]["Enums"]["caso_estado"]
            | null
          estado_caso_nuevo?: Database["public"]["Enums"]["caso_estado"] | null
          estado_nuevo?: Database["public"]["Enums"]["expediente_estado"] | null
          expediente_id?: string
          id?: string
          nota?: string | null
          observacion?: string | null
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
          estado_caso: Database["public"]["Enums"]["caso_estado"]
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
          estado_caso?: Database["public"]["Enums"]["caso_estado"]
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
          estado_caso?: Database["public"]["Enums"]["caso_estado"]
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
      extractos_lecturas: {
        Row: {
          aprobado_por: string | null
          archivo_nombre: string | null
          archivo_path: string | null
          asesor_id: string
          banco: string | null
          confianza_global: number
          created_at: string
          datos: Json
          estado: string
          expediente_id: string | null
          id: string
          moneda: string | null
          motor_version: string
          notas: string | null
          producto: string | null
          scores: Json
          updated_at: string
        }
        Insert: {
          aprobado_por?: string | null
          archivo_nombre?: string | null
          archivo_path?: string | null
          asesor_id?: string
          banco?: string | null
          confianza_global?: number
          created_at?: string
          datos?: Json
          estado?: string
          expediente_id?: string | null
          id?: string
          moneda?: string | null
          motor_version?: string
          notas?: string | null
          producto?: string | null
          scores?: Json
          updated_at?: string
        }
        Update: {
          aprobado_por?: string | null
          archivo_nombre?: string | null
          archivo_path?: string | null
          asesor_id?: string
          banco?: string | null
          confianza_global?: number
          created_at?: string
          datos?: Json
          estado?: string
          expediente_id?: string | null
          id?: string
          moneda?: string | null
          motor_version?: string
          notas?: string | null
          producto?: string | null
          scores?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string | null
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
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
      can_manage_cartera: { Args: { _uid: string }; Returns: boolean }
      can_view_cartera_row: {
        Args: { _exp_id: string; _uid: string }
        Returns: boolean
      }
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
        | "contabilidad"
      cartera_estado:
        | "pendiente_cobro"
        | "cuenta_cobro_generada"
        | "cuenta_cobro_enviada"
        | "pago_parcial"
        | "pago_total"
        | "vencido"
        | "acuerdo_pago"
        | "en_seguimiento"
        | "prejuridico"
        | "cerrado"
      caso_estado:
        | "lead_creado"
        | "extracto_recibido"
        | "simulacion_realizada"
        | "propuesta_presentada"
        | "negociacion"
        | "pendiente_contratacion"
        | "enviado_contratacion"
        | "contrato_enviado"
        | "contrato_firmado"
        | "poder_firmado"
        | "radicacion_pendiente"
        | "radicado_banco"
        | "en_estudio_banco"
        | "aprobado"
        | "documentos_banco_firmados"
        | "condiciones_aplicadas"
        | "resultado_final_generado"
        | "cuenta_cobro_generada"
        | "cuenta_cobro_enviada"
        | "honorarios_pagados"
        | "paz_y_salvo_generado"
        | "proceso_cerrado"
        | "prejuridico"
        | "simulado"
        | "prospecto"
        | "propuesta_enviada"
        | "acepto_propuesta"
        | "documentacion_completa"
        | "contrato_generado"
        | "poder_generado"
        | "radicacion_preparada"
        | "aprobado_banco"
        | "docs_complementarios_banco"
        | "aplicado_banco"
        | "honorarios_pendientes"
        | "caso_finalizado"
        | "devuelto_banco"
        | "negado_banco"
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
        "contabilidad",
      ],
      cartera_estado: [
        "pendiente_cobro",
        "cuenta_cobro_generada",
        "cuenta_cobro_enviada",
        "pago_parcial",
        "pago_total",
        "vencido",
        "acuerdo_pago",
        "en_seguimiento",
        "prejuridico",
        "cerrado",
      ],
      caso_estado: [
        "lead_creado",
        "extracto_recibido",
        "simulacion_realizada",
        "propuesta_presentada",
        "negociacion",
        "pendiente_contratacion",
        "enviado_contratacion",
        "contrato_enviado",
        "contrato_firmado",
        "poder_firmado",
        "radicacion_pendiente",
        "radicado_banco",
        "en_estudio_banco",
        "aprobado",
        "documentos_banco_firmados",
        "condiciones_aplicadas",
        "resultado_final_generado",
        "cuenta_cobro_generada",
        "cuenta_cobro_enviada",
        "honorarios_pagados",
        "paz_y_salvo_generado",
        "proceso_cerrado",
        "prejuridico",
        "simulado",
        "prospecto",
        "propuesta_enviada",
        "acepto_propuesta",
        "documentacion_completa",
        "contrato_generado",
        "poder_generado",
        "radicacion_preparada",
        "aprobado_banco",
        "docs_complementarios_banco",
        "aplicado_banco",
        "honorarios_pendientes",
        "caso_finalizado",
        "devuelto_banco",
        "negado_banco",
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
