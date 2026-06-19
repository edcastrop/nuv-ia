import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { PageLayout, ExecutiveHero, NCard } from "@/components/nuvia";
import { formatCOP } from "@/lib/format";
import {
  getCuentaCobro,
  cambiarEstadoCuenta,
  PORCENTAJES_COMISION_CC,
  type CuentaCobro,
  type Comision,
} from "@/lib/comisiones";
import {
  enviarCuentaCobroEmail,
  marcarCuentaCobroPagada,
  rechazarCuentaCobro,
  devolverCuentaCobro,
  programarPagoCuentaCobro,
} from "@/lib/comisiones.functions";
import { buildCuentaCobroPdf, downloadBlob } from "@/lib/cuentaCobroPdf";
import { ArrowLeft, Send, CheckCircle2, XCircle, DollarSign, Download, Mail, RotateCcw, CalendarClock, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comisiones/$id")({
  component: DetalleCuentaCobro,
  head: () => ({ meta: [{ title: "Detalle cuenta de cobro · NUVEX" }] }),
});

function DetalleCuentaCobro() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { roles, loading: rolesLoading } = useUserRole();
  const esManager = roles.some((r) =>
    ["admin", "gerencia", "super_admin", "cartera", "contabilidad"].includes(r),
  );

  const enviarEmail = useServerFn(enviarCuentaCobroEmail);
  const marcarPagada = useServerFn(marcarCuentaCobroPagada);
  const rechazar = useServerFn(rechazarCuentaCobro);

  const [cc, setCc] = useState<CuentaCobro | null>(null);
  const [items, setItems] = useState<Comision[]>([]);
  const [expedientes, setExpedientes] = useState<Map<string, { cliente: string; banco: string | null }>>(new Map());
  const [historial, setHistorial] = useState<{ id: string; accion: string; observacion: string | null; created_at: string }[]>([]);
  const [licenciado, setLicenciado] = useState<{ nombre: string; email: string | null } | null>(null);
  const [observ, setObserv] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Pago
  const [comprobante, setComprobante] = useState<File | null>(null);

  // Envío contabilidad
  const [destinatariosExtra, setDestinatariosExtra] = useState("");

  // Programación de pago
  const [fechaProg, setFechaProg] = useState<string>("");

  const devolver = useServerFn(devolverCuentaCobro);
  const programar = useServerFn(programarPagoCuentaCobro);

  const cargar = async () => {
    setLoading(true);
    const c = await getCuentaCobro(id);
    setCc(c);
    if (c) {
      const { data: prof } = await supabase.from("profiles").select("nombre, email").eq("id", c.user_id).maybeSingle();
      setLicenciado(prof ? { nombre: prof.nombre || prof.email || "—", email: prof.email } : null);
    }
    const { data: its } = await supabase
      .from("comisiones" as never)
      .select("*")
      .eq("cuenta_cobro_id", id);
    const arr = (its ?? []) as unknown as Comision[];
    setItems(arr);
    const ids = arr.map((x) => x.expediente_id);
    if (ids.length) {
      const { data: exps } = await supabase
        .from("expedientes")
        .select("id, cliente_nombre, banco")
        .in("id", ids);
      const m = new Map<string, { cliente: string; banco: string | null }>();
      (exps ?? []).forEach((e) => m.set(e.id, { cliente: e.cliente_nombre, banco: e.banco }));
      setExpedientes(m);
    }
    const { data: hist } = await supabase
      .from("cuentas_cobro_historial" as never)
      .select("*")
      .eq("cuenta_cobro_id", id)
      .order("created_at", { ascending: false });
    setHistorial((hist ?? []) as unknown as typeof historial);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, [id]);

  function fileToBase64(f: File): Promise<string> {
    return f.arrayBuffer().then((buf) => {
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    });
  }

  async function buildPdf() {
    if (!cc || !licenciado) throw new Error("Cuenta no lista para PDF.");
    return buildCuentaCobroPdf({
      cuenta: cc,
      licenciado: { nombre: licenciado.nombre, email: licenciado.email },
      items: items.map((it) => {
        const exp = expedientes.get(it.expediente_id);
        return { ...it, cliente: exp?.cliente ?? "—", banco: exp?.banco ?? null };
      }),
    });
  }

  async function onDescargar() {
    try {
      setBusy(true);
      const { blob, filename } = await buildPdf();
      downloadBlob(blob, filename);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function guardarPorcentaje(pct: number): Promise<boolean> {
    if (!cc) return false;
    const pctAnterior = cc.porcentaje_comision;
    // 1) Guardar % en la cuenta
    const { error } = await supabase
      .from("cuentas_cobro" as never)
      .update({ porcentaje_comision: pct } as never)
      .eq("id", cc.id);
    if (error) {
      alert("No se pudo guardar el porcentaje: " + error.message);
      return false;
    }
    // 2) Recalcular cada comisión incluida: valor = round(base * pct / 100)
    const updates = items.map((it) =>
      supabase
        .from("comisiones" as never)
        .update({ porcentaje: pct, valor: Math.round(Number(it.base) * pct / 100) } as never)
        .eq("id", it.id),
    );
    await Promise.all(updates);
    // Auditoría
    await supabase.from("finanzas_auditoria" as never).insert({
      entidad: "cuenta_cobro",
      entidad_id: cc.id,
      accion: "cambio_porcentaje",
      user_id: user?.id ?? null,
      valor_anterior: { porcentaje_comision: pctAnterior },
      valor_nuevo: { porcentaje_comision: pct, comisiones_afectadas: items.length },
    } as never);
    // 3) Refrescar para que el trigger recalc_cuenta_cobro_total actualice cc.total
    await cargar();
    return true;
  }

  async function onEnviarContabilidad() {
    if (!cc) return;
    if (!cc.porcentaje_comision) {
      alert("Debes seleccionar el porcentaje de comisión (30%, 35%, 40%, 45% o 50%) antes de enviar a Contabilidad.");
      return;
    }
    const extras = destinatariosExtra
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!confirm("¿Enviar cuenta de cobro a contabilidad por correo (con PDF adjunto)?")) return;
    setBusy(true);
    try {
      const { base64, filename } = await buildPdf();
      await enviarEmail({
        data: {
          cuentaCobroId: cc.id,
          pdfBase64: base64,
          pdfFilename: filename,
          destinatarios: extras.length ? extras : undefined,
          mensaje: observ.trim() || undefined,
        },
      });
      setObserv("");
      setDestinatariosExtra("");
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onAprobar() {
    if (!cc) return;
    if (!confirm("¿Aprobar esta cuenta de cobro?")) return;
    setBusy(true);
    try {
      await cambiarEstadoCuenta(cc.id, "aprobada", observ.trim() || undefined);
      setObserv("");
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onRechazar() {
    if (!cc) return;
    if (observ.trim().length < 5) {
      alert("Indica el motivo de rechazo (mínimo 5 caracteres) en el campo de observación.");
      return;
    }
    if (!confirm("¿Rechazar esta cuenta de cobro?")) return;
    setBusy(true);
    try {
      await rechazar({ data: { cuentaCobroId: cc.id, motivo: observ.trim() } });
      setObserv("");
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onMarcarPagada() {
    if (!cc) return;
    if (!comprobante) {
      alert("Adjunta el comprobante de pago antes de marcar como pagada.");
      return;
    }
    if (!confirm("¿Confirmar pago y registrar el comprobante?")) return;
    setBusy(true);
    try {
      const base64 = await fileToBase64(comprobante);
      await marcarPagada({
        data: {
          cuentaCobroId: cc.id,
          comprobanteBase64: base64,
          comprobanteFilename: comprobante.name,
          observacion: observ.trim() || undefined,
        },
      });
      setObserv("");
      setComprobante(null);
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDevolver() {
    if (!cc) return;
    if (observ.trim().length < 10) {
      alert("Escribe el motivo de devolución (mínimo 10 caracteres) en el campo de observación.");
      return;
    }
    if (!confirm("¿Devolver la cuenta de cobro al Analista Financiero Comercial para corrección?")) return;
    setBusy(true);
    try {
      await devolver({ data: { cuentaCobroId: cc.id, motivo: observ.trim() } });
      setObserv("");
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onProgramar() {
    if (!cc) return;
    if (!fechaProg) {
      alert("Selecciona la fecha programada de pago.");
      return;
    }
    if (!confirm(`¿Programar el pago para el ${fechaProg}?`)) return;
    setBusy(true);
    try {
      await programar({
        data: { cuentaCobroId: cc.id, fechaProgramada: fechaProg, observacion: observ.trim() || undefined },
      });
      setObserv("");
      setFechaProg("");
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || rolesLoading) {
    return (
      <PageLayout maxWidth="5xl">
        <div className="p-12 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      </PageLayout>
    );
  }
  if (!cc) {
    return (
      <PageLayout maxWidth="5xl">
        <div className="p-12 text-center text-sm" style={{ color: "var(--nuvia-danger)" }}>Cuenta no encontrada.</div>
      </PageLayout>
    );
  }

  const esDueno = user?.id === cc.user_id;
  const puedeEnviar = esDueno && (cc.estado === "borrador" || cc.estado === "rechazada" || cc.estado === "devuelta_correccion");
  const puedeAprobar = esManager && cc.estado === "enviada";
  const puedeProgramar = esManager && cc.estado === "aprobada";
  const puedePagar = esManager && (cc.estado === "aprobada" || cc.estado === "programada_pago");

  return (
    <PageLayout maxWidth="5xl">
      <Link to="/comisiones" className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline" style={{ color: "var(--nuvia-accent-blue)" }}>
        <ArrowLeft size={13} /> Volver a comisiones
      </Link>

      <ExecutiveHero
        badge={{ icon: <Receipt size={12} />, label: "Contabilidad", tone: "blue" }}
        title="Cuenta de cobro"
        description="Revisión, aprobación, programación de pago y auditoría contable."
      />

      <NCard variant="elevated" padding="none" className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">Cuenta de cobro</div>
            <div className="mt-1 font-mono text-lg font-semibold text-[#0A1226]">{cc.numero}</div>
            <div className="mt-1 text-[12px] text-[#242424]/70">
              Analista F. Comercial: <b>{licenciado?.nombre ?? "—"}</b>
              {licenciado?.email && <> · {licenciado.email}</>}
            </div>
            <div className="mt-1 text-[12px] text-[#242424]/70">
              Creada el {new Date(cc.created_at).toLocaleString("es-CO")}
              {Number(cc.version ?? 1) > 1 && (
                <span className="ml-2 rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-semibold text-[#8A5A00]">
                  v{cc.version}
                </span>
              )}
            </div>
            {cc.fecha_programada_pago && (
              <div className="mt-1 text-[12px] text-[#445DA3]">
                📅 Pago programado: <b>{new Date(cc.fecha_programada_pago + "T00:00:00").toLocaleDateString("es-CO")}</b>
              </div>
            )}
            {cc.motivo_devolucion && cc.estado === "devuelta_correccion" && (
              <div className="mt-2 rounded-md border border-[#FCA5A5] bg-[#FEF2F2] p-2 text-[12px] text-[#7F1D1D]">
                <b>Motivo de devolución:</b> {cc.motivo_devolucion}
              </div>
            )}
            {cc.observaciones && <div className="mt-2 text-[13px] italic text-[#242424]/70">"{cc.observaciones}"</div>}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">Total</div>
            <div className="mt-1 text-2xl font-bold text-[#1F7A45]">{formatCOP(Number(cc.total))}</div>
            {cc.porcentaje_comision && (
              <div className="mt-1 text-[12px] text-[#242424]/70">
                % Comisión Analista F. Comercial: <b>{Number(cc.porcentaje_comision).toFixed(0)}%</b>
              </div>
            )}
            <div
              className="mt-2 inline-block rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{ background: ESTADO_CC[cc.estado].bg, color: ESTADO_CC[cc.estado].color }}
            >
              {ESTADO_CC[cc.estado].label}
            </div>
            <div className="mt-3">
              <button
                onClick={onDescargar}
                disabled={busy || items.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#445DA3] px-3 py-1.5 text-[12px] font-semibold text-[#445DA3] hover:bg-[#EEF1FA] disabled:opacity-50"
              >
                <Download size={13} /> Descargar PDF
              </button>
            </div>
          </div>
        </div>

        {(puedeEnviar || puedeAprobar || puedeProgramar || puedePagar) && (
          <div className="border-t border-[#E3E7EE] bg-[#F7F9FB] p-4 space-y-3">
            <input
              value={observ}
              onChange={(e) => setObserv(e.target.value)}
              placeholder={puedeAprobar ? "Observación (obligatoria si rechazas)" : "Observación / mensaje (opcional)"}
              className="w-full rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm outline-none focus:border-[#445DA3]"
            />

            {puedeEnviar && (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#E3E7EE] bg-white p-3">
                  <div className="mb-2 text-[12px] font-semibold text-[#0A1226]">
                    % Comisión Analista F. Comercial <span className="text-[#991B1B]">*</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PORCENTAJES_COMISION_CC.map((p) => {
                      const active = Number(cc.porcentaje_comision) === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={busy}
                          onClick={() => guardarPorcentaje(p)}
                          className="rounded-lg border px-4 py-1.5 text-[13px] font-semibold transition disabled:opacity-50"
                          style={{
                            background: active ? "linear-gradient(135deg,#445DA3,#84B98F)" : "#fff",
                            color: active ? "#fff" : "#0A1226",
                            borderColor: active ? "transparent" : "#E3E7EE",
                          }}
                        >
                          {p}%
                        </button>
                      );
                    })}
                  </div>
                  {!cc.porcentaje_comision && (
                    <div className="mt-2 text-[11px] text-[#991B1B]">
                      Selecciona el porcentaje antes de enviar la cuenta de cobro.
                    </div>
                  )}
                </div>

                <input
                  value={destinatariosExtra}
                  onChange={(e) => setDestinatariosExtra(e.target.value)}
                  placeholder="Destinatarios adicionales (opcional, separados por coma). Por defecto: contabilidad@nuvex.com.co"
                  className="w-full rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm outline-none focus:border-[#445DA3]"
                />
                <button
                  onClick={onEnviarContabilidad}
                  disabled={busy || !cc.porcentaje_comision}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
                  title={!cc.porcentaje_comision ? "Selecciona el % de comisión" : undefined}
                >
                  <Mail size={13} /> {busy ? "Enviando…" : "Enviar a contabilidad por correo (con PDF)"}
                </button>
                <button
                  onClick={async () => {
                    if (!cc) return;
                    if (!cc.porcentaje_comision) {
                      alert("Selecciona el % de comisión antes de marcar como enviada.");
                      return;
                    }
                    if (!confirm("¿Marcar como enviada sin envío por correo?")) return;
                    setBusy(true);
                    try {
                      await cambiarEstadoCuenta(cc.id, "enviada", observ.trim() || undefined);
                      setObserv("");
                      await cargar();
                    } catch (e) {
                      alert((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy || !cc.porcentaje_comision}
                  className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-[12px] font-semibold text-[#445DA3] disabled:opacity-50"
                >
                  <Send size={13} /> Marcar enviada (sin correo)
                </button>
              </div>
            )}

            {puedeAprobar && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onAprobar}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F7A45] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <CheckCircle2 size={13} /> Aprobar
                </button>
                <button
                  onClick={onDevolver}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#8A5A00] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                  title="Devolver al Analista Financiero Comercial para corrección (motivo obligatorio ≥10 caracteres)"
                >
                  <RotateCcw size={13} /> Devolver para corrección
                </button>
                <button
                  onClick={onRechazar}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#991B1B] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <XCircle size={13} /> Rechazar (motivo obligatorio)
                </button>
              </div>
            )}

            {puedeProgramar && (
              <div className="space-y-2 rounded-lg border border-[#E3E7EE] bg-white p-3">
                <div className="text-[12px] font-semibold text-[#0A1226]">
                  Programar pago (opcional, antes de marcar pagada)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={fechaProg}
                    onChange={(e) => setFechaProg(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#445DA3]"
                  />
                  <button
                    onClick={onProgramar}
                    disabled={busy || !fechaProg}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#445DA3] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                  >
                    <CalendarClock size={13} /> Programar
                  </button>
                </div>
              </div>
            )}

            {puedePagar && (
              <div className="space-y-2 rounded-lg border border-[#E0E7FF] bg-[#F5F7FF] p-3">
                <div className="text-[12px] font-semibold text-[#0A1226]">
                  Registro de pago <span className="text-[#991B1B]">*</span>
                </div>
                <div className="text-[11px] text-[#242424]/70">
                  Adjunta el comprobante (imagen o PDF) para habilitar el botón.
                </div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                  className="block w-full text-[12px] file:mr-3 file:rounded-md file:border-0 file:bg-[#445DA3] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white hover:file:bg-[#384e8a]"
                />
                {comprobante && (
                  <div className="text-[11px] text-[#1F7A45]">
                    ✓ Archivo listo: <b>{comprobante.name}</b>
                  </div>
                )}
                <button
                  onClick={onMarcarPagada}
                  disabled={busy || !comprobante}
                  title={!comprobante ? "Adjunta el comprobante primero" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F7A45] px-4 py-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <DollarSign size={13} /> {busy ? "Registrando…" : "Marcar pagada (con comprobante)"}
                </button>
              </div>
            )}
          </div>
        )}
      </NCard>

      <NCard variant="elevated" padding="none" className="mb-4 overflow-hidden">
        <div className="border-b border-[#E3E7EE] px-4 py-3 text-sm font-semibold text-[#0A1226]">
          Comisiones incluidas ({items.length})
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
            <tr>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Banco</th>
              <th className="px-4 py-2 text-right">Base</th>
              <th className="px-4 py-2 text-right">%</th>
              <th className="px-4 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EE]">
            {items.map((it) => {
              const exp = expedientes.get(it.expediente_id);
              return (
                <tr key={it.id}>
                  <td className="px-4 py-2 text-[#0A1226]">{exp?.cliente ?? "—"}</td>
                  <td className="px-4 py-2 text-[#242424]/70">{exp?.banco ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{formatCOP(Number(it.base))}</td>
                  <td className="px-4 py-2 text-right">{Number(it.porcentaje).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right font-semibold text-[#1F7A45]">
                    {formatCOP(Number(it.valor))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </NCard>

      <NCard variant="elevated" padding="none" className="overflow-hidden">
        <div className="border-b border-[#E3E7EE] px-4 py-3 text-sm font-semibold text-[#0A1226]">Historial</div>
        {historial.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#242424]/60">Sin movimientos.</div>
        ) : (
          <ul className="divide-y divide-[#E3E7EE]">
            {historial.map((h) => (
              <li key={h.id} className="px-4 py-2.5">
                <div className="text-[13px] text-[#0A1226]">{h.accion.replace(/_/g, " ")}</div>
                {h.observacion && <div className="text-[12px] text-[#242424]/60">{h.observacion}</div>}
                <div className="text-[11px] text-[#242424]/50">
                  {new Date(h.created_at).toLocaleString("es-CO")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </NCard>
    </PageLayout>
  );
}

const ESTADO_CC: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: "#F1F3F8", color: "#445DA3", label: "Borrador" },
  enviada: { bg: "#EEF1FA", color: "#445DA3", label: "Enviada" },
  aprobada: { bg: "#EAF7EE", color: "#1F7A45", label: "Aprobada" },
  devuelta_correccion: { bg: "#FEF3C7", color: "#8A5A00", label: "Devuelta para corrección" },
  rechazada: { bg: "#FEE2E2", color: "#991B1B", label: "Rechazada" },
  programada_pago: { bg: "#E0E7FF", color: "#3730A3", label: "Programada para pago" },
  pagada: { bg: "#DDF4E3", color: "#1F7A45", label: "Pagada" },
};
