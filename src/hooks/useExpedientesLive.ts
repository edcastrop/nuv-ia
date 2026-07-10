import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeEtapaActual, type EtapaPipelineId } from "@/lib/pipelineEtapas";

export type ExpedienteLive = {
  id: string;
  estado?: string | null;
  estado_caso?: string | null;
  qa_score?: number | null;
  updated_at?: string | null;
  etapa: EtapaPipelineId;
};

/**
 * Suscribe a `postgres_changes` sobre `expedientes` para el conjunto de casoIds
 * indicado y devuelve un map reactivo con la etapa actual (más otros campos
 * live). Si Realtime no está publicado sobre `expedientes`, degrada
 * silenciosamente (fallback: sólo carga inicial).
 */
export function useExpedientesLive(casoIds: string[]): Record<string, ExpedienteLive> {
  const key = casoIds.slice().sort().join(",");
  const [map, setMap] = useState<Record<string, ExpedienteLive>>({});

  useEffect(() => {
    if (!casoIds.length) { setMap({}); return; }
    let active = true;

    const hydrate = async () => {
      const { data } = await supabase
        .from("expedientes")
        .select("id, estado, estado_caso, qa_score, updated_at")
        .in("id", casoIds);
      if (!active || !data) return;
      const next: Record<string, ExpedienteLive> = {};
      for (const row of data as unknown as ExpedienteLive[]) {
        next[row.id] = { ...row, etapa: computeEtapaActual(row) };
      }
      setMap(next);
    };
    hydrate();

    const channel = supabase
      .channel(`expedientes-live-${key.slice(0, 40)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expedientes", filter: `id=in.(${casoIds.join(",")})` },
        (payload) => {
          const row = (payload.new ?? payload.old) as ExpedienteLive | undefined;
          if (!row?.id) return;
          setMap((prev) => ({
            ...prev,
            [row.id]: { ...row, etapa: computeEtapaActual(row) },
          }));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}
