import { supabase } from "@/integrations/supabase/client";

export type CarteraEstado =
  | "pendiente_cobro"
  | "cuenta_cobro_generada"
  | "cuenta_cobro_enviada"
  | "pago_parcial"
  | "pago_total"
  | "vencido"
  | "acuerdo_pago"
  | "en_seguimiento"
  | "prejuridico"
  | "cerrado";

export const CARTERA_ESTADOS: { key: CarteraEstado; label: string; color: string; bg: string }[] = [
  { key: "pendiente_cobro", label: "Pendiente de cobro", color: "#8A5A00", bg: "#FFF7E6" },
  { key: "cuenta_cobro_generada", label: "Cuenta de cobro generada", color: "#6B21A8", bg: "#F3E8FF" },
  { key: "cuenta_cobro_enviada", label: "Cuenta de cobro enviada", color: "#3730A3", bg: "#E0E7FF" },
  { key: "pago_parcial", label: "Pago parcial", color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "pago_total", label: "Pago total", color: "#1F7A45", bg: "#DDF4E3" },
  { key: "vencido", label: "Vencido", color: "#991B1B", bg: "#FEE2E2" },
  { key: "acuerdo_pago", label: "Acuerdo de pago", color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "en_seguimiento", label: "En seguimiento", color: "#8A5A00", bg: "#FFF7E6" },
  { key: "prejuridico", label: "Prejurídico", color: "#7F1D1D", bg: "#FECACA" },
  { key: "cerrado", label: "Cerrado", color: "#242424", bg: "#E5E7EB" },
];

export const CARTERA_ESTADO_BY_KEY = Object.fromEntries(
  CARTERA_ESTADOS.map((s) => [s.key, s] as const),
) as Record<CarteraEstado, (typeof CARTERA_ESTADOS)[number]>;

export interface Cartera {
  id: string;
  expediente_id: string;
  responsable_id: string | null;
  estado_cartera: CarteraEstado;
  forma_pago: "contado" | "financiado";
  fecha_aplicacion_banco: string;
  fecha_resultado_final: string | null;
  fecha_cuenta_cobro: string | null;
  fecha_vencimiento: string;
  honorarios_totales: number;
  pagado: number;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarteraConExpediente extends Cartera {
  expediente?: {
    id: string;
    cliente_nombre: string;
    cedula: string | null;
    banco: string | null;
    producto: string | null;
    numero_credito: string | null;
    asesor_id: string;
    honorarios_final: number;
    descuento: number;
    propuesta_data: Record<string, unknown> | null;
    cliente_data: Record<string, unknown>;
    aprobado_data: Record<string, unknown> | null;
    estado_caso: string;
  };

  responsable?: { id: string; nombre: string | null; email: string | null } | null;
}

export interface CarteraPago {
  id: string;
  cartera_id: string;
  fecha: string;
  valor: number;
  metodo: string | null;
  metodo_pago: string | null;
  cuenta_receptora_id: string | null;
  valor_bruto: number | null;
  fee_wompi: number | null;
  iva_fee: number | null;
  valor_neto: number | null;
  numero_transaccion: string | null;
  banco_receptor: string | null;
  comprobante_num: string | null;
  comprobante_url: string | null;
  observaciones: string | null;
  user_id: string | null;
  created_at: string;
}

export interface CarteraCuota {
  id: string;
  cartera_id: string;
  numero: number;
  valor: number;
  fecha_vencimiento: string;
  estado: "pendiente" | "pagada" | "vencida";
  pagado: number;
}

export interface CarteraAcuerdo {
  id: string;
  cartera_id: string;
  valor_total: number;
  numero_cuotas: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: "activo" | "cumplido" | "incumplido" | "cancelado";
  observaciones: string | null;
  created_at: string;
}

export interface CarteraComunicacion {
  id: string;
  cartera_id: string;
  tipo: string;
  canal: "email" | "whatsapp";
  estado: string;
  asunto: string | null;
  destinatario: string | null;
  body: string | null;
  proveedor_msg_id: string | null;
  user_id: string | null;
  created_at: string;
}

export interface CarteraAuditoria {
  id: string;
  cartera_id: string;
  user_id: string | null;
  accion: string;
  observacion: string | null;
  canal: string | null;
  created_at: string;
}

export function diasMora(fechaVencimiento: string): number {
  const v = new Date(fechaVencimiento + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ms = hoy.getTime() - v.getTime();
  return Math.floor(ms / 86400000);
}

export function calcularVencimiento(fechaAplicacion: string, dias = 5): string {
  const d = new Date(fechaAplicacion + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function getCarteraByExpediente(expedienteId: string): Promise<Cartera | null> {
  const { data } = await supabase
    .from("cartera" as never)
    .select("*")
    .eq("expediente_id", expedienteId)
    .maybeSingle();
  return (data as unknown as Cartera) ?? null;
}

export async function getCartera(id: string): Promise<CarteraConExpediente | null> {
  const { data } = await supabase
    .from("cartera" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const c = data as unknown as Cartera;
  const { data: exp } = await supabase
    .from("expedientes")
    .select("id, cliente_nombre, cedula, banco, producto, numero_credito, asesor_id, honorarios_final, descuento, propuesta_data, cliente_data, aprobado_data, estado_caso")
    .eq("id", c.expediente_id)
    .maybeSingle();
  let responsable = null;
  if (c.responsable_id) {
    const { data: r } = await supabase.from("profiles").select("id, nombre, email").eq("id", c.responsable_id).maybeSingle();
    responsable = r;
  }
  return { ...c, expediente: exp as never, responsable };
}

export async function listCarteras(filtros: {
  estado?: CarteraEstado | "";
  responsableId?: string;
  banco?: string;
  diasMoraMin?: number;
} = {}): Promise<CarteraConExpediente[]> {
  let q = supabase.from("cartera" as never).select("*").order("fecha_vencimiento", { ascending: true });
  if (filtros.estado) q = q.eq("estado_cartera", filtros.estado);
  if (filtros.responsableId) q = q.eq("responsable_id", filtros.responsableId);
  const { data, error } = await q;
  if (error) throw error;
  const carteras = (data ?? []) as unknown as Cartera[];
  if (carteras.length === 0) return [];
  const expIds = Array.from(new Set(carteras.map((c) => c.expediente_id)));
  const respIds = Array.from(new Set(carteras.map((c) => c.responsable_id).filter(Boolean))) as string[];
  const { data: exps } = await supabase
    .from("expedientes")
    .select("id, cliente_nombre, cedula, banco, producto, numero_credito, asesor_id, honorarios_final, descuento, propuesta_data, cliente_data, aprobado_data, estado_caso")
    .in("id", expIds);
  const expMap = new Map((exps ?? []).map((e) => [e.id, e]));
  let respMap = new Map<string, { id: string; nombre: string | null; email: string | null }>();
  if (respIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, nombre, email").in("id", respIds);
    respMap = new Map((profs ?? []).map((p) => [p.id, p]));
  }
  let result = carteras.map((c) => ({
    ...c,
    expediente: expMap.get(c.expediente_id) as CarteraConExpediente["expediente"],
    responsable: c.responsable_id ? respMap.get(c.responsable_id) ?? null : null,
  }));
  if (filtros.banco) result = result.filter((c) => c.expediente?.banco === filtros.banco);
  if (typeof filtros.diasMoraMin === "number") {
    result = result.filter((c) => diasMora(c.fecha_vencimiento) >= filtros.diasMoraMin!);
  }
  return result;
}

export async function listPagos(carteraId: string): Promise<CarteraPago[]> {
  const { data } = await supabase
    .from("cartera_pagos" as never)
    .select("*")
    .eq("cartera_id", carteraId)
    .order("fecha", { ascending: false });
  return (data ?? []) as unknown as CarteraPago[];
}

export async function listCuotas(carteraId: string): Promise<CarteraCuota[]> {
  const { data } = await supabase
    .from("cartera_cuotas" as never)
    .select("*")
    .eq("cartera_id", carteraId)
    .order("numero");
  return (data ?? []) as unknown as CarteraCuota[];
}

export async function listAcuerdos(carteraId: string): Promise<CarteraAcuerdo[]> {
  const { data } = await supabase
    .from("cartera_acuerdos" as never)
    .select("*")
    .eq("cartera_id", carteraId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as CarteraAcuerdo[];
}

export async function listComunicaciones(carteraId: string): Promise<CarteraComunicacion[]> {
  const { data } = await supabase
    .from("cartera_comunicaciones" as never)
    .select("*")
    .eq("cartera_id", carteraId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as CarteraComunicacion[];
}

export async function listAuditoria(carteraId: string): Promise<CarteraAuditoria[]> {
  const { data } = await supabase
    .from("cartera_auditoria" as never)
    .select("*")
    .eq("cartera_id", carteraId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as CarteraAuditoria[];
}

export const TIPO_COMUNICACION_LABEL: Record<string, string> = {
  email_cuenta_cobro: "Email — Cuenta de cobro",
  email_recordatorio: "Email — Recordatorio (día 3)",
  email_vencimiento: "Email — Día de vencimiento",
  email_mora_7: "Email — Mora 7 días",
  email_mora_15: "Email — Mora 15 días",
  email_prejuridico: "Email — Aviso prejurídico",
  whatsapp_cuenta_cobro: "WhatsApp — Cuenta de cobro",
  whatsapp_recordatorio: "WhatsApp — Recordatorio",
  whatsapp_vencimiento: "WhatsApp — Vencimiento",
  whatsapp_mora_7: "WhatsApp — Mora 7",
  whatsapp_mora_15: "WhatsApp — Mora 15",
  whatsapp_mora_30: "WhatsApp — Mora 30",
};

export function buildWhatsappMensaje(tipo: string, ctx: { cliente: string; saldo: number; fechaVenc: string; banco?: string | null }): string {
  const money = (n: number) => "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
  switch (tipo) {
    case "whatsapp_cuenta_cobro":
      return `Hola ${ctx.cliente}, te compartimos la cuenta de cobro NUVEX por ${money(ctx.saldo)} correspondiente a los honorarios de tu proceso${ctx.banco ? " con " + ctx.banco : ""}. Vencimiento: ${ctx.fechaVenc}.`;
    case "whatsapp_recordatorio":
      return `Hola ${ctx.cliente}, recordatorio amable: tus honorarios NUVEX por ${money(ctx.saldo)} vencen el ${ctx.fechaVenc}. ¿Necesitas el detalle de pago?`;
    case "whatsapp_vencimiento":
      return `Hola ${ctx.cliente}, hoy vencen tus honorarios NUVEX por ${money(ctx.saldo)}. Por favor confírmanos tu pago.`;
    case "whatsapp_mora_7":
      return `Hola ${ctx.cliente}, llevas 7 días de mora en tus honorarios NUVEX (${money(ctx.saldo)}). Te pedimos regularizar la situación lo antes posible.`;
    case "whatsapp_mora_15":
      return `Hola ${ctx.cliente}, este es el último aviso amistoso. Tus honorarios NUVEX (${money(ctx.saldo)}) llevan 15 días vencidos. Solicitamos pago inmediato para evitar trámite prejurídico.`;
    case "whatsapp_mora_30":
      return `Sr(a) ${ctx.cliente}, su obligación con NUVEX (${money(ctx.saldo)}) supera los 30 días de mora. Su caso será trasladado a área prejurídica.`;
    default:
      return "";
  }
}
