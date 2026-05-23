import { supabase } from "@/integrations/supabase/client";

export interface ApoderadoNuvex {
  id: string;
  nombre: string;
  cedula: string;
  lugar_expedicion: string | null;
  ciudad: string | null;
  celular: string | null;
  correo: string | null;
  activo: boolean;
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
}

export async function listApoderados(soloActivos = false): Promise<ApoderadoNuvex[]> {
  let q = supabase.from("apoderados_nuvex").select("*").order("nombre", { ascending: true });
  if (soloActivos) q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ApoderadoNuvex[];
}

export async function createApoderado(p: ApoderadoInput): Promise<ApoderadoNuvex> {
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
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ApoderadoNuvex;
}

export async function updateApoderado(id: string, p: Partial<ApoderadoInput>): Promise<ApoderadoNuvex> {
  const row: Record<string, unknown> = {};
  if (p.nombre !== undefined) row.nombre = p.nombre;
  if (p.cedula !== undefined) row.cedula = p.cedula;
  if (p.lugar_expedicion !== undefined) row.lugar_expedicion = p.lugar_expedicion || null;
  if (p.ciudad !== undefined) row.ciudad = p.ciudad || null;
  if (p.celular !== undefined) row.celular = p.celular || null;
  if (p.correo !== undefined) row.correo = p.correo || null;
  if (p.activo !== undefined) row.activo = p.activo;
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
