import { supabase } from "@/integrations/supabase/client";

export const BANCOS_DISPONIBLES = [
  "Bancolombia",
  "Davivienda",
  "Banco de Bogotá",
  "Davibank",
  "Caja Social",
  "Banco Popular",
  "Banco de Occidente",
  "Credifamilia",
  "FNA",
  "Otros",
] as const;

export type BancoAsignado = typeof BANCOS_DISPONIBLES[number];

export interface ApoderadoNuvex {
  id: string;
  nombre: string;
  cedula: string;
  lugar_expedicion: string | null;
  ciudad: string | null;
  celular: string | null;
  correo: string | null;
  activo: boolean;
  predeterminado_general: boolean;
  predeterminado_fna: boolean;
  bancos_asignados: string[];
  created_at: string;
  updated_at: string;
}

export interface ApoderadoInput {
  nombre: string;
  cedula: string;
  lugar_expedicion: string;
  ciudad: string;
  celular: string;
  correo: string;
  activo: boolean;
  predeterminado_general: boolean;
  predeterminado_fna: boolean;
  bancos_asignados: string[];
}

export async function listApoderados(soloActivos = false): Promise<ApoderadoNuvex[]> {
  let q = supabase.from("apoderados_nuvex").select("*").order("nombre", { ascending: true });
  if (soloActivos) q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as Partial<ApoderadoNuvex>[]).map((r) => ({
    id: String(r.id),
    nombre: r.nombre ?? "",
    cedula: r.cedula ?? "",
    lugar_expedicion: r.lugar_expedicion ?? null,
    ciudad: r.ciudad ?? null,
    celular: r.celular ?? null,
    correo: r.correo ?? null,
    activo: !!r.activo,
    predeterminado_general: !!r.predeterminado_general,
    predeterminado_fna: !!r.predeterminado_fna,
    bancos_asignados: Array.isArray(r.bancos_asignados) ? (r.bancos_asignados as string[]) : [],
    created_at: r.created_at ?? "",
    updated_at: r.updated_at ?? "",
  }));
}

// Si se marca predeterminado_general/fna, desmarcar al resto para no violar el índice único.
async function clearOtherDefaults(opts: { excludeId?: string; general?: boolean; fna?: boolean }) {
  if (opts.general) {
    let q = supabase.from("apoderados_nuvex").update({ predeterminado_general: false } as never).eq("predeterminado_general", true);
    if (opts.excludeId) q = q.neq("id", opts.excludeId);
    await q;
  }
  if (opts.fna) {
    let q = supabase.from("apoderados_nuvex").update({ predeterminado_fna: false } as never).eq("predeterminado_fna", true);
    if (opts.excludeId) q = q.neq("id", opts.excludeId);
    await q;
  }
}

export async function createApoderado(p: ApoderadoInput): Promise<ApoderadoNuvex> {
  await clearOtherDefaults({ general: p.predeterminado_general, fna: p.predeterminado_fna });
  const { data, error } = await supabase
    .from("apoderados_nuvex")
    .insert({
      nombre: p.nombre,
      cedula: p.cedula,
      lugar_expedicion: p.lugar_expedicion || null,
      ciudad: p.ciudad || null,
      celular: p.celular || null,
      correo: p.correo || null,
      activo: p.activo,
      predeterminado_general: p.predeterminado_general,
      predeterminado_fna: p.predeterminado_fna,
      bancos_asignados: p.bancos_asignados,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ApoderadoNuvex;
}

export async function updateApoderado(id: string, p: Partial<ApoderadoInput>): Promise<ApoderadoNuvex> {
  await clearOtherDefaults({
    excludeId: id,
    general: p.predeterminado_general === true,
    fna: p.predeterminado_fna === true,
  });
  const row: Record<string, unknown> = {};
  if (p.nombre !== undefined) row.nombre = p.nombre;
  if (p.cedula !== undefined) row.cedula = p.cedula;
  if (p.lugar_expedicion !== undefined) row.lugar_expedicion = p.lugar_expedicion || null;
  if (p.ciudad !== undefined) row.ciudad = p.ciudad || null;
  if (p.celular !== undefined) row.celular = p.celular || null;
  if (p.correo !== undefined) row.correo = p.correo || null;
  if (p.activo !== undefined) row.activo = p.activo;
  if (p.predeterminado_general !== undefined) row.predeterminado_general = p.predeterminado_general;
  if (p.predeterminado_fna !== undefined) row.predeterminado_fna = p.predeterminado_fna;
  if (p.bancos_asignados !== undefined) row.bancos_asignados = p.bancos_asignados;
  const { data, error } = await supabase
    .from("apoderados_nuvex")
    .update(row as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ApoderadoNuvex;
}

export async function deleteApoderado(id: string): Promise<void> {
  const { error } = await supabase.from("apoderados_nuvex").delete().eq("id", id);
  if (error) throw error;
}

// ── Selección automática por banco ─────────────────────────────────────
export type MotivoSeleccion =
  | "predeterminado_fna"
  | "predeterminado_general"
  | "asignado_banco"
  | "unico_disponible"
  | "manual"
  | "ninguno";

export interface SeleccionApoderado {
  apoderado: ApoderadoNuvex | null;
  motivo: MotivoSeleccion;
  candidatos: ApoderadoNuvex[]; // apoderados elegibles para este banco
}

function normBanco(b?: string | null): string {
  return (b ?? "").trim().toLowerCase();
}

export function isFNA(banco?: string | null): boolean {
  return normBanco(banco) === "fna";
}

/** Devuelve el apoderado sugerido para un banco según las reglas:
 *  - Si banco = FNA → predeterminado_fna.
 *  - Sino → predeterminado_general.
 *  - Candidatos: apoderados activos que tengan el banco en bancos_asignados
 *    (o lista vacía = elegible para todos).
 */
export function seleccionarApoderado(
  banco: string | null | undefined,
  apoderados: ApoderadoNuvex[],
): SeleccionApoderado {
  const activos = apoderados.filter((a) => a.activo);
  const fna = isFNA(banco);
  const bancoNorm = normBanco(banco);

  const candidatos = activos.filter((a) => {
    if (!a.bancos_asignados || a.bancos_asignados.length === 0) return true;
    return a.bancos_asignados.some((x) => normBanco(x) === bancoNorm);
  });

  if (fna) {
    const pf = activos.find((a) => a.predeterminado_fna);
    if (pf) return { apoderado: pf, motivo: "predeterminado_fna", candidatos };
  } else {
    const pg = activos.find((a) => a.predeterminado_general);
    if (pg) return { apoderado: pg, motivo: "predeterminado_general", candidatos };
  }

  if (candidatos.length === 1) {
    return { apoderado: candidatos[0], motivo: "unico_disponible", candidatos };
  }
  if (candidatos.length > 1) {
    return { apoderado: candidatos[0], motivo: "asignado_banco", candidatos };
  }
  return { apoderado: activos[0] ?? null, motivo: activos.length ? "asignado_banco" : "ninguno", candidatos: activos };
}
