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
      academia_certificaciones: {
        Row: {
          codigo: string
          curso_id: string
          emitida_at: string
          id: string
          nota_final: number
          user_id: string
        }
        Insert: {
          codigo: string
          curso_id: string
          emitida_at?: string
          id?: string
          nota_final?: number
          user_id: string
        }
        Update: {
          codigo?: string
          curso_id?: string
          emitida_at?: string
          id?: string
          nota_final?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_certificaciones_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "academia_cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_cursos: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          orden: number
          rol_destino: Database["public"]["Enums"]["academia_rol"]
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          orden?: number
          rol_destino: Database["public"]["Enums"]["academia_rol"]
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          orden?: number
          rol_destino?: Database["public"]["Enums"]["academia_rol"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      academia_evaluaciones: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          intentos_permitidos: number
          modulo_id: string
          nota_minima: number
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          intentos_permitidos?: number
          modulo_id: string
          nota_minima?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          intentos_permitidos?: number
          modulo_id?: string
          nota_minima?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_evaluaciones_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "academia_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_intentos: {
        Row: {
          aprobado: boolean
          created_at: string
          evaluacion_id: string
          id: string
          nota: number
          porcentaje: number
          respuestas: Json
          user_id: string
        }
        Insert: {
          aprobado?: boolean
          created_at?: string
          evaluacion_id: string
          id?: string
          nota?: number
          porcentaje?: number
          respuestas?: Json
          user_id: string
        }
        Update: {
          aprobado?: boolean
          created_at?: string
          evaluacion_id?: string
          id?: string
          nota?: number
          porcentaje?: number
          respuestas?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_intentos_evaluacion_id_fkey"
            columns: ["evaluacion_id"]
            isOneToOne: false
            referencedRelation: "academia_evaluaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_lecciones: {
        Row: {
          activo: boolean
          contenido: Json
          created_at: string
          duracion_min: number
          id: string
          modulo_id: string
          orden: number
          tipo: Database["public"]["Enums"]["leccion_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contenido?: Json
          created_at?: string
          duracion_min?: number
          id?: string
          modulo_id: string
          orden?: number
          tipo?: Database["public"]["Enums"]["leccion_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contenido?: Json
          created_at?: string
          duracion_min?: number
          id?: string
          modulo_id?: string
          orden?: number
          tipo?: Database["public"]["Enums"]["leccion_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_lecciones_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "academia_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_modulos: {
        Row: {
          activo: boolean
          created_at: string
          curso_id: string
          descripcion: string | null
          id: string
          orden: number
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          curso_id: string
          descripcion?: string | null
          id?: string
          orden?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          curso_id?: string
          descripcion?: string | null
          id?: string
          orden?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "academia_cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_preguntas: {
        Row: {
          created_at: string
          enunciado: string
          evaluacion_id: string
          id: string
          opciones: Json
          orden: number
          puntos: number
          respuesta_correcta: Json
          tipo: Database["public"]["Enums"]["pregunta_tipo"]
        }
        Insert: {
          created_at?: string
          enunciado: string
          evaluacion_id: string
          id?: string
          opciones?: Json
          orden?: number
          puntos?: number
          respuesta_correcta?: Json
          tipo?: Database["public"]["Enums"]["pregunta_tipo"]
        }
        Update: {
          created_at?: string
          enunciado?: string
          evaluacion_id?: string
          id?: string
          opciones?: Json
          orden?: number
          puntos?: number
          respuesta_correcta?: Json
          tipo?: Database["public"]["Enums"]["pregunta_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "academia_preguntas_evaluacion_id_fkey"
            columns: ["evaluacion_id"]
            isOneToOne: false
            referencedRelation: "academia_evaluaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_progreso_lecciones: {
        Row: {
          completada: boolean
          completada_at: string
          leccion_id: string
          user_id: string
        }
        Insert: {
          completada?: boolean
          completada_at?: string
          leccion_id: string
          user_id: string
        }
        Update: {
          completada?: boolean
          completada_at?: string
          leccion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_progreso_lecciones_leccion_id_fkey"
            columns: ["leccion_id"]
            isOneToOne: false
            referencedRelation: "academia_lecciones"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_recursos: {
        Row: {
          created_at: string
          id: string
          leccion_id: string | null
          modulo_id: string | null
          orden: number
          tipo: string
          titulo: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          leccion_id?: string | null
          modulo_id?: string | null
          orden?: number
          tipo?: string
          titulo: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          leccion_id?: string | null
          modulo_id?: string | null
          orden?: number
          tipo?: string
          titulo?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_recursos_leccion_id_fkey"
            columns: ["leccion_id"]
            isOneToOne: false
            referencedRelation: "academia_lecciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_recursos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "academia_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
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
      auditoria_global: {
        Row: {
          accion: string
          caso_id: string | null
          created_at: string
          entidad: string
          entidad_id: string | null
          expediente_id: string | null
          id: string
          observacion: string | null
          rol_efectivo: string | null
          user_id: string | null
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          accion: string
          caso_id?: string | null
          created_at?: string
          entidad: string
          entidad_id?: string | null
          expediente_id?: string | null
          id?: string
          observacion?: string | null
          rol_efectivo?: string | null
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          accion?: string
          caso_id?: string | null
          created_at?: string
          entidad?: string
          entidad_id?: string | null
          expediente_id?: string | null
          id?: string
          observacion?: string | null
          rol_efectivo?: string | null
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
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
          cuenta_receptora_id: string | null
          fecha: string
          fee_wompi: number | null
          id: string
          iva_fee: number | null
          metodo: string | null
          metodo_pago: string | null
          numero_transaccion: string | null
          observaciones: string | null
          user_id: string | null
          valor: number
          valor_bruto: number | null
          valor_neto: number | null
        }
        Insert: {
          banco_receptor?: string | null
          cartera_id: string
          comprobante_num?: string | null
          comprobante_url?: string | null
          created_at?: string
          cuenta_receptora_id?: string | null
          fecha?: string
          fee_wompi?: number | null
          id?: string
          iva_fee?: number | null
          metodo?: string | null
          metodo_pago?: string | null
          numero_transaccion?: string | null
          observaciones?: string | null
          user_id?: string | null
          valor: number
          valor_bruto?: number | null
          valor_neto?: number | null
        }
        Update: {
          banco_receptor?: string | null
          cartera_id?: string
          comprobante_num?: string | null
          comprobante_url?: string | null
          created_at?: string
          cuenta_receptora_id?: string | null
          fecha?: string
          fee_wompi?: number | null
          id?: string
          iva_fee?: number | null
          metodo?: string | null
          metodo_pago?: string | null
          numero_transaccion?: string | null
          observaciones?: string | null
          user_id?: string | null
          valor?: number
          valor_bruto?: number | null
          valor_neto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cartera_pagos_cartera_id_fkey"
            columns: ["cartera_id"]
            isOneToOne: false
            referencedRelation: "cartera"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartera_pagos_cuenta_receptora_id_fkey"
            columns: ["cuenta_receptora_id"]
            isOneToOne: false
            referencedRelation: "cuentas_receptoras"
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
          comision_liberada: number
          comision_pagada: number
          comision_potencial: number
          created_at: string
          cuenta_cobro_id: string | null
          estado: string
          expediente_id: string
          honorarios_contratados: number | null
          id: string
          porcentaje: number
          recaudado: number
          rol: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          base?: number
          comision_liberada?: number
          comision_pagada?: number
          comision_potencial?: number
          created_at?: string
          cuenta_cobro_id?: string | null
          estado?: string
          expediente_id: string
          honorarios_contratados?: number | null
          id?: string
          porcentaje?: number
          recaudado?: number
          rol?: string
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          base?: number
          comision_liberada?: number
          comision_pagada?: number
          comision_potencial?: number
          created_at?: string
          cuenta_cobro_id?: string | null
          estado?: string
          expediente_id?: string
          honorarios_contratados?: number | null
          id?: string
          porcentaje?: number
          recaudado?: number
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
          comprobante_url: string | null
          created_at: string
          estado: string
          fecha_aprobacion: string | null
          fecha_envio: string | null
          fecha_pago: string | null
          fecha_programada_pago: string | null
          id: string
          motivo_devolucion: string | null
          numero: string
          observaciones: string | null
          porcentaje_comision: number | null
          total: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          comprobante_url?: string | null
          created_at?: string
          estado?: string
          fecha_aprobacion?: string | null
          fecha_envio?: string | null
          fecha_pago?: string | null
          fecha_programada_pago?: string | null
          id?: string
          motivo_devolucion?: string | null
          numero?: string
          observaciones?: string | null
          porcentaje_comision?: number | null
          total?: number
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          comprobante_url?: string | null
          created_at?: string
          estado?: string
          fecha_aprobacion?: string | null
          fecha_envio?: string | null
          fecha_pago?: string | null
          fecha_programada_pago?: string | null
          id?: string
          motivo_devolucion?: string | null
          numero?: string
          observaciones?: string | null
          porcentaje_comision?: number | null
          total?: number
          updated_at?: string
          user_id?: string
          version?: number
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
      cuentas_receptoras: {
        Row: {
          activa: boolean
          banco: string
          created_at: string
          id: string
          nit: string | null
          numero: string | null
          observaciones: string | null
          tipo: string
          titular: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          banco: string
          created_at?: string
          id?: string
          nit?: string | null
          numero?: string | null
          observaciones?: string | null
          tipo?: string
          titular?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          banco?: string
          created_at?: string
          id?: string
          nit?: string | null
          numero?: string | null
          observaciones?: string | null
          tipo?: string
          titular?: string | null
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
      expediente_soportes: {
        Row: {
          archivo_nombre: string
          archivo_path: string
          categoria: string
          created_at: string
          estado_relacionado: string | null
          expediente_id: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          subcategoria: string
          user_id: string | null
        }
        Insert: {
          archivo_nombre: string
          archivo_path: string
          categoria?: string
          created_at?: string
          estado_relacionado?: string | null
          expediente_id: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          subcategoria: string
          user_id?: string | null
        }
        Update: {
          archivo_nombre?: string
          archivo_path?: string
          categoria?: string
          created_at?: string
          estado_relacionado?: string | null
          expediente_id?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          subcategoria?: string
          user_id?: string | null
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
          cuotas_aprobadas_banco: number | null
          cuotas_pactadas: number | null
          descuento: number | null
          discount_data: Json
          estado: Database["public"]["Enums"]["expediente_estado"]
          estado_caso: Database["public"]["Enums"]["caso_estado"]
          fecha_simulacion: string
          honorarios_base: number | null
          honorarios_final: number | null
          honorarios_pactados: number | null
          honorarios_recalculados: number | null
          id: string
          modo: Database["public"]["Enums"]["expediente_modo"]
          numero_credito: string | null
          producto: string | null
          propuesta_data: Json
          recalculo_at: string | null
          recalculo_user_id: string | null
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
          cuotas_aprobadas_banco?: number | null
          cuotas_pactadas?: number | null
          descuento?: number | null
          discount_data?: Json
          estado?: Database["public"]["Enums"]["expediente_estado"]
          estado_caso?: Database["public"]["Enums"]["caso_estado"]
          fecha_simulacion?: string
          honorarios_base?: number | null
          honorarios_final?: number | null
          honorarios_pactados?: number | null
          honorarios_recalculados?: number | null
          id?: string
          modo: Database["public"]["Enums"]["expediente_modo"]
          numero_credito?: string | null
          producto?: string | null
          propuesta_data?: Json
          recalculo_at?: string | null
          recalculo_user_id?: string | null
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
          cuotas_aprobadas_banco?: number | null
          cuotas_pactadas?: number | null
          descuento?: number | null
          discount_data?: Json
          estado?: Database["public"]["Enums"]["expediente_estado"]
          estado_caso?: Database["public"]["Enums"]["caso_estado"]
          fecha_simulacion?: string
          honorarios_base?: number | null
          honorarios_final?: number | null
          honorarios_pactados?: number | null
          honorarios_recalculados?: number | null
          id?: string
          modo?: Database["public"]["Enums"]["expediente_modo"]
          numero_credito?: string | null
          producto?: string | null
          propuesta_data?: Json
          recalculo_at?: string | null
          recalculo_user_id?: string | null
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
      finanzas_alertas: {
        Row: {
          cartera_id: string | null
          created_at: string
          cuenta_cobro_id: string | null
          expediente_id: string | null
          id: string
          leida: boolean
          mensaje_ia: string | null
          nomina_pago_id: string | null
          severidad: string
          tipo: string
          titulo: string
        }
        Insert: {
          cartera_id?: string | null
          created_at?: string
          cuenta_cobro_id?: string | null
          expediente_id?: string | null
          id?: string
          leida?: boolean
          mensaje_ia?: string | null
          nomina_pago_id?: string | null
          severidad?: string
          tipo: string
          titulo: string
        }
        Update: {
          cartera_id?: string | null
          created_at?: string
          cuenta_cobro_id?: string | null
          expediente_id?: string | null
          id?: string
          leida?: boolean
          mensaje_ia?: string | null
          nomina_pago_id?: string | null
          severidad?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      finanzas_auditoria: {
        Row: {
          accion: string
          created_at: string
          documento_url: string | null
          entidad: string
          entidad_id: string | null
          id: string
          motivo: string | null
          rol: string | null
          user_id: string | null
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          accion: string
          created_at?: string
          documento_url?: string | null
          entidad: string
          entidad_id?: string | null
          id?: string
          motivo?: string | null
          rol?: string | null
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          accion?: string
          created_at?: string
          documento_url?: string | null
          entidad?: string
          entidad_id?: string | null
          id?: string
          motivo?: string | null
          rol?: string | null
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: []
      }
      modulo_ayuda: {
        Row: {
          activo: boolean
          contenido: Json
          created_at: string
          id: string
          modulo_sistema: string
          orden: number
          tipo: Database["public"]["Enums"]["ayuda_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contenido?: Json
          created_at?: string
          id?: string
          modulo_sistema: string
          orden?: number
          tipo: Database["public"]["Enums"]["ayuda_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contenido?: Json
          created_at?: string
          id?: string
          modulo_sistema?: string
          orden?: number
          tipo?: Database["public"]["Enums"]["ayuda_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      nomina_empleados: {
        Row: {
          activo: boolean
          area: string | null
          cargo: string | null
          created_at: string
          documento: string | null
          id: string
          nombre: string
          observaciones: string | null
          tipo_contrato: string
          updated_at: string
          user_id: string | null
          valor_mensual: number
        }
        Insert: {
          activo?: boolean
          area?: string | null
          cargo?: string | null
          created_at?: string
          documento?: string | null
          id?: string
          nombre: string
          observaciones?: string | null
          tipo_contrato?: string
          updated_at?: string
          user_id?: string | null
          valor_mensual?: number
        }
        Update: {
          activo?: boolean
          area?: string | null
          cargo?: string | null
          created_at?: string
          documento?: string | null
          id?: string
          nombre?: string
          observaciones?: string | null
          tipo_contrato?: string
          updated_at?: string
          user_id?: string | null
          valor_mensual?: number
        }
        Relationships: []
      }
      nomina_pagos: {
        Row: {
          comprobante_num: string | null
          comprobante_url: string | null
          created_at: string
          empleado_id: string
          estado: string
          fecha_pago: string | null
          id: string
          observaciones: string | null
          periodo: string
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          comprobante_num?: string | null
          comprobante_url?: string | null
          created_at?: string
          empleado_id: string
          estado?: string
          fecha_pago?: string | null
          id?: string
          observaciones?: string | null
          periodo: string
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Update: {
          comprobante_num?: string | null
          comprobante_url?: string | null
          created_at?: string
          empleado_id?: string
          estado?: string
          fecha_pago?: string | null
          id?: string
          observaciones?: string | null
          periodo?: string
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "nomina_pagos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "nomina_empleados"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones_usuario: {
        Row: {
          created_at: string
          id: string
          leida: boolean
          link: string | null
          mensaje: string | null
          metadata: Json | null
          severidad: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leida?: boolean
          link?: string | null
          mensaje?: string | null
          metadata?: Json | null
          severidad?: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leida?: boolean
          link?: string | null
          mensaje?: string | null
          metadata?: Json | null
          severidad?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      parametros_financieros: {
        Row: {
          clave: string
          descripcion: string | null
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          clave: string
          descripcion?: string | null
          updated_at?: string
          updated_by?: string | null
          valor: Json
        }
        Update: {
          clave?: string
          descripcion?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      permisos_catalogo: {
        Row: {
          accion: string
          descripcion: string | null
          id: string
          modulo: string
        }
        Insert: {
          accion: string
          descripcion?: string | null
          id?: string
          modulo: string
        }
        Update: {
          accion?: string
          descripcion?: string | null
          id?: string
          modulo?: string
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
      rol_permisos: {
        Row: {
          accion: string
          id: string
          modulo: string
          permitido: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accion: string
          id?: string
          modulo: string
          permitido?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accion?: string
          id?: string
          modulo?: string
          permitido?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tesoreria_movimientos: {
        Row: {
          categoria: string
          comprobante_url: string | null
          created_at: string
          cuenta_cobro_id: string | null
          descripcion: string | null
          expediente_id: string | null
          fecha: string
          id: string
          nomina_pago_id: string | null
          tipo: string
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          categoria: string
          comprobante_url?: string | null
          created_at?: string
          cuenta_cobro_id?: string | null
          descripcion?: string | null
          expediente_id?: string | null
          fecha?: string
          id?: string
          nomina_pago_id?: string | null
          tipo: string
          updated_at?: string
          user_id?: string | null
          valor: number
        }
        Update: {
          categoria?: string
          comprobante_url?: string | null
          created_at?: string
          cuenta_cobro_id?: string | null
          descripcion?: string | null
          expediente_id?: string | null
          fecha?: string
          id?: string
          nomina_pago_id?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string | null
          valor?: number
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
      validaciones_qa: {
        Row: {
          created_at: string
          expediente_id: string
          id: string
          motivo: string | null
          observacion: string | null
          primera_revision: boolean
          resultado: string | null
          solicitada_at: string
          solicitada_por: string
          tiempo_validacion_min: number | null
          validada_at: string | null
          validada_por: string | null
        }
        Insert: {
          created_at?: string
          expediente_id: string
          id?: string
          motivo?: string | null
          observacion?: string | null
          primera_revision?: boolean
          resultado?: string | null
          solicitada_at?: string
          solicitada_por: string
          tiempo_validacion_min?: number | null
          validada_at?: string | null
          validada_por?: string | null
        }
        Update: {
          created_at?: string
          expediente_id?: string
          id?: string
          motivo?: string | null
          observacion?: string | null
          primera_revision?: boolean
          resultado?: string | null
          solicitada_at?: string
          solicitada_por?: string
          tiempo_validacion_min?: number | null
          validada_at?: string | null
          validada_por?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      academia_rol_del_usuario: {
        Args: { _uid: string }
        Returns: Database["public"]["Enums"]["academia_rol"]
      }
      can_manage_cartera: { Args: { _uid: string }; Returns: boolean }
      can_manage_finanzas: { Args: { _uid: string }; Returns: boolean }
      can_validar_proyeccion: { Args: { _uid: string }; Returns: boolean }
      can_view_cartera_row: {
        Args: { _exp_id: string; _uid: string }
        Returns: boolean
      }
      comision_disponible_para_cc: {
        Args: { _comision_id: string }
        Returns: number
      }
      has_permission: {
        Args: { _accion: string; _modulo: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      intentar_emitir_certificado: {
        Args: { _curso_id: string; _user_id: string }
        Returns: string
      }
      is_apoderado: { Args: { _uid: string }; Returns: boolean }
      is_director_juridico: { Args: { _uid: string }; Returns: boolean }
      is_director_qa: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      liberar_comisiones_por_recaudo: {
        Args: { _expediente_id: string; _user_validador?: string }
        Returns: undefined
      }
      map_caso_to_expediente_estado: {
        Args: { _caso: Database["public"]["Enums"]["caso_estado"] }
        Returns: Database["public"]["Enums"]["expediente_estado"]
      }
      notify_role: {
        Args: {
          _link: string
          _mensaje: string
          _meta?: Json
          _role: Database["public"]["Enums"]["app_role"]
          _sev?: string
          _tipo: string
          _titulo: string
        }
        Returns: number
      }
      notify_user: {
        Args: {
          _link: string
          _mensaje: string
          _meta?: Json
          _sev?: string
          _tipo: string
          _titulo: string
          _uid: string
        }
        Returns: string
      }
    }
    Enums: {
      academia_rol:
        | "licenciado"
        | "operaciones"
        | "juridica"
        | "contabilidad"
        | "director_financiero_qa"
        | "gerencia"
        | "super_admin"
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
        | "director_financiero_qa"
        | "director_juridico"
        | "auxiliar_operativo"
        | "apoderado"
      ayuda_tipo: "guia" | "video" | "faq" | "checklist"
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
        | "proyeccion_pendiente_qa"
        | "proyeccion_aprobada_qa"
        | "proyeccion_devuelta_qa"
      expediente_estado:
        | "SIMULADO"
        | "FIRMADO"
        | "RADICADO"
        | "APROBADO"
        | "FACTURADO"
        | "PAGADO"
        | "ENVIADO_CONTRATACION"
        | "CONDICIONES_APLICADAS"
      expediente_modo: "pesos" | "uvr"
      leccion_tipo:
        | "texto"
        | "pdf"
        | "video"
        | "imagen"
        | "checklist"
        | "enlace"
        | "faq"
      pregunta_tipo: "unica" | "multiple" | "verdadero_falso"
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
      academia_rol: [
        "licenciado",
        "operaciones",
        "juridica",
        "contabilidad",
        "director_financiero_qa",
        "gerencia",
        "super_admin",
      ],
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
        "director_financiero_qa",
        "director_juridico",
        "auxiliar_operativo",
        "apoderado",
      ],
      ayuda_tipo: ["guia", "video", "faq", "checklist"],
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
        "proyeccion_pendiente_qa",
        "proyeccion_aprobada_qa",
        "proyeccion_devuelta_qa",
      ],
      expediente_estado: [
        "SIMULADO",
        "FIRMADO",
        "RADICADO",
        "APROBADO",
        "FACTURADO",
        "PAGADO",
        "ENVIADO_CONTRATACION",
        "CONDICIONES_APLICADAS",
      ],
      expediente_modo: ["pesos", "uvr"],
      leccion_tipo: [
        "texto",
        "pdf",
        "video",
        "imagen",
        "checklist",
        "enlace",
        "faq",
      ],
      pregunta_tipo: ["unica", "multiple", "verdadero_falso"],
    },
  },
} as const
