import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { NCard } from "@/components/nuvia/NCard";
import { NSelect } from "@/components/nuvia/NSelect";
import {
  treasuryConfigGet,
  treasuryConfigSet,
  treasuryRulesList,
  treasuryRuleUpsert,
  treasuryRuleDelete,
} from "@/lib/treasury.functions";
import { Settings, Sliders, ListChecks, Plus, Trash2, Save, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/finanzas/treasury/config")({
  component: ConfigPage,
  head: () => ({ meta: [{ title: "Configuración · NUVIA Treasury AI" }] }),
});

const TIPOS = [
  { value: "cartera", label: "Cartera" },
  { value: "cuenta_cobro", label: "Cuenta de Cobro" },
  { value: "honorario", label: "Honorario" },
  { value: "comision", label: "Comisión" },
  { value: "otro", label: "Otro" },
];

function ConfigPage() {
  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Settings size={12} />, label: "Treasury AI · Config", tone: "blue" }}
        title="Configuración avanzada"
        description="Ajusta los umbrales de confianza del motor de conciliación y administra las reglas de match automáticas."
      />
      <UmbralesCard />
      <ReglasCard />
    </PageLayout>
  );
}

function UmbralesCard() {
  const getFn = useServerFn(treasuryConfigGet);
  const setFn = useServerFn(treasuryConfigSet);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["tConfig"], queryFn: () => getFn() });
  const [auto, setAuto] = useState(92);
  const [sug, setSug] = useState(70);
  const [tol, setTol] = useState(1.5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) { setAuto(data.umbral_auto_conciliar); setSug(data.umbral_sugerir); setTol(data.tolerancia_pct); }
  }, [data]);

  async function save() {
    if (sug >= auto) { toast.error("El umbral de sugerir debe ser menor que el de auto-conciliar"); return; }
    setSaving(true);
    try {
      await setFn({ data: { umbral_auto_conciliar: auto, umbral_sugerir: sug, tolerancia_pct: tol } });
      toast.success("Umbrales actualizados");
      qc.invalidateQueries({ queryKey: ["tConfig"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  return (
    <NCard variant="elevated">
      <div className="flex items-center gap-2 mb-3">
        <Sliders size={14} style={{ color: "#A5B5E0" }} />
        <h3 className="font-semibold" style={{ color: "var(--nuvia-text-primary)", fontSize: 14 }}>
          Umbrales del motor de conciliación
        </h3>
      </div>
      <p style={{ color: "var(--nuvia-text-secondary)", fontSize: 12, marginBottom: 18 }}>
        Define en qué porcentaje de score un movimiento se concilia automáticamente, se sugiere para revisión, y cuánta diferencia de valor se tolera al comparar.
      </p>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <Slider label="Auto-conciliar (≥)" suffix="%" min={70} max={100} step={1} value={auto} onChange={setAuto} hint="Movimientos con score ≥ este valor se concilian sin intervención." />
        <Slider label="Sugerir (≥)" suffix="%" min={30} max={95} step={1} value={sug} onChange={setSug} hint="Score mínimo para mostrar como sugerencia revisable." />
        <Slider label="Tolerancia de valor" suffix="%" min={0} max={10} step={0.1} value={tol} onChange={setTol} hint="Margen aceptado al comparar el valor del movimiento con el saldo." />
      </div>
      <div className="mt-5 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #4F69B8 0%, #445DA3 100%)", color: "#fff" }}
        >
          <Save size={13} /> {saving ? "Guardando…" : "Guardar umbrales"}
        </button>
      </div>
    </NCard>
  );
}

function Slider({
  label, suffix, min, max, step, value, onChange, hint,
}: {
  label: string; suffix: string; min: number; max: number; step: number;
  value: number; onChange: (n: number) => void; hint: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span style={{ color: "var(--nuvia-text-secondary)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>{label}</span>
        <span className="tabular-nums font-bold" style={{ color: "#A5B5E0", fontSize: 16 }}>{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#4F69B8" }}
      />
      <div style={{ color: "var(--nuvia-text-muted)", fontSize: 10.5, marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function ReglasCard() {
  const listFn = useServerFn(treasuryRulesList);
  const upFn = useServerFn(treasuryRuleUpsert);
  const delFn = useServerFn(treasuryRuleDelete);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["tRules"], queryFn: () => listFn() });
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ patron: "", canal: "", contraparte_hint: "", match_tipo: "cartera", activa: true });

  async function crear() {
    if (form.patron.trim().length < 2) { toast.error("Ingresa un patrón"); return; }
    try {
      await upFn({ data: { ...form, canal: form.canal || null, contraparte_hint: form.contraparte_hint || null } as never });
      toast.success("Regla creada");
      setForm({ patron: "", canal: "", contraparte_hint: "", match_tipo: "cartera", activa: true });
      setShowNew(false);
      qc.invalidateQueries({ queryKey: ["tRules"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function toggle(r: { id: string; patron: string; canal: string | null; contraparte_hint: string | null; match_tipo: string; activa: boolean }) {
    try {
      await upFn({ data: { id: r.id, patron: r.patron, canal: r.canal, contraparte_hint: r.contraparte_hint, match_tipo: r.match_tipo as never, activa: !r.activa } });
      qc.invalidateQueries({ queryKey: ["tRules"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta regla?")) return;
    try {
      await delFn({ data: { id } });
      toast.success("Regla eliminada");
      qc.invalidateQueries({ queryKey: ["tRules"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  const items = data?.items ?? [];

  return (
    <NCard variant="elevated">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks size={14} style={{ color: "#A5B5E0" }} />
          <h3 className="font-semibold" style={{ color: "var(--nuvia-text-primary)", fontSize: 14 }}>
            Reglas de match automático
          </h3>
          <span
            className="inline-flex rounded-full px-2 py-0.5 font-semibold tabular-nums"
            style={{ background: "rgba(165,181,224,0.16)", color: "#A5B5E0", fontSize: 10 }}
          >
            {items.length}
          </span>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: "rgba(132,185,143,0.16)", color: "#9BCB9F", border: "1px solid rgba(132,185,143,0.45)" }}
        >
          <Plus size={13} /> {showNew ? "Cancelar" : "Nueva regla"}
        </button>
      </div>
      <p style={{ color: "var(--nuvia-text-secondary)", fontSize: 12, marginBottom: 14 }}>
        El motor compara la descripción de cada movimiento bancario contra estos patrones para clasificarlo automáticamente.
      </p>

      {showNew && (
        <div
          className="mb-4 rounded-lg p-3 grid gap-2"
          style={{
            background: "rgba(132,185,143,0.06)",
            border: "1px solid rgba(132,185,143,0.30)",
            gridTemplateColumns: "1.4fr 1fr 1.4fr 1fr auto",
          }}
        >
          <input
            className="nuvia-input nuvia-input-sm"
            placeholder="Patrón (ej. NEQUI, PSE, NUVEX)"
            value={form.patron}
            onChange={(e) => setForm((f) => ({ ...f, patron: e.target.value }))}
          />
          <input
            className="nuvia-input nuvia-input-sm"
            placeholder="Canal (opcional)"
            value={form.canal}
            onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))}
          />
          <input
            className="nuvia-input nuvia-input-sm"
            placeholder="Contraparte hint (opcional)"
            value={form.contraparte_hint}
            onChange={(e) => setForm((f) => ({ ...f, contraparte_hint: e.target.value }))}
          />
          <NSelect
            value={form.match_tipo}
            onValueChange={(v) => setForm((f) => ({ ...f, match_tipo: v }))}
            options={TIPOS}
          />
          <button
            onClick={crear}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, #4F69B8 0%, #445DA3 100%)", color: "#fff" }}
          >
            <Save size={12} /> Crear
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table style={{ width: "100%", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Patrón</th>
              <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Canal</th>
              <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Contraparte</th>
              <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Tipo</th>
              <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)", textAlign: "right" }}>Aplicada</th>
              <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Estado</th>
              <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                <td style={{ padding: "8px", color: "var(--nuvia-text-primary)", fontWeight: 600 }}>{r.patron}</td>
                <td style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>{r.canal ?? "—"}</td>
                <td style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>{r.contraparte_hint ?? "—"}</td>
                <td style={{ padding: "8px", color: "#A5B5E0" }}>{r.match_tipo}</td>
                <td style={{ padding: "8px", color: "var(--nuvia-text-primary)", textAlign: "right" }} className="tabular-nums">
                  {r.veces_aplicada}
                </td>
                <td style={{ padding: "8px" }}>
                  <button
                    onClick={() => toggle(r)}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold uppercase"
                    style={{
                      background: r.activa ? "rgba(132,185,143,0.16)" : "rgba(255,107,107,0.16)",
                      color: r.activa ? "#9BCB9F" : "#FF8585",
                      fontSize: 9, letterSpacing: "0.08em",
                      border: `1px solid ${r.activa ? "rgba(132,185,143,0.45)" : "rgba(255,107,107,0.45)"}`,
                    }}
                  >
                    {r.activa ? <Power size={10} /> : <PowerOff size={10} />}
                    {r.activa ? "activa" : "inactiva"}
                  </button>
                </td>
                <td style={{ padding: "8px", textAlign: "right" }}>
                  <button
                    onClick={() => eliminar(r.id)}
                    className="inline-flex items-center rounded-md p-1.5"
                    style={{ color: "#FF8585", background: "rgba(255,107,107,0.10)" }}
                    title="Eliminar"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--nuvia-text-secondary)" }}>
                  Aún no hay reglas. Crea la primera para acelerar la conciliación.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </NCard>
  );
}
