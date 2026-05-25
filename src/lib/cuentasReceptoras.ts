import { supabase } from "@/integrations/supabase/client";

export interface CuentaReceptora {
  id: string;
  banco: string;
  tipo: string;
  numero: string | null;
  titular: string | null;
  nit: string | null;
  activa: boolean;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export const METODOS_PAGO = [
  { key: "transferencia", label: "Transferencia bancaria" },
  { key: "wompi", label: "Wompi (PSE / Tarjeta)" },
  { key: "nequi", label: "Nequi" },
  { key: "daviplata", label: "Daviplata" },
  { key: "pse", label: "PSE directo" },
  { key: "efectivo", label: "Efectivo" },
  { key: "cheque", label: "Cheque" },
  { key: "otro", label: "Otro" },
] as const;

export type MetodoPago = typeof METODOS_PAGO[number]["key"];

export async function listCuentasReceptoras(soloActivas = false): Promise<CuentaReceptora[]> {
  let q = supabase.from("cuentas_receptoras" as never).select("*").order("banco");
  if (soloActivas) q = q.eq("activa", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as CuentaReceptora[];
}

export async function upsertCuentaReceptora(c: Partial<CuentaReceptora> & { banco: string }): Promise<void> {
  const payload = {
    id: c.id,
    banco: c.banco,
    tipo: c.tipo ?? "ahorros",
    numero: c.numero ?? null,
    titular: c.titular ?? null,
    nit: c.nit ?? null,
    activa: c.activa ?? true,
    observaciones: c.observaciones ?? null,
  };
  const { error } = c.id
    ? await supabase.from("cuentas_receptoras" as never).update(payload as never).eq("id", c.id)
    : await supabase.from("cuentas_receptoras" as never).insert(payload as never);
  if (error) throw error;
}

export async function deleteCuentaReceptora(id: string): Promise<void> {
  const { error } = await supabase.from("cuentas_receptoras" as never).delete().eq("id", id);
  if (error) throw error;
}

// ---------- Parámetros financieros ----------
export interface ParametroFinanciero {
  clave: string;
  valor: unknown;
  descripcion: string | null;
  updated_at: string;
}

export async function getParametrosFinancieros(): Promise<Record<string, number>> {
  const { data } = await supabase.from("parametros_financieros" as never).select("*");
  const rows = (data ?? []) as unknown as ParametroFinanciero[];
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = typeof r.valor === "number" ? r.valor : Number(r.valor);
    if (!Number.isNaN(v)) out[r.clave] = v;
  }
  return out;
}

export async function setParametroFinanciero(clave: string, valor: number): Promise<void> {
  const { error } = await supabase
    .from("parametros_financieros" as never)
    .upsert({ clave, valor: valor as never } as never, { onConflict: "clave" });
  if (error) throw error;
}

export function calcularDesgloseWompi(
  valorBruto: number,
  feePct: number,
  ivaPct: number,
): { fee: number; iva: number; neto: number } {
  const fee = Math.round((valorBruto * feePct) / 100 * 100) / 100;
  const iva = Math.round((fee * ivaPct) / 100 * 100) / 100;
  const neto = Math.round((valorBruto - fee - iva) * 100) / 100;
  return { fee, iva, neto };
}
