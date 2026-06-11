import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GraduationCap, X } from "lucide-react";

export function AcademiaBanner() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("nuvia.acad.banner.hidden") === "1"
      || sessionStorage.getItem("nuvex.acad.banner.hidden") === "1";
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
      className="relative flex items-center gap-3 px-4 py-2.5 text-xs overflow-hidden"
      style={{
        background: "var(--nuvia-bg-secondary)",
        color: "var(--nuvia-text-primary)",
        borderBottom: "1px solid var(--nuvia-border)",
        boxShadow: "inset 0 -1px 0 rgba(132,185,143,0.20)",
      }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-all duration-700 opacity-70"
        style={{
          width: `${Math.max(pct, 2)}%`,
          background: "var(--nuvia-gradient-primary)",
        }}
      />
      <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--nuvia-border)" }}
        >
          <GraduationCap size={13} style={{ color: "var(--nuvia-accent-green)" }} />
        </span>
        <span className="truncate">
          <b className="font-semibold">Capacitación en progreso</b>
          <span style={{ color: "var(--nuvia-text-secondary)" }}> · {pct}% completado</span>
          <span style={{ color: "var(--nuvia-text-muted)" }}> ({progress.done}/{progress.total} lecciones)</span>
        </span>
        <Link
          to="/academia"
          className="ml-2 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-primary)",
          }}
        >
          Continuar →
        </Link>
        <button
          onClick={() => { sessionStorage.setItem("nuvia.acad.banner.hidden", "1"); setHidden(true); }}
          className="ml-auto transition"
          style={{ color: "var(--nuvia-text-muted)" }}
          aria-label="Ocultar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
