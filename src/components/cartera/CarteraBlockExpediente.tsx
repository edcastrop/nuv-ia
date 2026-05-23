import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/nuvex/ui";
import { getCarteraByExpediente, calcularVencimiento, type Cartera, CARTERA_ESTADO_BY_KEY } from "@/lib/cartera";
import { crearCartera } from "@/lib/cartera.functions";
import { supabase } from "@/integrations/supabase/client";

const ESTADOS_PERMITIDOS = new Set([
  "condiciones_aplicadas", "resultado_final_generado", "cuenta_cobro_generada",
  "cuenta_cobro_enviada", "honorarios_pagados", "paz_y_salvo_generado", "proceso_cerrado",
]);

export function CarteraBlockExpediente({ expedienteId, estadoCaso }: { expedienteId: string; estadoCaso: string }) {
  const [cartera, setCartera] = useState<Cartera | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fechaAplic, setFechaAplic] = useState(new Date().toISOString().slice(0, 10));
  const [formaPago, setFormaPago] = useState<"contado" | "financiado">("contado");
  const [responsableId, setResponsableId] = useState<string>("");
  const [responsables, setResponsables] = useState<{ id: string; nombre: string | null; email: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const crear = useServerFn(crearCartera);

  useEffect(() => {
    getCarteraByExpediente(expedienteId).then(setCartera).finally(() => setLoading(false));
    supabase.from("profiles").select("id, nombre, email").eq("activo", true).then(({ data }) => {
      setResponsables(data ?? []);
    });
  }, [expedienteId]);

  if (loading) return null;

  const elegible = ESTADOS_PERMITIDOS.has(estadoCaso);

  if (cartera) {
    const def = CARTERA_ESTADO_BY_KEY[cartera.estado_cartera];
    const saldo = Number(cartera.honorarios_totales) - Number(cartera.pagado);
    return (
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#242424]/60">Cartera</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: def.bg, color: def.color }}>
                {def.label}
              </span>
              <span className="text-xs text-[#242424]/60">Vence: {cartera.fecha_vencimiento}</span>
            </div>
            <div className="mt-2 text-sm">
              Saldo: <strong>${saldo.toLocaleString("es-CO")}</strong> · Pagado: ${Number(cartera.pagado).toLocaleString("es-CO")} de ${Number(cartera.honorarios_totales).toLocaleString("es-CO")}
            </div>
          </div>
          <Link to="/cartera/$id" params={{ id: cartera.id }} className="rounded-lg bg-[#445DA3] px-4 py-2 text-xs font-semibold text-white">
            Abrir cartera
          </Link>
        </div>
      </Card>
    );
  }

  if (!elegible) {
    return (
      <Card>
        <div className="text-[11px] uppercase tracking-wider text-[#242424]/60">Cartera</div>
        <div className="mt-2 text-sm text-[#242424]/70">
          La cartera nace cuando el banco aplica las nuevas condiciones. Marca el estado <strong>Condiciones aplicadas</strong> para habilitar.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#242424]/60">Cartera</div>
          <div className="mt-1 text-sm">Listo para crear la cartera de honorarios.</div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="rounded-lg bg-[#1F7A45] px-4 py-2 text-xs font-semibold text-white">
            Crear cartera
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-[#242424]/60">Fecha aplicación banco</span>
            <input type="date" value={fechaAplic} onChange={(e) => setFechaAplic(e.target.value)} className="rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-[#242424]/60">Forma de pago</span>
            <select value={formaPago} onChange={(e) => setFormaPago(e.target.value as "contado" | "financiado")} className="rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm">
              <option value="contado">Contado</option>
              <option value="financiado">Financiado</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] uppercase tracking-wider text-[#242424]/60">Responsable de cartera</span>
            <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className="rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm">
              <option value="">Seleccionar…</option>
              {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre || r.email}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2 text-xs text-[#242424]/60">
            Vencimiento calculado: <strong>{calcularVencimiento(fechaAplic, 5)}</strong> (aplicación + 5 días)
          </div>
          {error && <div className="sm:col-span-2 text-xs text-red-600">{error}</div>}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-[#E3E7EE] px-4 py-2 text-xs">Cancelar</button>
            <button
              disabled={!responsableId || busy}
              onClick={async () => {
                setError(null); setBusy(true);
                try {
                  const r = await crear({ data: { expedienteId, fechaAplicacionBanco: fechaAplic, formaPago, responsableId, cuotas: [] } });
                  const c = await getCarteraByExpediente(expedienteId);
                  setCartera(c); setShowForm(false);
                  void r;
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Error");
                } finally { setBusy(false); }
              }}
              className="rounded-lg bg-[#1F7A45] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Creando…" : "Crear cartera"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
