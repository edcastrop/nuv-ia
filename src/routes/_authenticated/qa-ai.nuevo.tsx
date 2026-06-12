import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageLayout, ExecutiveHero, NCard, SectionHeader, NSelect } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { auditarCaso } from "@/lib/qaAI.functions";
import { Brain, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa-ai/nuevo")({
  component: NuevoQaAi,
  head: () => ({ meta: [{ title: "Auditar caso · QA AI" }] }),
});

type ModalidadOpt = "hipotecario" | "leasing" | "uvr";

function NuevoQaAi() {
  const run = useServerFn(auditarCaso);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalidad, setModalidad] = useState<ModalidadOpt>("hipotecario");
  const [saldo, setSaldo] = useState("");
  const [tasa, setTasa] = useState("");
  const [cuotas, setCuotas] = useState("");
  const [seguros, setSeguros] = useState("");
  const [frech, setFrech] = useState("");
  const [desemb, setDesemb] = useState("");
  // extracto
  const [extSaldo, setExtSaldo] = useState("");
  const [extTasa, setExtTasa] = useState("");
  const [extCuota, setExtCuota] = useState("");
  const [extSeguros, setExtSeguros] = useState("");
  // simulación
  const [simAhorro, setSimAhorro] = useState("");
  const [simPlazo, setSimPlazo] = useState("");

  const num = (v: string) => (v === "" ? undefined : Number(v));

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await run({
        data: {
          modalidad,
          reconstruccion: {
            saldoCapital: Number(saldo || 0),
            tasaEa: Number(tasa || 0),
            cuotasPendientes: Number(cuotas || 0),
            seguros: Number(seguros || 0),
            coberturaFrechPp: num(frech),
            valorDesembolsado: num(desemb),
          },
          extracto: {
            saldoCapital: num(extSaldo),
            tasaEa: num(extTasa),
            cuota: num(extCuota),
            seguros: num(extSeguros),
          },
          simulacion: simAhorro || simPlazo ? {
            ahorroProyectado: num(simAhorro),
            nuevoPlazo: num(simPlazo),
          } : undefined,
        },
      });
      navigate({ to: "/qa-ai/$id", params: { id: res.auditoriaId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error ejecutando auditoría");
      setBusy(false);
    }
  };

  const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>
      {label}
      <input className="nuvia-input nuvia-input-sm tabular-nums" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Brain size={12} />, label: "Nuevo caso", tone: "blue" }}
        title="Auditar caso · NUVIA QA AI"
        description="Captura los datos del crédito y del extracto. El motor reconstruye matemáticamente y emite dictamen."
      />

      <NCard>
        <SectionHeader title="Modalidad y datos del crédito" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>
            Modalidad
            <NSelect
              value={modalidad}
              onChange={(v) => setModalidad(v as ModalidadOpt)}
              options={[
                { value: "hipotecario", label: "Hipotecario" },
                { value: "leasing", label: "Leasing habitacional" },
                { value: "uvr", label: "UVR" },
              ]}
            />
          </label>
          <Field label="Saldo capital (COP)" value={saldo} onChange={setSaldo} placeholder="120000000" />
          <Field label="Tasa EA (%)" value={tasa} onChange={setTasa} placeholder="12.5" />
          <Field label="Cuotas pendientes" value={cuotas} onChange={setCuotas} placeholder="180" />
          <Field label="Seguros totales (COP/mes)" value={seguros} onChange={setSeguros} placeholder="180000" />
          <Field label="Cobertura FRECH (pp EA, opcional)" value={frech} onChange={setFrech} placeholder="2.5" />
          <Field label="Valor desembolsado original (opcional)" value={desemb} onChange={setDesemb} placeholder="180000000" />
        </div>
      </NCard>

      <NCard>
        <SectionHeader title="Datos del extracto bancario" description="Lo reportado por el banco — el motor lo comparará con la reconstrucción." />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <Field label="Saldo capital extracto" value={extSaldo} onChange={setExtSaldo} />
          <Field label="Tasa EA extracto (%)" value={extTasa} onChange={setExtTasa} />
          <Field label="Cuota mensual extracto" value={extCuota} onChange={setExtCuota} />
          <Field label="Total seguros extracto" value={extSeguros} onChange={setExtSeguros} />
        </div>
      </NCard>

      <NCard>
        <SectionHeader title="Simulación del analista (opcional)" description="Cifras declaradas por el analista NUVEX para auditar contra el motor." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Field label="Ahorro proyectado (COP)" value={simAhorro} onChange={setSimAhorro} />
          <Field label="Nuevo plazo (cuotas)" value={simPlazo} onChange={setSimPlazo} />
        </div>
      </NCard>

      {error && <p className="text-xs" style={{ color: "var(--nuvia-danger)" }}>{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={busy || !saldo || !tasa || !cuotas}
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
          style={{ background: "var(--nuvia-accent)", color: "#fff", opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer", border: "none" }}
        >
          <Play size={14} /> {busy ? "Auditando…" : "Ejecutar auditoría"}
        </button>
      </div>
    </PageLayout>
  );
}
