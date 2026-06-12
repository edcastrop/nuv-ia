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
import { registrarMovimiento } from "@/lib/finanzas.functions";
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Wallet,
  ListChecks,
  UploadCloud,
  FileText,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/tesoreria")({
  component: TesoreriaPage,
  head: () => ({ meta: [{ title: "Tesorería · NUVIA" }] }),
});

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
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tesoreria_movimientos" as never)
        .select("*")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false })
        .limit(500);
      setMovs((data ?? []) as unknown as Mov[]);
    })();
  }, [tick, desde, hasta]);

  const totals = useMemo(() => {
    let ing = 0,
      egr = 0;
    for (const m of movs) {
      if (m.tipo === "ingreso") ing += Number(m.valor);
      else egr += Number(m.valor);
    }
    return { ing, egr, neto: ing - egr };
  }, [movs]);

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Landmark size={12} />, label: "Finanzas", tone: "blue" }}
        title="Tesorería"
        description="Flujo de caja consolidado: ingresos por recaudo y egresos por comisiones, nómina y operación."
      />

      <NCard padding="md">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde">
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="nuvia-input nuvia-input-sm"
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="nuvia-input nuvia-input-sm"
            />
          </Field>
        </div>
      </NCard>

      <KpiGrid cols={4}>
        <KpiCard icon={<TrendingUp size={16} />} tone="green" label="Ingresos" value={money(totals.ing)} />
        <KpiCard icon={<TrendingDown size={16} />} tone="danger" label="Egresos" value={money(totals.egr)} />
        <KpiCard
          icon={<Wallet size={16} />}
          tone={totals.neto >= 0 ? "blue" : "danger"}
          label="Neto"
          value={money(totals.neto)}
        />
        <KpiCard icon={<ListChecks size={16} />} tone="neutral" label="Movimientos" value={String(movs.length)} />
      </KpiGrid>

      <FormMov onSaved={() => setTick((t) => t + 1)} />

      <NCard padding="md">
        <SectionHeader title="Movimientos" description={`${movs.length} en el rango`} />
        {movs.length === 0 ? (
          <div className="py-8 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>
            Sin movimientos en el rango.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    { l: "Fecha", a: "left" },
                    { l: "Tipo", a: "left" },
                    { l: "Categoría", a: "left" },
                    { l: "Descripción", a: "left" },
                    { l: "Valor", a: "right" },
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
                {movs.map((m) => {
                  const color =
                    m.tipo === "ingreso" ? "var(--nuvia-success)" : "var(--nuvia-danger)";
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-white/[0.03]"
                      style={{ borderBottom: "1px solid var(--nuvia-border)" }}
                    >
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{m.fecha}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded"
                          style={{
                            color,
                            background:
                              m.tipo === "ingreso"
                                ? "rgba(132,185,143,0.12)"
                                : "rgba(180,35,24,0.12)",
                          }}
                        >
                          {m.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>
                        {m.categoria}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {m.descripcion ?? "—"}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-semibold tabular-nums"
                        style={{ color }}
                      >
                        {m.tipo === "egreso" ? "−" : ""}
                        {money(Number(m.valor))}
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

const TIPO_OPTS = [
  { value: "ingreso", label: "Ingreso" },
  { value: "egreso", label: "Egreso" },
];

function FormMov({ onSaved }: { onSaved: () => void }) {
  const registrar = useServerFn(registrarMovimiento);
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("egreso");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const v = Number(valor);
    if (!categoria.trim() || !v || v <= 0) {
      setError("Categoría y valor son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      let b64: string | undefined;
      let fn: string | undefined;
      if (file) {
        b64 = await fileToBase64(file);
        fn = file.name;
      }
      await registrar({
        data: {
          tipo,
          categoria,
          valor: v,
          fecha,
          descripcion: descripcion || undefined,
          comprobanteBase64: b64,
          comprobanteFilename: fn,
        },
      });
      setValor("");
      setCategoria("");
      setDescripcion("");
      setFile(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <NCard padding="md">
      <SectionHeader title="Registrar movimiento manual" description="Ingresos o egresos con soporte opcional" />
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
        <Field label="Tipo">
          <NSelect
            value={tipo}
            onValueChange={(v) => setTipo(v as "ingreso" | "egreso")}
            options={TIPO_OPTS}
            compact
          />
        </Field>
        <Field label="Categoría">
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="nuvia-input nuvia-input-sm w-full"
          />
        </Field>
        <Field label="Valor">
          <input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="nuvia-input nuvia-input-sm w-full"
          />
        </Field>
        <Field label="Fecha">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="nuvia-input nuvia-input-sm w-full"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Descripción">
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="nuvia-input nuvia-input-sm w-full"
            />
          </Field>
        </div>
        <div className="md:col-span-3">
          <Field label="Comprobante (opcional)">
            <Dropzone file={file} setFile={setFile} dragOver={dragOver} setDragOver={setDragOver} />
          </Field>
        </div>
        <div className="md:col-span-3 flex items-end gap-2">
          {error && (
            <span className="text-[12px]" style={{ color: "var(--nuvia-danger)" }}>
              {error}
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="ml-auto rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
          >
            {saving ? "Registrando…" : "Registrar"}
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
