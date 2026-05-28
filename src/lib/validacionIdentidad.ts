// Validación de identidad y control contractual NUVEX.
// Estados, helpers y operaciones contra `expedientes` + tablas auxiliares.

import { supabase } from "@/integrations/supabase/client";
import type { Expediente } from "@/lib/expedientes";
import { cityDepartment } from "@/lib/colombiaCities";

const isCityKnown = (city: string | null | undefined) => !!cityDepartment(city);

export type ValidacionEstado =
  | "pendiente_validacion"
  | "en_revision_contratacion"
  | "devuelto_datos_incorrectos"
  | "datos_validados"
  | "bloqueado_inconsistencia";

export const VALIDACION_LABELS: Record<ValidacionEstado, string> = {
  pendiente_validacion: "Pendiente validación",
  en_revision_contratacion: "En revisión contratación",
  devuelto_datos_incorrectos: "Devuelto por datos incorrectos",
  datos_validados: "Datos validados",
  bloqueado_inconsistencia: "Bloqueado por inconsistencia crítica",
};

export const VALIDACION_COLORS: Record<ValidacionEstado, { bg: string; fg: string; border: string }> = {
  pendiente_validacion: { bg: "#FFF7E6", fg: "#8A5A00", border: "#FAD491" },
  en_revision_contratacion: { bg: "#E8F0FF", fg: "#1E3A8A", border: "#B6CEFF" },
  devuelto_datos_incorrectos: { bg: "#FDECEC", fg: "#B42318", border: "#F5C2C2" },
  datos_validados: { bg: "#E6F4EA", fg: "#1F6F4A", border: "#BBE4C9" },
  bloqueado_inconsistencia: { bg: "#FDECEC", fg: "#7A0E0E", border: "#F5A8A8" },
};

export const MOTIVOS_DEVOLUCION = [
  "Nombre mal digitado",
  "Documento incorrecto",
  "Lugar de expedición faltante",
  "Banco incorrecto",
  "Número de crédito incorrecto",
  "Dirección incompleta",
  "Cotitular incompleto",
  "Otro",
] as const;

export type ValidacionFields = {
  validacion_estado: ValidacionEstado;
  validacion_confirmado_licenciado: boolean;
  validacion_confirmado_at: string | null;
  validacion_enviado_at: string | null;
  validacion_aprobado_por: string | null;
  validacion_aprobado_at: string | null;
  validacion_motivo_devolucion: string | null;
  validacion_version: number;
};

export function readValidacion(exp: Partial<Expediente> & Partial<ValidacionFields>): ValidacionFields {
  const x = exp as unknown as Partial<ValidacionFields>;
  return {
    validacion_estado: (x.validacion_estado as ValidacionEstado) || "pendiente_validacion",
    validacion_confirmado_licenciado: !!x.validacion_confirmado_licenciado,
    validacion_confirmado_at: x.validacion_confirmado_at ?? null,
    validacion_enviado_at: x.validacion_enviado_at ?? null,
    validacion_aprobado_por: x.validacion_aprobado_por ?? null,
    validacion_aprobado_at: x.validacion_aprobado_at ?? null,
    validacion_motivo_devolucion: x.validacion_motivo_devolucion ?? null,
    validacion_version: Number(x.validacion_version ?? 1),
  };
}

export function puedeGenerarDocumentos(v: ValidacionFields): boolean {
  return v.validacion_estado === "datos_validados";
}

export function razonBloqueoDocs(v: ValidacionFields): string | null {
  switch (v.validacion_estado) {
    case "datos_validados":
      return null;
    case "pendiente_validacion":
      return "Este expediente aún no tiene datos validados. No se pueden generar documentos jurídicos hasta que Contratación apruebe la información.";
    case "en_revision_contratacion":
      return "Datos en revisión por Contratación. Espera la aprobación antes de generar documentos.";
    case "devuelto_datos_incorrectos":
      return "Contratación devolvió el expediente por datos incorrectos. Corrige y reenvía para volver a generar documentos.";
    case "bloqueado_inconsistencia":
      return "Expediente bloqueado por inconsistencia crítica. Solo Super Admin puede desbloquear.";
  }
}

// ── Detección de inconsistencias ──────────────────────────────────────────

export interface CamposCriticos {
  nombre: string;
  tipoDocumento?: string;
  cedula: string;
  lugarExpedicion?: string;
  fechaExpedicion?: string;
  email?: string;
  celular?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  banco: string;
  numeroCredito: string;
  tipoProducto?: string;
  cotitularActivo?: boolean;
  cotitularNombre?: string;
  cotitularCedula?: string;
  cotitularDireccion?: string;
}

export type Inconsistencia = {
  severidad: "alta" | "media" | "baja";
  campo: string;
  mensaje: string;
};

const SOLO_LETRAS_CO = /^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ' ´.\-]+$/;

export function detectarInconsistencias(c: CamposCriticos): Inconsistencia[] {
  const out: Inconsistencia[] = [];
  const push = (severidad: Inconsistencia["severidad"], campo: string, mensaje: string) =>
    out.push({ severidad, campo, mensaje });

  // Nombre
  const nombre = (c.nombre || "").trim();
  if (!nombre) push("alta", "nombre", "Nombre del cliente vacío.");
  else {
    if (nombre.length < 5) push("alta", "nombre", "Nombre demasiado corto.");
    if (/\d/.test(nombre)) push("alta", "nombre", "El nombre contiene números.");
    if (!SOLO_LETRAS_CO.test(nombre)) push("media", "nombre", "El nombre contiene caracteres inválidos.");
    if (nombre.trim().split(/\s+/).length < 2)
      push("media", "nombre", "Falta al menos un apellido en el nombre.");
  }

  // Cédula
  const cedula = (c.cedula || "").replace(/\D/g, "");
  if (!cedula) push("alta", "cedula", "Documento del cliente vacío.");
  else if (cedula.length < 6 || cedula.length > 11)
    push("alta", "cedula", "Longitud de documento inválida (esperado 6 a 11 dígitos).");

  // Lugar expedición
  if (!c.lugarExpedicion?.trim())
    push("media", "lugarExpedicion", "Falta lugar de expedición del documento.");

  // Email / celular
  if (c.email && c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()))
    push("media", "email", "Correo electrónico con formato inválido.");
  if (c.celular && c.celular.replace(/\D/g, "").length < 7)
    push("baja", "celular", "Celular demasiado corto.");

  // Dirección / ciudad
  if (!c.direccion?.trim()) push("media", "direccion", "Dirección vacía.");
  if (!c.ciudad?.trim()) push("alta", "ciudad", "Ciudad de residencia vacía.");
  else if (!isCityKnown(c.ciudad))
    push("media", "ciudad", `Ciudad "${c.ciudad}" no reconocida en catálogo Colombia.`);

  // Banco / crédito
  if (!c.banco?.trim()) push("alta", "banco", "Banco no especificado.");
  if (!c.numeroCredito?.trim()) push("alta", "numeroCredito", "Número de crédito vacío.");
  if (!c.tipoProducto?.trim()) push("media", "tipoProducto", "Tipo de producto no especificado.");

  // Cotitular
  if (c.cotitularActivo) {
    if (!c.cotitularNombre?.trim())
      push("alta", "cotitularNombre", "Cotitular activado pero sin nombre.");
    if (!c.cotitularCedula?.trim())
      push("alta", "cotitularCedula", "Cotitular activado pero sin documento.");
    if (!c.cotitularDireccion?.trim())
      push("baja", "cotitularDireccion", "Cotitular sin dirección registrada.");
  }
  return out;
}

export function extraerCamposCriticosDesdeExpediente(
  exp: Expediente,
): CamposCriticos {
  const cd = (exp.cliente_data ?? {}) as Record<string, unknown>;
  const pick = (k: string) => (typeof cd[k] === "string" ? (cd[k] as string) : "");
  const ij = (cd.informacionJuridica ?? {}) as {
    titular?: Record<string, string>;
    cotitular?: Record<string, string> & { activo?: boolean };
  };
  const t = ij.titular ?? {};
  const co = ij.cotitular ?? {};
  return {
    nombre: t.nombre || pick("nombre") || exp.cliente_nombre || "",
    tipoDocumento: t.tipoDocumento || pick("tipoDocumento") || "CC",
    cedula: t.cedula || pick("cedula") || exp.cedula || "",
    lugarExpedicion: t.expedidaEn || pick("expedidaEn") || "",
    fechaExpedicion: t.fechaExpedicion || pick("fechaExpedicion") || "",
    email: t.email || pick("email") || pick("correo") || "",
    celular: t.telefono || pick("telefono") || pick("celular") || "",
    direccion: t.direccion || pick("direccion") || "",
    ciudad: t.ciudad || pick("ciudad") || "",
    departamento: t.departamento || pick("departamento") || "",
    banco: pick("banco") || exp.banco || "",
    numeroCredito: pick("numeroCredito") || exp.numero_credito || "",
    tipoProducto: pick("tipoProducto") || exp.producto || "",
    cotitularActivo: !!co.activo,
    cotitularNombre: co.nombre || "",
    cotitularCedula: co.cedula || "",
    cotitularDireccion: co.direccion || "",
  };
}

// ── Operaciones contra Supabase ───────────────────────────────────────────

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("No autenticado");
  return data.user.id;
}

async function snapshot(expedienteId: string) {
  const { data } = await supabase
    .from("expedientes")
    .select("cliente_nombre,cedula,banco,numero_credito,producto,cliente_data")
    .eq("id", expedienteId)
    .maybeSingle();
  return data ?? {};
}

async function registrar(
  expedienteId: string,
  accion: string,
  motivo: string | null,
  datos?: Record<string, unknown>,
) {
  const user_id = await uid().catch(() => null);
  await supabase.from("expediente_validacion_historial").insert({
    expediente_id: expedienteId,
    accion,
    motivo,
    user_id,
    datos_snapshot: (datos ?? null) as never,
  });
}

export async function confirmarChecklistLicenciado(
  expedienteId: string,
  confirmar: boolean,
) {
  const { error } = await supabase
    .from("expedientes")
    .update({
      validacion_confirmado_licenciado: confirmar,
      validacion_confirmado_at: confirmar ? new Date().toISOString() : null,
    } as never)
    .eq("id", expedienteId);
  if (error) throw error;
}

export async function enviarAValidacion(expedienteId: string, nota?: string) {
  const snap = await snapshot(expedienteId);
  const { error } = await supabase
    .from("expedientes")
    .update({
      validacion_estado: "en_revision_contratacion",
      validacion_enviado_at: new Date().toISOString(),
      validacion_motivo_devolucion: null,
    } as never)
    .eq("id", expedienteId);
  if (error) throw error;
  await registrar(expedienteId, "enviar", nota ?? null, snap);
}

export async function aprobarValidacion(expedienteId: string, nota?: string) {
  const user_id = await uid();
  const snap = await snapshot(expedienteId);
  const { error } = await supabase
    .from("expedientes")
    .update({
      validacion_estado: "datos_validados",
      validacion_aprobado_por: user_id,
      validacion_aprobado_at: new Date().toISOString(),
      validacion_motivo_devolucion: null,
    } as never)
    .eq("id", expedienteId);
  if (error) throw error;
  await registrar(expedienteId, "aprobar", nota ?? null, snap);
}

export async function devolverValidacion(expedienteId: string, motivo: string) {
  if (!motivo || motivo.trim().length < 4)
    throw new Error("Indica un motivo de devolución (mínimo 4 caracteres).");
  const snap = await snapshot(expedienteId);
  const { error } = await supabase
    .from("expedientes")
    .update({
      validacion_estado: "devuelto_datos_incorrectos",
      validacion_motivo_devolucion: motivo.trim().slice(0, 500),
    } as never)
    .eq("id", expedienteId);
  if (error) throw error;
  await registrar(expedienteId, "devolver", motivo, snap);
}

export async function bloquearInconsistencia(expedienteId: string, motivo: string) {
  if (!motivo || motivo.trim().length < 4)
    throw new Error("Indica el motivo de bloqueo (mínimo 4 caracteres).");
  const snap = await snapshot(expedienteId);
  const { error } = await supabase
    .from("expedientes")
    .update({
      validacion_estado: "bloqueado_inconsistencia",
      validacion_motivo_devolucion: motivo.trim().slice(0, 500),
    } as never)
    .eq("id", expedienteId);
  if (error) throw error;
  await registrar(expedienteId, "bloquear", motivo, snap);
}

export async function desbloquearExcepcional(expedienteId: string, motivo: string) {
  if (!motivo || motivo.trim().length < 6)
    throw new Error("Indica el motivo de desbloqueo (mínimo 6 caracteres).");
  const { error } = await supabase
    .from("expedientes")
    .update({
      validacion_estado: "pendiente_validacion",
      validacion_motivo_devolucion: null,
    } as never)
    .eq("id", expedienteId);
  if (error) throw error;
  await registrar(expedienteId, "desbloquear", motivo);
}

export interface HistorialItem {
  id: string;
  expediente_id: string;
  accion: string;
  motivo: string | null;
  user_id: string | null;
  created_at: string;
}

export async function listHistorialValidacion(
  expedienteId: string,
): Promise<HistorialItem[]> {
  const { data, error } = await supabase
    .from("expediente_validacion_historial")
    .select("id,expediente_id,accion,motivo,user_id,created_at")
    .eq("expediente_id", expedienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HistorialItem[];
}

export interface BandejaItem {
  id: string;
  cliente_nombre: string;
  cedula: string | null;
  banco: string | null;
  asesor_id: string;
  validacion_estado: ValidacionEstado;
  validacion_enviado_at: string | null;
  validacion_confirmado_licenciado: boolean;
  validacion_motivo_devolucion: string | null;
  validacion_version: number;
  updated_at: string;
}

export async function listBandejaValidacion(filtro?: ValidacionEstado | "todos"): Promise<BandejaItem[]> {
  let q = supabase
    .from("expedientes")
    .select(
      "id,cliente_nombre,cedula,banco,asesor_id,validacion_estado,validacion_enviado_at,validacion_confirmado_licenciado,validacion_motivo_devolucion,validacion_version,updated_at",
    )
    .order("validacion_enviado_at", { ascending: false, nullsFirst: false });
  if (filtro && filtro !== "todos") q = q.eq("validacion_estado", filtro);
  else q = q.in("validacion_estado", [
    "pendiente_validacion",
    "en_revision_contratacion",
    "devuelto_datos_incorrectos",
    "bloqueado_inconsistencia",
  ]);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as BandejaItem[];
}

// ── Versionamiento documental ─────────────────────────────────────────────

export async function registrarVersionDocumento(
  expedienteId: string,
  tipo: "poder" | "contrato" | "datos_contrato" | "solicitud_plazos" | "derecho_peticion" | "tutela" | "negacion" | "radicacion" | "otro",
  snapshotDoc?: Record<string, unknown>,
) {
  const created_by = await uid().catch(() => null);
  const { data: prev } = await supabase
    .from("documentos_juridicos_versiones")
    .select("version")
    .eq("expediente_id", expedienteId)
    .eq("tipo", tipo)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = ((prev?.[0]?.version as number) || 0) + 1;
  await supabase.from("documentos_juridicos_versiones").insert({
    expediente_id: expedienteId,
    tipo,
    version: nextVersion,
    snapshot: (snapshotDoc ?? null) as never,
    created_by,
  });
}

export interface VersionDoc {
  id: string;
  tipo: string;
  version: number;
  obsoleto: boolean;
  motivo_obsoleto: string | null;
  created_by: string | null;
  created_at: string;
  obsoleto_at: string | null;
}

export async function listVersionesDocumentos(expedienteId: string): Promise<VersionDoc[]> {
  const { data, error } = await supabase
    .from("documentos_juridicos_versiones")
    .select("id,tipo,version,obsoleto,motivo_obsoleto,created_by,created_at,obsoleto_at")
    .eq("expediente_id", expedienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VersionDoc[];
}
