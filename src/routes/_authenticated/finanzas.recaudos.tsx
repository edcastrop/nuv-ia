import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageLayout, ExecutiveHero, NCard } from "@/components/nuvia";
import { NSelect } from "@/components/nuvia/NSelect";
import { supabase } from "@/integrations/supabase/client";
import { listCarteras, type CarteraConExpediente } from "@/lib/cartera";
import { registrarPago } from "@/lib/cartera.functions";
import { listCuentasReceptoras, type CuentaReceptora } from "@/lib/cuentasReceptoras";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/recaudos")({
  component: RecaudosPage,
  head: () => ({ meta: [{ title: "Recaudos · NUVIA" }] }),
});

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

type PagoRecent = {
  id: string;
  cartera_id: string;
  fecha: string;
  valor: number;
  metodo: string | null;
  banco_receptor: string | null;
  comprobante_num: string | null;
  observaciones: string | null;
  created_at: string;
  cliente: string;
  banco: string | null;
};

function RecaudosPage() {
  const [carteras, setCarteras] = useState<CarteraConExpediente[]>([]);
  const [pagos, setPagos] = useState<PagoRecent[]>([]);
  const [cuentas, setCuentas] = useState<CuentaReceptora[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listCarteras()
      .then(setCarteras)
      .finally(() => setLoading(false));
    listCuentasReceptoras(true).then(setCuentas).catch(() => setCuentas([]));
  }, [reloadKey]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cartera_pagos" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = (data ?? []) as unknown as PagoRecent[];
      if (rows.length === 0) {
        setPagos([]);
        return;
      }
      const cartIds = Array.from(new Set(rows.map((r) => r.cartera_id)));
      const { data: carts } = await supabase
        .from("cartera" as never)
        .select("id, expediente_id")
        .in("id", cartIds);
      const expIds = Array.from(new Set(((carts ?? []) as unknown as { id: string; expediente_id: string }[]).map((c) => c.expediente_id)));
      const { data: exps } = await supabase
        .from("expedientes")
        .select("id, cliente_nombre, banco")
        .in("id", expIds);
      const expMap = new Map((exps ?? []).map((e) => [e.id, e]));
      const cartMap = new Map(((carts ?? []) as unknown as { id: string; expediente_id: string }[]).map((c) => [c.id, c.expediente_id]));
      setPagos(
        rows.map((r) => {
          const exp = expMap.get(cartMap.get(r.cartera_id) ?? "");
          return { ...r, cliente: exp?.cliente_nombre ?? "—", banco: exp?.banco ?? null };
        }),
      );
    })();
  }, [reloadKey]);

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Receipt size={12} />, label: "Finanzas", tone: "green" }}
        title="Recaudos"
        description="Registra pagos de clientes. El sistema recalcula saldo y cierra la cartera automáticamente cuando el pagado iguala los honorarios."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <NuevoRecaudo
          carteras={carteras}
          cuentas={cuentas}
          loading={loading}
          onSaved={() => setReloadKey((k) => k + 1)}
        />

        <NCard padding="none">
          <div className="px-4 py-3 text-sm font-semibold" style={{ borderBottom: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}>
            Últimos 50 recaudos
          </div>
          {pagos.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: "var(--nuvia-text-muted)" }}>Sin recaudos registrados aún.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide"  style={{ color: "var(--nuvia-text-muted)" }}>Fecha</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide"  style={{ color: "var(--nuvia-text-muted)" }}>Cliente</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide"  style={{ color: "var(--nuvia-text-muted)" }}>Banco</th>
                    <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Valor</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide"  style={{ color: "var(--nuvia-text-muted)" }}>Método</th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wide"  style={{ color: "var(--nuvia-text-muted)" }}>Comp. #</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.03]" style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                      <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{p.fecha}</td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--nuvia-text-primary)" }}>{p.cliente}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{p.banco ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-accent-green)" }}>{money(Number(p.valor))}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{p.metodo ?? "—"}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{p.comprobante_num ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Link to="/cartera/$id" params={{ id: p.cartera_id }} className="text-[11px] hover:underline" style={{ color: "var(--nuvia-accent-blue)" }}>Ver →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </NCard>
      </div>
    </PageLayout>
  );
}

const METODO_OPTS = [
  { value: "__none__", label: "—" },
  ...METODOS_PAGO.map((m) => ({ value: m.key, label: m.label })),
];

function NuevoRecaudo({
  carteras,
  cuentas,
  loading,
  onSaved,
}: {
  carteras: CarteraConExpediente[];
  cuentas: CuentaReceptora[];
  loading: boolean;
  onSaved: () => void;
}) {
  const registrar = useServerFn(registrarPago);
  const [busqueda, setBusqueda] = useState("");
  const [carteraId, setCarteraId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState("");
  const [metodo, setMetodo] = useState("__none__");
  const [bancoReceptor, setBancoReceptor] = useState("");
  const [comprobanteNum, setComprobanteNum] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const candidatos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const conSaldo = carteras.filter((c) => Number(c.honorarios_totales) - Number(c.pagado) > 0);
    if (!q) return conSaldo.slice(0, 25);
    return conSaldo
      .filter(
        (c) =>
          c.expediente?.cliente_nombre?.toLowerCase().includes(q) ||
          c.expediente?.cedula?.toLowerCase().includes(q) ||
          c.expediente?.banco?.toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [carteras, busqueda]);

  const carteraOpts = useMemo(() => {
    const opts = [{ value: "__none__", label: loading ? "Cargando…" : "— Selecciona —" }];
    for (const c of candidatos) {
      const s = Number(c.honorarios_totales) - Number(c.pagado);
      opts.push({
        value: c.id,
        label: `${c.expediente?.cliente_nombre ?? "—"} · ${c.expediente?.banco ?? "—"} · saldo ${money(s)}`,
      });
    }
    return opts;
  }, [candidatos, loading]);

  const seleccionada = carteras.find((c) => c.id === carteraId);
  const saldo = seleccionada ? Number(seleccionada.honorarios_totales) - Number(seleccionada.pagado) : 0;

  async function fileToBase64(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!carteraId) {
      setError("Selecciona la cartera a abonar.");
      return;
    }
    const v = Number(valor);
    if (!v || v <= 0) {
      setError("Valor inválido.");
      return;
    }
    if (v > saldo + 1) {
      if (!confirm(`El valor (${money(v)}) supera el saldo (${money(saldo)}). ¿Continuar de todos modos?`)) return;
    }
    setSaving(true);
    try {
      let comprobanteBase64: string | undefined;
      let comprobanteFilename: string | undefined;
      if (file) {
        comprobanteBase64 = await fileToBase64(file);
        comprobanteFilename = file.name;
      }
      await registrar({
        data: {
          carteraId,
          fecha,
          valor: v,
          metodo: metodo !== "__none__" ? metodo : undefined,
          bancoReceptor: bancoReceptor || undefined,
          comprobanteNum: comprobanteNum || undefined,
          comprobanteBase64,
          comprobanteFilename,
          observaciones: observaciones || undefined,
        },
      });
      setOk("Recaudo registrado correctamente.");
      setValor("");
      setMetodo("__none__");
      setBancoReceptor("");
      setComprobanteNum("");
      setObservaciones("");
      setFile(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar pago.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <NCard>
      <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--nuvia-text-primary)" }}>Registrar recaudo</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Buscar cliente / cédula / banco">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Escribe para filtrar carteras con saldo"
            className="nuvia-input nuvia-input-sm w-full"
          />
        </Field>
        <Field label="Cartera">
          <NSelect
            value={carteraId || "__none__"}
            onValueChange={(v) => setCarteraId(v === "__none__" ? "" : v)}
            options={carteraOpts}
            compact
          />
        </Field>

        {seleccionada && (
          <div
            className="rounded-lg p-2.5 text-[11.5px]"
            style={{
              background: "rgba(68,93,163,0.10)",
              border: "1px solid rgba(68,93,163,0.30)",
              color: "var(--nuvia-text-secondary)",
            }}
          >
            Honorarios: <b style={{ color: "var(--nuvia-text-primary)" }}>{money(Number(seleccionada.honorarios_totales))}</b> · Pagado:{" "}
            <b style={{ color: "var(--nuvia-accent-green)" }}>{money(Number(seleccionada.pagado))}</b> · Saldo:{" "}
            <b style={{ color: "var(--nuvia-accent-blue)" }}>{money(saldo)}</b>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
          </Field>
          <Field label="Valor (COP)">
            <input type="number" min={0} value={valor} onChange={(e) => setValor(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
          </Field>
          <Field label="Método">
            <NSelect value={metodo} onValueChange={setMetodo} options={METODO_OPTS} compact />
          </Field>
          <Field label="Banco receptor">
            {cuentas.length > 0 ? (
              <NSelect
                value={bancoReceptor || "__none__"}
                onValueChange={(v) => setBancoReceptor(v === "__none__" ? "" : v)}
                options={[
                  { value: "__none__", label: "— Selecciona cuenta —" },
                  ...cuentas.map((c) => ({
                    value: `${c.banco}${c.numero ? ` · ${c.numero}` : ""}`,
                    label: `${c.banco}${c.tipo ? ` (${c.tipo})` : ""}${c.numero ? ` · ${c.numero}` : ""}`,
                  })),
                ]}
                compact
              />
            ) : (
              <input
                value={bancoReceptor}
                onChange={(e) => setBancoReceptor(e.target.value)}
                placeholder="Sin cuentas parametrizadas"
                className="nuvia-input nuvia-input-sm w-full"
              />
            )}
          </Field>
        </div>

        <Field label="N° comprobante">
          <input value={comprobanteNum} onChange={(e) => setComprobanteNum(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
        </Field>
        <Field label="Comprobante (PDF/imagen)">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-[12px]"
            style={{ color: "var(--nuvia-text-secondary)" }}
          />
        </Field>
        <Field label="Observaciones">
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className="nuvia-input nuvia-input-sm w-full"
          />
        </Field>

        {error && <div className="text-[12px]" style={{ color: "var(--nuvia-danger)" }}>{error}</div>}
        {ok && <div className="text-[12px]" style={{ color: "var(--nuvia-accent-green)" }}>{ok}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
        >
          {saving ? "Registrando…" : "Registrar recaudo"}
        </button>
      </form>
    </NCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}
