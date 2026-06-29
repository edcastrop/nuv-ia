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
    honorarioRecalculado?: number;
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
      pactados: 0, honorarioRecalculado: 0, porcentaje: 0, estadoCobro: "—", estadoPago: "—",
      cuentaCobroEmitida: false, pazYSalvo: false,
    },
    timeline: [],
    intervinientes: [],
    trazabilidad: [],
  };
}

function n(v: unknown, d = 0): number {
  const x = typeof v === "string"
    ? Number(
        v
          .replace(/[^\d,.-]/g, "")
          .replace(/\.(?=\d{3}(\D|$))/g, "")
          .replace(",", "."),
      )
    : (v as number);
  return Number.isFinite(x) ? Number(x) : d;
}
function s(v: unknown, d = "—"): string {
  if (v == null) return d;
  const str = String(v).trim();
  return str.length ? str : d;
}

function pmt(rate: number, nper: number, pv: number): number {
  if (!(nper > 0) || !(pv > 0)) return 0;
  if (!rate) return pv / nper;
  return (rate * pv) / (1 - Math.pow(1 + rate, -nper));
}

function proyectarUVRPendiente(params: {
  saldoUVR: number;
  valorUVR: number;
  tea: number;
  variacionUVR: number;
  seguros: number;
  plazo: number;
}): number {
  const { saldoUVR, valorUVR, tea, variacionUVR, seguros, plazo } = params;
  if (!(saldoUVR > 0 && valorUVR > 0 && plazo > 0)) return 0;
  const tasaMensual = Math.pow(1 + tea / 100, 1 / 12) - 1;
  const variacionMensual = Math.pow(1 + variacionUVR / 100, 1 / 12) - 1;
  const cuotaUVR = pmt(tasaMensual, plazo, saldoUVR);
  let saldo = saldoUVR;
  let valor = valorUVR;
  let total = 0;
  for (let i = 0; i < plazo && saldo > 0; i += 1) {
    const interes = saldo * tasaMensual;
    const capital = Math.max(0, Math.min(saldo, cuotaUVR - interes));
    const cuotaEfectiva = interes + capital;
    valor *= 1 + variacionMensual;
    total += cuotaEfectiva * valor + seguros;
    saldo = Math.max(0, saldo - capital);
  }
  return total;
}

function proyectarPesosPendiente(params: { saldo: number; tea: number; seguros: number; plazo: number }): number {
  const { saldo, tea, seguros, plazo } = params;
  if (!(saldo > 0 && plazo > 0)) return 0;
  const tasaMensual = Math.pow(1 + tea / 100, 1 / 12) - 1;
  return (pmt(tasaMensual, plazo, saldo) + seguros) * plazo;
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

      // Crédito — acepta tanto snake_case como camelCase (datos reales del expediente).
      const cobertura = (crData.coberturaFresh ?? {}) as Record<string, unknown>;
      dto.credito.banco = s(exp.banco);
      dto.credito.numeroCredito = s(exp.numero_credito);
      dto.credito.producto = s(exp.producto);
      dto.credito.modalidad = s(exp.modo);
      dto.credito.saldoCapital = n(crData.saldo_capital ?? crData.saldoCapital);
      dto.credito.valorDesembolsado = n(crData.valor_desembolsado ?? crData.valorDesembolsado);
      dto.credito.plazoAprobado = n(
        crData.plazo ?? crData.plazo_aprobado ?? crData.plazoAprobado ?? cobertura.cuotasTotales ?? exp.cuotas_aprobadas_banco,
      );
      dto.credito.cuotasPagadas = n(crData.cuotas_pagadas ?? crData.cuotasPagadas ?? cobertura.cuotasPagadas);
      dto.credito.cuotasPendientes = n(
        crData.cuotas_pendientes ?? crData.cuotasPendientes ?? crData.cuotas_restantes ?? cobertura.cuotasPendientes,
      );
      dto.credito.cuotaActual = n(crData.cuota_actual ?? crData.cuotaActual ?? crData.cuota ?? crData.cuotaBaseSimulacion);
      dto.credito.seguros = n(crData.seguros ?? crData.segurosMensuales ?? crData.seguro_mensual);
      dto.credito.interesMensual = n(crData.interes_mensual ?? crData.interesMensualExtracto ?? crData.intereses_mes);
      dto.credito.capitalMensual = n(crData.capital_mensual ?? crData.capitalMensualExtracto ?? crData.capital_mes);
      dto.credito.freshMensual = n(
        crData.fresh ?? crData.frech ?? crData.fresh_mensual ?? crData.beneficioFrechMensualExtracto ?? cobertura.valorMensual,
      );
      dto.credito.tea = n(crData.tea ?? crData.tasa_ea ?? crData.teaPactada);
      dto.credito.tem = n(crData.tem ?? crData.tasa_mensual);

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
        if (!dto.credito.cuotaActual) dto.credito.cuotaActual = n(ld.cuota ?? ld.cuota_mensual ?? ld.cuotaActual);
        if (!dto.credito.seguros) dto.credito.seguros = n(ld.seguros);
        if (!dto.credito.tea) dto.credito.tea = n(ld.tea ?? ld.tea_pactada ?? ld.teaPactada);
        if (!dto.credito.tem) dto.credito.tem = n(ld.tem);
      }

      // Propuesta — acepta snake_case y camelCase.
      dto.propuesta.escenario = s(pData.escenario ?? pData.nombre);
      dto.propuesta.cuotasEliminadas = n(pData.cuotas_eliminadas ?? pData.cuotasEliminadas);
      dto.propuesta.nuevoPlazo = n(pData.nuevo_plazo ?? pData.nuevoPlazo ?? pData.plazo_nuevo);
      dto.propuesta.nuevaCuota = n(pData.nueva_cuota ?? pData.nuevaCuota ?? pData.cuota_nueva);
      dto.propuesta.incrementoMensual = n(pData.incremento_mensual ?? pData.incrementoMensual);
      dto.propuesta.ahorroTotal = n(pData.ahorro_total ?? pData.ahorroTotal);
      dto.propuesta.ahorroIntereses = n(pData.ahorro_intereses ?? pData.ahorroIntereses);
      dto.propuesta.ahorroSeguros = n(pData.ahorro_seguros ?? pData.ahorroSeguros);
      const mesesRecuperadosGuardados = n(pData.tiempo_recuperado ?? pData.tiempoRecuperado ?? pData.meses_recuperados);
      const añosEliminadosGuardados = n(pData.años_eliminados ?? pData.añosEliminados);
      dto.propuesta.tiempoRecuperado =
        dto.propuesta.cuotasEliminadas ||
        mesesRecuperadosGuardados ||
        (añosEliminadosGuardados ? añosEliminadosGuardados * 12 : 0);
      dto.propuesta.recomendada = Boolean(
        pData.recomendada ?? pData.is_recomendada ?? (pData.recomendadaIdx != null && pData.recomendadaIdx === pData.index) ?? true,
      );

      // Coherencia financiera del snapshot: en créditos con cobertura/FRECH, las
      // cuotas pendientes de la cobertura NO son el plazo pendiente del crédito.
      // Para la propuesta seleccionada, el plazo base debe ser nuevo plazo + cuotas eliminadas.
      const plazoPendientePropuesto = dto.propuesta.nuevoPlazo + dto.propuesta.cuotasEliminadas;
      if (plazoPendientePropuesto > 0 && Math.abs(dto.credito.cuotasPendientes - plazoPendientePropuesto) > 1) {
        dto.credito.cuotasPendientes = plazoPendientePropuesto;
      }

      // Total proyectado / costo real / veces pagado.
      // pData.totalProyectado pertenece a la PROPUESTA, no al escenario actual;
      // por eso el snapshot debe reconstruir el escenario actual desde el crédito.
      dto.credito.totalProyectado = n(crData.total_proyectado ?? crData.totalProyectado ?? crData.total_por_pagar);
      if (!dto.credito.totalProyectado) {
        const saldoUVR = n(crData.saldo_uvr ?? crData.saldoUVR);
        const valorUVR = n(crData.valor_uvr ?? crData.valorUVR);
        const variacionUVR = n(crData.variacion_uvr ?? crData.variacionUVR, 0);
        const esUVR = /uvr/i.test(`${exp.modo ?? ""} ${exp.producto ?? ""}`) || saldoUVR > 0;
        dto.credito.totalProyectado = esUVR
          ? proyectarUVRPendiente({
              saldoUVR,
              valorUVR,
              tea: dto.credito.tea,
              variacionUVR,
              seguros: dto.credito.seguros,
              plazo: dto.credito.cuotasPendientes,
            })
          : proyectarPesosPendiente({
              saldo: dto.credito.saldoCapital,
              tea: dto.credito.tea,
              seguros: dto.credito.seguros,
              plazo: dto.credito.cuotasPendientes,
            });
      }
      const cuotaPagadaCliente = n(crData.cuota_pagada_cliente ?? crData.cuotaPagadaCliente ?? cobertura.cuotaPagadaCliente);
      const dineroPagadoFecha = (cuotaPagadaCliente || dto.credito.cuotaActual) * dto.credito.cuotasPagadas;
      dto.credito.costoReal = n(crData.costo_real_credito ?? crData.costo_real ?? crData.costoReal);
      if (!dto.credito.costoReal && dto.credito.totalProyectado) {
        dto.credito.costoReal = dto.credito.totalProyectado + dineroPagadoFecha;
      }
      dto.credito.vecesPagado = n(crData.veces_pagado ?? crData.vecesPagado);
      if (!dto.credito.vecesPagado) {
        const baseCredito = dto.credito.valorDesembolsado > 0 ? dto.credito.valorDesembolsado : dto.credito.saldoCapital;
        const numerador = dto.credito.valorDesembolsado > 0 ? dto.credito.costoReal : dto.credito.totalProyectado;
        dto.credito.vecesPagado = baseCredito > 0 && numerador > 0 ? numerador / baseCredito : 0;
      }

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
        dto.honorarios.honorarioRecalculado = n(hon.honorario_topado ?? hon.honorario_ofertado);
        dto.honorarios.porcentaje = n(hon.porcentaje_aplicado);
        dto.honorarios.estadoCobro = s(hon.estado);
      }
      if (!dto.honorarios.pactados) {
        dto.honorarios.pactados = n(exp.honorarios_final ?? exp.honorarios_pactados ?? pData.honorarios ?? exp.honorarios_base);
      }
      if (!dto.honorarios.honorarioRecalculado) {
        dto.honorarios.honorarioRecalculado = n(exp.honorarios_base ?? pData.honorarios ?? dto.honorarios.pactados);
      }
      if (!dto.honorarios.porcentaje) {
        dto.honorarios.porcentaje = n((exp.aprobado_data as Record<string, unknown> | null)?.cliente && ((exp.aprobado_data as Record<string, unknown>).cliente as Record<string, unknown>).porcentajeHonorarios);
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
          fecha: h.created_at
            ? new Date(h.created_at).toLocaleDateString("es-CO", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—",
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
