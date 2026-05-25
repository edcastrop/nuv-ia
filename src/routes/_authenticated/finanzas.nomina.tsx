import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { upsertEmpleado, pagarNomina } from "@/lib/finanzas.functions";

export const Route = createFileRoute("/_authenticated/finanzas/nomina")({
  component: NominaPage,
  head: () => ({ meta: [{ title: "Nómina · NUVEX" }] }),
});

const AZUL = "#445DA3";
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

type Empleado = {
  id: string;
  nombre: string;
  documento: string | null;
  cargo: string | null;
  area: string | null;
  tipo_contrato: string;
  valor_mensual: number;
  activo: boolean;
};
type Pago = {
  id: string;
  empleado_id: string;
  periodo: string;
  valor: number;
  fecha_pago: string | null;
  estado: string;
  comprobante_url: string | null;
};

function NominaPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: emps } = await supabase
        .from("nomina_empleados" as never)
        .select("*")
        .order("nombre");
      setEmpleados((emps ?? []) as unknown as Empleado[]);
      const { data: ps } = await supabase
        .from("nomina_pagos" as never)
        .select("*")
        .order("fecha_pago", { ascending: false })
        .limit(60);
      setPagos((ps ?? []) as unknown as Pago[]);
    })();
  }, [tick]);

  const totalNomina = empleados.filter((e) => e.activo).reduce((a, b) => a + Number(b.valor_mensual), 0);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#0A1226]">Nómina</h1>
            <p className="text-[12px] text-[#242424]/60">Empleados activos y pagos mensuales con comprobante.</p>
          </div>
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">Costo mensual activo</div>
            <div className="text-lg font-semibold" style={{ color: AZUL }}>{money(totalNomina)}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <FormEmpleado onSaved={() => setTick((t) => t + 1)} />
        <Card>
          <h2 className="text-sm font-semibold text-[#0A1226] mb-2">Empleados ({empleados.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left py-2 pr-3">Nombre</th>
                  <th className="text-left pr-3">Cargo</th>
                  <th className="text-left pr-3">Contrato</th>
                  <th className="text-right pr-3">Valor mes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((e) => (
                  <tr key={e.id} className="border-b border-[#F3F4F6]">
                    <td className="py-2 pr-3 font-medium">{e.nombre}</td>
                    <td className="pr-3">{e.cargo ?? "—"}</td>
                    <td className="pr-3">{e.tipo_contrato}</td>
                    <td className="pr-3 text-right">{money(Number(e.valor_mensual))}</td>
                    <td>{e.activo ? <span className="text-[10px] text-[#1F7A45]">Activo</span> : <span className="text-[10px] text-[#B42318]">Inactivo</span>}</td>
                  </tr>
                ))}
                {empleados.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-[12px] text-[#242424]/60">Sin empleados registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <FormPago empleados={empleados.filter((e) => e.activo)} onSaved={() => setTick((t) => t + 1)} />

      <Card>
        <h2 className="text-sm font-semibold text-[#0A1226] mb-2">Pagos recientes</h2>
        {pagos.length === 0 ? (
          <div className="py-4 text-center text-[12px] text-[#242424]/60">Sin pagos registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left py-2 pr-3">Fecha</th>
                  <th className="text-left pr-3">Empleado</th>
                  <th className="text-left pr-3">Periodo</th>
                  <th className="text-right pr-3">Valor</th>
                  <th className="text-left pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => {
                  const emp = empleados.find((e) => e.id === p.empleado_id);
                  return (
                    <tr key={p.id} className="border-b border-[#F3F4F6]">
                      <td className="py-2 pr-3">{p.fecha_pago ?? "—"}</td>
                      <td className="pr-3 font-medium">{emp?.nombre ?? "—"}</td>
                      <td className="pr-3">{p.periodo}</td>
                      <td className="pr-3 text-right text-[#1F7A45] font-semibold">{money(Number(p.valor))}</td>
                      <td className="pr-3">{p.estado}</td>
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

function FormEmpleado({ onSaved }: { onSaved: () => void }) {
  const guardar = useServerFn(upsertEmpleado);
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [cargo, setCargo] = useState("");
  const [area, setArea] = useState("");
  const [tipo, setTipo] = useState<"indefinido" | "fijo" | "prestacion" | "obra_labor">("indefinido");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = Number(valor);
    if (!nombre.trim() || !v || v <= 0) { setError("Nombre y valor mensual son obligatorios."); return; }
    setSaving(true);
    try {
      await guardar({ data: { nombre, documento: documento || undefined, cargo: cargo || undefined, area: area || undefined, tipo_contrato: tipo, valor_mensual: v, activo: true } });
      setNombre(""); setDocumento(""); setCargo(""); setArea(""); setValor("");
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-[#0A1226] mb-3">Registrar empleado</h2>
      <form onSubmit={onSubmit} className="space-y-2">
        <Inp label="Nombre" value={nombre} onChange={setNombre} />
        <div className="grid grid-cols-2 gap-2">
          <Inp label="Documento" value={documento} onChange={setDocumento} />
          <Inp label="Cargo" value={cargo} onChange={setCargo} />
          <Inp label="Área" value={area} onChange={setArea} />
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">Contrato</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white">
              <option value="indefinido">Indefinido</option>
              <option value="fijo">Fijo</option>
              <option value="prestacion">Prestación servicios</option>
              <option value="obra_labor">Obra labor</option>
            </select>
          </label>
        </div>
        <Inp label="Valor mensual (COP)" value={valor} onChange={setValor} type="number" />
        {error && <div className="text-[12px] text-[#B42318]">{error}</div>}
        <button type="submit" disabled={saving} className="w-full rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${AZUL}, #84B98F)` }}>
          {saving ? "Guardando…" : "Guardar empleado"}
        </button>
      </form>
    </Card>
  );
}

function FormPago({ empleados, onSaved }: { empleados: Empleado[]; onSaved: () => void }) {
  const pagar = useServerFn(pagarNomina);
  const [empleadoId, setEmpleadoId] = useState("");
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [valor, setValor] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [num, setNum] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    const e = empleados.find((x) => x.id === empleadoId);
    if (e) setValor(String(e.valor_mensual));
  }, [empleadoId, empleados]);

  async function fileToBase64(f: File) {
    const buf = await f.arrayBuffer();
    let bin = ""; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOk(null);
    const v = Number(valor);
    if (!empleadoId || !v || v <= 0 || !file) { setError("Empleado, valor y comprobante son obligatorios."); return; }
    setSaving(true);
    try {
      const b64 = await fileToBase64(file);
      await pagar({ data: { empleado_id: empleadoId, periodo, valor: v, fecha_pago: fecha, comprobante_num: num || undefined, comprobanteBase64: b64, comprobanteFilename: file.name, observaciones: obs || undefined } });
      setOk("Pago registrado y movimiento creado en tesorería.");
      setFile(null); setObs(""); setNum("");
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-[#0A1226] mb-3">Registrar pago de nómina</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 md:col-span-1">
          <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">Empleado</span>
          <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white">
            <option value="">— Selecciona —</option>
            {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </label>
        <Inp label="Periodo (YYYY-MM)" value={periodo} onChange={setPeriodo} />
        <Inp label="Fecha de pago" type="date" value={fecha} onChange={setFecha} />
        <Inp label="Valor (COP)" type="number" value={valor} onChange={setValor} />
        <Inp label="N° comprobante" value={num} onChange={setNum} />
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">Comprobante (PDF/imagen)*</span>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[12px]" />
        </label>
        <label className="flex flex-col gap-1 md:col-span-3">
          <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">Observaciones</span>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white" />
        </label>
        {error && <div className="md:col-span-3 text-[12px] text-[#B42318]">{error}</div>}
        {ok && <div className="md:col-span-3 text-[12px] text-[#1F7A45]">{ok}</div>}
        <div className="md:col-span-3">
          <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${AZUL}, #84B98F)` }}>
            {saving ? "Registrando…" : "Pagar nómina"}
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
