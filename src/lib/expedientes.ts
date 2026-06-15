import { supabase } from "@/integrations/supabase/client";
import type { ClientData } from "@/components/nuvex/ClientFields";
import { estadosParaEtapa, type EtapaPipelineId } from "@/lib/pipelineEtapas";

export type EstadoExpediente =
  | "SIMULADO"
  | "FIRMADO"
  | "RADICADO"
  | "APROBADO"
  | "CONDICIONES_APLICADAS"
  | "FACTURADO"
  | "PAGADO"
  | "ENVIADO_CONTRATACION";

export const ESTADOS: EstadoExpediente[] = [
  "SIMULADO",
  "FIRMADO",
  "ENVIADO_CONTRATACION",
  "RADICADO",
  "APROBADO",
  "CONDICIONES_APLICADAS",
  "FACTURADO",
  "PAGADO",
];

export const ESTADO_COLORS: Record<EstadoExpediente, { bg: string; color: string; border: string }> = {
  SIMULADO:  { bg: "#EEF1FA", color: "#445DA3", border: "#445DA3" },
  FIRMADO:   { bg: "#FFF7E6", color: "#8A5A00", border: "#F0B429" },
  ENVIADO_CONTRATACION: { bg: "#E0E7FF", color: "#3730A3", border: "#6366F1" },
  RADICADO:  { bg: "#E8F0FE", color: "#1A4A8A", border: "#3B6FA0" },
  APROBADO:  { bg: "#EAF7EE", color: "#1F7A45", border: "#2E8B57" },
  CONDICIONES_APLICADAS: { bg: "#DDF4E3", color: "#0F5132", border: "#16A34A" },
  FACTURADO: { bg: "#F3E8FF", color: "#6B21A8", border: "#9333EA" },
  PAGADO:    { bg: "#DCFCE7", color: "#14532D", border: "#15803D" },
};

export interface PropuestaData {
  index?: number;
  nuevaCuota: number;
  nuevoPlazo: number;
  cuotasEliminadas?: number;
  añosEliminados: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorarios: number;
  totalProyectado: number;
  incrementoMensual?: number;
  fuente: "manual" | "automatica";
}

// discount_data persists the raw form state from DiscountModule (type/value/vigencia)
export type DiscountData = Record<string, unknown>;

export interface AprobadoData {
  fechaAprobacion: string;
  radicado: string;
  banco: string;
  cuotaAprobada: number;
  plazoAprobado: number;
  cuotasEliminadas?: number;
  añosEliminados?: number;
  ahorroIntereses?: number;
  ahorroSeguros?: number;
  ahorroTotal?: number;
  ahorroAprobado: number;
  honorariosBase?: number;
  descuento?: number;
  honorariosFinales?: number;
  observaciones?: string;
}

export interface Expediente {
  id: string;
  asesor_id: string;
  modo: "pesos" | "uvr";
  cliente_nombre: string;
  cedula: string | null;
  banco: string | null;
  numero_credito: string | null;
  producto: string | null;
  cliente_data: ClientData;
  credito_data: Record<string, string>;
  propuesta_data: PropuestaData | Record<string, never>;
  discount_data: DiscountData | Record<string, never>;
  honorarios_base: number;
  honorarios_final: number;
  descuento: number;
  estado: EstadoExpediente;
  estado_caso?: string | null;
  fecha_simulacion: string;
  aprobado_data: AprobadoData | null;
  acertividad_global: number | null;
  qa_score?: number | null;
  qa_dictamen?: string | null;
  qa_categoria?: "excelente" | "aprobado" | "revisar" | "rechazado" | null;
  qa_auditoria_id?: string | null;
  qa_ejecutada_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertPayload {
  id?: string;
  modo: "pesos" | "uvr";
  cliente: ClientData;
  credito: Record<string, string>;
  propuesta: PropuestaData;
  discountState: DiscountData;
  honorariosBase: number;
  honorariosFinal: number;
  descuento: number;
}

export async function listExpedientes(params: { search?: string; estado?: EstadoExpediente | ""; etapa?: EtapaPipelineId | "" } = {}) {
  let q = supabase
    .from("expedientes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (params.estado) q = q.eq("estado", params.estado);
  if (params.etapa) {
    const estados = estadosParaEtapa(params.etapa);
    if (estados.length > 0) q = q.in("estado_caso", estados as never);
  }
  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`;
    q = q.or(
      `cliente_nombre.ilike.${s},cedula.ilike.${s},numero_credito.ilike.${s},banco.ilike.${s}`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Expediente[];
}

export async function getExpediente(id: string): Promise<Expediente> {
  const { data, error } = await supabase.from("expedientes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No se encontró este expediente o ya no está disponible.");
  return data as unknown as Expediente;
}

export async function upsertExpediente(p: UpsertPayload): Promise<Expediente> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("No autenticado");

  const row = {
    modo: p.modo,
    cliente_nombre: p.cliente.nombre || "Sin nombre",
    cedula: p.cliente.cedula || null,
    banco: p.cliente.banco || null,
    numero_credito: p.cliente.numeroCredito || null,
    producto: p.cliente.tipoProducto || null,
    cliente_data: p.cliente as unknown as never,
    credito_data: p.credito as unknown as never,
    propuesta_data: p.propuesta as unknown as never,
    discount_data: p.discountState as unknown as never,
    honorarios_base: p.honorariosBase,
    honorarios_final: p.honorariosFinal,
    descuento: p.descuento,
  };

  if (p.id) {
    const { data, error } = await supabase
      .from("expedientes")
      .update(row)
      .eq("id", p.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se pudo actualizar el expediente. Verifica que siga disponible.");
    return data as unknown as Expediente;
  }
  const { data, error } = await supabase
    .from("expedientes")
    .insert({ ...row, asesor_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Expediente;
}

// Mapeo inverso: estado legacy → estado_caso canónico del pipeline.
// Permite que el dropdown superior (legacy) mantenga sincronizado el
// estado del caso del pipeline para evitar divergencias visuales.
const ESTADO_LEGACY_A_CASO: Record<EstadoExpediente, string> = {
  SIMULADO: "lead_creado",
  ENVIADO_CONTRATACION: "enviado_contratacion",
  FIRMADO: "contrato_firmado",
  RADICADO: "radicado_banco",
  APROBADO: "aprobado_banco",
  CONDICIONES_APLICADAS: "condiciones_aplicadas",
  FACTURADO: "cuenta_cobro_generada",
  PAGADO: "honorarios_pagados",
};

export async function updateEstado(id: string, estado: EstadoExpediente, nota?: string) {
  const prev = await getExpediente(id);
  const estadoCasoSync = ESTADO_LEGACY_A_CASO[estado];
  const prevCaso = (prev as unknown as { estado_caso?: string | null }).estado_caso ?? null;
  const { error } = await supabase
    .from("expedientes")
    .update({ estado, estado_caso: estadoCasoSync } as never)
    .eq("id", id);
  if (error) throw error;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  await supabase.from("expediente_historial").insert({
    expediente_id: id,
    estado_anterior: prev.estado,
    estado_nuevo: estado,
    estado_caso_anterior: prevCaso as never,
    estado_caso_nuevo: estadoCasoSync as never,
    accion_origen: "manual" as never,
    user_id: userId,
    nota: nota ?? null,
  } as never);
}

export async function setAprobado(id: string, aprobado: AprobadoData, acertividad: number) {
  const prev = await getExpediente(id);
  const { error } = await supabase
    .from("expedientes")
    .update({
      aprobado_data: aprobado as unknown as never,
      acertividad_global: acertividad,
      estado: "APROBADO",
    })
    .eq("id", id);
  if (error) throw error;
  if (prev.estado !== "APROBADO") {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("expediente_historial").insert({
      expediente_id: id,
      estado_anterior: prev.estado,
      estado_nuevo: "APROBADO",
      user_id: userData.user?.id ?? null,
      nota: "Aprobación bancaria registrada",
    });
  }
}


export async function deleteExpediente(id: string) {
  const { error } = await supabase.from("expedientes").delete().eq("id", id);
  if (error) throw error;
}

export interface AsesorStats {
  asesor_id: string;
  nombre: string;
  total: number;
  aprobados: number;
  pagados: number;
  honorariosFinal: number;
  honorariosPagados: number;
  acertividadPromedio: number;
}

export interface DashboardMetrics {
  total: number;
  porEstado: Record<EstadoExpediente, number>;
  tasaAprobacion: number;
  tasaCierre: number;
  acertividadPromedio: number;
  honorariosBase: number;
  honorariosFacturados: number;
  honorariosPagados: number;
  pipeline: number;
  porAsesor?: AsesorStats[];
}

export async function getDashboardMetrics(opts: { global?: boolean } = {}): Promise<{ metrics: DashboardMetrics; rows: Expediente[] }> {
  const rows = await listExpedientes();
  const porEstado = ESTADOS.reduce((acc, e) => ({ ...acc, [e]: 0 }), {} as Record<EstadoExpediente, number>);
  let honBase = 0, honFact = 0, honPag = 0, pipeline = 0;
  let acertSum = 0, acertCount = 0;

  for (const r of rows) {
    porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;
    honBase += Number(r.honorarios_base) || 0;
    if (r.estado === "FACTURADO") honFact += Number(r.honorarios_final) || 0;
    if (r.estado === "PAGADO") honPag += Number(r.honorarios_final) || 0;
    if (r.estado !== "PAGADO" && r.estado !== "SIMULADO") {
      pipeline += Number(r.honorarios_final) || 0;
    }
    if (r.acertividad_global != null) {
      acertSum += Number(r.acertividad_global);
      acertCount += 1;
    }
  }
  const radicadoOPlus = porEstado.RADICADO + porEstado.APROBADO + porEstado.FACTURADO + porEstado.PAGADO;
  const aprobadoOPlus = porEstado.APROBADO + porEstado.FACTURADO + porEstado.PAGADO;
  const tasaAprobacion = radicadoOPlus > 0 ? (aprobadoOPlus / radicadoOPlus) * 100 : 0;
  const tasaCierre = rows.length > 0 ? (porEstado.PAGADO / rows.length) * 100 : 0;
  const acertividadPromedio = acertCount > 0 ? acertSum / acertCount : 0;

  let porAsesor: AsesorStats[] | undefined;
  if (opts.global) {
    const ids = Array.from(new Set(rows.map((r) => r.asesor_id)));
    const nombreById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
      (profs ?? []).forEach((p) => nombreById.set(p.id, p.nombre || p.email || "Sin nombre"));
    }
    const acertByAsesor = new Map<string, { sum: number; n: number }>();
    const map = new Map<string, AsesorStats>();
    for (const r of rows) {
      const cur = map.get(r.asesor_id) ?? {
        asesor_id: r.asesor_id,
        nombre: nombreById.get(r.asesor_id) || "—",
        total: 0, aprobados: 0, pagados: 0,
        honorariosFinal: 0, honorariosPagados: 0,
        acertividadPromedio: 0,
      };
      cur.total += 1;
      if (["APROBADO","FACTURADO","PAGADO"].includes(r.estado)) cur.aprobados += 1;
      if (r.estado === "PAGADO") { cur.pagados += 1; cur.honorariosPagados += Number(r.honorarios_final) || 0; }
      cur.honorariosFinal += Number(r.honorarios_final) || 0;
      if (r.acertividad_global != null) {
        const a = acertByAsesor.get(r.asesor_id) ?? { sum: 0, n: 0 };
        a.sum += Number(r.acertividad_global); a.n += 1;
        acertByAsesor.set(r.asesor_id, a);
      }
      map.set(r.asesor_id, cur);
    }
    for (const [id, a] of acertByAsesor) {
      const s = map.get(id);
      if (s) s.acertividadPromedio = a.n > 0 ? a.sum / a.n : 0;
    }
    porAsesor = Array.from(map.values()).sort((a, b) => b.honorariosFinal - a.honorariosFinal);
  }

  return {
    metrics: {
      total: rows.length,
      porEstado,
      tasaAprobacion,
      tasaCierre,
      acertividadPromedio,
      honorariosBase: honBase,
      honorariosFacturados: honFact,
      honorariosPagados: honPag,
      pipeline,
      porAsesor,
    },
    rows,
  };
}
