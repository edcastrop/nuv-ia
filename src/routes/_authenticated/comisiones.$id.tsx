import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/nuvex/ui";
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
} from "@/lib/comisiones.functions";
import { buildCuentaCobroPdf, downloadBlob } from "@/lib/cuentaCobroPdf";
import { ArrowLeft, Send, CheckCircle2, XCircle, DollarSign, Download, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comisiones/$id")({
  component: DetalleCuentaCobro,
  head: () => ({ meta: [{ title: "Detalle cuenta de cobro · NUVEX" }] }),
});

function DetalleCuentaCobro() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { roles } = useUserRole();
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
    const { error } = await supabase
      .from("cuentas_cobro" as never)
      .update({ porcentaje_comision: pct } as never)
      .eq("id", cc.id);
    if (error) {
      alert("No se pudo guardar el porcentaje: " + error.message);
      return false;
    }
    setCc({ ...cc, porcentaje_comision: pct });
    return true;
  }

  async function onEnviarContabilidad() {
    if (!cc) return;
    if (!cc.porcentaje_comision) {
      alert("Debes seleccionar el porcentaje de comisión (35%, 40%, 45% o 50%) antes de enviar a Contabilidad.");
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

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!cc) return <div className="p-12 text-center text-sm text-[#991B1B]">Cuenta no encontrada.</div>;

  const esDueno = user?.id === cc.user_id;
  const puedeEnviar = esDueno && (cc.estado === "borrador" || cc.estado === "rechazada");
  const puedeAprobar = esManager && cc.estado === "enviada";
  const puedePagar = esManager && cc.estado === "aprobada";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link to="/comisiones" className="mb-4 inline-flex items-center gap-1 text-[12px] text-[#445DA3] hover:underline">
        <ArrowLeft size={13} /> Volver a comisiones
      </Link>

      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">Cuenta de cobro</div>
            <div className="mt-1 font-mono text-lg font-semibold text-[#0A1226]">{cc.numero}</div>
            <div className="mt-1 text-[12px] text-[#242424]/70">
              Licenciado: <b>{licenciado?.nombre ?? "—"}</b>
              {licenciado?.email && <> · {licenciado.email}</>}
            </div>
            <div className="mt-1 text-[12px] text-[#242424]/70">
              Creada el {new Date(cc.created_at).toLocaleString("es-CO")}
            </div>
            {cc.observaciones && <div className="mt-2 text-[13px] italic text-[#242424]/70">"{cc.observaciones}"</div>}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">Total</div>
            <div className="mt-1 text-2xl font-bold text-[#1F7A45]">{formatCOP(Number(cc.total))}</div>
            {cc.porcentaje_comision && (
              <div className="mt-1 text-[12px] text-[#242424]/70">
                % Comisión licenciado: <b>{Number(cc.porcentaje_comision).toFixed(0)}%</b>
              </div>
            )}
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

        {(puedeEnviar || puedeAprobar || puedePagar) && (
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
                    % Comisión licenciado <span className="text-[#991B1B]">*</span>
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
                  onClick={onRechazar}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#991B1B] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <XCircle size={13} /> Rechazar (motivo obligatorio)
                </button>
              </div>
            )}

            {puedePagar && (
              <div className="space-y-2 rounded-lg border border-[#E0E7FF] bg-[#F5F7FF] p-3">
                <div className="text-[12px] font-semibold text-[#0A1226]">Registro de pago</div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                  className="w-full text-[12px]"
                />
                <button
                  onClick={onMarcarPagada}
                  disabled={busy || !comprobante}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F7A45] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <DollarSign size={13} /> Marcar pagada (con comprobante)
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-4">
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
      </Card>

      <Card>
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
      </Card>
    </div>
  );
}

const ESTADO_CC: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: "#F1F3F8", color: "#445DA3", label: "Borrador" },
  enviada: { bg: "#EEF1FA", color: "#445DA3", label: "Enviada" },
  aprobada: { bg: "#EAF7EE", color: "#1F7A45", label: "Aprobada" },
  rechazada: { bg: "#FEE2E2", color: "#991B1B", label: "Rechazada" },
  pagada: { bg: "#DDF4E3", color: "#1F7A45", label: "Pagada" },
};
