// Matriz documental para representación ante el banco.
// Define qué documentos pedir según banco + perfil laboral + condiciones del cliente.
// Diseñada para crecer: agregar bancos o documentos es trivialmente editable aquí.

import { supabase } from "@/integrations/supabase/client";
import type { ExpedienteMaestro } from "./expedienteMaestro";

export type PerfilLaboral = "empleado" | "independiente" | "ambos";
export type FrecuenciaPago = "mensual" | "quincenal";

export type EstadoDoc =
  | "pendiente"
  | "solicitado"
  | "recibido"
  | "en_revision"
  | "aprobado"
  | "rechazado"
  | "vencido"
  | "no_aplica";

export const ESTADOS_LABEL: Record<EstadoDoc, string> = {
  pendiente: "Pendiente",
  solicitado: "Solicitado",
  recibido: "Recibido",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  vencido: "Vencido",
  no_aplica: "No aplica",
};

export const ESTADOS_COLOR: Record<EstadoDoc, string> = {
  pendiente: "#8A5A00",
  solicitado: "#1E4E8C",
  recibido: "#1F6F4A",
  en_revision: "#7A4FB5",
  aprobado: "#1F6F4A",
  rechazado: "#B42318",
  vencido: "#B42318",
  no_aplica: "#6B7280",
};

export interface FlagsCliente {
  declaraRenta: boolean;
  frecuenciaPago: FrecuenciaPago;
  recibePorBilleteras: boolean;
}

export const FLAGS_DEFAULT: FlagsCliente = {
  declaraRenta: false,
  frecuenciaPago: "mensual",
  recibePorBilleteras: false,
};

export interface DocRequerido {
  id: string;
  nombre: string;
  obligatorio: boolean;
  vigenciaDias?: number;
  observacion?: string;
  perfil: "ambos" | "empleado" | "independiente";
  /** Si está presente, sólo se incluye cuando devuelve true. */
  condicion?: (f: FlagsCliente) => boolean;
}

// ─── Generales para todos los bancos ───────────────────────────────────────
const GENERALES: DocRequerido[] = [
  { id: "cedula_cliente", nombre: "Cédula del cliente", obligatorio: true, perfil: "ambos" },
  { id: "poder", nombre: "Poder o poderes especiales firmados", obligatorio: true, perfil: "ambos" },
  { id: "solicitud_plazos", nombre: "Solicitud Cambio de Plazos", obligatorio: true, perfil: "ambos" },
];

const CEDULA_AMPLIADA: DocRequerido = {
  id: "cedula_ampliada_150",
  nombre: "Cédula ampliada al 150%",
  obligatorio: true,
  perfil: "ambos",
  observacion: "Reemplaza la cédula estándar para este banco.",
};

const CARTA_LABORAL: DocRequerido = {
  id: "carta_laboral",
  nombre: "Carta laboral",
  obligatorio: true,
  perfil: "empleado",
};

const DESPRENDIBLES_MENSUAL: DocRequerido = {
  id: "desprendibles_3",
  nombre: "Últimos 3 desprendibles de nómina (pago mensual)",
  obligatorio: true,
  perfil: "empleado",
  condicion: (f) => f.frecuenciaPago === "mensual",
};

const DESPRENDIBLES_QUINCENAL: DocRequerido = {
  id: "desprendibles_6",
  nombre: "Últimos 6 desprendibles de nómina (pago quincenal)",
  obligatorio: true,
  perfil: "empleado",
  condicion: (f) => f.frecuenciaPago === "quincenal",
};

const DECLARACION_RENTA_EMPLEADO: DocRequerido = {
  id: "renta_empleado",
  nombre: "Declaración de renta (si declara)",
  obligatorio: false,
  perfil: "empleado",
  condicion: (f) => f.declaraRenta,
  observacion: "Sólo si el cliente declara renta.",
};

const DECLARACION_RENTA_INDEP: DocRequerido = {
  id: "renta_independiente",
  nombre: "Declaración de renta del último año",
  obligatorio: true,
  perfil: "independiente",
  condicion: (f) => f.declaraRenta,
  observacion: "Si no declara, marcar como No aplica.",
};

const EXTRACTOS_3: DocRequerido = {
  id: "extractos_3",
  nombre: "Últimos 3 extractos bancarios donde recibe sus ingresos",
  obligatorio: true,
  perfil: "independiente",
};

const BILLETERAS: DocRequerido = {
  id: "billeteras_3m",
  nombre: "Movimientos de billeteras virtuales (últimos 3 meses)",
  obligatorio: true,
  perfil: "independiente",
  condicion: (f) => f.recibePorBilleteras,
};

const CTL_15D: DocRequerido = {
  id: "ctl_15d",
  nombre: "Certificado de Tradición y Libertad",
  obligatorio: true,
  perfil: "ambos",
  vigenciaDias: 15,
  observacion: "Debe estar vigente y no tener más de 15 días desde su expedición.",
};

const CERT_INGRESOS_RET: DocRequerido = {
  id: "cert_ingresos_retenciones",
  nombre: "Certificado de ingresos y retenciones (año anterior, expedido este año)",
  obligatorio: true,
  perfil: "empleado",
};

// ─── Banco Keys ────────────────────────────────────────────────────────────
export type BancoKey =
  | "bancolombia"
  | "davivienda"
  | "davibank"
  | "bogota_occidente_av_popular"
  | "otros";

export function detectBanco(banco?: string | null): BancoKey {
  const b = (banco || "").toLowerCase();
  if (!b) return "otros";
  if (b.includes("bancolombia")) return "bancolombia";
  if (b.includes("davibank") || b.includes("scotiabank") || b.includes("colpatria")) return "davibank";
  if (b.includes("davivienda")) return "davivienda";
  if (
    b.includes("bogot") || b.includes("occidente") ||
    b.includes("av villas") || b.includes("avvillas") || b.includes("popular")
  ) return "bogota_occidente_av_popular";
  return "otros";
}

const BANCO_LABEL: Record<BancoKey, string> = {
  bancolombia: "Bancolombia",
  davivienda: "Davivienda",
  davibank: "Davibank (antes Scotiabank Colpatria)",
  bogota_occidente_av_popular: "Banco de Bogotá / Occidente / AV Villas / Popular",
  otros: "Otro banco",
};

export function bancoLabel(banco?: string | null) {
  return BANCO_LABEL[detectBanco(banco)];
}

// ─── Matriz por banco ──────────────────────────────────────────────────────
// Cada array son documentos ESPECÍFICOS del banco; los generales se concatenan
// automáticamente en buildChecklist.
//
// Para Bancolombia los generales ya cubren todo. Para los demás bancos se
// agrega cédula ampliada + documentos financieros por perfil.

const FINANCIEROS_EMPLEADO: DocRequerido[] = [
  CARTA_LABORAL,
  DESPRENDIBLES_MENSUAL,
  DESPRENDIBLES_QUINCENAL,
  DECLARACION_RENTA_EMPLEADO,
];

const FINANCIEROS_INDEPENDIENTE: DocRequerido[] = [
  DECLARACION_RENTA_INDEP,
  EXTRACTOS_3,
  BILLETERAS,
];

const MATRIZ_DOCUMENTAL: Record<BancoKey, DocRequerido[]> = {
  bancolombia: [
    {
      id: "ficha_contractual",
      nombre: "Ficha contractual",
      obligatorio: true,
      perfil: "ambos",
      observacion: "Específica de Bancolombia.",
    },
  ],
  davivienda: [
    CEDULA_AMPLIADA,
    ...FINANCIEROS_EMPLEADO,
    ...FINANCIEROS_INDEPENDIENTE,
  ],
  davibank: [
    CEDULA_AMPLIADA,
    CTL_15D,
    ...FINANCIEROS_EMPLEADO,
    ...FINANCIEROS_INDEPENDIENTE,
  ],
  bogota_occidente_av_popular: [
    CEDULA_AMPLIADA,
    CERT_INGRESOS_RET,
    ...FINANCIEROS_EMPLEADO,
    ...FINANCIEROS_INDEPENDIENTE,
  ],
  otros: [
    ...FINANCIEROS_EMPLEADO,
    ...FINANCIEROS_INDEPENDIENTE,
  ],
};

// ─── Construcción del checklist ────────────────────────────────────────────
function aplicaPerfil(doc: DocRequerido, perfil: PerfilLaboral): boolean {
  if (doc.perfil === "ambos") return true;
  if (perfil === "ambos") return true;
  return doc.perfil === perfil;
}

export function buildChecklist(
  expediente: ExpedienteMaestro,
  perfil: PerfilLaboral,
  flags: FlagsCliente,
): DocRequerido[] {
  const banco = detectBanco(expediente.credito?.banco);
  const candidatos = [...GENERALES, ...MATRIZ_DOCUMENTAL[banco]];

  // Dedupe por id, mantener primera ocurrencia.
  const vistos = new Set<string>();
  const result: DocRequerido[] = [];
  for (const d of candidatos) {
    if (vistos.has(d.id)) continue;
    if (!aplicaPerfil(d, perfil)) continue;
    if (d.condicion && !d.condicion(flags)) continue;
    vistos.add(d.id);
    result.push(d);
  }
  return result;
}

// ─── Persistencia ──────────────────────────────────────────────────────────
export interface ChecklistRow {
  id: string;
  expediente_id: string;
  documento_id: string;
  documento_nombre: string;
  obligatorio: boolean;
  estado: EstadoDoc;
  vigencia_dias: number | null;
  fecha_solicitado: string | null;
  fecha_recibido: string | null;
  fecha_vencimiento: string | null;
  archivo_url: string | null;
  observaciones: string | null;
  updated_at: string;
}

export async function loadChecklistRows(expedienteId: string): Promise<ChecklistRow[]> {

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => { eq: (k: string, v: string) => Promise<{ data: unknown; error: unknown }> };
    };
  };
  const { data, error } = await sb
    .from("expediente_checklist_documentos")
    .select("*")
    .eq("expediente_id", expedienteId);
  if (error) throw error as Error;
  return (data ?? []) as ChecklistRow[];
}

export async function upsertChecklistRow(
  expedienteId: string,
  doc: DocRequerido,
  patch: Partial<ChecklistRow>,
): Promise<void> {
  const payload = {
    expediente_id: expedienteId,
    documento_id: doc.id,
    documento_nombre: doc.nombre,
    obligatorio: doc.obligatorio,
    vigencia_dias: doc.vigenciaDias ?? null,
    estado: patch.estado ?? "pendiente",
    fecha_solicitado: patch.fecha_solicitado ?? null,
    fecha_recibido: patch.fecha_recibido ?? null,
    fecha_vencimiento: patch.fecha_vencimiento ?? null,
    archivo_url: patch.archivo_url ?? null,
    observaciones: patch.observaciones ?? null,
  };
  const sb = supabase as unknown as {
    from: (t: string) => {
      upsert: (p: unknown, o: { onConflict: string }) => Promise<{ error: unknown }>;
    };
  };
  const { error } = await sb
    .from("expediente_checklist_documentos")
    .upsert(payload, { onConflict: "expediente_id,documento_id" });
  if (error) throw error as Error;
}

export async function registrarEnvioChecklist(input: {
  expediente_id: string;
  enviado_a_email: string;
  cc_licenciado_email?: string;
  asunto: string;
  cuerpo: string;
  pdf_url?: string;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const sb = supabase as unknown as {
    from: (t: string) => { insert: (p: unknown) => Promise<{ error: unknown }> };
  };
  const { error } = await sb
    .from("expediente_checklist_envios")
    .insert({ ...input, enviado_por: u.user?.id ?? null });
  if (error) throw error as Error;
}

// ─── Plantilla de correo ───────────────────────────────────────────────────
export function buildEmailDefaults(
  expediente: ExpedienteMaestro,
  docs: DocRequerido[],
) {
  const banco = expediente.credito?.banco || "el banco";
  const cliente = expediente.cliente?.nombre || "cliente";
  const licenciado = expediente.licenciado?.nombre || "Equipo NUVEX";
  const lista = docs.map((d, i) => `${i + 1}. ${d.nombre}${d.obligatorio ? "" : " (opcional)"}`).join("\n");
  const cuerpo =
`Estimado(a) ${cliente},

Para continuar con la representación ante ${banco}, necesitamos que nos compartas los siguientes documentos:

${lista}

Por favor envía los documentos en formato PDF o imagen legible. Estos soportes son necesarios para continuar con la solicitud formal ante el banco.

Cordialmente,

${licenciado}
NUVEX Finanzas Inteligentes`;
  return {
    asunto: `Documentos requeridos para representación ante el banco — NUVEX`,
    cuerpo,
  };
}

export function buildMailto(opts: {
  to: string;
  cc?: string;
  asunto: string;
  cuerpo: string;
}): string {
  const qs = new URLSearchParams();
  qs.set("subject", opts.asunto);
  qs.set("body", opts.cuerpo);
  if (opts.cc) qs.set("cc", opts.cc);
  return `mailto:${encodeURIComponent(opts.to)}?${qs.toString().replace(/\+/g, "%20")}`;
}
