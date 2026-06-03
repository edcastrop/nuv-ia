import { supabase } from "@/integrations/supabase/client";

export interface WalletSaldos {
  disponible: number;
  en_tramite: number;
  pendiente_recaudo: number;
  pagado_historico: number;
  ajustes_credito: number;
  ajustes_debito: number;
  retenido: number;
}

export type WalletMovTipo =
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
  | "liberacion_retencion";

export interface WalletMovimiento {
  id: string;
  user_id: string;
  tipo: WalletMovTipo;
  monto: number;
  descripcion: string | null;
  comision_id: string | null;
  cuenta_cobro_id: string | null;
  ajuste_id: string | null;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

export interface WalletAjuste {
  id: string;
  user_id: string;
  tipo: "ajuste_credito" | "ajuste_debito" | "retencion" | "liberacion_retencion";
  monto: number;
  motivo: string;
  anulado: boolean;
  anulado_at: string | null;
  anulado_por: string | null;
  anulado_motivo: string | null;
  created_by: string;
  created_at: string;
}

const EMPTY: WalletSaldos = {
  disponible: 0,
  en_tramite: 0,
  pendiente_recaudo: 0,
  pagado_historico: 0,
  ajustes_credito: 0,
  ajustes_debito: 0,
  retenido: 0,
};

export async function getWalletSaldos(userId: string): Promise<WalletSaldos> {
  const { data, error } = await supabase.rpc("wallet_saldos" as never, { _user_id: userId } as never);
  if (error) throw error;
  const obj = (data ?? {}) as Partial<WalletSaldos>;
  return { ...EMPTY, ...obj };
}

export async function listWalletMovimientos(userId: string, limit = 100): Promise<WalletMovimiento[]> {
  const { data, error } = await supabase
    .from("wallet_movimientos" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as WalletMovimiento[];
}

export async function listWalletAjustes(userId: string): Promise<WalletAjuste[]> {
  const { data, error } = await supabase
    .from("wallet_ajustes" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as WalletAjuste[];
}

export async function crearAjusteWallet(input: {
  user_id: string;
  tipo: WalletAjuste["tipo"];
  monto: number;
  motivo: string;
}): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  if (!input.motivo || input.motivo.trim().length < 5) {
    throw new Error("El motivo es obligatorio (mín. 5 caracteres)");
  }
  if (!(input.monto > 0)) throw new Error("El monto debe ser positivo");

  const { data, error } = await supabase
    .from("wallet_ajustes" as never)
    .insert({
      user_id: input.user_id,
      tipo: input.tipo,
      monto: input.monto,
      motivo: input.motivo.trim(),
      created_by: u.user.id,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as unknown as { id: string }).id;
}

export async function anularAjusteWallet(id: string, motivo: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  if (!motivo || motivo.trim().length < 5) {
    throw new Error("Motivo de anulación obligatorio (mín. 5 caracteres)");
  }
  const { error } = await supabase
    .from("wallet_ajustes" as never)
    .update({
      anulado: true,
      anulado_at: new Date().toISOString(),
      anulado_por: u.user.id,
      anulado_motivo: motivo.trim(),
    } as never)
    .eq("id", id)
    .eq("anulado", false);
  if (error) throw error;
}

/** Lista de usuarios con actividad de comisiones (para vista contabilidad). */
export async function listWalletUsuarios(): Promise<Array<{ user_id: string; nombre: string; email: string }>> {
  const { data: com } = await supabase.from("comisiones" as never).select("user_id");
  const ids = Array.from(new Set(((com ?? []) as unknown as Array<{ user_id: string }>).map((r) => r.user_id)));
  if (!ids.length) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, nombre, email")
    .in("id", ids);
  return ((profs ?? []) as Array<{ id: string; nombre: string | null; email: string | null }>).map((p) => ({
    user_id: p.id,
    nombre: p.nombre || p.email || "—",
    email: p.email || "",
  }));
}

export const WALLET_MOV_LABEL: Record<WalletMovTipo, string> = {
  comision_generada: "Comisión generada",
  comision_liberada: "Comisión liberada",
  comision_pagada: "Comisión pagada",
  cc_creada: "Cuenta de cobro creada",
  cc_enviada: "CC enviada",
  cc_aprobada: "CC aprobada",
  cc_pagada: "CC pagada",
  cc_rechazada: "CC rechazada",
  ajuste_credito: "Ajuste a favor",
  ajuste_debito: "Ajuste en contra",
  retencion: "Retención",
  liberacion_retencion: "Liberación de retención",
};

export function signoMov(t: WalletMovTipo): "+" | "-" | "·" {
  if (t === "comision_liberada" || t === "comision_pagada" || t === "ajuste_credito" || t === "liberacion_retencion") return "+";
  if (t === "ajuste_debito" || t === "retencion" || t === "cc_rechazada") return "-";
  return "·";
}
