import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Carga el nombre del perfil del usuario autenticado (Licenciado / Gerente / Asesor)
// y lo aplica como Asesor NUVEX cuando el campo aún está vacío.
export function useAsesorDefault(
  asesor: string,
  setAsesor: (nombre: string) => void,
) {
  useEffect(() => {
    if (asesor && asesor.trim()) return;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nombre, email")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      const nombre = (profile?.nombre || profile?.email || "").trim();
      if (nombre) setAsesor(nombre);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
