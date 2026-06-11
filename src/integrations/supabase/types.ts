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
      acceso_auditoria: {
        Row: {
          accion: string
          actor_id: string | null
          created_at: string
          detalle: Json
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accion: string
          actor_id?: string | null
          created_at?: string
          detalle?: Json
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accion?: string
          actor_id?: string | null
          created_at?: string
          detalle?: Json
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analisis_capacidad_pago: {
        Row: {
          confianza: number | null
          created_at: string
          created_by: string | null
          cuota_propuesta: number
          detalle_codeudor: Json | null
          detalle_titular: Json | null
          es_vis: boolean
          expediente_id: string
          id: string
          ingreso_codeudor: number
          ingreso_titular: number
          ingreso_total: number | null
          limite_aplicable: number
          modelo_ia: string | null
          observaciones: string[] | null
          payload_ia: Json | null
          porcentaje_endeudamiento: number | null
          semaforo: string
          tipo_persona: string
          updated_at: string
        }
        Insert: {
          confianza?: number | null
          created_at?: string
          created_by?: string | null
          cuota_propuesta: number
          detalle_codeudor?: Json | null
          detalle_titular?: Json | null
          es_vis?: boolean
          expediente_id: string
          id?: string
          ingreso_codeudor?: number
          ingreso_titular?: number
          ingreso_total?: number | null
          limite_aplicable: number
          modelo_ia?: string | null
          observaciones?: string[] | null
          payload_ia?: Json | null
          porcentaje_endeudamiento?: number | null
          semaforo: string
          tipo_persona: string
          updated_at?: string
        }
        Update: {
          confianza?: number | null
          created_at?: string
          created_by?: string | null
          cuota_propuesta?: number
          detalle_codeudor?: Json | null
          detalle_titular?: Json | null
          es_vis?: boolean
          expediente_id?: string
          id?: string
          ingreso_codeudor?: number
          ingreso_titular?: number
          ingreso_total?: number | null
          limite_aplicable?: number
          modelo_ia?: string | null
          observaciones?: string[] | null
          payload_ia?: Json | null
          porcentaje_endeudamiento?: number | null
          semaforo?: string
          tipo_persona?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analisis_capacidad_pago_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      analista_metricas: {
        Row: {
          analista_id: string
          created_at: string
          nivel_autonomia: number
          porcentaje_aprobacion_banco: number
          porcentaje_devoluciones: number
          precision_ahorro: number
          precision_cuota: number
          precision_historica: number
          precision_plazo: number
          score_promedio: number
          total_simulaciones: number
          ultimo_recalculo: string
          updated_at: string
        }
        Insert: {
          analista_id: string
          created_at?: string
          nivel_autonomia?: number
          porcentaje_aprobacion_banco?: number
          porcentaje_devoluciones?: number
          precision_ahorro?: number
          precision_cuota?: number
          precision_historica?: number
          precision_plazo?: number
          score_promedio?: number
          total_simulaciones?: number
          ultimo_recalculo?: string
          updated_at?: string
        }
        Update: {
          analista_id?: string
          created_at?: string
          nivel_autonomia?: number
          porcentaje_aprobacion_banco?: number
          porcentaje_devoluciones?: number
          precision_ahorro?: number
          precision_cuota?: number
          precision_historica?: number
          precision_plazo?: number
          score_promedio?: number
          total_simulaciones?: number
          ultimo_recalculo?: string
          updated_at?: string
        }
        Relationships: []
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
      audit_alertas: {
        Row: {
          analista_id: string
          created_at: string
          id: string
          leida: boolean
          mensaje: string
          nivel_anterior: number | null
          nivel_nuevo: number | null
          simulacion_id: string | null
          tipo: string
        }
        Insert: {
          analista_id: string
          created_at?: string
          id?: string
          leida?: boolean
          mensaje: string
          nivel_anterior?: number | null
          nivel_nuevo?: number | null
          simulacion_id?: string | null
          tipo: string
        }
        Update: {
          analista_id?: string
          created_at?: string
          id?: string
          leida?: boolean
          mensaje?: string
          nivel_anterior?: number | null
          nivel_nuevo?: number | null
          simulacion_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_alertas_simulacion_id_fkey"
            columns: ["simulacion_id"]
            isOneToOne: false
            referencedRelation: "audit_simulaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_respuestas_banco: {
        Row: {
          analista_id: string
          created_at: string
          cuota_aprobada: number | null
          cuota_propuesta: number | null
          cuotas_aprobadas: number | null
          cuotas_eliminadas_propuestas: number | null
          fecha_aprobacion: string | null
          id: string
          observaciones: string | null
          plazo_aprobado: number | null
          plazo_propuesto: number | null
          precision_ahorro: number | null
          precision_cuota: number | null
          precision_plazo: number | null
          simulacion_id: string
          updated_at: string
        }
        Insert: {
          analista_id: string
          created_at?: string
          cuota_aprobada?: number | null
          cuota_propuesta?: number | null
          cuotas_aprobadas?: number | null
          cuotas_eliminadas_propuestas?: number | null
          fecha_aprobacion?: string | null
          id?: string
          observaciones?: string | null
          plazo_aprobado?: number | null
          plazo_propuesto?: number | null
          precision_ahorro?: number | null
          precision_cuota?: number | null
          precision_plazo?: number | null
          simulacion_id: string
          updated_at?: string
        }
        Update: {
          analista_id?: string
          created_at?: string
          cuota_aprobada?: number | null
          cuota_propuesta?: number | null
          cuotas_aprobadas?: number | null
          cuotas_eliminadas_propuestas?: number | null
          fecha_aprobacion?: string | null
          id?: string
          observaciones?: string | null
          plazo_aprobado?: number | null
          plazo_propuesto?: number | null
          precision_ahorro?: number | null
          precision_cuota?: number | null
          precision_plazo?: number | null
          simulacion_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_respuestas_banco_simulacion_id_fkey"
            columns: ["simulacion_id"]
            isOneToOne: false
            referencedRelation: "audit_simulaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_simulaciones: {
        Row: {
          analista_id: string
          banco: string | null
          created_at: string
          datos_analista: Json
          datos_extracto: Json
          datos_propuesta: Json
          expediente_id: string | null
          id: string
          inconsistencias: Json
          moneda: string | null
          motivo_escalamiento: string | null
          nivel_riesgo: string
          producto: string | null
          requiere_revision: boolean
          score_campos: number
          score_documental: number
          score_extracto: number
          score_matematico: number
          score_total: number
          tipo_credito: string | null
          updated_at: string
        }
        Insert: {
          analista_id: string
          banco?: string | null
          created_at?: string
          datos_analista?: Json
          datos_extracto?: Json
          datos_propuesta?: Json
          expediente_id?: string | null
          id?: string
          inconsistencias?: Json
          moneda?: string | null
          motivo_escalamiento?: string | null
          nivel_riesgo?: string
          producto?: string | null
          requiere_revision?: boolean
          score_campos?: number
          score_documental?: number
          score_extracto?: number
          score_matematico?: number
          score_total?: number
          tipo_credito?: string | null
          updated_at?: string
        }
        Update: {
          analista_id?: string
          banco?: string | null
          created_at?: string
          datos_analista?: Json
          datos_extracto?: Json
          datos_propuesta?: Json
          expediente_id?: string | null
          id?: string
          inconsistencias?: Json
          moneda?: string | null
          motivo_escalamiento?: string | null
          nivel_riesgo?: string
          producto?: string | null
          requiere_revision?: boolean
          score_campos?: number
          score_documental?: number
          score_extracto?: number
          score_matematico?: number
          score_total?: number
          tipo_credito?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_simulaciones_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
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
      colab_auditoria: {
        Row: {
          accion: string
          canal_id: string | null
          created_at: string
          detalle: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          accion: string
          canal_id?: string | null
          created_at?: string
          detalle?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          accion?: string
          canal_id?: string | null
          created_at?: string
          detalle?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      colab_canales: {
        Row: {
          archivado: boolean
          area: string | null
          caso_id: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          nombre: string
          privado: boolean
          tipo: Database["public"]["Enums"]["colab_canal_tipo"]
          updated_at: string
        }
        Insert: {
          archivado?: boolean
          area?: string | null
          caso_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          privado?: boolean
          tipo?: Database["public"]["Enums"]["colab_canal_tipo"]
          updated_at?: string
        }
        Update: {
          archivado?: boolean
          area?: string | null
          caso_id?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          privado?: boolean
          tipo?: Database["public"]["Enums"]["colab_canal_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      colab_mensajes: {
        Row: {
          adjuntos: Json
          borrado: boolean
          canal_id: string
          created_at: string
          editado_at: string | null
          id: string
          menciones: string[]
          reply_to: string | null
          texto: string | null
          user_id: string
        }
        Insert: {
          adjuntos?: Json
          borrado?: boolean
          canal_id: string
          created_at?: string
          editado_at?: string | null
          id?: string
          menciones?: string[]
          reply_to?: string | null
          texto?: string | null
          user_id: string
        }
        Update: {
          adjuntos?: Json
          borrado?: boolean
          canal_id?: string
          created_at?: string
          editado_at?: string | null
          id?: string
          menciones?: string[]
          reply_to?: string | null
          texto?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colab_mensajes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "colab_canales"
            referencedColumns: ["id"]
          },
        ]
      }
      colab_miembros: {
        Row: {
          canal_id: string
          created_at: string
          rol: string
          silenciado: boolean
          ultima_lectura: string
          user_id: string
        }
        Insert: {
          canal_id: string
          created_at?: string
          rol?: string
          silenciado?: boolean
          ultima_lectura?: string
          user_id: string
        }
        Update: {
          canal_id?: string
          created_at?: string
          rol?: string
          silenciado?: boolean
          ultima_lectura?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colab_miembros_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "colab_canales"
            referencedColumns: ["id"]
          },
        ]
      }
      colab_notificaciones: {
        Row: {
          canal_id: string | null
          created_at: string
          id: string
          leida: boolean
          mensaje_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          canal_id?: string | null
          created_at?: string
          id?: string
          leida?: boolean
          mensaje_id?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          canal_id?: string | null
          created_at?: string
          id?: string
          leida?: boolean
          mensaje_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colab_notificaciones_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "colab_canales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colab_notificaciones_mensaje_id_fkey"
            columns: ["mensaje_id"]
            isOneToOne: false
            referencedRelation: "colab_mensajes"
            referencedColumns: ["id"]
          },
        ]
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
      documentos_juridicos_versiones: {
        Row: {
          created_at: string
          created_by: string | null
          expediente_id: string
          id: string
          motivo_obsoleto: string | null
          obsoleto: boolean
          obsoleto_at: string | null
          snapshot: Json | null
          tipo: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expediente_id: string
          id?: string
          motivo_obsoleto?: string | null
          obsoleto?: boolean
          obsoleto_at?: string | null
          snapshot?: Json | null
          tipo: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expediente_id?: string
          id?: string
          motivo_obsoleto?: string | null
          obsoleto?: boolean
          obsoleto_at?: string | null
          snapshot?: Json | null
          tipo?: string
          version?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
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
      expediente_checklist_auditoria: {
        Row: {
          created_at: string
          documento_id: string
          documento_nombre: string
          estado_anterior: string | null
          estado_nuevo: string
          expediente_id: string
          id: string
          usuario_id: string | null
          usuario_nombre: string | null
        }
        Insert: {
          created_at?: string
          documento_id: string
          documento_nombre: string
          estado_anterior?: string | null
          estado_nuevo: string
          expediente_id: string
          id?: string
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Update: {
          created_at?: string
          documento_id?: string
          documento_nombre?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          expediente_id?: string
          id?: string
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Relationships: []
      }
      expediente_checklist_documentos: {
        Row: {
          archivo_url: string | null
          created_at: string
          created_by: string | null
          documento_id: string
          documento_nombre: string
          estado: string
          expediente_id: string
          fecha_recibido: string | null
          fecha_solicitado: string | null
          fecha_vencimiento: string | null
          id: string
          obligatorio: boolean
          observaciones: string | null
          recibido_por: string | null
          updated_at: string
          updated_by: string | null
          vigencia_dias: number | null
        }
        Insert: {
          archivo_url?: string | null
          created_at?: string
          created_by?: string | null
          documento_id: string
          documento_nombre: string
          estado?: string
          expediente_id: string
          fecha_recibido?: string | null
          fecha_solicitado?: string | null
          fecha_vencimiento?: string | null
          id?: string
          obligatorio?: boolean
          observaciones?: string | null
          recibido_por?: string | null
          updated_at?: string
          updated_by?: string | null
          vigencia_dias?: number | null
        }
        Update: {
          archivo_url?: string | null
          created_at?: string
          created_by?: string | null
          documento_id?: string
          documento_nombre?: string
          estado?: string
          expediente_id?: string
          fecha_recibido?: string | null
          fecha_solicitado?: string | null
          fecha_vencimiento?: string | null
          id?: string
          obligatorio?: boolean
          observaciones?: string | null
          recibido_por?: string | null
          updated_at?: string
          updated_by?: string | null
          vigencia_dias?: number | null
        }
        Relationships: []
      }
      expediente_checklist_envios: {
        Row: {
          asunto: string | null
          cc_emails: string[]
          cc_licenciado_email: string | null
          cuerpo: string | null
          destinatarios: string[]
          documentos: Json
          documentos_solicitados: Json
          enviado_a_email: string | null
          enviado_at: string
          enviado_por: string | null
          error: string | null
          estado_envio: string
          expediente_id: string
          id: string
          pdf_url: string | null
          proveedor_message_id: string | null
        }
        Insert: {
          asunto?: string | null
          cc_emails?: string[]
          cc_licenciado_email?: string | null
          cuerpo?: string | null
          destinatarios?: string[]
          documentos?: Json
          documentos_solicitados?: Json
          enviado_a_email?: string | null
          enviado_at?: string
          enviado_por?: string | null
          error?: string | null
          estado_envio?: string
          expediente_id: string
          id?: string
          pdf_url?: string | null
          proveedor_message_id?: string | null
        }
        Update: {
          asunto?: string | null
          cc_emails?: string[]
          cc_licenciado_email?: string | null
          cuerpo?: string | null
          destinatarios?: string[]
          documentos?: Json
          documentos_solicitados?: Json
          enviado_a_email?: string | null
          enviado_at?: string
          enviado_por?: string | null
          error?: string | null
          estado_envio?: string
          expediente_id?: string
          id?: string
          pdf_url?: string | null
          proveedor_message_id?: string | null
        }
        Relationships: []
      }
      expediente_checklist_validacion: {
        Row: {
          expediente_id: string
          notas: string | null
          total_obligatorios: number
          validada_at: string
          validada_por: string | null
          validada_por_nombre: string | null
        }
        Insert: {
          expediente_id: string
          notas?: string | null
          total_obligatorios: number
          validada_at?: string
          validada_por?: string | null
          validada_por_nombre?: string | null
        }
        Update: {
          expediente_id?: string
          notas?: string | null
          total_obligatorios?: number
          validada_at?: string
          validada_por?: string | null
          validada_por_nombre?: string | null
        }
        Relationships: []
      }
      expediente_entrega_documental: {
        Row: {
          banco: string
          creado_por: string | null
          created_at: string
          estado: string
          expediente_id: string
          fecha_completada: string | null
          fecha_programada: string | null
          id: string
          modalidad: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          banco: string
          creado_por?: string | null
          created_at?: string
          estado?: string
          expediente_id: string
          fecha_completada?: string | null
          fecha_programada?: string | null
          id?: string
          modalidad: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          banco?: string
          creado_por?: string | null
          created_at?: string
          estado?: string
          expediente_id?: string
          fecha_completada?: string | null
          fecha_programada?: string | null
          id?: string
          modalidad?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expediente_entrega_documental_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: true
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
      expediente_validacion_historial: {
        Row: {
          accion: string
          created_at: string
          datos_snapshot: Json | null
          expediente_id: string
          id: string
          motivo: string | null
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          datos_snapshot?: Json | null
          expediente_id: string
          id?: string
          motivo?: string | null
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          datos_snapshot?: Json | null
          expediente_id?: string
          id?: string
          motivo?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      expedientes: {
        Row: {
          aceptacion_cliente_at: string | null
          aceptacion_medio: string | null
          aceptacion_observaciones: string | null
          acertividad_global: number | null
          aprobado_data: Json | null
          asesor_id: string
          banco: string | null
          cedula: string | null
          cliente_data: Json
          cliente_nombre: string
          codigo: string | null
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
          producto_bancario_id: string | null
          propuesta_data: Json
          radicado_fecha: string | null
          radicado_id_banco: string | null
          recalculo_at: string | null
          recalculo_user_id: string | null
          updated_at: string
          validacion_aprobado_at: string | null
          validacion_aprobado_por: string | null
          validacion_confirmado_at: string | null
          validacion_confirmado_licenciado: boolean
          validacion_enviado_at: string | null
          validacion_estado: string
          validacion_motivo_devolucion: string | null
          validacion_version: number
        }
        Insert: {
          aceptacion_cliente_at?: string | null
          aceptacion_medio?: string | null
          aceptacion_observaciones?: string | null
          acertividad_global?: number | null
          aprobado_data?: Json | null
          asesor_id: string
          banco?: string | null
          cedula?: string | null
          cliente_data?: Json
          cliente_nombre: string
          codigo?: string | null
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
          producto_bancario_id?: string | null
          propuesta_data?: Json
          radicado_fecha?: string | null
          radicado_id_banco?: string | null
          recalculo_at?: string | null
          recalculo_user_id?: string | null
          updated_at?: string
          validacion_aprobado_at?: string | null
          validacion_aprobado_por?: string | null
          validacion_confirmado_at?: string | null
          validacion_confirmado_licenciado?: boolean
          validacion_enviado_at?: string | null
          validacion_estado?: string
          validacion_motivo_devolucion?: string | null
          validacion_version?: number
        }
        Update: {
          aceptacion_cliente_at?: string | null
          aceptacion_medio?: string | null
          aceptacion_observaciones?: string | null
          acertividad_global?: number | null
          aprobado_data?: Json | null
          asesor_id?: string
          banco?: string | null
          cedula?: string | null
          cliente_data?: Json
          cliente_nombre?: string
          codigo?: string | null
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
          producto_bancario_id?: string | null
          propuesta_data?: Json
          radicado_fecha?: string | null
          radicado_id_banco?: string | null
          recalculo_at?: string | null
          recalculo_user_id?: string | null
          updated_at?: string
          validacion_aprobado_at?: string | null
          validacion_aprobado_por?: string | null
          validacion_confirmado_at?: string | null
          validacion_confirmado_licenciado?: boolean
          validacion_enviado_at?: string | null
          validacion_estado?: string
          validacion_motivo_devolucion?: string | null
          validacion_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "expedientes_producto_bancario_id_fkey"
            columns: ["producto_bancario_id"]
            isOneToOne: false
            referencedRelation: "productos_bancarios"
            referencedColumns: ["id"]
          },
        ]
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
      gpt_conversaciones: {
        Row: {
          created_at: string
          id: string
          modulo_contexto: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modulo_contexto?: string | null
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modulo_contexto?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gpt_mensajes: {
        Row: {
          content: string
          conversacion_id: string
          created_at: string
          id: string
          metadata: Json
          role: string
        }
        Insert: {
          content: string
          conversacion_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
        }
        Update: {
          content?: string
          conversacion_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "gpt_mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "gpt_conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      gpt_tickets: {
        Row: {
          area: string
          asignado_a: string | null
          asunto: string
          conversacion_id: string | null
          created_at: string
          descripcion: string
          estado: string
          id: string
          prioridad: string
          resuelto_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area: string
          asignado_a?: string | null
          asunto: string
          conversacion_id?: string | null
          created_at?: string
          descripcion: string
          estado?: string
          id?: string
          prioridad?: string
          resuelto_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          asignado_a?: string | null
          asunto?: string
          conversacion_id?: string | null
          created_at?: string
          descripcion?: string
          estado?: string
          id?: string
          prioridad?: string
          resuelto_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gpt_tickets_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "gpt_conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      honorarios_aprobaciones: {
        Row: {
          aprobado_por: string | null
          calculo_id: string
          comentarios_aprobador: string | null
          created_at: string
          decidido_at: string | null
          decision: Database["public"]["Enums"]["honorarios_decision"] | null
          honorario_contraoferta: number | null
          honorario_recomendado: number
          honorario_solicitado: number
          id: string
          motivo_solicitud: string
          solicitado_por: string
        }
        Insert: {
          aprobado_por?: string | null
          calculo_id: string
          comentarios_aprobador?: string | null
          created_at?: string
          decidido_at?: string | null
          decision?: Database["public"]["Enums"]["honorarios_decision"] | null
          honorario_contraoferta?: number | null
          honorario_recomendado: number
          honorario_solicitado: number
          id?: string
          motivo_solicitud: string
          solicitado_por?: string
        }
        Update: {
          aprobado_por?: string | null
          calculo_id?: string
          comentarios_aprobador?: string | null
          created_at?: string
          decidido_at?: string | null
          decision?: Database["public"]["Enums"]["honorarios_decision"] | null
          honorario_contraoferta?: number | null
          honorario_recomendado?: number
          honorario_solicitado?: number
          id?: string
          motivo_solicitud?: string
          solicitado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_aprobaciones_calculo_id_fkey"
            columns: ["calculo_id"]
            isOneToOne: false
            referencedRelation: "honorarios_calculos"
            referencedColumns: ["id"]
          },
        ]
      }
      honorarios_auditoria: {
        Row: {
          accion: string
          calculo_id: string | null
          created_at: string
          id: string
          user_id: string | null
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          accion: string
          calculo_id?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          accion?: string
          calculo_id?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_auditoria_calculo_id_fkey"
            columns: ["calculo_id"]
            isOneToOne: false
            referencedRelation: "honorarios_calculos"
            referencedColumns: ["id"]
          },
        ]
      }
      honorarios_calculos: {
        Row: {
          ahorro_intereses: number
          ahorro_seguros: number
          ahorro_total: number
          alerta_tope: boolean
          banco: string | null
          cedula: string | null
          clasificacion: Database["public"]["Enums"]["honorarios_clasificacion"]
          cliente_nombre: string
          created_at: string
          created_by: string
          descuento_aplicado_pct: number | null
          estado: Database["public"]["Enums"]["honorarios_estado"]
          expediente_id: string | null
          honorario_ofertado: number | null
          honorario_teorico: number
          honorario_topado: number
          id: string
          notas: string | null
          plazo_original_meses: number | null
          porcentaje_aplicado: number
          rentabilidad_pct: number | null
          saldo_capital: number | null
          tipo_credito: string
          updated_at: string
        }
        Insert: {
          ahorro_intereses?: number
          ahorro_seguros?: number
          ahorro_total?: number
          alerta_tope?: boolean
          banco?: string | null
          cedula?: string | null
          clasificacion: Database["public"]["Enums"]["honorarios_clasificacion"]
          cliente_nombre: string
          created_at?: string
          created_by?: string
          descuento_aplicado_pct?: number | null
          estado?: Database["public"]["Enums"]["honorarios_estado"]
          expediente_id?: string | null
          honorario_ofertado?: number | null
          honorario_teorico: number
          honorario_topado: number
          id?: string
          notas?: string | null
          plazo_original_meses?: number | null
          porcentaje_aplicado: number
          rentabilidad_pct?: number | null
          saldo_capital?: number | null
          tipo_credito?: string
          updated_at?: string
        }
        Update: {
          ahorro_intereses?: number
          ahorro_seguros?: number
          ahorro_total?: number
          alerta_tope?: boolean
          banco?: string | null
          cedula?: string | null
          clasificacion?: Database["public"]["Enums"]["honorarios_clasificacion"]
          cliente_nombre?: string
          created_at?: string
          created_by?: string
          descuento_aplicado_pct?: number | null
          estado?: Database["public"]["Enums"]["honorarios_estado"]
          expediente_id?: string | null
          honorario_ofertado?: number | null
          honorario_teorico?: number
          honorario_topado?: number
          id?: string
          notas?: string | null
          plazo_original_meses?: number | null
          porcentaje_aplicado?: number
          rentabilidad_pct?: number | null
          saldo_capital?: number | null
          tipo_credito?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_calculos_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "expedientes"
            referencedColumns: ["id"]
          },
        ]
      }
      incidentes_operativos: {
        Row: {
          asignado_a: string | null
          cerrado_at: string | null
          created_at: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["incidente_estado"]
          expediente_id: string | null
          id: string
          reportado_por: string
          resolucion: string | null
          resuelto_at: string | null
          severidad: Database["public"]["Enums"]["incidente_severidad"]
          tipo: Database["public"]["Enums"]["incidente_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          asignado_a?: string | null
          cerrado_at?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["incidente_estado"]
          expediente_id?: string | null
          id?: string
          reportado_por: string
          resolucion?: string | null
          resuelto_at?: string | null
          severidad?: Database["public"]["Enums"]["incidente_severidad"]
          tipo?: Database["public"]["Enums"]["incidente_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          asignado_a?: string | null
          cerrado_at?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["incidente_estado"]
          expediente_id?: string | null
          id?: string
          reportado_por?: string
          resolucion?: string | null
          resuelto_at?: string | null
          severidad?: Database["public"]["Enums"]["incidente_severidad"]
          tipo?: Database["public"]["Enums"]["incidente_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      mfa_codigos_email: {
        Row: {
          codigo_hash: string
          created_at: string
          expira_at: string
          id: string
          usado: boolean
          user_id: string
        }
        Insert: {
          codigo_hash: string
          created_at?: string
          expira_at: string
          id?: string
          usado?: boolean
          user_id: string
        }
        Update: {
          codigo_hash?: string
          created_at?: string
          expira_at?: string
          id?: string
          usado?: boolean
          user_id?: string
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
      nuvex_ia_log: {
        Row: {
          audiencia: string | null
          created_at: string
          fuente: string
          id: string
          modulo: string | null
          nombre_usuario: string | null
          origen: string
          pregunta: string
          respuesta: string | null
          rol: string | null
          tiempo_respuesta_ms: number | null
          usuario_id: string | null
        }
        Insert: {
          audiencia?: string | null
          created_at?: string
          fuente?: string
          id?: string
          modulo?: string | null
          nombre_usuario?: string | null
          origen?: string
          pregunta: string
          respuesta?: string | null
          rol?: string | null
          tiempo_respuesta_ms?: number | null
          usuario_id?: string | null
        }
        Update: {
          audiencia?: string | null
          created_at?: string
          fuente?: string
          id?: string
          modulo?: string | null
          nombre_usuario?: string | null
          origen?: string
          pregunta?: string
          respuesta?: string | null
          rol?: string | null
          tiempo_respuesta_ms?: number | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      nuvex_kb: {
        Row: {
          audiencias: string[]
          categoria: string
          creado_por: string | null
          created_at: string
          estado: string
          id: string
          pregunta: string
          respuesta: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          audiencias?: string[]
          categoria: string
          creado_por?: string | null
          created_at?: string
          estado?: string
          id?: string
          pregunta: string
          respuesta: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          audiencias?: string[]
          categoria?: string
          creado_por?: string | null
          created_at?: string
          estado?: string
          id?: string
          pregunta?: string
          respuesta?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_auditoria: {
        Row: {
          actor_id: string | null
          created_at: string
          detalle: Json
          evento: string
          id: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detalle?: Json
          evento: string
          id?: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detalle?: Json
          evento?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_config: {
        Row: {
          descripcion_empresa: string
          id: boolean
          mensaje_bienvenida: string
          updated_at: string
          updated_by: string | null
          video_bienvenida_url: string | null
        }
        Insert: {
          descripcion_empresa?: string
          id?: boolean
          mensaje_bienvenida?: string
          updated_at?: string
          updated_by?: string | null
          video_bienvenida_url?: string | null
        }
        Update: {
          descripcion_empresa?: string
          id?: boolean
          mensaje_bienvenida?: string
          updated_at?: string
          updated_by?: string | null
          video_bienvenida_url?: string | null
        }
        Relationships: []
      }
      onboarding_notif_log: {
        Row: {
          asunto: string | null
          canal: string
          email_destino: string | null
          enviado_at: string
          etapa: string
          id: string
          metadata: Json
          procesado_at: string | null
          user_id: string
        }
        Insert: {
          asunto?: string | null
          canal: string
          email_destino?: string | null
          enviado_at?: string
          etapa: string
          id?: string
          metadata?: Json
          procesado_at?: string | null
          user_id: string
        }
        Update: {
          asunto?: string | null
          canal?: string
          email_destino?: string | null
          enviado_at?: string
          etapa?: string
          id?: string
          metadata?: Json
          procesado_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_notif_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_notif_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_publicos"
            referencedColumns: ["id"]
          },
        ]
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
      productos_bancarios: {
        Row: {
          activo: boolean
          banco: string
          cobertura: boolean
          codigo: string
          created_at: string
          id: string
          modalidad: string
          nombre_comercial: string
          orden: number
          submodalidad_uvr: string | null
          tipo_producto: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          banco: string
          cobertura?: boolean
          codigo: string
          created_at?: string
          id?: string
          modalidad: string
          nombre_comercial: string
          orden?: number
          submodalidad_uvr?: string | null
          tipo_producto: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          banco?: string
          cobertura?: boolean
          codigo?: string
          created_at?: string
          id?: string
          modalidad?: string
          nombre_comercial?: string
          orden?: number
          submodalidad_uvr?: string | null
          tipo_producto?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_auditoria: {
        Row: {
          accion: string
          actor_id: string | null
          created_at: string
          id: string
          profile_id: string
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          academia_asignada: boolean
          activo: boolean
          aprobado_at: string | null
          aprobado_por: string | null
          avatar_path: string | null
          avatar_url: string | null
          banco: string | null
          bienvenida_vista: boolean
          celular: string | null
          checklist_completo: boolean
          ciudad: string | null
          ciudad_registro: string | null
          coordinador_id: string | null
          correo_corporativo: string | null
          created_at: string
          departamento: string | null
          desvinculado_at: string | null
          desvinculado_por: string | null
          direccion: string | null
          email: string | null
          equipo: string | null
          equipo_registro: string | null
          estado_acceso: Database["public"]["Enums"]["acceso_estado"]
          fecha_ingreso: string | null
          id: string
          intentos_fallidos: number
          last_seen_at: string | null
          mfa_metodo: Database["public"]["Enums"]["mfa_metodo"]
          mfa_requerido: boolean
          mfa_secret: string | null
          mfa_verificado_at: string | null
          nombre: string | null
          numero_cuenta: string | null
          numero_documento: string | null
          onboarding_completed_at: string | null
          onboarding_estado: string
          onboarding_paso: number
          onboarding_started_at: string | null
          pais: string | null
          perfil_completo: boolean
          porcentaje_comision: number | null
          presencia_visible: boolean
          rechazado_motivo: string | null
          reemplazo_user_id: string | null
          rol_solicitado: string | null
          sede: string | null
          telefono_registro: string | null
          tipo_cuenta: string | null
          tipo_documento: string | null
          titular_cuenta: string | null
          tour_completo: boolean
          ultimo_login_at: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          academia_asignada?: boolean
          activo?: boolean
          aprobado_at?: string | null
          aprobado_por?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          banco?: string | null
          bienvenida_vista?: boolean
          celular?: string | null
          checklist_completo?: boolean
          ciudad?: string | null
          ciudad_registro?: string | null
          coordinador_id?: string | null
          correo_corporativo?: string | null
          created_at?: string
          departamento?: string | null
          desvinculado_at?: string | null
          desvinculado_por?: string | null
          direccion?: string | null
          email?: string | null
          equipo?: string | null
          equipo_registro?: string | null
          estado_acceso?: Database["public"]["Enums"]["acceso_estado"]
          fecha_ingreso?: string | null
          id: string
          intentos_fallidos?: number
          last_seen_at?: string | null
          mfa_metodo?: Database["public"]["Enums"]["mfa_metodo"]
          mfa_requerido?: boolean
          mfa_secret?: string | null
          mfa_verificado_at?: string | null
          nombre?: string | null
          numero_cuenta?: string | null
          numero_documento?: string | null
          onboarding_completed_at?: string | null
          onboarding_estado?: string
          onboarding_paso?: number
          onboarding_started_at?: string | null
          pais?: string | null
          perfil_completo?: boolean
          porcentaje_comision?: number | null
          presencia_visible?: boolean
          rechazado_motivo?: string | null
          reemplazo_user_id?: string | null
          rol_solicitado?: string | null
          sede?: string | null
          telefono_registro?: string | null
          tipo_cuenta?: string | null
          tipo_documento?: string | null
          titular_cuenta?: string | null
          tour_completo?: boolean
          ultimo_login_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          academia_asignada?: boolean
          activo?: boolean
          aprobado_at?: string | null
          aprobado_por?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          banco?: string | null
          bienvenida_vista?: boolean
          celular?: string | null
          checklist_completo?: boolean
          ciudad?: string | null
          ciudad_registro?: string | null
          coordinador_id?: string | null
          correo_corporativo?: string | null
          created_at?: string
          departamento?: string | null
          desvinculado_at?: string | null
          desvinculado_por?: string | null
          direccion?: string | null
          email?: string | null
          equipo?: string | null
          equipo_registro?: string | null
          estado_acceso?: Database["public"]["Enums"]["acceso_estado"]
          fecha_ingreso?: string | null
          id?: string
          intentos_fallidos?: number
          last_seen_at?: string | null
          mfa_metodo?: Database["public"]["Enums"]["mfa_metodo"]
          mfa_requerido?: boolean
          mfa_secret?: string | null
          mfa_verificado_at?: string | null
          nombre?: string | null
          numero_cuenta?: string | null
          numero_documento?: string | null
          onboarding_completed_at?: string | null
          onboarding_estado?: string
          onboarding_paso?: number
          onboarding_started_at?: string | null
          pais?: string | null
          perfil_completo?: boolean
          porcentaje_comision?: number | null
          presencia_visible?: boolean
          rechazado_motivo?: string | null
          reemplazo_user_id?: string | null
          rol_solicitado?: string | null
          sede?: string | null
          telefono_registro?: string | null
          tipo_cuenta?: string | null
          tipo_documento?: string | null
          titular_cuenta?: string | null
          tour_completo?: boolean
          ultimo_login_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      proyeccion_escenarios: {
        Row: {
          abono_extraordinario: number
          aporte_mensual_extra: number
          created_at: string
          created_by: string
          es_principal: boolean
          id: string
          nombre: string
          nueva_tasa: number | null
          nuevo_plazo: number | null
          proyeccion_id: string
          resultado_jsonb: Json
          tipo: string
          updated_at: string
        }
        Insert: {
          abono_extraordinario?: number
          aporte_mensual_extra?: number
          created_at?: string
          created_by: string
          es_principal?: boolean
          id?: string
          nombre?: string
          nueva_tasa?: number | null
          nuevo_plazo?: number | null
          proyeccion_id: string
          resultado_jsonb?: Json
          tipo?: string
          updated_at?: string
        }
        Update: {
          abono_extraordinario?: number
          aporte_mensual_extra?: number
          created_at?: string
          created_by?: string
          es_principal?: boolean
          id?: string
          nombre?: string
          nueva_tasa?: number | null
          nuevo_plazo?: number | null
          proyeccion_id?: string
          resultado_jsonb?: Json
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyeccion_escenarios_proyeccion_id_fkey"
            columns: ["proyeccion_id"]
            isOneToOne: false
            referencedRelation: "proyecciones_financieras"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecciones_financieras: {
        Row: {
          banco: string
          cliente_nombre: string
          created_at: string
          created_by: string
          cuota_actual: number
          cuotas_pagadas: number
          cuotas_pendientes: number
          cuotas_totales: number
          expediente_id: string | null
          fecha_desembolso: string | null
          fecha_terminacion_estimada: string | null
          id: string
          moneda: string
          notas: string | null
          otros_seguros: number
          saldo_capital: number
          saldo_uvr: number
          seguro_incendio: number
          seguro_terremoto: number
          seguro_vida: number
          tea_pct: number
          tipo_producto: string
          updated_at: string
          uvr_valor: number
          valor_desembolsado: number
          variacion_uvr_pct: number
        }
        Insert: {
          banco?: string
          cliente_nombre?: string
          created_at?: string
          created_by: string
          cuota_actual?: number
          cuotas_pagadas?: number
          cuotas_pendientes?: number
          cuotas_totales?: number
          expediente_id?: string | null
          fecha_desembolso?: string | null
          fecha_terminacion_estimada?: string | null
          id?: string
          moneda?: string
          notas?: string | null
          otros_seguros?: number
          saldo_capital?: number
          saldo_uvr?: number
          seguro_incendio?: number
          seguro_terremoto?: number
          seguro_vida?: number
          tea_pct?: number
          tipo_producto?: string
          updated_at?: string
          uvr_valor?: number
          valor_desembolsado?: number
          variacion_uvr_pct?: number
        }
        Update: {
          banco?: string
          cliente_nombre?: string
          created_at?: string
          created_by?: string
          cuota_actual?: number
          cuotas_pagadas?: number
          cuotas_pendientes?: number
          cuotas_totales?: number
          expediente_id?: string | null
          fecha_desembolso?: string | null
          fecha_terminacion_estimada?: string | null
          id?: string
          moneda?: string
          notas?: string | null
          otros_seguros?: number
          saldo_capital?: number
          saldo_uvr?: number
          seguro_incendio?: number
          seguro_terremoto?: number
          seguro_vida?: number
          tea_pct?: number
          tipo_producto?: string
          updated_at?: string
          uvr_valor?: number
          valor_desembolsado?: number
          variacion_uvr_pct?: number
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
      solicitudes_reactivacion: {
        Row: {
          aprobado_por: string | null
          correo: string
          created_at: string
          estado: string
          fecha_aprobacion: string | null
          fecha_solicitud: string
          id: string
          motivo: string | null
          nombre: string | null
          observacion_admin: string | null
          rol_actual: string | null
          rol_solicitado: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aprobado_por?: string | null
          correo: string
          created_at?: string
          estado?: string
          fecha_aprobacion?: string | null
          fecha_solicitud?: string
          id?: string
          motivo?: string | null
          nombre?: string | null
          observacion_admin?: string | null
          rol_actual?: string | null
          rol_solicitado?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aprobado_por?: string | null
          correo?: string
          created_at?: string
          estado?: string
          fecha_aprobacion?: string | null
          fecha_solicitud?: string
          id?: string
          motivo?: string | null
          nombre?: string | null
          observacion_admin?: string | null
          rol_actual?: string | null
          rol_solicitado?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_reactivacion_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_reactivacion_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "profiles_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_reactivacion_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_reactivacion_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      wallet_ajustes: {
        Row: {
          anulado: boolean
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          created_at: string
          created_by: string
          id: string
          monto: number
          motivo: string
          tipo: Database["public"]["Enums"]["wallet_mov_tipo"]
          user_id: string
        }
        Insert: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          created_at?: string
          created_by: string
          id?: string
          monto: number
          motivo: string
          tipo: Database["public"]["Enums"]["wallet_mov_tipo"]
          user_id: string
        }
        Update: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          created_at?: string
          created_by?: string
          id?: string
          monto?: number
          motivo?: string
          tipo?: Database["public"]["Enums"]["wallet_mov_tipo"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_movimientos: {
        Row: {
          actor_id: string | null
          ajuste_id: string | null
          comision_id: string | null
          created_at: string
          cuenta_cobro_id: string | null
          descripcion: string | null
          id: string
          metadata: Json
          monto: number
          tipo: Database["public"]["Enums"]["wallet_mov_tipo"]
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          ajuste_id?: string | null
          comision_id?: string | null
          created_at?: string
          cuenta_cobro_id?: string | null
          descripcion?: string | null
          id?: string
          metadata?: Json
          monto?: number
          tipo: Database["public"]["Enums"]["wallet_mov_tipo"]
          user_id: string
        }
        Update: {
          actor_id?: string | null
          ajuste_id?: string | null
          comision_id?: string | null
          created_at?: string
          cuenta_cobro_id?: string | null
          descripcion?: string | null
          id?: string
          metadata?: Json
          monto?: number
          tipo?: Database["public"]["Enums"]["wallet_mov_tipo"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_publicos: {
        Row: {
          activo: boolean | null
          avatar_path: string | null
          avatar_url: string | null
          celular: string | null
          ciudad: string | null
          coordinador_id: string | null
          correo_corporativo: string | null
          created_at: string | null
          departamento: string | null
          direccion: string | null
          email: string | null
          equipo: string | null
          fecha_ingreso: string | null
          id: string | null
          nombre: string | null
          numero_documento: string | null
          pais: string | null
          sede: string | null
          tipo_documento: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          activo?: boolean | null
          avatar_path?: string | null
          avatar_url?: string | null
          celular?: string | null
          ciudad?: string | null
          coordinador_id?: string | null
          correo_corporativo?: string | null
          created_at?: string | null
          departamento?: string | null
          direccion?: string | null
          email?: string | null
          equipo?: string | null
          fecha_ingreso?: string | null
          id?: string | null
          nombre?: string | null
          numero_documento?: string | null
          pais?: string | null
          sede?: string | null
          tipo_documento?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          activo?: boolean | null
          avatar_path?: string | null
          avatar_url?: string | null
          celular?: string | null
          ciudad?: string | null
          coordinador_id?: string | null
          correo_corporativo?: string | null
          created_at?: string | null
          departamento?: string | null
          direccion?: string | null
          email?: string | null
          equipo?: string | null
          fecha_ingreso?: string | null
          id?: string | null
          nombre?: string | null
          numero_documento?: string | null
          pais?: string | null
          sede?: string | null
          tipo_documento?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      academia_rol_del_usuario: {
        Args: { _uid: string }
        Returns: Database["public"]["Enums"]["academia_rol"]
      }
      calcular_etapa_onboarding: { Args: { _user_id: string }; Returns: string }
      can_aprobar_honorarios: { Args: { _uid: string }; Returns: boolean }
      can_manage_cartera: { Args: { _uid: string }; Returns: boolean }
      can_manage_finanzas: { Args: { _uid: string }; Returns: boolean }
      can_use_checklist_docs: { Args: { _uid: string }; Returns: boolean }
      can_use_motor_honorarios: { Args: { _uid: string }; Returns: boolean }
      can_use_proyeccion_financiera: {
        Args: { _uid: string }
        Returns: boolean
      }
      can_validar_identidad: { Args: { _uid: string }; Returns: boolean }
      can_validar_proyeccion: { Args: { _uid: string }; Returns: boolean }
      can_view_cartera_row: {
        Args: { _exp_id: string; _uid: string }
        Returns: boolean
      }
      can_view_profile_finanzas: {
        Args: { _profile_id: string; _uid: string }
        Returns: boolean
      }
      colab_es_miembro: {
        Args: { _canal: string; _user: string }
        Returns: boolean
      }
      colab_puede_ver_canal: {
        Args: { _canal: string; _user: string }
        Returns: boolean
      }
      comision_disponible_para_cc: {
        Args: { _comision_id: string }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      desvincular_usuario: {
        Args: {
          _reemplazo: string
          _target: string
          _transferir_comisiones?: boolean
        }
        Returns: Json
      }
      desvincular_usuario_sin_traslado: {
        Args: { _motivo: string; _target: string }
        Returns: Json
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      gpt_can_see_ticket: {
        Args: { _area: string; _user: string }
        Returns: boolean
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
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
      preview_desvinculacion: { Args: { _target: string }; Returns: Json }
      procesar_recordatorios_onboarding: { Args: never; Returns: Json }
      reactivar_usuario_solicitud: {
        Args: {
          _nuevo_rol?: Database["public"]["Enums"]["app_role"]
          _observacion?: string
          _solicitud_id: string
        }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalcular_nivel_autonomia: {
        Args: { _user_id: string }
        Returns: {
          analista_id: string
          created_at: string
          nivel_autonomia: number
          porcentaje_aprobacion_banco: number
          porcentaje_devoluciones: number
          precision_ahorro: number
          precision_cuota: number
          precision_historica: number
          precision_plazo: number
          score_promedio: number
          total_simulaciones: number
          ultimo_recalculo: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "analista_metricas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rechazar_reactivacion_solicitud: {
        Args: { _motivo: string; _solicitud_id: string }
        Returns: Json
      }
      registrar_notif_onboarding: {
        Args: {
          _asunto?: string
          _canal: string
          _etapa: string
          _meta?: Json
          _user_id: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      solicitar_reactivacion_por_email: {
        Args: {
          _email: string
          _motivo?: string
          _nombre?: string
          _rol_solicitado?: string
        }
        Returns: Json
      }
      wallet_saldos: { Args: { _user_id: string }; Returns: Json }
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
      acceso_estado:
        | "pendiente"
        | "aprobado"
        | "rechazado"
        | "bloqueado"
        | "desvinculado"
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
      colab_canal_tipo: "area" | "caso" | "dm" | "custom"
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
      honorarios_clasificacion:
        | "estandar"
        | "intermedio"
        | "premium"
        | "corporativo"
        | "uvr_360"
      honorarios_decision: "aprobado" | "rechazado" | "contraofertado"
      honorarios_estado:
        | "borrador"
        | "ofertado"
        | "pendiente_aprobacion"
        | "aprobado"
        | "rechazado"
        | "contraofertado"
        | "cerrado"
      incidente_estado: "abierto" | "en_gestion" | "resuelto" | "cerrado"
      incidente_severidad: "baja" | "media" | "alta" | "critica"
      incidente_tipo:
        | "documental"
        | "juridico"
        | "financiero"
        | "banco"
        | "cliente"
        | "sistema"
        | "otro"
      leccion_tipo:
        | "texto"
        | "pdf"
        | "video"
        | "imagen"
        | "checklist"
        | "enlace"
        | "faq"
      mfa_metodo: "ninguno" | "email" | "totp"
      pregunta_tipo: "unica" | "multiple" | "verdadero_falso"
      wallet_mov_tipo:
        | "comision_generada"
        | "comision_liberada"
        | "comision_pagada"
        | "cc_creada"
        | "cc_enviada"
        | "cc_aprobada"
        | "cc_pagada"
        | "cc_rechazada"
        | "ajuste_credito"
        | "ajuste_debito"
        | "retencion"
        | "liberacion_retencion"
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
      acceso_estado: [
        "pendiente",
        "aprobado",
        "rechazado",
        "bloqueado",
        "desvinculado",
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
      colab_canal_tipo: ["area", "caso", "dm", "custom"],
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
      honorarios_clasificacion: [
        "estandar",
        "intermedio",
        "premium",
        "corporativo",
        "uvr_360",
      ],
      honorarios_decision: ["aprobado", "rechazado", "contraofertado"],
      honorarios_estado: [
        "borrador",
        "ofertado",
        "pendiente_aprobacion",
        "aprobado",
        "rechazado",
        "contraofertado",
        "cerrado",
      ],
      incidente_estado: ["abierto", "en_gestion", "resuelto", "cerrado"],
      incidente_severidad: ["baja", "media", "alta", "critica"],
      incidente_tipo: [
        "documental",
        "juridico",
        "financiero",
        "banco",
        "cliente",
        "sistema",
        "otro",
      ],
      leccion_tipo: [
        "texto",
        "pdf",
        "video",
        "imagen",
        "checklist",
        "enlace",
        "faq",
      ],
      mfa_metodo: ["ninguno", "email", "totp"],
      pregunta_tipo: ["unica", "multiple", "verdadero_falso"],
      wallet_mov_tipo: [
        "comision_generada",
        "comision_liberada",
        "comision_pagada",
        "cc_creada",
        "cc_enviada",
        "cc_aprobada",
        "cc_pagada",
        "cc_rechazada",
        "ajuste_credito",
        "ajuste_debito",
        "retencion",
        "liberacion_retencion",
      ],
    },
  },
} as const
