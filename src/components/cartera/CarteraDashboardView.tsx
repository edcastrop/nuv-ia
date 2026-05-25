import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import {
  listCarteras,
  CARTERA_ESTADO_BY_KEY,
  CARTERA_ESTADOS,
  diasMora,
  type CarteraConExpediente,
  type CarteraEstado,
} from "@/lib/cartera";
import { supabase } from "@/integrations/supabase/client";

const AZUL = "#445DA3";
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function CarteraDashboardView({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  const [items, setItems] = useState<CarteraConExpediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [responsables, setResponsables] = useState<{ id: string; nombre: string | null; email: string | null }[]>([]);

  const [estado, setEstado] = useState<CarteraEstado | "">("");
  const [responsableId, setResponsableId] = useState("");
  const [banco, setBanco] = useState("");
  const [moraMin, setMoraMin] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("id, nombre, email").eq("activo", true).then(({ data }) => setResponsables(data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    listCarteras({
      estado: estado || undefined,
      responsableId: responsableId || undefined,
      banco: banco || undefined,
      diasMoraMin: moraMin ? Number(moraMin) : undefined,
    })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [estado, responsableId, banco, moraMin]);

  const totales = useMemo(() => {
    let th = 0, tp = 0, ts = 0, enMora = 0;
    for (const c of items) {
      th += Number(c.honorarios_totales);
      tp += Number(c.pagado);
      const saldo = Number(c.honorarios_totales) - Number(c.pagado);
      ts += saldo;
      if (diasMora(c.fecha_vencimiento) > 0 && saldo > 0) enMora++;
    }
    return { th, tp, ts, enMora, n: items.length };
  }, [items]);

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-semibold text-[#0A1226]">{titulo}</h1>
        <p className="text-[12px] text-[#242424]/60">{subtitulo}</p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Casos" value={String(totales.n)} />
        <Metric label="Honorarios totales" value={money(totales.th)} />
        <Metric label="Pagado" value={money(totales.tp)} accent="#1F7A45" />
        <Metric label="Saldo" value={money(totales.ts)} accent={AZUL} />
        <Metric label="En mora" value={String(totales.enMora)} accent="#B42318" />
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Estado">
            <select value={estado} onChange={(e) => setEstado(e.target.value as CarteraEstado | "")} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white">
              <option value="">Todos</option>
              {CARTERA_ESTADOS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Responsable">
            <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white">
              <option value="">Todos</option>
              {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre || r.email}</option>)}
            </select>
          </Field>
          <Field label="Banco">
            <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="p.ej. Davivienda" className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white" />
          </Field>
          <Field label="Mora mínima (días)">
            <input type="number" min={0} value={moraMin} onChange={(e) => setMoraMin(e.target.value)} className="w-28 text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white" />
          </Field>
          <button
            onClick={() => { setEstado(""); setResponsableId(""); setBanco(""); setMoraMin(""); }}
            className="text-[11px] text-[#445DA3] hover:underline"
          >Limpiar filtros</button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="py-6 text-center text-sm text-[#242424]/60">Cargando carteras…</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-sm text-[#242424]/60">Sin resultados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left py-2 pr-3">Cliente</th>
                  <th className="text-left pr-3">Banco</th>
                  <th className="text-right pr-3">Honorarios</th>
                  <th className="text-right pr-3">Pagado</th>
                  <th className="text-right pr-3">Saldo</th>
                  <th className="text-left pr-3">Vencimiento</th>
                  <th className="text-left pr-3">Mora</th>
                  <th className="text-left pr-3">Estado</th>
                  <th className="text-left pr-3">Responsable</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const saldo = Number(c.honorarios_totales) - Number(c.pagado);
                  const dm = diasMora(c.fecha_vencimiento);
                  const def = CARTERA_ESTADO_BY_KEY[c.estado_cartera];
                  return (
                    <tr key={c.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                      <td className="py-2 pr-3 font-medium text-[#242424]">{c.expediente?.cliente_nombre}</td>
                      <td className="pr-3">{c.expediente?.banco ?? "—"}</td>
                      <td className="text-right pr-3">{money(Number(c.honorarios_totales))}</td>
                      <td className="text-right pr-3 text-[#1F7A45]">{money(Number(c.pagado))}</td>
                      <td className="text-right pr-3 font-semibold">{money(saldo)}</td>
                      <td className="pr-3">{c.fecha_vencimiento}</td>
                      <td className="pr-3" style={{ color: dm > 0 ? "#B42318" : "#242424" }}>{dm > 0 ? `${dm} días` : "—"}</td>
                      <td className="pr-3">
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded" style={{ color: def.color, background: def.bg }}>{def.label}</span>
                      </td>
                      <td className="pr-3 text-[11.5px]">{c.responsable?.nombre || c.responsable?.email || "—"}</td>
                      <td>
                        <Link to="/cartera/$id" params={{ id: c.id }} className="text-[11px] text-[#445DA3] hover:underline">Abrir →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <div className="text-[10.5px] uppercase tracking-wider text-[#242424]/55">{label}</div>
      <div className="text-[20px] font-semibold mt-1" style={{ color: accent ?? "#242424" }}>{value}</div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">{label}</span>
      {children}
    </label>
  );
}
