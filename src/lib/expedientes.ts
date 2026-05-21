import { supabase } from "@/integrations/supabase/client";
import type { ClientData } from "@/components/nuvex/ClientFields";

export type EstadoExpediente =
  | "SIMULADO"
  | "FIRMADO"
  | "RADICADO"
  | "APROBADO"
  | "FACTURADO"
  | "PAGADO";

export const ESTADOS: EstadoExpediente[] = [
  "SIMULADO",
  "FIRMADO",
  "RADICADO",
  "APROBADO",
  "FACTURADO",
  "PAGADO",
];

export const ESTADO_COLORS: Record<EstadoExpediente, { bg: string; color: string; border: string }> = {
  SIMULADO:  { bg: "#EEF1FA", color: "#445DA3", border: "#445DA3" },
  FIRMADO:   { bg: "#FFF7E6", color: "#8A5A00", border: "#F0B429" },
  RADICADO:  { bg: "#E8F0FE", color: "#1A4A8A", border: "#3B6FA0" },
  APROBADO:  { bg: "#EAF7EE", color: "#1F7A45", border: "#2E8B57" },
  FACTURADO: { bg: "#F3E8FF", color: "#6B21A8", border: "#9333EA" },
  PAGADO:    { bg: "#DDF4E3", color: "#1F7A45", border: "#84B98F" },
};

export interface PropuestaData {
  nuevaCuota: number;
  nuevoPlazo: number;
  añosEliminados: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorarios: number;
  totalProyectado: number;
  fuente: "manual" | "automatica";
}

export interface DiscountData {
  motivo?: string;
  porcentaje?: number;
  vigencia?: string;
  descuento: number;
  final: number;
  hasDiscount: boolean;
}

export interface AprobadoData {
  fechaAprobacion: string;
  radicado: string;
  banco: string;
  cuotaAprobada: number;
  plazoAprobado: number;
  ahorroAprobado: number;
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
  fecha_simulacion: string;
  aprobado_data: AprobadoData | null;
  acertividad_global: number | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertPayload {
  id?: string;
  modo: "pesos" | "uvr";
  cliente: ClientData;
  credito: Record<string, string>;
  propuesta: PropuestaData;
  discount: DiscountData;
}

export async function listExpedientes(params: { search?: string; estado?: EstadoExpediente | "" } = {}) {
  let q = supabase
    .from("expedientes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (params.estado) q = q.eq("estado", params.estado);
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
  const { data, error } = await supabase.from("expedientes").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as Expediente;
}

export async function upsertExpediente(p: UpsertPayload): Promise<Expediente> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("No autenticado");

  const row = {
    asesor_id: user.id,
    modo: p.modo,
    cliente_nombre: p.cliente.nombre || "Sin nombre",
    cedula: p.cliente.cedula || null,
    banco: p.cliente.banco || null,
    numero_credito: p.cliente.numeroCredito || null,
    producto: p.cliente.tipoProducto || null,
    cliente_data: p.cliente as unknown as Record<string, unknown>,
    credito_data: p.credito,
    propuesta_data: p.propuesta as unknown as Record<string, unknown>,
    discount_data: p.discount as unknown as Record<string, unknown>,
    honorarios_base: p.propuesta.honorarios,
    honorarios_final: p.discount.final,
    descuento: p.discount.descuento,
  };

  if (p.id) {
    const { data, error } = await supabase
      .from("expedientes")
      .update(row)
      .eq("id", p.id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Expediente;
  }
  const { data, error } = await supabase
    .from("expedientes")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Expediente;
}

export async function updateEstado(id: string, estado: EstadoExpediente, nota?: string) {
  const prev = await getExpediente(id);
  const { error } = await supabase.from("expedientes").update({ estado }).eq("id", id);
  if (error) throw error;
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("expediente_historial").insert({
    expediente_id: id,
    estado_anterior: prev.estado,
    estado_nuevo: estado,
    user_id: userData.user?.id ?? null,
    nota: nota ?? null,
  });
}

export async function setAprobado(id: string, aprobado: AprobadoData, acertividad: number) {
  const { error } = await supabase
    .from("expedientes")
    .update({ aprobado_data: aprobado as unknown as Record<string, unknown>, acertividad_global: acertividad })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteExpediente(id: string) {
  const { error } = await supabase.from("expedientes").delete().eq("id", id);
  if (error) throw error;
}

export interface DashboardMetrics {
  total: number;
  porEstado: Record<EstadoExpediente, number>;
  tasaAprobacion: number; // APROBADO / RADICADO
  tasaCierre: number; // PAGADO / SIMULADO
  acertividadPromedio: number;
  honorariosBase: number;
  honorariosFacturados: number;
  honorariosPagados: number;
  pipeline: number;
}

export async function getDashboardMetrics(): Promise<{ metrics: DashboardMetrics; rows: Expediente[] }> {
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
    },
    rows,
  };
}
