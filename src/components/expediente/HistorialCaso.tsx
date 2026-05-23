import { useEffect, useState } from "react";
import { listHistorial, labelEstado, type HistorialEntry } from "@/lib/casoEstados";
import { Card } from "@/components/nuvex/ui";

export function HistorialCaso({ expedienteId, refreshKey = 0 }: { expedienteId: string; refreshKey?: number }) {
  const [rows, setRows] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listHistorial(expedienteId).then(setRows).finally(() => setLoading(false));
  }, [expedienteId, refreshKey]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#242424]">Historial del caso</h3>
          <div className="text-[11px] text-[#242424]/60">Registro de cambios y trazabilidad</div>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-[#242424]/60">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-[#242424]/60">Sin movimientos registrados.</div>
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
              <li key={r.id} className="rounded-lg border border-[#E3E7EE] bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-[#242424]">{principal}</div>
                  <div className="text-[11px] text-[#242424]/60">
                    {new Date(r.created_at).toLocaleString("es-CO")}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-[#242424]/60 space-x-2">
                  {r.user_nombre && <span>👤 {r.user_nombre}</span>}
                  {r.accion_origen && <span>· acción: {r.accion_origen}</span>}
                </div>
                {r.observacion && <div className="mt-2 text-xs text-[#242424]/80 whitespace-pre-wrap">{r.observacion}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
