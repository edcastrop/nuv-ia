import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, FolderPlus, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { upsertExpediente } from "@/lib/expedientes";
import { cambiarEstadoConValidacion } from "@/lib/pipelineTransiciones";
import { defaultClient } from "@/components/nuvex/ClientFields";
import { BANCOS } from "@/components/nuvex/constants";
import type {
  ProyeccionFinancieraInput,
  ResultadoEscenario,
  KpisComparacion,
  EscenarioInput,
} from "@/lib/proyeccionFinanciera";

interface Props {
  open: boolean;
  onClose: () => void;
  autoSave?: boolean;
  input: ProyeccionFinancieraInput;
  resultados: { actual: ResultadoEscenario; optimizado: ResultadoEscenario };
  escenarios: EscenarioInput[];
  kpis: KpisComparacion;
}

type CasoForm = {
  nombre: string;
  cedula: string;
  celular: string;
  correo: string;
  banco: string;
  ciudad: string;
  numeroCredito: string;
};

export function GuardarCasoModal({ open, onClose, autoSave = false, input, resultados, escenarios, kpis }: Props) {
  const navigate = useNavigate();
  const autoSaveRef = useRef(false);
  const projectionForm: CasoForm = {
    nombre: input.clienteNombre || "",
    cedula: input.cedula || "",
    celular: input.celular || "",
    correo: input.correo || "",
    banco: input.banco || "",
    ciudad: input.ciudad || "",
    numeroCredito: input.numeroCredito || "",
  };
  const [form, setForm] = useState<CasoForm>(projectionForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (!open) {
      autoSaveRef.current = false;
      return;
    }
    setForm(projectionForm);
    setError(null);
    setDone(null);
  }, [
    open,
    input.clienteNombre,
    input.cedula,
    input.celular,
    input.correo,
    input.banco,
    input.ciudad,
    input.numeroCredito,
  ]);

  useEffect(() => {
    if (!open || !autoSave || autoSaveRef.current) return;
    if (!projectionForm.nombre.trim() || !projectionForm.cedula.trim() || !projectionForm.banco.trim()) return;
    autoSaveRef.current = true;
    void saveCase(projectionForm);
  }, [
    open,
    autoSave,
    input.clienteNombre,
    input.cedula,
    input.banco,
    input.celular,
    input.correo,
    input.ciudad,
    input.numeroCredito,
  ]);

  if (!open) return null;

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function saveCase(formData: CasoForm) {
    setError(null);
    if (!formData.nombre.trim() || !formData.cedula.trim() || !formData.banco.trim()) {
      setError("Nombre, cédula y banco son obligatorios para crear el caso.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sesión no válida. Inicia sesión nuevamente.");

      // Snapshot completo de la proyección (compacto para no romper jsonb)
      const snapshot = {
        version: 1,
        creadoAt: new Date().toISOString(),
        input,
        kpis,
        escenarios: escenarios.map((e) => ({
          nombre: e.nombre,
          tipo: e.tipo,
          aporteMensualExtra: e.aporteMensualExtra,
          abonoExtraordinario: e.abonoExtraordinario,
          nuevaTasa: e.nuevaTasa,
        })),
        resumen: {
          actual: {
            mesesRestantes: resultados.actual.mesesRestantes,
            totalIntereses: resultados.actual.totalIntereses,
            totalSeguros: resultados.actual.totalSeguros,
            totalPagado: resultados.actual.totalPagado,
            fechaFinalizacion: resultados.actual.fechaFinalizacion,
          },
          optimizado: {
            mesesRestantes: resultados.optimizado.mesesRestantes,
            totalIntereses: resultados.optimizado.totalIntereses,
            totalSeguros: resultados.optimizado.totalSeguros,
            totalPagado: resultados.optimizado.totalPagado,
            fechaFinalizacion: resultados.optimizado.fechaFinalizacion,
          },
        },
      };

      const cliente = {
        ...defaultClient,
        nombre: formData.nombre.trim(),
        cedula: formData.cedula.trim(),
        numeroCredito: formData.numeroCredito.trim(),
        banco: formData.banco,
        tipoProducto: input.tipoProducto === "leasing" ? "Leasing Habitacional" : "Hipotecario",
        asesor: "",
        plazoInicial: String(input.cuotasTotales || ""),
        cuotasPagadas: String(input.cuotasPagadas || ""),
        porcentajeHonorarios: "6",
      };

      const credito: Record<string, unknown> = {
        moneda: input.moneda,
        fechaDesembolso: input.fechaDesembolso,
        valorDesembolsado: input.valorDesembolsado,
        saldoCapital: input.saldoCapital,
        cuotaActual: input.cuotaActual,
        teaPct: input.teaPct,
        cuotasTotales: input.cuotasTotales,
        cuotasPagadas: input.cuotasPagadas,
        cuotasPendientes: input.cuotasPendientes,
        seguroVida: input.seguroVida,
        seguroIncendio: input.seguroIncendio,
        seguroTerremoto: input.seguroTerremoto,
        otrosSeguros: input.otrosSeguros,
        contacto: { celular: formData.celular, correo: formData.correo, ciudad: formData.ciudad },
        proyeccion_financiera_snapshot: snapshot,
      };

      const e = await upsertExpediente({
        modo: input.moneda === "uvr" ? "uvr" : "pesos",
        cliente,
        credito: credito as unknown as Record<string, string>,
        propuesta: {
          nuevaCuota: 0,
          nuevoPlazo: resultados.optimizado.mesesRestantes,
          añosEliminados: kpis.aniosEliminados,
          ahorroIntereses: kpis.interesesEvitados,
          ahorroSeguros: kpis.segurosEvitados,
          ahorroTotal: kpis.ahorroTotal,
          honorarios: 0,
          totalProyectado: resultados.optimizado.totalPagado,
          fuente: "automatica",
        },
        discountState: {},
        honorariosBase: 0,
        honorariosFinal: 0,
        descuento: 0,
      });

      try {
        await cambiarEstadoConValidacion(e.id, "simulado", "simulacion_guardada");
      } catch (err) {
        console.warn("[estado]", err);
      }

      setDone({ id: e.id });
    } catch (err) {
      setError((err as Error).message || "No se pudo crear el caso");
    } finally {
      setSaving(false);
    }
  }

  const handleSave = () => void saveCase(form);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: "rgba(8,8,10,0.78)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/[0.08] shadow-2xl"
        style={{
          background: "linear-gradient(180deg,#1a1a1c,#101012)",
          boxShadow: "0 50px 100px -20px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/[0.08] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {done ? (
          <div className="flex flex-col items-center gap-4 px-8 py-12 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(135deg,#84B98F,#445DA3)" }}
            >
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Caso creado</h3>
              <p className="mt-1 text-sm text-white/60">
                La proyección financiera quedó adjuntada al expediente.
              </p>
            </div>
            <div className="mt-2 flex gap-3">
              <button
                onClick={onClose}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-sm text-white/80 hover:bg-white/[0.08]"
              >
                Seguir simulando
              </button>
              <button
                onClick={() => navigate({ to: "/casos/$id", params: { id: done.id } })}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
              >
                Abrir expediente
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="border-b border-white/[0.06] px-7 py-6">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
                >
                  <FolderPlus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-white">
                    Crear caso desde proyección
                  </h2>
                  <p className="text-[12px] text-white/55">
                    El snapshot completo de escenarios queda adjunto al expediente.
                  </p>
                </div>
              </div>
            </header>

            <div className="grid gap-3.5 px-7 py-6 sm:grid-cols-2">
              <Field label="Nombre del cliente *" value={form.nombre} onChange={(v) => set("nombre", v)} />
              <Field label="Cédula *" value={form.cedula} onChange={(v) => set("cedula", v)} />
              <Field label="Celular" value={form.celular} onChange={(v) => set("celular", v)} />
              <Field label="Correo" value={form.correo} onChange={(v) => set("correo", v)} type="email" />
              <SelectFld
                label="Banco *"
                value={form.banco}
                onChange={(v) => set("banco", v)}
                options={BANCOS}
              />
              <Field label="Ciudad" value={form.ciudad} onChange={(v) => set("ciudad", v)} />
              <Field
                label="Número de crédito"
                value={form.numeroCredito}
                onChange={(v) => set("numeroCredito", v)}
                className="sm:col-span-2"
              />
            </div>

            {error && (
              <div className="mx-7 mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-200">
                {error}
              </div>
            )}

            <footer className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-7 py-5">
              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[13px] text-white/75 hover:bg-white/[0.08] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg,#445DA3,#84B98F)",
                  boxShadow: "0 14px 30px -12px rgba(68,93,163,0.65)",
                }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                {saving ? "Creando…" : "Crear caso"}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/30 outline-none transition focus:border-white/20 focus:bg-white/[0.06]"
      />
    </label>
  );
}

function SelectFld({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13.5px] text-white outline-none transition focus:border-white/20 focus:bg-white/[0.06]"
      >
        <option value="" className="bg-[#161618]">
          Seleccionar…
        </option>
        {options.map((b) => (
          <option key={b} value={b} className="bg-[#161618]">
            {b}
          </option>
        ))}
      </select>
    </label>
  );
}
