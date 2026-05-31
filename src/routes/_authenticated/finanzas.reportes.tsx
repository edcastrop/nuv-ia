import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/finanzas/reportes")({
  component: ReportesPage,
  head: () => ({ meta: [{ title: "Reportes · Finanzas NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

type ReporteId = "cartera" | "recaudos" | "comisiones" | "cuentas_cobro" | "nomina" | "tesoreria";

const REPORTES: Array<{ id: ReporteId; label: string; descripcion: string }> = [
  { id: "cartera", label: "Cartera de clientes", descripcion: "Honorarios, recaudo, saldo y mora por expediente." },
  { id: "recaudos", label: "Recaudos", descripcion: "Pagos registrados de clientes con método y comprobante." },
  { id: "comisiones", label: "Comisiones", descripcion: "Comisiones generadas, pendientes y pagadas por licenciado." },
  { id: "cuentas_cobro", label: "Cuentas de cobro", descripcion: "Estado de cuentas de cobro y trazabilidad de pago." },
  { id: "nomina", label: "Nómina", descripcion: "Pagos de nómina por periodo y empleado." },
  { id: "tesoreria", label: "Tesorería", descripcion: "Movimientos ingresos / egresos con categoría." },
];

function ReportesPage() {
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));
  const [last, setLast] = useState<{ id: ReporteId; rows: Record<string, unknown>[] } | null>(null);
  const [loading, setLoading] = useState<ReporteId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar(id: ReporteId) {
    setLoading(id); setError(null);
    try {
      const rows = await fetchReporte(id, desde, hasta);
      setLast({ id, rows });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(null);
    }
  }

  function descargarCSV() {
    if (!last) return;
    const headers = Object.keys(last.rows[0] ?? {});
    const csv = [
      headers.join(","),
      ...last.rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
    ].join("\n");
    download(`nuvex-${last.id}-${desde}_${hasta}.csv`, csv, "text/csv;charset=utf-8");
  }

  function descargarPDF() {
    if (!last) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`NUVEX · Reporte: ${last.id.toUpperCase()}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Periodo: ${desde}  →  ${hasta}    Generado: ${new Date().toLocaleString("es-CO")}`, 14, 20);

    const headers = Object.keys(last.rows[0] ?? {});
    const body = last.rows.map((r) => headers.map((h) => formatCell(r[h])));
    autoTable(doc, {
      head: [headers],
      body,
      startY: 26,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [68, 93, 163], textColor: 255 },
    });
    doc.save(`nuvex-${last.id}-${desde}_${hasta}.pdf`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#0A1226]">Reportes financieros</h1>
            <p className="text-[12px] text-[#242424]/60">Genera y exporta reportes en CSV o PDF institucional NUVEX.</p>
          </div>
          <div className="flex gap-2 items-end">
            <Inp label="Desde" type="date" value={desde} onChange={setDesde} />
            <Inp label="Hasta" type="date" value={hasta} onChange={setHasta} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTES.map((r) => (
          <Card key={r.id} className="flex flex-col">
            <div className="flex items-start gap-2">
              <FileText size={16} className="mt-0.5" style={{ color: AZUL }} />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#0A1226]">{r.label}</h3>
                <p className="text-[11.5px] text-[#242424]/60 mt-0.5">{r.descripcion}</p>
              </div>
            </div>
            <button
              onClick={() => cargar(r.id)}
              disabled={loading !== null}
              className="mt-3 self-start rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}
            >
              {loading === r.id ? "Generando…" : "Generar"}
            </button>
          </Card>
        ))}
      </div>

      {error && <Card><div className="text-[12px] text-[#B42318]">{error}</div></Card>}

      {last && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-[#0A1226]">
              {REPORTES.find((r) => r.id === last.id)?.label} — {last.rows.length} filas
            </h2>
            <div className="flex gap-2">
              <button onClick={descargarCSV} disabled={last.rows.length === 0} className="inline-flex items-center gap-1 rounded-lg border border-[#445DA3] px-3 py-1.5 text-[11.5px] font-semibold text-[#445DA3] hover:bg-[#F5F7FF] disabled:opacity-50">
                <Download size={12} /> CSV
              </button>
              <button onClick={descargarPDF} disabled={last.rows.length === 0} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}>
                <Download size={12} /> PDF
              </button>
            </div>
          </div>
          {last.rows.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-[#242424]/60">Sin datos en el rango.</div>
          ) : (
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-[12px]">
                <thead className="text-[10.5px] uppercase tracking-wider text-[#242424]/60 sticky top-0 bg-white">
                  <tr className="border-b border-[#E5E7EB]">
                    {Object.keys(last.rows[0]).map((h) => (
                      <th key={h} className="text-left py-2 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {last.rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-b border-[#F3F4F6]">
                      {Object.keys(last.rows[0]).map((h) => (
                        <td key={h} className="py-1.5 pr-3 align-top">{formatCell(r[h])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {last.rows.length > 200 && (
                <div className="mt-2 text-[11px] text-[#242424]/60 italic">Mostrando 200 de {last.rows.length} filas (CSV/PDF incluyen todas).</div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

async function fetchReporte(id: ReporteId, desde: string, hasta: string) {
  if (id === "cartera") {
    const { data } = await supabase
      .from("cartera" as never)
      .select("id, expediente_id, honorarios_totales, pagado, fecha_vencimiento, estado_cartera, forma_pago");
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const expIds = Array.from(new Set(rows.map((r) => r.expediente_id as string)));
    const { data: exps } = await supabase.from("expedientes").select("id, cliente_nombre, cedula, banco").in("id", expIds);
    const expMap = new Map((exps ?? []).map((e) => [e.id, e]));
    const hoy = new Date();
    return rows.map((r) => {
      const e = expMap.get(r.expediente_id as string);
      const saldo = Number(r.honorarios_totales) - Number(r.pagado);
      const dias = Math.floor((hoy.getTime() - new Date(r.fecha_vencimiento as string).getTime()) / 86400000);
      return {
        Cliente: e?.cliente_nombre ?? "—",
        Cedula: e?.cedula ?? "—",
        Banco: e?.banco ?? "—",
        Honorarios: Number(r.honorarios_totales),
        Pagado: Number(r.pagado),
        Saldo: saldo,
        Vencimiento: r.fecha_vencimiento,
        Mora_dias: dias,
        Estado: r.estado_cartera,
        Forma_pago: r.forma_pago,
      };
    });
  }
  if (id === "recaudos") {
    const { data } = await supabase
      .from("cartera_pagos" as never)
      .select("id, cartera_id, fecha, valor, metodo, banco_receptor, comprobante_num")
      .gte("fecha", desde).lte("fecha", hasta)
      .order("fecha", { ascending: false });
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const cartIds = Array.from(new Set(rows.map((r) => r.cartera_id as string)));
    const { data: carts } = await supabase.from("cartera" as never).select("id, expediente_id").in("id", cartIds);
    const cartMap = new Map(((carts ?? []) as unknown as { id: string; expediente_id: string }[]).map((c) => [c.id, c.expediente_id]));
    const expIds = Array.from(new Set(((carts ?? []) as unknown as { expediente_id: string }[]).map((c) => c.expediente_id)));
    const { data: exps } = await supabase.from("expedientes").select("id, cliente_nombre, banco").in("id", expIds);
    const expMap = new Map((exps ?? []).map((e) => [e.id, e]));
    return rows.map((r) => {
      const exp = expMap.get(cartMap.get(r.cartera_id as string) ?? "");
      return {
        Fecha: r.fecha,
        Cliente: exp?.cliente_nombre ?? "—",
        Banco: exp?.banco ?? "—",
        Valor: Number(r.valor),
        Metodo: r.metodo ?? "—",
        Banco_receptor: r.banco_receptor ?? "—",
        Comprobante: r.comprobante_num ?? "—",
      };
    });
  }
  if (id === "comisiones") {
    const { data } = await supabase
      .from("comisiones" as never)
      .select("id, expediente_id, user_id, base, porcentaje, valor, estado, rol, created_at")
      .gte("created_at", desde).lte("created_at", hasta + "T23:59:59")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const uids = Array.from(new Set(rows.map((r) => r.user_id as string)));
    const expIds = Array.from(new Set(rows.map((r) => r.expediente_id as string)));
    const [{ data: profs }, { data: exps }] = await Promise.all([
      supabase.from("profiles").select("id, nombre").in("id", uids),
      supabase.from("expedientes").select("id, cliente_nombre, banco").in("id", expIds),
    ]);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p.nombre ?? "—"]));
    const emap = new Map((exps ?? []).map((e) => [e.id, e]));
    return rows.map((r) => {
      const exp = emap.get(r.expediente_id as string);
      return {
        Fecha: String(r.created_at).slice(0, 10),
        "Analista F. Comercial": pmap.get(r.user_id as string) ?? "—",
        Cliente: exp?.cliente_nombre ?? "—",
        Banco: exp?.banco ?? "—",
        Base: Number(r.base),
        Porcentaje: Number(r.porcentaje),
        Valor: Number(r.valor),
        Estado: r.estado,
        Rol: r.rol,
      };
    });
  }
  if (id === "cuentas_cobro") {
    const { data } = await supabase
      .from("cuentas_cobro" as never)
      .select("id, numero, user_id, total, estado, fecha_envio, fecha_aprobacion, fecha_pago, created_at")
      .gte("created_at", desde).lte("created_at", hasta + "T23:59:59")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const uids = Array.from(new Set(rows.map((r) => r.user_id as string)));
    const { data: profs } = await supabase.from("profiles").select("id, nombre").in("id", uids);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p.nombre ?? "—"]));
    return rows.map((r) => ({
      Numero: r.numero,
      Licenciado: pmap.get(r.user_id as string) ?? "—",
      Total: Number(r.total),
      Estado: r.estado,
      Creada: String(r.created_at).slice(0, 10),
      Enviada: r.fecha_envio ? String(r.fecha_envio).slice(0, 10) : "—",
      Aprobada: r.fecha_aprobacion ? String(r.fecha_aprobacion).slice(0, 10) : "—",
      Pagada: r.fecha_pago ? String(r.fecha_pago).slice(0, 10) : "—",
    }));
  }
  if (id === "nomina") {
    const { data } = await supabase
      .from("nomina_pagos" as never)
      .select("id, empleado_id, periodo, valor, fecha_pago, estado, comprobante_num")
      .gte("fecha_pago", desde).lte("fecha_pago", hasta)
      .order("fecha_pago", { ascending: false });
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const empIds = Array.from(new Set(rows.map((r) => r.empleado_id as string)));
    const { data: emps } = await supabase.from("nomina_empleados" as never).select("id, nombre, cargo").in("id", empIds);
    const emap = new Map(((emps ?? []) as unknown as { id: string; nombre: string; cargo: string }[]).map((e) => [e.id, e]));
    return rows.map((r) => {
      const e = emap.get(r.empleado_id as string);
      return {
        Fecha: r.fecha_pago,
        Empleado: e?.nombre ?? "—",
        Cargo: e?.cargo ?? "—",
        Periodo: r.periodo,
        Valor: Number(r.valor),
        Estado: r.estado,
        Comprobante: r.comprobante_num ?? "—",
      };
    });
  }
  // tesoreria
  const { data } = await supabase
    .from("tesoreria_movimientos" as never)
    .select("fecha, tipo, categoria, valor, descripcion")
    .gte("fecha", desde).lte("fecha", hasta)
    .order("fecha", { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    Fecha: r.fecha,
    Tipo: r.tipo,
    Categoria: r.categoria,
    Valor: Number(r.valor),
    Descripcion: r.descripcion ?? "—",
  }));
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    return Math.abs(v) >= 1000 ? money(v) : String(v);
  }
  return String(v);
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Inp({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white" />
    </label>
  );
}
