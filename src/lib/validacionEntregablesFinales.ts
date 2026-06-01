// Fase 6 — Validación de entregables finales antes de cerrar el caso.
// Bloquea la generación del paz y salvo (y por extensión el cierre automático)
// hasta que se cumplan los entregables operativos finales.
import { supabase } from "@/integrations/supabase/client";

export interface RequisitoFinal {
  key: "resultado_final" | "soportes_banco" | "cuenta_cobro" | "honorarios_pagados";
  label: string;
  cumple: boolean;
  detalle?: string;
}

export interface ResultadoValidacionEntregables {
  puedeCerrar: boolean;
  requisitos: RequisitoFinal[];
  pendientes: string[];
}

const ESTADOS_RESULTADO_FINAL = new Set([
  "resultado_final_generado", "cuenta_cobro_generada", "cuenta_cobro_enviada",
  "honorarios_pendientes", "honorarios_pagados", "paz_y_salvo_generado", "caso_finalizado",
]);
const ESTADOS_CUENTA_COBRO = new Set([
  "cuenta_cobro_generada", "cuenta_cobro_enviada", "honorarios_pendientes",
  "honorarios_pagados", "paz_y_salvo_generado", "caso_finalizado",
]);
const ESTADOS_HONORARIOS_PAGADOS = new Set([
  "honorarios_pagados", "paz_y_salvo_generado", "caso_finalizado",
]);

export async function evaluarEntregablesFinales(expedienteId: string): Promise<ResultadoValidacionEntregables> {
  const { data: hist } = await supabase
    .from("expediente_historial")
    .select("estado_caso_nuevo")
    .eq("expediente_id", expedienteId);
  const estados = new Set<string>(
    ((hist ?? []) as Array<{ estado_caso_nuevo: string | null }>)
      .map((h) => h.estado_caso_nuevo || "")
      .filter(Boolean),
  );
  const { data: exp } = await supabase
    .from("expedientes")
    .select("estado_caso" as never)
    .eq("id", expedienteId)
    .single();
  const actual = (exp as unknown as { estado_caso?: string })?.estado_caso ?? "";
  if (actual) estados.add(actual);

  const resultadoOk = [...estados].some((e) => ESTADOS_RESULTADO_FINAL.has(e));
  const cuentaCobroOk = [...estados].some((e) => ESTADOS_CUENTA_COBRO.has(e));
  const honorariosOk = [...estados].some((e) => ESTADOS_HONORARIOS_PAGADOS.has(e));

  // Soportes banco: al menos un archivo cargado en expediente_soportes
  let soportesOk = false;
  let detalleSoportes = "";
  try {
    const { count } = await supabase
      .from("expediente_soportes" as never)
      .select("id", { count: "exact", head: true })
      .eq("expediente_id", expedienteId);
    soportesOk = (count ?? 0) > 0;
    if (!soportesOk) detalleSoportes = "No se ha cargado ningún soporte del banco.";
  } catch {
    detalleSoportes = "No se pudo verificar los soportes del banco.";
  }

  const requisitos: RequisitoFinal[] = [
    { key: "resultado_final", label: "Resultado final generado", cumple: resultadoOk, detalle: resultadoOk ? undefined : "Falta generar el resultado final del caso." },
    { key: "soportes_banco", label: "Soportes del banco cargados", cumple: soportesOk, detalle: soportesOk ? undefined : detalleSoportes },
    { key: "cuenta_cobro", label: "Cuenta de cobro emitida", cumple: cuentaCobroOk, detalle: cuentaCobroOk ? undefined : "Falta generar/enviar la cuenta de cobro." },
    { key: "honorarios_pagados", label: "Honorarios pagados", cumple: honorariosOk, detalle: honorariosOk ? undefined : "Los honorarios aún no figuran como pagados." },
  ];

  const pendientes = requisitos.filter((r) => !r.cumple).map((r) => r.label);
  return { puedeCerrar: pendientes.length === 0, requisitos, pendientes };
}

export class BloqueoCierreError extends Error {
  pendientes: string[];
  constructor(pendientes: string[]) {
    super(`No se puede cerrar el caso: faltan ${pendientes.join(", ")}.`);
    this.name = "BloqueoCierreError";
    this.pendientes = pendientes;
  }
}
