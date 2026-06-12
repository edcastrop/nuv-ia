import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  NCard,
  SectionHeader,
} from "@/components/nuvia";
import { NSelect } from "@/components/nuvia/NSelect";
import { supabase } from "@/integrations/supabase/client";
import { upsertEmpleado, pagarNomina } from "@/lib/finanzas.functions";
import { Users2, Wallet, UserPlus, UploadCloud, FileText, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/nomina")({
  component: NominaPage,
  head: () => ({ meta: [{ title: "Nómina · NUVIA" }] }),
});

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

  const activos = useMemo(() => empleados.filter((e) => e.activo), [empleados]);
  const totalNomina = activos.reduce((a, b) => a + Number(b.valor_mensual), 0);
  const pagadoMes = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    return pagos.filter((p) => p.periodo === mes).reduce((a, b) => a + Number(b.valor), 0);
  }, [pagos]);

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Users2 size={12} />, label: "Finanzas", tone: "blue" }}
        title="Nómina"
        description="Empleados activos y pagos mensuales con comprobante. Cada pago genera un movimiento en tesorería."
      />

      <KpiGrid cols={4}>
        <KpiCard icon={<Users2 size={16} />} tone="blue" label="Activos" value={String(activos.length)} hint={`${empleados.length} totales`} />
        <KpiCard icon={<Wallet size={16} />} tone="neutral" label="Costo mensual" value={money(totalNomina)} />
        <KpiCard icon={<Wallet size={16} />} tone="green" label="Pagado este mes" value={money(pagadoMes)} />
        <KpiCard
          icon={<Wallet size={16} />}
          tone={totalNomina - pagadoMes > 0 ? "warning" : "neutral"}
          label="Pendiente del mes"
          value={money(Math.max(0, totalNomina - pagadoMes))}
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <FormEmpleado onSaved={() => setTick((t) => t + 1)} />
        <NCard padding="md">
          <SectionHeader title={`Empleados (${empleados.length})`} description="Plantilla registrada" />
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    { l: "Nombre", a: "left" },
                    { l: "Cargo", a: "left" },
                    { l: "Contrato", a: "left" },
                    { l: "Valor mes", a: "right" },
                    { l: "Estado", a: "left" },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2.5 font-semibold uppercase"
                      style={{
                        textAlign: h.a as "left" | "right",
                        fontSize: "10.5px",
                        letterSpacing: "0.12em",
                        color: "var(--nuvia-text-secondary)",
                        borderBottom: "1px solid var(--nuvia-border)",
                      }}
                    >
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empleados.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-white/[0.03]"
                    style={{ borderBottom: "1px solid var(--nuvia-border)" }}
                  >
                    <td className="px-3 py-2.5 font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                      {e.nombre}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                      {e.cargo ?? "—"}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                      {e.tipo_contrato}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right font-semibold tabular-nums"
                      style={{ color: "var(--nuvia-text-primary)" }}
                    >
                      {money(Number(e.valor_mensual))}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                        style={{
                          color: e.activo ? "var(--nuvia-success)" : "var(--nuvia-danger)",
                          background: e.activo ? "rgba(132,185,143,0.12)" : "rgba(180,35,24,0.12)",
                        }}
                      >
                        {e.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
                {empleados.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-[12px]"
                      style={{ color: "var(--nuvia-text-muted)" }}
                    >
                      Sin empleados registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </NCard>
      </div>

      <FormPago empleados={activos} onSaved={() => setTick((t) => t + 1)} />

      <NCard padding="md">
        <SectionHeader title="Pagos recientes" description={`${pagos.length} últimos pagos`} />
        {pagos.length === 0 ? (
          <div className="py-6 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>
            Sin pagos registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    { l: "Fecha", a: "left" },
                    { l: "Empleado", a: "left" },
                    { l: "Periodo", a: "left" },
                    { l: "Valor", a: "right" },
                    { l: "Estado", a: "left" },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2.5 font-semibold uppercase"
                      style={{
                        textAlign: h.a as "left" | "right",
                        fontSize: "10.5px",
                        letterSpacing: "0.12em",
                        color: "var(--nuvia-text-secondary)",
                        borderBottom: "1px solid var(--nuvia-border)",
                      }}
                    >
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => {
                  const emp = empleados.find((e) => e.id === p.empleado_id);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-white/[0.03]"
                      style={{ borderBottom: "1px solid var(--nuvia-border)" }}
                    >
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {p.fecha_pago ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                        {emp?.nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {p.periodo}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-semibold tabular-nums"
                        style={{ color: "var(--nuvia-success)" }}
                      >
                        {money(Number(p.valor))}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {p.estado}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </NCard>
    </PageLayout>
  );
}

const CONTRATO_OPTS = [
  { value: "indefinido", label: "Indefinido" },
  { value: "fijo", label: "Fijo" },
  { value: "prestacion", label: "Prestación servicios" },
  { value: "obra_labor", label: "Obra labor" },
];

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
    if (!nombre.trim() || !v || v <= 0) {
      setError("Nombre y valor mensual son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await guardar({
        data: {
          nombre,
          documento: documento || undefined,
          cargo: cargo || undefined,
          area: area || undefined,
          tipo_contrato: tipo,
          valor_mensual: v,
          activo: true,
        },
      });
      setNombre("");
      setDocumento("");
      setCargo("");
      setArea("");
      setValor("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <NCard padding="md">
      <SectionHeader icon={<UserPlus size={14} />} title="Registrar empleado" />
      <form onSubmit={onSubmit} className="space-y-2.5">
        <Field label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Documento">
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
          </Field>
          <Field label="Cargo">
            <input value={cargo} onChange={(e) => setCargo(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
          </Field>
          <Field label="Área">
            <input value={area} onChange={(e) => setArea(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
          </Field>
          <Field label="Contrato">
            <NSelect
              value={tipo}
              onValueChange={(v) => setTipo(v as typeof tipo)}
              options={CONTRATO_OPTS}
              compact
            />
          </Field>
        </div>
        <Field label="Valor mensual (COP)">
          <input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="nuvia-input nuvia-input-sm w-full"
          />
        </Field>
        {error && (
          <div className="text-[12px]" style={{ color: "var(--nuvia-danger)" }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
        >
          {saving ? "Guardando…" : "Guardar empleado"}
        </button>
      </form>
    </NCard>
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
  const [dragOver, setDragOver] = useState(false);
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
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const v = Number(valor);
    if (!empleadoId || !v || v <= 0 || !file) {
      setError("Empleado, valor y comprobante son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const b64 = await fileToBase64(file);
      await pagar({
        data: {
          empleado_id: empleadoId,
          periodo,
          valor: v,
          fecha_pago: fecha,
          comprobante_num: num || undefined,
          comprobanteBase64: b64,
          comprobanteFilename: file.name,
          observaciones: obs || undefined,
        },
      });
      setOk("Pago registrado y movimiento creado en tesorería.");
      setFile(null);
      setObs("");
      setNum("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const empOpts = [
    { value: "__none__", label: "— Selecciona —" },
    ...empleados.map((e) => ({ value: e.id, label: e.nombre })),
  ];

  return (
    <NCard padding="md">
      <SectionHeader title="Registrar pago de nómina" description="Genera movimiento de egreso en tesorería" />
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Empleado">
          <NSelect
            value={empleadoId || "__none__"}
            onValueChange={(v) => setEmpleadoId(v === "__none__" ? "" : v)}
            options={empOpts}
            compact
          />
        </Field>
        <Field label="Periodo (YYYY-MM)">
          <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
        </Field>
        <Field label="Fecha de pago">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
        </Field>
        <Field label="Valor (COP)">
          <input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="nuvia-input nuvia-input-sm w-full"
          />
        </Field>
        <Field label="N° comprobante">
          <input value={num} onChange={(e) => setNum(e.target.value)} className="nuvia-input nuvia-input-sm w-full" />
        </Field>
        <Field label="Comprobante (PDF/imagen) *">
          <Dropzone file={file} setFile={setFile} dragOver={dragOver} setDragOver={setDragOver} />
        </Field>
        <div className="md:col-span-3">
          <Field label="Observaciones">
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              className="nuvia-input nuvia-input-sm w-full"
            />
          </Field>
        </div>
        {error && (
          <div className="md:col-span-3 text-[12px]" style={{ color: "var(--nuvia-danger)" }}>
            {error}
          </div>
        )}
        {ok && (
          <div className="md:col-span-3 text-[12px]" style={{ color: "var(--nuvia-success)" }}>
            {ok}
          </div>
        )}
        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
          >
            {saving ? "Registrando…" : "Pagar nómina"}
          </button>
        </div>
      </form>
    </NCard>
  );
}

function Dropzone({
  file,
  setFile,
  dragOver,
  setDragOver,
}: {
  file: File | null;
  setFile: (f: File | null) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
}) {
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) setFile(f);
      }}
      className="flex flex-col items-center justify-center gap-1.5 rounded-lg cursor-pointer transition-colors px-3 py-4 text-center"
      style={{
        border: `1.5px dashed ${dragOver ? "var(--nuvia-accent-blue)" : "var(--nuvia-border)"}`,
        background: dragOver ? "rgba(68,93,163,0.08)" : "rgba(255,255,255,0.02)",
        color: "var(--nuvia-text-secondary)",
      }}
    >
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      {file ? (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--nuvia-text-primary)" }}>
          <FileText size={14} style={{ color: "var(--nuvia-accent-blue)" }} />
          <span className="truncate max-w-[220px]">{file.name}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFile(null);
            }}
            className="ml-1 rounded p-0.5 hover:bg-white/10"
            style={{ color: "var(--nuvia-text-muted)" }}
            aria-label="Quitar archivo"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <UploadCloud size={18} style={{ color: "var(--nuvia-accent-blue)" }} />
          <div className="text-[12px]" style={{ color: "var(--nuvia-text-primary)" }}>
            Arrastra el comprobante aquí
          </div>
          <div className="text-[10.5px]" style={{ color: "var(--nuvia-text-muted)" }}>
            o haz clic para seleccionar · PDF o imagen
          </div>
        </>
      )}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[10.5px] uppercase tracking-wider"
        style={{ color: "var(--nuvia-text-muted)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
