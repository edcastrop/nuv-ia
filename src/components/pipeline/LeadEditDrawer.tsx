// Drawer lateral para editar información rápida del lead sin salir del pipeline.
import { useEffect, useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import type { Expediente } from "@/lib/expedientes";
import { ESTADOS, type EstadoExpediente } from "@/lib/expedientes";
import { BANCOS } from "@/components/nuvex/constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AnalistaInfo = { id: string; nombre: string | null; email: string | null };

export function LeadEditDrawer({
  expediente,
  analistas,
  onClose,
  onSaved,
}: {
  expediente: Expediente;
  analistas: AnalistaInfo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [banco, setBanco] = useState(expediente.banco ?? "");
  const [producto, setProducto] = useState(expediente.producto ?? "");
  const [numeroCredito, setNumeroCredito] = useState(expediente.numero_credito ?? "");
  const [asesorId, setAsesorId] = useState(expediente.asesor_id ?? "");
  const [estado, setEstado] = useState<EstadoExpediente>(expediente.estado);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const bancosUnion = Array.from(new Set([...BANCOS, banco].filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, string | null> = {
        banco: banco || null,
        producto: producto || null,
        numero_credito: numeroCredito || null,
        estado,
      };
      if (asesorId && asesorId !== expediente.asesor_id) {
        updates.asesor_id = asesorId;
      }
      const { error } = await supabase
        .from("expedientes")
        .update(updates as never)
        .eq("id", expediente.id);
      if (error) throw error;
      toast.success("Lead actualizado");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("No se pudo actualizar el lead", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label={`Editar ${expediente.cliente_nombre}`}
        className="fixed right-0 top-0 z-[91] h-full w-full max-w-[440px] overflow-y-auto border-l border-[var(--nuvia-border)] p-5 text-[var(--nuvia-text-primary)] shadow-2xl"
        style={{
          background:
            "linear-gradient(180deg, var(--nuvia-bg-secondary) 0%, var(--nuvia-bg-primary) 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--nuvia-accent-blue)]">
              Edición rápida
            </div>
            <h2 className="mt-0.5 truncate text-lg font-semibold">{expediente.cliente_nombre}</h2>
            <div className="text-[11px] text-[var(--nuvia-text-secondary)]">
              Para editar todo (cliente, simulación) abre el expediente completo.
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] p-1.5 text-[var(--nuvia-text-secondary)] transition hover:text-[var(--nuvia-text-primary)] disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Banco">
            <select
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              className="nuvia-input"
            >
              <option value="">Sin banco</option>
              {bancosUnion.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Producto">
            <input
              type="text"
              value={producto}
              onChange={(e) => setProducto(e.target.value)}
              placeholder="Hipotecario, Leasing, Libre inversión…"
              className="nuvia-input"
            />
          </Field>

          <Field label="Número de crédito">
            <input
              type="text"
              value={numeroCredito}
              onChange={(e) => setNumeroCredito(e.target.value)}
              placeholder="—"
              className="nuvia-input"
            />
          </Field>

          <Field label="Analista asignado">
            <select
              value={asesorId}
              onChange={(e) => setAsesorId(e.target.value)}
              className="nuvia-input"
            >
              {!analistas.some((a) => a.id === expediente.asesor_id) && (
                <option value={expediente.asesor_id}>
                  Actual: {expediente.asesor_id.slice(0, 8)}
                </option>
              )}
              {analistas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre || a.email || a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estado">
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoExpediente)}
              className="nuvia-input"
            >
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="h-10 flex-1 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] text-sm font-medium text-[var(--nuvia-text-secondary)] transition hover:text-[var(--nuvia-text-primary)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--nuvia-text-primary)] shadow-[var(--nuvia-shadow-sm)] transition hover:brightness-110 disabled:opacity-50"
            style={{ background: "var(--nuvia-gradient-primary)" }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-secondary)]">
        {label}
      </div>
      {children}
    </label>
  );
}
