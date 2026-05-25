import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, MetricCard } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { registrarMovimiento } from "@/lib/finanzas.functions";

export const Route = createFileRoute("/_authenticated/finanzas/tesoreria")({
  component: TesoreriaPage,
  head: () => ({ meta: [{ title: "Tesorería · NUVEX" }] }),
});

const AZUL = "#445DA3";
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

type Mov = {
  id: string;
  tipo: "ingreso" | "egreso";
  categoria: string;
  valor: number;
  fecha: string;
  descripcion: string | null;
  comprobante_url: string | null;
};

function TesoreriaPage() {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [tick, setTick] = useState(0);
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tesoreria_movimientos" as never)
        .select("*")
        .gte("fecha", desde).lte("fecha", hasta)
        .order("fecha", { ascending: false })
        .limit(500);
      setMovs((data ?? []) as unknown as Mov[]);
    })();
  }, [tick, desde, hasta]);

  const totals = useMemo(() => {
    let ing = 0, egr = 0;
    const porCat: Record<string, number> = {};
    for (const m of movs) {
      if (m.tipo === "ingreso") ing += Number(m.valor);
      else egr += Number(m.valor);
      const k = `${m.tipo}:${m.categoria}`;
      porCat[k] = (porCat[k] ?? 0) + Number(m.valor);
    }
    return { ing, egr, neto: ing - egr, porCat };
  }, [movs]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#0A1226]">Tesorería</h1>
            <p className="text-[12px] text-[#242424]/60">Flujo de caja consolidado: ingresos por recaudo y egresos por comisiones, nómina y operación.</p>
          </div>
          <div className="flex gap-2 items-end">
            <Inp label="Desde" type="date" value={desde} onChange={setDesde} />
            <Inp label="Hasta" type="date" value={hasta} onChange={setHasta} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Ingresos" value={money(totals.ing)} accent="green" />
        <MetricCard label="Egresos" value={money(totals.egr)} accent="default" />
        <MetricCard label="Neto" value={money(totals.neto)} accent={totals.neto >= 0 ? "blue" : "default"} />
        <MetricCard label="Movimientos" value={String(movs.length)} accent="dark" />
      </div>

      <FormMov onSaved={() => setTick((t) => t + 1)} />

      <Card>
        <h2 className="text-sm font-semibold text-[#0A1226] mb-2">Movimientos</h2>
        {movs.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[#242424]/60">Sin movimientos en el rango.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left py-2 pr-3">Fecha</th>
                  <th className="text-left pr-3">Tipo</th>
                  <th className="text-left pr-3">Categoría</th>
                  <th className="text-left pr-3">Descripción</th>
                  <th className="text-right pr-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id} className="border-b border-[#F3F4F6]">
                    <td className="py-2 pr-3">{m.fecha}</td>
                    <td className="pr-3">
                      <span className={`text-[10px] font-semibold uppercase ${m.tipo === "ingreso" ? "text-[#1F7A45]" : "text-[#B42318]"}`}>{m.tipo}</span>
                    </td>
                    <td className="pr-3">{m.categoria}</td>
                    <td className="pr-3 text-[#242424]/80">{m.descripcion ?? "—"}</td>
                    <td className={`pr-3 text-right font-semibold ${m.tipo === "ingreso" ? "text-[#1F7A45]" : "text-[#B42318]"}`}>
                      {m.tipo === "egreso" ? "-" : ""}{money(Number(m.valor))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function FormMov({ onSaved }: { onSaved: () => void }) {
  const registrar = useServerFn(registrarMovimiento);
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("egreso");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fileToBase64(f: File) {
    const buf = await f.arrayBuffer();
    let bin = ""; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = Number(valor);
    if (!categoria.trim() || !v || v <= 0) { setError("Categoría y valor son obligatorios."); return; }
    setSaving(true);
    try {
      let b64: string | undefined; let fn: string | undefined;
      if (file) { b64 = await fileToBase64(file); fn = file.name; }
      await registrar({ data: { tipo, categoria, valor: v, fecha, descripcion: descripcion || undefined, comprobanteBase64: b64, comprobanteFilename: fn } });
      setValor(""); setCategoria(""); setDescripcion(""); setFile(null);
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-[#0A1226] mb-3">Registrar movimiento manual</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "ingreso" | "egreso")} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white">
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
        </label>
        <Inp label="Categoría" value={categoria} onChange={setCategoria} />
        <Inp label="Valor" type="number" value={valor} onChange={setValor} />
        <Inp label="Fecha" type="date" value={fecha} onChange={setFecha} />
        <label className="md:col-span-2 flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">Descripción</span>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white" />
        </label>
        <label className="md:col-span-3 flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">Comprobante (opcional)</span>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[12px]" />
        </label>
        <div className="md:col-span-3 flex items-end gap-2">
          {error && <span className="text-[12px] text-[#B42318]">{error}</span>}
          <button type="submit" disabled={saving} className="ml-auto rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${AZUL}, #84B98F)` }}>
            {saving ? "Registrando…" : "Registrar"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Inp({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white" />
    </label>
  );
}
