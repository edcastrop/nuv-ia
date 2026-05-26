import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GraduationCap, X } from "lucide-react";

export function AcademiaBanner() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("nuvex.acad.banner.hidden") === "1";
  });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!user || hidden) return;
    (async () => {
      const { data: lessons } = await supabase.from("academia_lecciones").select("id");
      const total = lessons?.length ?? 0;
      if (!total) return;
      const { data: done } = await supabase
        .from("academia_progreso_lecciones")
        .select("leccion_id")
        .eq("user_id", user.id)
        .eq("completada", true);
      setProgress({ done: done?.length ?? 0, total });
    })();
  }, [user, hidden]);

  if (hidden || !progress || progress.total === 0) return null;
  if (progress.done >= progress.total) return null;

  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs text-white border-b border-white/5"
      style={{ background: "linear-gradient(90deg, rgba(68,93,163,0.18), rgba(132,185,143,0.12))" }}>
      <GraduationCap size={14} className="text-[#84B98F]" />
      <span>📚 <b>Capacitación en progreso</b> · {pct}% completado ({progress.done}/{progress.total} lecciones)</span>
      <Link to="/academia" className="ml-2 underline hover:text-white/90">Continuar</Link>
      <button onClick={() => { sessionStorage.setItem("nuvex.acad.banner.hidden", "1"); setHidden(true); }} className="ml-auto text-white/50 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}
