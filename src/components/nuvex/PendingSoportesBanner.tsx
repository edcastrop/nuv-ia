import { useSyncExternalStore } from "react";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import {
  getVersion,
  listByDraft,
  removeEntry,
  subscribe,
  type Entry,
  type SoporteKind,
} from "./pendingSoportes";

function useEntriesByDraft(draftKey: string | undefined, kinds?: SoporteKind[]): Entry[] {
  const version = useSyncExternalStore(subscribe, getVersion, () => 0);
  // Nota: usamos `version` únicamente para forzar re-render — el filtro se
  // recalcula cada render.
  void version;
  if (!draftKey) return [];
  const all = listByDraft(draftKey);
  if (!kinds || kinds.length === 0) return all;
  return all.filter((e) => kinds.includes(e.kind));
}

export function PendingSoportesBanner({
  draftKey,
  kinds,
  className,
}: {
  draftKey: string | undefined;
  kinds?: SoporteKind[];
  className?: string;
}) {
  const entries = useEntriesByDraft(draftKey, kinds);
  if (!entries.length) return null;
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      {entries.map((e) => {
        const failed = e.status === "failed";
        const flushing = e.status === "flushing";
        const bg = failed ? "#FEF2F2" : flushing ? "#EFF6FF" : "#FFFBEB";
        const border = failed ? "#FECACA" : flushing ? "#BFDBFE" : "#FDE68A";
        const color = failed ? "#991B1B" : flushing ? "#1E3A8A" : "#92400E";
        const Icon = failed ? AlertTriangle : flushing ? Loader2 : Clock;
        return (
          <div
            key={e.id}
            className="flex items-start justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]"
            style={{ background: bg, borderColor: border, color }}
          >
            <div className="flex items-start gap-1.5">
              <Icon
                size={12}
                className={`mt-0.5 shrink-0 ${flushing ? "animate-spin" : ""}`}
              />
              <div>
                <div className="font-semibold">{e.label}</div>
                <div className="opacity-80">
                  {failed
                    ? `No se pudo adjuntar: ${e.error ?? "error"}`
                    : flushing
                      ? "Adjuntando al caso…"
                      : "Cargado localmente · se adjuntará al crear el caso"}
                </div>
              </div>
            </div>
            {!flushing && (
              <button
                type="button"
                onClick={() => removeEntry(e.id)}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold hover:bg-black/5"
              >
                Quitar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
