import { supabase } from "@/integrations/supabase/client";
import type { ClientData } from "@/components/nuvex/ClientFields";
import { estadosParaEtapa, type EtapaPipelineId } from "@/lib/pipelineEtapas";

export type EstadoExpediente =
  | "SIMULADO"
  | "FIRMADO"
  | "RADICADO"
  | "APROBADO"
  | "CONDICIONES_APLICADAS"
  | "FACTURADO"
  | "PAGADO"
  | "ENVIADO_CONTRATACION";

export const ESTADOS: EstadoExpediente[] = [
  "SIMULADO",
  "FIRMADO",
  "ENVIADO_CONTRATACION",
  "RADICADO",
  "APROBADO",
  "CONDICIONES_APLICADAS",
  "FACTURADO",
  "PAGADO",
];

export const ESTADO_COLORS: Record<EstadoExpediente, { bg: string; color: string; border: string }> = {
  SIMULADO:  { bg: "#EEF1FA", color: "#445DA3", border: "#445DA3" },
  FIRMADO:   { bg: "#FFF7E6", color: "#8A5A00", border: "#F0B429" },
  ENVIADO_CONTRATACION: { bg: "#E0E7FF", color: "#3730A3", border: "#6366F1" },
  RADICADO:  { bg: "#E8F0FE", color: "#1A4A8A", border: "#3B6FA0" },
  APROBADO:  { bg: "#EAF7EE", color: "#1F7A45", border: "#2E8B57" },
  CONDICIONES_APLICADAS: { bg: "#DDF4E3", color: "#0F5132", border: "#16A34A" },
  FACTURADO: { bg: "#F3E8FF", color: "#6B21A8", border: "#9333EA" },
  PAGADO:    { bg: "#DCFCE7", color: "#14532D", border: "#15803D" },
};

export interface PropuestaData {
  index?: number;
  nuevaCuota: number;
  nuevoPlazo: number;
  cuotasEliminadas?: number;
  añosEliminados: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorarios: number;
  totalProyectado: number;
  incrementoMensual?: number;
  fuente: "manual" | "automatica";
}

// discount_data persists the raw form state from DiscountModule (type/value/vigencia)
export type DiscountData = Record<string, unknown>;

export interface AprobadoData {
  fechaAprobacion: string;
  radicado: string;
  banco: string;
  cuotaAprobada: number;
  plazoAprobado: number;
  cuotasEliminadas?: number;
  añosEliminados?: number;
  ahorroIntereses?: number;
  ahorroSeguros?: number;
  ahorroTotal?: number;
  ahorroAprobado: number;
  honorariosBase?: number;
  descuento?: number;
  honorariosFinales?: number;
  observaciones?: string;
}

export interface Expediente {
  id: string;
  asesor_id: string;
  licenciado_id?: string | null;
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
  estado_caso?: string | null;
  fecha_simulacion: string;
  aprobado_data: AprobadoData | null;
  acertividad_global: number | null;
  qa_score?: number | null;
  qa_dictamen?: string | null;
  qa_categoria?: "excelente" | "aprobado" | "revisar" | "rechazado" | null;
  qa_auditoria_id?: string | null;
  qa_ejecutada_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertPayload {
  id?: string;
  modo: "pesos" | "uvr";
  cliente: ClientData;
  credito: Record<string, string>;
  propuesta: PropuestaData;
  discountState: DiscountData;
  honorariosBase: number;
  honorariosFinal: number;
  descuento: number;
}

type LooseRecord = Record<string, unknown>;

const asRecord = (v: unknown): LooseRecord =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as LooseRecord) : {};

const isMeaningfulValue = (v: unknown): boolean => {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return v === true;
  if (Array.isArray(v)) return v.some(isMeaningfulValue);
  if (typeof v === "object") return Object.values(v as LooseRecord).some(isMeaningfulValue);
  return true;
};

const firstMeaningful = (...values: unknown[]): unknown =>
  values.find(isMeaningfulValue);

const stringFrom = (...values: unknown[]): string => {
  const v = firstMeaningful(...values);
  return v === undefined ? "" : String(v).trim();
};

const mergePreservingMeaningful = (
  existing: LooseRecord | null | undefined,
  incoming: LooseRecord | null | undefined,
): LooseRecord => {
  const out: LooseRecord = { ...(existing ?? {}) };
  const src = incoming ?? {};
  for (const k of Object.keys(src)) {
    const next = src[k];
    const prev = out[k];
    if (!isMeaningfulValue(next)) continue;
    if (
      prev && next &&
      typeof prev === "object" && !Array.isArray(prev) &&
      typeof next === "object" && !Array.isArray(next)
    ) {
      out[k] = mergePreservingMeaningful(prev as LooseRecord, next as LooseRecord);
    } else if (!isMeaningfulValue(prev) || isMeaningfulValue(next)) {
      out[k] = next;
    }
  }
  return out;
};

const setIfBlank = (target: LooseRecord, key: string, ...values: unknown[]) => {
  if (!isMeaningfulValue(target[key])) {
    const v = firstMeaningful(...values);
    if (v !== undefined) target[key] = String(v).trim();
  }
};

const normalizeClienteSnapshot = (
  raw: LooseRecord | null | undefined,
  source: LooseRecord,
): LooseRecord => {
  const out: LooseRecord = { ...(raw ?? {}) };
  setIfBlank(out, "nombre", source.nombre, source.cliente_nombre, source.cliente, source.titular);
  setIfBlank(out, "cedula", source.cedula, source.documento, source.numeroDocumento);
  setIfBlank(out, "banco", source.banco);
  setIfBlank(out, "numeroCredito", source.numeroCredito, source.numero_credito);
  setIfBlank(out, "tipoProducto", source.tipoProducto, source.producto, source.tipo_credito, source.tipoCredito);
  setIfBlank(out, "plazoInicial", source.plazoInicial, source.cuotasTotales, source.plazoOriginal);
  setIfBlank(out, "cuotasPagadas", source.cuotasPagadas);
  setIfBlank(out, "cuotasPendientes", source.cuotasPendientes);
  setIfBlank(out, "fechaDesembolso", source.fechaDesembolso);
  if (!isMeaningfulValue(out.porcentajeHonorarios)) out.porcentajeHonorarios = "6";

  const cobertura = asRecord(out.cobertura);
  const tasaCobertura = stringFrom(cobertura.tasaCobertura, source.tasaCobertura, source.coberturaFrechPp);
  const valorCobertura = stringFrom(cobertura.valorCobertura, source.valorCobertura, source.valorSubsidioGobierno, source.coberturaFrechValorMensual);
  out.cobertura = {
    activo: cobertura.activo === true || !!tasaCobertura || !!valorCobertura,
    tasaCobertura,
    valorCobertura,
  };
  return out;
};

const normalizeCreditoSnapshot = (
  raw: LooseRecord | null | undefined,
  source: LooseRecord,
): LooseRecord => {
  const out: LooseRecord = { ...(raw ?? {}) };
  setIfBlank(out, "tea", source.tea, source.teaPactada, source.tasaEA, source.teaPct, source.tasaEa);
  setIfBlank(out, "teaCobrada", source.teaCobrada, source.tasaEA, source.teaPct, source.tasaEa);
  setIfBlank(out, "cuotaActual", source.cuotaActual, source.cuotaMensual, source.valorAPagar, source.cuotaPagadaCliente);
  setIfBlank(out, "cuotaActualPesos", source.cuotaActualPesos, source.cuotaActual, source.cuotaMensual, source.valorAPagar, source.cuotaPagadaCliente);
  setIfBlank(out, "saldoCapital", source.saldoCapital, source.saldoPesos);
  setIfBlank(out, "saldoPesos", source.saldoPesos, source.saldoCapital);
  setIfBlank(out, "saldoUVR", source.saldoUVR);
  setIfBlank(out, "valorUVR", source.valorUVR);
  setIfBlank(out, "seguros", source.seguros, source.totalSeguros);
  setIfBlank(out, "valorDesembolsado", source.valorDesembolsado);
  setIfBlank(out, "cuotaConInteresSinSeguros", source.cuotaConInteresSinSeguros, source.cuotaSinSeguros);
  setIfBlank(out, "cuotaBaseSimulacion", source.cuotaBaseSimulacion, source.cuotaSinSubsidio);
  setIfBlank(out, "variacionUVR", source.variacionUVR, source.variacionUvrPct, source.variacion_uvr_pct);
  return out;
};

const jsonChanged = (a: unknown, b: unknown) => JSON.stringify(a ?? {}) !== JSON.stringify(b ?? {});

async function hydrateExpedienteSnapshot(row: Expediente): Promise<Expediente> {
  const clienteActual = asRecord(row.cliente_data);
  const creditoActual = asRecord(row.credito_data);
  let source: LooseRecord = {
    ...clienteActual,
    ...creditoActual,
    cliente_nombre: row.cliente_nombre,
    cedula: row.cedula,
    banco: row.banco,
    numero_credito: row.numero_credito,
    producto: row.producto,
  };

  const necesitaExtracto =
    !isMeaningfulValue(clienteActual.nombre) ||
    !isMeaningfulValue(clienteActual.banco) ||
    !isMeaningfulValue(clienteActual.numeroCredito) ||
    !isMeaningfulValue(creditoActual.saldoCapital) ||
    !isMeaningfulValue(creditoActual.cuotaActual) ||
    !isMeaningfulValue(creditoActual.tea);

  if (necesitaExtracto) {
    try {
      const { data: ext } = await supabase
        .from("extractos_lecturas")
        .select("banco,producto,moneda,datos,created_at")
        .eq("expediente_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const d = asRecord(ext?.datos);
      source = {
        ...source,
        ...d,
        banco: firstMeaningful(source.banco, d.banco, ext?.banco),
        producto: firstMeaningful(source.producto, d.producto, ext?.producto),
        moneda: firstMeaningful(d.moneda, ext?.moneda),
      };
    } catch {
      // La hidratación es defensiva; si la lectura no está disponible, devolvemos el expediente base.
    }
  }

  const clienteNext = normalizeClienteSnapshot(clienteActual, source) as unknown as ClientData;
  const creditoNext = normalizeCreditoSnapshot(creditoActual, source) as Record<string, string>;
  const patch: Partial<Expediente> & LooseRecord = {};

  const clienteNombre = stringFrom(row.cliente_nombre, clienteNext.nombre);
  const cedula = stringFrom(row.cedula, clienteNext.cedula);
  const banco = stringFrom(row.banco, clienteNext.banco, source.banco);
  const numeroCredito = stringFrom(row.numero_credito, clienteNext.numeroCredito, source.numeroCredito);
  const producto = stringFrom(row.producto, clienteNext.tipoProducto, source.producto);

  if (clienteNombre && (!row.cliente_nombre || row.cliente_nombre === "Sin nombre")) patch.cliente_nombre = clienteNombre;
  if (cedula && !row.cedula) patch.cedula = cedula;
  if (banco && !row.banco) patch.banco = banco;
  if (numeroCredito && !row.numero_credito) patch.numero_credito = numeroCredito;
  if (producto && !row.producto) patch.producto = producto;
  if (jsonChanged(clienteActual, clienteNext)) patch.cliente_data = clienteNext;
  if (jsonChanged(creditoActual, creditoNext)) patch.credito_data = creditoNext;

  if (Object.keys(patch).length > 0) {
    try {
      await supabase.from("expedientes").update(patch as never).eq("id", row.id);
    } catch {
      // Si el usuario puede leer pero no actualizar, al menos devolvemos la vista hidratada en memoria.
    }
    return { ...row, ...patch } as Expediente;
  }
  return row;
}

export async function listExpedientes(params: { search?: string; estado?: EstadoExpediente | ""; etapa?: EtapaPipelineId | "" } = {}) {
  let q = supabase
    .from("expedientes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (params.estado) q = q.eq("estado", params.estado);
  if (params.etapa) {
    const estados = estadosParaEtapa(params.etapa);
    if (estados.length > 0) q = q.in("estado_caso", estados as never);
  }
  if (params.search && params.search.trim()) {
    const raw = params.search.trim();
    const s = `%${raw}%`;
    // Si el término parece un código de auditoría NUVIA (ej. NUV_AUD_2026_DL_00002),
    // resolvemos primero los IDs de qa_auditorias y filtramos expedientes por qa_auditoria_id.
    const looksLikeAuditCode = /nuv[_-]?aud|^aud[_-]?|_aud_/i.test(raw);
    if (looksLikeAuditCode) {
      try {
        const { data: auds } = await supabase
          .from("qa_auditorias")
          .select("id,expediente_id,codigo")
          .ilike("codigo", s);
        const audIds = (auds ?? []).map((a) => a.id).filter(Boolean) as string[];
        const expIds = (auds ?? []).map((a) => a.expediente_id).filter(Boolean) as string[];
        const orParts: string[] = [];
        if (audIds.length > 0) orParts.push(`qa_auditoria_id.in.(${audIds.join(",")})`);
        if (expIds.length > 0) orParts.push(`id.in.(${expIds.join(",")})`);
        orParts.push(`codigo.ilike.${s}`);
        q = q.or(orParts.join(","));
      } catch {
        q = q.ilike("codigo", s);
      }
    } else {
      q = q.or(
        `cliente_nombre.ilike.${s},cedula.ilike.${s},numero_credito.ilike.${s},banco.ilike.${s},codigo.ilike.${s}`,
      );
    }
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Expediente[];
}

export async function getExpediente(id: string): Promise<Expediente> {
  const { data, error } = await supabase.from("expedientes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No se encontró este expediente o ya no está disponible.");
  return hydrateExpedienteSnapshot(data as unknown as Expediente);
}

export async function upsertExpediente(p: UpsertPayload): Promise<Expediente> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("No autenticado");

  const nombreLimpio = (p.cliente.nombre ?? "").trim();
  // Solo bloqueamos "Sin nombre" al CREAR. En actualizaciones respetamos el
  // valor existente para no romper flujos de edición parcial (checklist, QA).
  if (!p.id && !nombreLimpio) {
    throw new Error(
      "No se puede crear el expediente sin el nombre del cliente. Aplica la lectura del extracto o completa el campo Cliente.",
    );
  }

  const pickNonEmpty = (
    nu: string | null | undefined,
    prev: string | null | undefined,
  ): string | null => {
    const n = (nu ?? "").trim();
    if (n) return n;
    return prev ?? null;
  };

  const incomingSource: LooseRecord = {
    ...(p.credito as unknown as LooseRecord),
    ...(p.cliente as unknown as LooseRecord),
    cliente_nombre: nombreLimpio,
    cedula: p.cliente.cedula,
    banco: p.cliente.banco,
    numeroCredito: p.cliente.numeroCredito,
    producto: p.cliente.tipoProducto,
  };
  const clienteNormalizado = normalizeClienteSnapshot(p.cliente as unknown as LooseRecord, incomingSource) as unknown as ClientData;
  const creditoNormalizado = normalizeCreditoSnapshot(p.credito as unknown as LooseRecord, incomingSource) as Record<string, string>;

  const baseRow = {
    modo: p.modo,
    cliente_nombre: nombreLimpio || clienteNormalizado.nombre || "Sin nombre",
    cedula: clienteNormalizado.cedula || null,
    banco: clienteNormalizado.banco || null,
    numero_credito: clienteNormalizado.numeroCredito || null,
    producto: clienteNormalizado.tipoProducto || null,
    cliente_data: clienteNormalizado as unknown as never,
    credito_data: creditoNormalizado as unknown as never,
    propuesta_data: p.propuesta as unknown as never,
    discount_data: p.discountState as unknown as never,
    honorarios_base: p.honorariosBase,
    honorarios_final: p.honorariosFinal,
    descuento: p.descuento,
  };

  if (p.id) {
    const { data: prev } = await supabase
      .from("expedientes")
      .select(
        "cliente_nombre,cedula,banco,numero_credito,producto,cliente_data,credito_data,propuesta_data,discount_data,honorarios_base,honorarios_final",
      )
      .eq("id", p.id)
      .maybeSingle();

    const prevRow = (prev ?? {}) as {
      cliente_nombre?: string | null;
      cedula?: string | null;
      banco?: string | null;
      numero_credito?: string | null;
      producto?: string | null;
      cliente_data?: Record<string, unknown> | null;
      credito_data?: Record<string, unknown> | null;
      propuesta_data?: Record<string, unknown> | null;
      discount_data?: Record<string, unknown> | null;
      honorarios_base?: number | null;
      honorarios_final?: number | null;
    };

    const propuestaIncoming = (p.propuesta ?? {}) as unknown as Record<string, unknown>;
    const propuestaFinal =
      Object.keys(propuestaIncoming).length > 0
        ? propuestaIncoming
        : (prevRow.propuesta_data ?? {});

    const mergedRow = {
      ...baseRow,
      cliente_nombre:
        pickNonEmpty(nombreLimpio || null, prevRow.cliente_nombre) || "Sin nombre",
      cedula: pickNonEmpty(baseRow.cedula, prevRow.cedula),
      banco: pickNonEmpty(baseRow.banco, prevRow.banco),
      numero_credito: pickNonEmpty(baseRow.numero_credito, prevRow.numero_credito),
      producto: pickNonEmpty(baseRow.producto, prevRow.producto),
      cliente_data: normalizeClienteSnapshot(
        mergePreservingMeaningful(prevRow.cliente_data, clienteNormalizado as unknown as LooseRecord),
        {
          ...incomingSource,
          cliente_nombre: pickNonEmpty(nombreLimpio || null, prevRow.cliente_nombre),
          cedula: pickNonEmpty(baseRow.cedula, prevRow.cedula),
          banco: pickNonEmpty(baseRow.banco, prevRow.banco),
          numero_credito: pickNonEmpty(baseRow.numero_credito, prevRow.numero_credito),
          producto: pickNonEmpty(baseRow.producto, prevRow.producto),
        },
      ) as unknown as never,
      credito_data: normalizeCreditoSnapshot(
        mergePreservingMeaningful(prevRow.credito_data, creditoNormalizado as unknown as LooseRecord),
        incomingSource,
      ) as unknown as never,
      propuesta_data: propuestaFinal as unknown as never,
      discount_data: mergePreservingMeaningful(
        prevRow.discount_data,
        p.discountState as unknown as LooseRecord,
      ) as unknown as never,
      honorarios_base: p.honorariosBase || Number(prevRow.honorarios_base ?? 0),
      honorarios_final: p.honorariosFinal || Number(prevRow.honorarios_final ?? 0),
    };

    const { data, error } = await supabase
      .from("expedientes")
      .update(mergedRow)
      .eq("id", p.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se pudo actualizar el expediente. Verifica que siga disponible.");
    return data as unknown as Expediente;
  }
  const { data, error } = await supabase
    .from("expedientes")
    .insert({ ...baseRow, asesor_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Expediente;
}

// Mapeo inverso: estado legacy → estado_caso canónico del pipeline.
// Permite que el dropdown superior (legacy) mantenga sincronizado el
// estado del caso del pipeline para evitar divergencias visuales.
const ESTADO_LEGACY_A_CASO: Record<EstadoExpediente, string> = {
  SIMULADO: "lead_creado",
  ENVIADO_CONTRATACION: "enviado_contratacion",
  FIRMADO: "contrato_firmado",
  RADICADO: "radicado_banco",
  APROBADO: "aprobado_banco",
  CONDICIONES_APLICADAS: "condiciones_aplicadas",
  FACTURADO: "cuenta_cobro_generada",
  PAGADO: "honorarios_pagados",
};

export async function updateEstado(id: string, estado: EstadoExpediente, nota?: string) {
  const prev = await getExpediente(id);
  const estadoCasoSync = ESTADO_LEGACY_A_CASO[estado];
  const prevCaso = (prev as unknown as { estado_caso?: string | null }).estado_caso ?? null;
  const { error } = await supabase
    .from("expedientes")
    .update({ estado, estado_caso: estadoCasoSync } as never)
    .eq("id", id);
  if (error) throw error;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  await supabase.from("expediente_historial").insert({
    expediente_id: id,
    estado_anterior: prev.estado,
    estado_nuevo: estado,
    estado_caso_anterior: prevCaso as never,
    estado_caso_nuevo: estadoCasoSync as never,
    accion_origen: "manual" as never,
    user_id: userId,
    nota: nota ?? null,
  } as never);
}

export async function setAprobado(id: string, aprobado: AprobadoData, acertividad: number) {
  const prev = await getExpediente(id);
  const { error } = await supabase
    .from("expedientes")
    .update({
      aprobado_data: aprobado as unknown as never,
      acertividad_global: acertividad,
      estado: "APROBADO",
    })
    .eq("id", id);
  if (error) throw error;
  if (prev.estado !== "APROBADO") {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("expediente_historial").insert({
      expediente_id: id,
      estado_anterior: prev.estado,
      estado_nuevo: "APROBADO",
      user_id: userData.user?.id ?? null,
      nota: "Aprobación bancaria registrada",
    });
  }
}


export async function deleteExpediente(id: string) {
  const { error } = await supabase.from("expedientes").delete().eq("id", id);
  if (error) throw error;
}

export interface AsesorStats {
  asesor_id: string;
  nombre: string;
  total: number;
  aprobados: number;
  pagados: number;
  honorariosFinal: number;
  honorariosPagados: number;
  acertividadPromedio: number;
}

export interface DashboardMetrics {
  total: number;
  porEstado: Record<EstadoExpediente, number>;
  tasaAprobacion: number;
  tasaCierre: number;
  acertividadPromedio: number;
  honorariosBase: number;
  honorariosFacturados: number;
  honorariosPagados: number;
  pipeline: number;
  porAsesor?: AsesorStats[];
}

export async function getDashboardMetrics(opts: { global?: boolean } = {}): Promise<{ metrics: DashboardMetrics; rows: Expediente[] }> {
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

  let porAsesor: AsesorStats[] | undefined;
  if (opts.global) {
    const ids = Array.from(new Set(rows.map((r) => r.asesor_id)));
    const nombreById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
      (profs ?? []).forEach((p) => nombreById.set(p.id, p.nombre || p.email || "Sin nombre"));
    }
    const acertByAsesor = new Map<string, { sum: number; n: number }>();
    const map = new Map<string, AsesorStats>();
    for (const r of rows) {
      const cur = map.get(r.asesor_id) ?? {
        asesor_id: r.asesor_id,
        nombre: nombreById.get(r.asesor_id) || "—",
        total: 0, aprobados: 0, pagados: 0,
        honorariosFinal: 0, honorariosPagados: 0,
        acertividadPromedio: 0,
      };
      cur.total += 1;
      if (["APROBADO","FACTURADO","PAGADO"].includes(r.estado)) cur.aprobados += 1;
      if (r.estado === "PAGADO") { cur.pagados += 1; cur.honorariosPagados += Number(r.honorarios_final) || 0; }
      cur.honorariosFinal += Number(r.honorarios_final) || 0;
      if (r.acertividad_global != null) {
        const a = acertByAsesor.get(r.asesor_id) ?? { sum: 0, n: 0 };
        a.sum += Number(r.acertividad_global); a.n += 1;
        acertByAsesor.set(r.asesor_id, a);
      }
      map.set(r.asesor_id, cur);
    }
    for (const [id, a] of acertByAsesor) {
      const s = map.get(id);
      if (s) s.acertividadPromedio = a.n > 0 ? a.sum / a.n : 0;
    }
    porAsesor = Array.from(map.values()).sort((a, b) => b.honorariosFinal - a.honorariosFinal);
  }

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
      porAsesor,
    },
    rows,
  };
}
