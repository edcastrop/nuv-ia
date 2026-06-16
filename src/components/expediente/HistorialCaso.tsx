import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { listHistorial, labelEstado, type HistorialEntry } from "@/lib/casoEstados";
import { NCard, SectionHeader } from "@/components/nuvia";

export function HistorialCaso({ expedienteId, refreshKey = 0 }: { expedienteId: string; refreshKey?: number }) {
  const [rows, setRows] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listHistorial(expedienteId).then(setRows).finally(() => setLoading(false));
  }, [expedienteId, refreshKey]);

  return (
    <NCard>
      <SectionHeader
        title="Historial del caso"
        description="Registro de cambios y trazabilidad"
        icon={<History size={16} />}
      />
      {loading ? (
        <div className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Sin movimientos registrados.</div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => {
            const cambioCaso = r.estado_caso_nuevo
              ? `${r.estado_caso_anterior ? labelEstado(r.estado_caso_anterior) + " → " : ""}${labelEstado(r.estado_caso_nuevo)}`
              : null;
            const cambioFlujo = r.estado_nuevo
              ? `${r.estado_anterior ? r.estado_anterior + " → " : ""}${r.estado_nuevo}`
              : null;
            const principal = cambioCaso ?? cambioFlujo ?? "Movimiento";
            return (
              <li
                key={r.id}
                className="rounded-lg border p-3 text-sm"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "var(--nuvia-border)",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                    {principal}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                    {new Date(r.created_at).toLocaleString("es-CO")}
                  </div>
                </div>
                <div
                  className="mt-1 text-[11px] space-x-2"
                  style={{ color: "var(--nuvia-text-secondary)" }}
                >
                  {r.user_nombre && <span>👤 {r.user_nombre}</span>}
                  {r.accion_origen && <span>· acción: {r.accion_origen}</span>}
                </div>
                {r.observacion && (
                  <div
                    className="mt-2 text-xs whitespace-pre-wrap"
                    style={{ color: "var(--nuvia-text-primary)", opacity: 0.85 }}
                  >
                    {r.observacion}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </NCard>
  );
}
