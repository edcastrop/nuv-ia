import { useEffect, useState } from "react";
import { Flame, Trophy } from "lucide-react";
import { readFeed, readStreak, subscribeVictoryBroadcast, subscribeVictoryLocal, type VictoryEvent } from "@/lib/victoryTrigger";

function timeAgo(ts: number): string {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export function VictoryFeed({ limit = 8 }: { limit?: number }) {
  const [feed, setFeed] = useState<VictoryEvent[]>(() => readFeed());
  const [streak, setStreak] = useState(() => readStreak());
  const [, tick] = useState(0);

  useEffect(() => {
    const refresh = () => { setFeed(readFeed()); setStreak(readStreak()); };
    const fn = () => refresh();
    window.addEventListener("nuvia:victory:feed", fn);
    const offLocal = subscribeVictoryLocal(refresh);
    const offRemote = subscribeVictoryBroadcast((evt) => {
      setFeed((prev) => [evt, ...prev].slice(0, 40));
    });
    const int = setInterval(() => tick((n) => n + 1), 30_000);
    return () => { window.removeEventListener("nuvia:victory:feed", fn); offLocal(); offRemote(); clearInterval(int); };
  }, []);

  return (
    <div style={{
      borderRadius: 18,
      background: "linear-gradient(155deg, rgba(14,24,44,.85), rgba(9,16,32,.9))",
      border: "1px solid rgba(255,255,255,.08)",
      padding: 20,
      color: "#E7EEFB",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(145deg,#F7B500,#E28900)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 6px 18px rgba(247,181,0,.35)",
          }}>
            <Trophy size={16} color="#1a1200" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Feed de victorias</div>
            <div style={{ fontSize: 11, color: "#8397B8" }}>Cierres firmados en vivo</div>
          </div>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 999,
          background: "rgba(247,181,0,.14)", border: "1px solid rgba(247,181,0,.4)",
          fontSize: 11, fontWeight: 700, color: "#FFD97A",
        }}>
          <Flame size={12} /> Racha ×{streak.actual} · Récord {streak.record}
        </div>
      </div>

      {feed.length === 0 ? (
        <div style={{ fontSize: 12, color: "#8397B8", padding: "16px 4px" }}>
          Aún no hay cierres registrados. ¡Sé el primero en firmar hoy!
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {feed.slice(0, limit).map((e) => (
            <li key={e.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "10px 12px", borderRadius: 12,
              background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  🔥 {e.analista} cerró un nuevo contrato
                </div>
                <div style={{ fontSize: 11, color: "#8397B8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.banco} · {e.cliente}
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#8397B8", whiteSpace: "nowrap" }}>{timeAgo(e.timestamp)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
