import { useEffect, useState } from "react";
import { suscribirPresencia } from "@/lib/presencia";

/** Devuelve un Set con los user_ids actualmente en línea (canal presencia-global). */
export function usePresenciaOnline(): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());
  useEffect(() => {
    const unsub = suscribirPresencia(setOnline);
    return () => { unsub(); };
  }, []);
  return online;
}
