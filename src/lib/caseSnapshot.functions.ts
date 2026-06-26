// Case Snapshot — server fn que agrega TODOS los datos del caso en un único DTO
// plano para que el cliente genere el PDF Executive Snapshot.
//
// Aditivo: no muta ni reemplaza nada. Si una tabla falla, devuelve campos vacíos.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CaseSnapshotDTO {
  meta: {
    expedienteId: string;
    cliente: string;
    cedula: string;
    banco: string;
    producto: string;
    modalidad: string;
    estado: string;
    estadoCaso: string;
    fecha: string;
    analista: { id: string | null; nombre: string; email: string };
    qaScore: number | null;
    qaDictamen: string | null;
    nivelAutonomia: number | null;
  };
  cliente: {
    nombre: string;
    cedula: string;
    ciudad: string;
    telefono: string;
    correo: string;
    estadoCivil: string;
    perfilLaboral: string;
    ingresos: number;
    otrosIngresos: number;
    egresos: number;
    capacidadPago: number;
    endeudamiento: number;
    scoreInterno: string;
  };
  credito: {
    banco: string;
    numeroCredito: string;
    producto: string;
    modalidad: string;
    saldoCapital: number;
    valorDesembolsado: number;
    plazoAprobado: number;
    cuotasPagadas: number;
    cuotasPendientes: number;
    cuotaActual: number;
    seguros: number;
    interesMensual: number;
    capitalMensual: number;
    freshMensual: number;
    tea: number;
    tem: number;
    vecesPagado: number;
    totalProyectado: number;
    costoReal: number;
  };
  propuesta: {
    escenario: string;
    cuotasEliminadas: number;
    nuevoPlazo: number;
    nuevaCuota: number;
    incrementoMensual: number;
    ahorroTotal: number;
    ahorroIntereses: number;
    ahorroSeguros: number;
    tiempoRecuperado: number;
    recomendada: boolean;
  };
  honorarios: {
    pactados: number;
    porcentaje: number;
    estadoCobro: string;
    estadoPago: string;
    cuentaCobroEmitida: boolean;
    pazYSalvo: boolean;
  };
  timeline: Array<{ etiqueta: string; estado: "hecho" | "curso" | "pendiente" }>;
  intervinientes: Array<{ rol: string; nombre: string; email: string }>;
  trazabilidad: Array<{ fecha: string; accion: string; usuario: string }>;
}

function emptyDTO(id: string): CaseSnapshotDTO {
  return {
    meta: {
      expedienteId: id, cliente: "—", cedula: "—", banco: "—", producto: "—",
      modalidad: "—", estado: "—", estadoCaso: "—", fecha: "—",
      analista: { id: null, nombre: "—", email: "—" },
      qaScore: null, qaDictamen: null, nivelAutonomia: null,
    },
    cliente: {
      nombre: "—", cedula: "—", ciudad: "—", telefono: "—", correo: "—",
      estadoCivil: "—", perfilLaboral: "—", ingresos: 0, otrosIngresos: 0,
      egresos: 0, capacidadPago: 0, endeudamiento: 0, scoreInterno: "—",
    },
    credito: {
      banco: "—", numeroCredito: "—", producto: "—", modalidad: "—",
      saldoCapital: 0, valorDesembolsado: 0, plazoAprobado: 0,
      cuotasPagadas: 0, cuotasPendientes: 0, cuotaActual: 0, seguros: 0,
      interesMensual: 0, capitalMensual: 0, freshMensual: 0,
      tea: 0, tem: 0, vecesPagado: 0, totalProyectado: 0, costoReal: 0,
    },
    propuesta: {
      escenario: "—", cuotasEliminadas: 0, nuevoPlazo: 0, nuevaCuota: 0,
      incrementoMensual: 0, ahorroTotal: 0, ahorroIntereses: 0,
      ahorroSeguros: 0, tiempoRecuperado: 0, recomendada: false,
    },
    honorarios: {
      pactados: 0, porcentaje: 0, estadoCobro: "—", estadoPago: "—",
      cuentaCobroEmitida: false, pazYSalvo: false,
    },
    timeline: [],
    intervinientes: [],
    trazabilidad: [],
  };
}

function n(v: unknown, d = 0): number {
  const x = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? Number(x) : d;
}
function s(v: unknown, d = "—"): string {
  if (v == null) return d;
  const str = String(v).trim();
  return str.length ? str : d;
}

export const getCaseSnapshotData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { expedienteId: string }) => input)
  .handler(async ({ data, context }): Promise<CaseSnapshotDTO> => {
    const { supabase } = context;
    const id = data.expedienteId;
    const dto = emptyDTO(id);

    try {
      const { data: exp } = await supabase
        .from("expedientes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!exp) return dto;

      const cliData = (exp.cliente_data ?? {}) as Record<string, unknown>;
      const crData = (exp.credito_data ?? {}) as Record<string, unknown>;
      const pData = (exp.propuesta_data ?? {}) as Record<string, unknown>;

      dto.meta.cliente = s(exp.cliente_nombre);
      dto.meta.cedula = s(exp.cedula);
      dto.meta.banco = s(exp.banco);
      dto.meta.producto = s(exp.producto);
      dto.meta.modalidad = s(exp.modo);
      dto.meta.estado = s(exp.estado);
      dto.meta.estadoCaso = s(exp.estado_caso);
      dto.meta.fecha = s(exp.fecha_simulacion ?? exp.created_at);
      dto.meta.qaScore = exp.qa_score != null ? n(exp.qa_score) : null;
      dto.meta.qaDictamen = exp.qa_dictamen ? String(exp.qa_dictamen) : null;

      // Analista real (prioriza asesor_id del expediente)
      const analistaId = exp.asesor_id as string | null;
      dto.meta.analista.id = analistaId;
      if (analistaId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("nombre, email, ciudad, celular")
          .eq("id", analistaId)
          .maybeSingle();
        dto.meta.analista.nombre = s(prof?.nombre);
        dto.meta.analista.email = s(prof?.email);
      }

      // Nivel autonomía
      if (analistaId) {
        const { data: met } = await supabase
          .from("analista_metricas")
          .select("nivel_autonomia")
          .eq("analista_id", analistaId)
          .maybeSingle();
        if (met) dto.meta.nivelAutonomia = n(met.nivel_autonomia, 1);
      }

      // Cliente
      let clienteRow: Record<string, unknown> | null = null;
      if (exp.cliente_id) {
        const { data: cli } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", exp.cliente_id)
          .maybeSingle();
        clienteRow = cli as Record<string, unknown> | null;
      }
      dto.cliente.nombre = s(exp.cliente_nombre ?? clienteRow?.nombre);
      dto.cliente.cedula = s(exp.cedula ?? clienteRow?.cedula);
      dto.cliente.ciudad = s(clienteRow?.ciudad ?? cliData.ciudad);
      dto.cliente.telefono = s(clienteRow?.telefono ?? cliData.telefono ?? cliData.celular);
      dto.cliente.correo = s(clienteRow?.correo ?? clienteRow?.email ?? cliData.correo);
      dto.cliente.estadoCivil = s(clienteRow?.estado_civil ?? cliData.estado_civil);
      dto.cliente.perfilLaboral = s(clienteRow?.ocupacion ?? cliData.perfil_laboral ?? cliData.ocupacion);

      // Capacidad de pago más reciente
      const { data: acp } = await supabase
        .from("analisis_capacidad_pago")
        .select("*")
        .eq("expediente_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (acp) {
        dto.cliente.ingresos = n(acp.ingreso_titular);
        dto.cliente.otrosIngresos = n(acp.ingreso_codeudor);
        const det = (acp.detalle_titular ?? {}) as Record<string, unknown>;
        dto.cliente.egresos = n(det.egresos ?? det.gastos_fijos);
        dto.cliente.capacidadPago = n(acp.cuota_propuesta);
        dto.cliente.endeudamiento = n(acp.porcentaje_endeudamiento);
        dto.cliente.scoreInterno = s(acp.semaforo).toUpperCase();
      }

      // Crédito
      dto.credito.banco = s(exp.banco);
      dto.credito.numeroCredito = s(exp.numero_credito);
      dto.credito.producto = s(exp.producto);
      dto.credito.modalidad = s(exp.modo);
      dto.credito.saldoCapital = n(crData.saldo_capital ?? crData.saldoCapital);
      dto.credito.valorDesembolsado = n(crData.valor_desembolsado ?? crData.valorDesembolsado);
      dto.credito.plazoAprobado = n(crData.plazo ?? crData.plazo_aprobado ?? exp.cuotas_aprobadas_banco);
      dto.credito.cuotasPagadas = n(crData.cuotas_pagadas);
      dto.credito.cuotasPendientes = n(crData.cuotas_pendientes ?? crData.cuotas_restantes);
      dto.credito.cuotaActual = n(crData.cuota_actual ?? crData.cuota);
      dto.credito.seguros = n(crData.seguros ?? crData.seguro_mensual);
      dto.credito.interesMensual = n(crData.interes_mensual ?? crData.intereses_mes);
      dto.credito.capitalMensual = n(crData.capital_mensual ?? crData.capital_mes);
      dto.credito.freshMensual = n(crData.fresh ?? crData.frech ?? crData.fresh_mensual);
      dto.credito.tea = n(crData.tea ?? crData.tasa_ea);
      dto.credito.tem = n(crData.tem ?? crData.tasa_mensual);
      dto.credito.vecesPagado = n(crData.veces_pagado);
      dto.credito.totalProyectado = n(crData.total_proyectado ?? crData.total_por_pagar);
      dto.credito.costoReal = n(crData.costo_real_credito ?? crData.costo_real);

      // Última lectura del extracto para refinar
      const { data: lectura } = await supabase
        .from("extractos_lecturas")
        .select("datos")
        .eq("expediente_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lectura?.datos) {
        const ld = lectura.datos as Record<string, unknown>;
        if (!dto.credito.saldoCapital) dto.credito.saldoCapital = n(ld.saldo_capital ?? ld.saldoCapital);
        if (!dto.credito.cuotaActual) dto.credito.cuotaActual = n(ld.cuota ?? ld.cuota_mensual);
        if (!dto.credito.seguros) dto.credito.seguros = n(ld.seguros);
        if (!dto.credito.tea) dto.credito.tea = n(ld.tea ?? ld.tea_pactada);
        if (!dto.credito.tem) dto.credito.tem = n(ld.tem);
      }

      // Propuesta
      dto.propuesta.escenario = s(pData.escenario ?? pData.nombre);
      dto.propuesta.cuotasEliminadas = n(pData.cuotas_eliminadas);
      dto.propuesta.nuevoPlazo = n(pData.nuevo_plazo ?? pData.plazo_nuevo);
      dto.propuesta.nuevaCuota = n(pData.nueva_cuota ?? pData.cuota_nueva);
      dto.propuesta.incrementoMensual = n(pData.incremento_mensual);
      dto.propuesta.ahorroTotal = n(pData.ahorro_total);
      dto.propuesta.ahorroIntereses = n(pData.ahorro_intereses);
      dto.propuesta.ahorroSeguros = n(pData.ahorro_seguros);
      dto.propuesta.tiempoRecuperado = n(pData.tiempo_recuperado ?? pData.meses_recuperados);
      dto.propuesta.recomendada = Boolean(pData.recomendada ?? pData.is_recomendada ?? true);

      // Honorarios
      const { data: hon } = await supabase
        .from("honorarios_calculos")
        .select("*")
        .eq("expediente_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hon) {
        dto.honorarios.pactados = n(hon.honorario_ofertado ?? hon.honorario_topado);
        dto.honorarios.porcentaje = n(hon.porcentaje_aplicado);
        dto.honorarios.estadoCobro = s(hon.estado);
      } else if (exp.honorarios_pactados) {
        dto.honorarios.pactados = n(exp.honorarios_pactados);
      }
      try {
        if (analistaId) {
          const { data: cc } = await supabase
            .from("cuentas_cobro")
            .select("estado")
            .eq("user_id", analistaId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (cc) {
            dto.honorarios.cuentaCobroEmitida = true;
            dto.honorarios.estadoPago = s(cc.estado);
            dto.honorarios.pazYSalvo = /paz|salvo|pagad/i.test(String(cc.estado ?? ""));
          }
        }
      } catch { /* opcional */ }

      // Timeline operativo
      const estadoCaso = String(exp.estado_caso ?? "");
      const hitos = [
        "Simulación", "QA", "Contrato", "Poder", "Checklist",
        "Radicación", "Respuesta banco", "Informe final", "Cuenta cobro", "Paz y salvo",
      ];
      const ordenEstados = [
        "lead_creado", "simulado", "qa_aprobado", "contrato_firmado",
        "poder_firmado", "checklist_completo", "radicado", "respuesta_banco",
        "informe_final", "cuenta_cobro", "paz_y_salvo", "cerrado",
      ];
      const idx = ordenEstados.findIndex((e) => estadoCaso.includes(e));
      dto.timeline = hitos.map((etiqueta, i) => ({
        etiqueta,
        estado: idx < 0 ? "pendiente" : i < idx ? "hecho" : i === idx ? "curso" : "pendiente",
      }));

      // Intervinientes (roles relevantes asociados a usuarios activos)
      const rolesObjetivo: Array<{ rol: string; appRole: string }> = [
        { rol: "Analista", appRole: "asesor" },
        { rol: "Director Financiero", appRole: "director_financiero_qa" },
        { rol: "Jurídica", appRole: "juridica" },
        { rol: "Apoderado", appRole: "apoderado" },
        { rol: "Contabilidad", appRole: "contabilidad" },
        { rol: "Gerencia", appRole: "gerencia" },
      ];
      // Analista del caso primero
      if (analistaId) {
        dto.intervinientes.push({
          rol: "Analista",
          nombre: dto.meta.analista.nombre,
          email: dto.meta.analista.email,
        });
      }
      for (const r of rolesObjetivo.slice(1)) {
        try {
          const { data: ur } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", r.appRole as "asesor")
            .limit(1);
          const uid = ur?.[0]?.user_id;
          if (!uid) continue;
          const { data: p } = await supabase
            .from("profiles")
            .select("nombre, email")
            .eq("id", uid)
            .maybeSingle();
          dto.intervinientes.push({
            rol: r.rol,
            nombre: s(p?.nombre),
            email: s(p?.email),
          });
        } catch { /* skip */ }
      }

      // Trazabilidad (últimas 10)
      const { data: hist } = await supabase
        .from("expediente_historial")
        .select("created_at, accion_origen, nota, observacion, estado_caso_nuevo, user_id")
        .eq("expediente_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (hist?.length) {
        const userIds = Array.from(new Set(hist.map((h) => h.user_id).filter(Boolean))) as string[];
        const nameById = new Map<string, string>();
        if (userIds.length) {
          const { data: ps } = await supabase
            .from("profiles")
            .select("id, nombre")
            .in("id", userIds);
          (ps ?? []).forEach((p) => nameById.set(p.id as string, s(p.nombre)));
        }
        dto.trazabilidad = hist.map((h) => ({
          fecha: s(h.created_at),
          accion: s(h.accion_origen ?? h.estado_caso_nuevo ?? h.nota ?? h.observacion, "—"),
          usuario: h.user_id ? nameById.get(h.user_id as string) ?? "—" : "—",
        }));
      }

      return dto;
    } catch (err) {
      console.error("[caseSnapshot] error", err);
      return dto;
    }
  });
