import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import {
  calcularNivelAutonomia,
  metricasIniciales,
  type MetricasAnalista,
  type NivelAutonomia,
} from "@/lib/autonomia";

export function useNivelAutonomia() {
  const { user } = useAuth();
  const [metricas, setMetricas] = useState<MetricasAnalista>(metricasIniciales);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMetricas(metricasIniciales);
      setLoading(false);
      return;
    }
    let cancel = false;
    supabase
      .from("analista_metricas")
      .select("total_simulaciones, score_promedio, precision_historica, nivel_autonomia")
      .eq("analista_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        if (!data) {
          setMetricas(metricasIniciales);
        } else {
          const m: MetricasAnalista = {
            totalSimulaciones: Number(data.total_simulaciones ?? 0),
            scorePromedio: Number(data.score_promedio ?? 0),
            precisionHistorica: Number(data.precision_historica ?? 0),
            nivelAutonomia: (Number(data.nivel_autonomia ?? 1) as NivelAutonomia) ?? 1,
          };
          // Re-cálculo local por si el trigger aún no corrió
          m.nivelAutonomia = calcularNivelAutonomia(m);
          setMetricas(m);
        }
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [user]);

  return { metricas, loading };
}
