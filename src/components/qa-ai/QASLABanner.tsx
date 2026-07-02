import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Zap } from "lucide-react";

interface PendingItem {
  id: string;
  expediente_id: string;
  solicitada_at: string;
}

/**
 * Banner rojo persistente que aparece en /qa-ai cuando hay validaciones QA
 * sin dictamen. Muestra cuántas y hace cuánto lleva la más antigua.
 */
export function QASLABanner() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("validaciones_qa" as never)
        .select("id, expediente_id, solicitada_at")
        .is("resultado", null)
        .order("solicitada_at", { ascending: true });
      if (cancelled) return;
      setItems((data ?? []) as unknown as PendingItem[]);
    };
    void load();
    const iv = window.setInterval(load, 30_000);
    const tk = window.setInterval(() => setNow(Date.now()), 30_000);
    // Realtime
    const ch = supabase
      .channel("qa_sla_banner")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "validaciones_qa" },
        () => { void load(); },
      )
      .subscribe();
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      window.clearInterval(tk);
      supabase.removeChannel(ch);
    };
  }, []);

  if (items.length === 0) return null;

  const oldest = items[0];
  const mins = Math.floor((now - new Date(oldest.solicitada_at).getTime()) / 60_000);
  const critico = mins >= 60;
  const muyCritico = mins >= 120;

  const label = mins < 60
    ? `${mins} min`
    : mins < 1440
      ? `${Math.floor(mins / 60)}h ${mins % 60}min`
      : `${Math.floor(mins / 1440)}d`;

  const bg = muyCritico
    ? "linear-gradient(90deg, #7A0F1F 0%, #C4102B 50%, #7A0F1F 100%)"
    : critico
      ? "linear-gradient(90deg, #7A3D0F 0%, #E8730A 50%, #7A3D0F 100%)"
      : "linear-gradient(90deg, #1F3A6B 0%, #3B6BDB 50%, #1F3A6B 100%)";

  return (
    <div
      role="alert"
      style={{
        position: "sticky",
        top: 78,
        zIndex: 45,
        marginBottom: 12,
        padding: "10px 18px",
        borderRadius: 12,
        color: "#FFFFFF",
        fontWeight: 600,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        background: bg,
        border: muyCritico
          ? "1px solid rgba(255,180,180,0.55)"
          : critico
            ? "1px solid rgba(255,210,150,0.5)"
            : "1px solid rgba(180,210,255,0.45)",
        boxShadow: muyCritico
          ? "0 0 24px rgba(255,60,60,0.35), inset 0 1px 0 rgba(255,255,255,0.1)"
          : "0 6px 18px -6px rgba(0,0,0,0.45)",
        animation: muyCritico ? "nuvia-sla-pulse 1.6s ease-in-out infinite" : undefined,
      }}
    >
      <style>{`
        @keyframes nuvia-sla-pulse {
          0%, 100% { box-shadow: 0 0 24px rgba(255,60,60,0.35), inset 0 1px 0 rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 42px rgba(255,60,60,0.75), inset 0 1px 0 rgba(255,255,255,0.14); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {muyCritico ? <Zap size={16} /> : <AlertTriangle size={16} />}
        <span style={{ letterSpacing: 0.2 }}>
          {items.length === 1
            ? "1 auditoría esperando dictamen"
            : `${items.length} auditorías esperando dictamen`}
          {" — la más antigua hace "}
          <span style={{ textDecoration: "underline", fontWeight: 800 }}>{label}</span>
          {muyCritico && "  · CRÍTICO"}
          {!muyCritico && critico && "  · ATENCIÓN"}
        </span>
      </div>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          padding: "3px 10px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.25)",
        }}
      >
        SLA NUVIA
      </span>
    </div>
  );
}
