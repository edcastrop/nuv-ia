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
    <div
      className="relative flex items-center gap-3 px-4 py-2.5 text-xs text-white border-b border-white/10 overflow-hidden"
      style={{
        background: "linear-gradient(90deg, #0E1A38 0%, #122448 50%, #0E1A38 100%)",
        boxShadow: "inset 0 -1px 0 rgba(132,185,143,0.25)",
      }}
    >
      {/* Barra de progreso de fondo */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-700"
        style={{
          width: `${Math.max(pct, 2)}%`,
          background: "linear-gradient(90deg, rgba(68,93,163,0.55), rgba(132,185,143,0.45))",
          boxShadow: "0 0 24px rgba(132,185,143,0.35)",
        }}
      />
      <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
          <GraduationCap size={13} className="text-[#A7D3AE]" />
        </span>
        <span className="truncate">
          <b className="font-semibold">Capacitación en progreso</b>
          <span className="text-white/70"> · {pct}% completado</span>
          <span className="text-white/50"> ({progress.done}/{progress.total} lecciones)</span>
        </span>
        <Link
          to="/academia"
          className="ml-2 inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/15 transition"
        >
          Continuar →
        </Link>
        <button
          onClick={() => { sessionStorage.setItem("nuvex.acad.banner.hidden", "1"); setHidden(true); }}
          className="ml-auto text-white/40 hover:text-white transition"
          aria-label="Ocultar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
