import { supabase } from "@/integrations/supabase/client";

export type AcademiaRol =
  | "licenciado" | "operaciones" | "juridica" | "contabilidad"
  | "director_financiero_qa" | "gerencia" | "super_admin";

export type LeccionTipo = "texto" | "pdf" | "video" | "imagen" | "checklist" | "enlace" | "faq";
export type PreguntaTipo = "unica" | "multiple" | "verdadero_falso";

export const ROL_LABEL: Record<AcademiaRol, string> = {
  licenciado: "Academia Licenciado",
  operaciones: "Academia Operaciones",
  juridica: "Academia Jurídica",
  contabilidad: "Academia Contabilidad",
  director_financiero_qa: "Academia Director Financiero QA",
  gerencia: "Academia Gerencia",
  super_admin: "Academia Super Admin",
};

export const ROL_LIST: AcademiaRol[] = [
  "licenciado", "operaciones", "juridica", "contabilidad",
  "director_financiero_qa", "gerencia", "super_admin",
];

export interface Curso {
  id: string; rol_destino: AcademiaRol; titulo: string; descripcion: string | null;
  orden: number; activo: boolean; created_at: string; updated_at: string;
}
export interface Modulo {
  id: string; curso_id: string; titulo: string; descripcion: string | null;
  orden: number; activo: boolean;
}
export interface Leccion {
  id: string; modulo_id: string; titulo: string; tipo: LeccionTipo;
  contenido: Record<string, unknown>; orden: number; duracion_min: number; activo: boolean;
}
export interface Evaluacion {
  id: string; modulo_id: string; titulo: string;
  nota_minima: number; intentos_permitidos: number; activo: boolean;
}
export interface Pregunta {
  id: string; evaluacion_id: string; enunciado: string; tipo: PreguntaTipo;
  opciones: string[]; respuesta_correcta: (string | number)[]; puntos: number; orden: number;
}
export interface Intento {
  id: string; evaluacion_id: string; user_id: string; respuestas: Record<string, unknown>;
  nota: number; porcentaje: number; aprobado: boolean; created_at: string;
}
export interface Certificacion {
  id: string; user_id: string; curso_id: string; nota_final: number; codigo: string; emitida_at: string;
}

const sb = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function getMyAcademiaRol(): Promise<AcademiaRol | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await sb.rpc("academia_rol_del_usuario", { _uid: u.user.id });
  return (data as AcademiaRol) ?? null;
}

export async function getCursoByRol(rol: AcademiaRol): Promise<Curso | null> {
  const { data } = await sb.from("academia_cursos").select("*").eq("rol_destino", rol).eq("activo", true).order("orden").limit(1).maybeSingle();
  return (data as Curso) ?? null;
}

export async function listCursos(): Promise<Curso[]> {
  const { data } = await sb.from("academia_cursos").select("*").order("orden");
  return (data as Curso[]) ?? [];
}

export async function getModulos(cursoId: string): Promise<Modulo[]> {
  const { data } = await sb.from("academia_modulos").select("*").eq("curso_id", cursoId).order("orden");
  return (data as Modulo[]) ?? [];
}

export async function getModulo(id: string): Promise<Modulo | null> {
  const { data } = await sb.from("academia_modulos").select("*").eq("id", id).maybeSingle();
  return (data as Modulo) ?? null;
}

export async function getLecciones(moduloId: string): Promise<Leccion[]> {
  const { data } = await sb.from("academia_lecciones").select("*").eq("modulo_id", moduloId).order("orden");
  return (data as Leccion[]) ?? [];
}

export async function getLeccion(id: string): Promise<Leccion | null> {
  const { data } = await sb.from("academia_lecciones").select("*").eq("id", id).maybeSingle();
  return (data as Leccion) ?? null;
}

export async function getEvaluaciones(moduloId: string): Promise<Evaluacion[]> {
  const { data } = await sb.from("academia_evaluaciones").select("*").eq("modulo_id", moduloId).order("created_at");
  return (data as Evaluacion[]) ?? [];
}

export async function getEvaluacion(id: string): Promise<Evaluacion | null> {
  const { data } = await sb.from("academia_evaluaciones").select("*").eq("id", id).maybeSingle();
  return (data as Evaluacion) ?? null;
}

export async function getPreguntas(evaluacionId: string): Promise<Pregunta[]> {
  const { data } = await sb.from("academia_preguntas").select("*").eq("evaluacion_id", evaluacionId).order("orden");
  return (data as Pregunta[]) ?? [];
}

export async function marcarLeccionCompletada(leccionId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await sb.from("academia_progreso_lecciones").upsert({ user_id: u.user.id, leccion_id: leccionId, completada: true, completada_at: new Date().toISOString() });
}

export async function listProgresoLecciones(leccionIds: string[]): Promise<Set<string>> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user || leccionIds.length === 0) return new Set();
  const { data } = await sb.from("academia_progreso_lecciones").select("leccion_id").eq("user_id", u.user.id).in("leccion_id", leccionIds);
  return new Set(((data as { leccion_id: string }[]) ?? []).map((r) => r.leccion_id));
}

export async function listMisIntentos(evaluacionIds: string[]): Promise<Intento[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user || evaluacionIds.length === 0) return [];
  const { data } = await sb.from("academia_intentos").select("*").eq("user_id", u.user.id).in("evaluacion_id", evaluacionIds).order("created_at", { ascending: false });
  return (data as Intento[]) ?? [];
}

export async function guardarIntento(input: { evaluacionId: string; respuestas: Record<string, unknown>; nota: number; porcentaje: number; aprobado: boolean; }): Promise<Intento | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await sb.from("academia_intentos").insert({
    evaluacion_id: input.evaluacionId, user_id: u.user.id,
    respuestas: input.respuestas, nota: input.nota, porcentaje: input.porcentaje, aprobado: input.aprobado,
  }).select("*").maybeSingle();
  return (data as Intento) ?? null;
}

export async function intentarEmitirCertificado(cursoId: string): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await sb.rpc("intentar_emitir_certificado", { _user_id: u.user.id, _curso_id: cursoId });
  return (data as string) ?? null;
}

export async function listMisCertificaciones(): Promise<Certificacion[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await sb.from("academia_certificaciones").select("*").eq("user_id", u.user.id).order("emitida_at", { ascending: false });
  return (data as Certificacion[]) ?? [];
}

export async function getCertificacionByCodigo(codigo: string): Promise<Certificacion | null> {
  const { data } = await sb.from("academia_certificaciones").select("*").eq("codigo", codigo).maybeSingle();
  return (data as Certificacion) ?? null;
}

export function calificar(preguntas: Pregunta[], respuestas: Record<string, (string | number)[]>) {
  let total = 0; let obtenido = 0;
  for (const p of preguntas) {
    total += Number(p.puntos) || 1;
    const r = respuestas[p.id] ?? [];
    const correctas = (p.respuesta_correcta ?? []).map(String).sort();
    const dadas = r.map(String).sort();
    if (correctas.length === dadas.length && correctas.every((v, i) => v === dadas[i])) {
      obtenido += Number(p.puntos) || 1;
    }
  }
  const porcentaje = total > 0 ? Math.round((obtenido / total) * 10000) / 100 : 0;
  return { nota: obtenido, total, porcentaje };
}
