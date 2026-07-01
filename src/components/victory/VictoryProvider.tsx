import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Trophy, Flame, Volume2, VolumeX, X, PartyPopper } from "lucide-react";
import {
  subscribeVictoryLocal,
  subscribeVictoryBroadcast,
  bumpStreak,
  readStreak,
  isVictoryMuted,
  setVictoryMuted,
  fireVictory,
  type VictoryEvent,
  type StreakState,
} from "@/lib/victoryTrigger";

/* ---------------------------- Audio Synthesizer ---------------------------- */
// "Cha-ching!" — caja registradora clásica: doble campana metálica (ding-ding)
// con síntesis FM + click mecánico inicial del cajón. ~1.4s.
async function playVictoryChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.34;
    master.connect(ctx.destination);

    // Reverb-lite via delay para brillo metálico
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.09;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    delay.connect(feedback).connect(delay).connect(master);

    const now = ctx.currentTime;

    // Click mecánico inicial (drawer): ruido corto filtrado
    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const nFilt = ctx.createBiquadFilter();
    nFilt.type = "highpass";
    nFilt.frequency.value = 2000;
    const nGain = ctx.createGain();
    nGain.gain.value = 0.25;
    noise.connect(nFilt).connect(nGain).connect(master);
    noise.start(now);

    // Dos "ding" campana (cha-ching): FM sine con modulador para timbre metálico
    const dings = [
      { t: 0.02, carrier: 1760, mod: 2637, modGain: 800 },  // "cha" (A6)
      { t: 0.22, carrier: 2093, mod: 3136, modGain: 950 },  // "ching" (C7, más brillante)
    ];
    for (const d of dings) {
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const env = ctx.createGain();
      carrier.type = "sine";
      modulator.type = "sine";
      carrier.frequency.setValueAtTime(d.carrier, now + d.t);
      modulator.frequency.setValueAtTime(d.mod, now + d.t);
      modGain.gain.setValueAtTime(d.modGain, now + d.t);
      modulator.connect(modGain).connect(carrier.frequency);
      env.gain.setValueAtTime(0.0001, now + d.t);
      env.gain.exponentialRampToValueAtTime(0.7, now + d.t + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, now + d.t + 0.9);
      carrier.connect(env);
      env.connect(master);
      env.connect(delay);
      modulator.start(now + d.t);
      carrier.start(now + d.t);
      modulator.stop(now + d.t + 1.0);
      carrier.stop(now + d.t + 1.0);
    }

    setTimeout(() => ctx.close().catch(() => {}), 1600);
  } catch (e) {
    console.warn("[victory] audio failed", e);
  }
}

/* ------------------------------- Modal ------------------------------------ */

interface QueueItem { evt: VictoryEvent; isMine: boolean; streak?: StreakState }

function formatMoney(v: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

function VictoryModal({ item, onClose }: { item: QueueItem; onClose: () => void }) {
  const { evt, isMine, streak } = item;
  const kindLabel = evt.kind === "contrato_firmado" ? "CONTRATO CERRADO" : "PODER FIRMADO";

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2147483600,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(4,8,20,0.62)", backdropFilter: "blur(14px)",
        animation: "nuviaVictoryFade .35s ease-out",
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes nuviaVictoryFade { from{opacity:0} to{opacity:1} }
        @keyframes nuviaVictoryPop { 0%{transform:scale(.82);opacity:0} 60%{transform:scale(1.04);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes nuviaVictoryGlow {
          0%,100% { box-shadow: 0 0 0 1px rgba(77,124,254,.35), 0 30px 90px rgba(77,124,254,.35), 0 0 60px rgba(46,204,113,.28); }
          50%     { box-shadow: 0 0 0 1px rgba(46,204,113,.55), 0 30px 120px rgba(46,204,113,.55), 0 0 90px rgba(77,124,254,.45); }
        }
        @keyframes nuviaVictorySpark {
          0% { transform: translate(-50%,-50%) scale(0); opacity:.9 }
          100% { transform: translate(-50%,-50%) scale(3); opacity:0 }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(520px, 92vw)",
          padding: "34px 30px 28px",
          borderRadius: 22,
          background: "linear-gradient(155deg, rgba(14,24,44,.94), rgba(9,16,32,.96))",
          border: "1px solid rgba(255,255,255,.10)",
          color: "#E7EEFB",
          animation: "nuviaVictoryPop .5s cubic-bezier(.2,1.2,.3,1), nuviaVictoryGlow 2.2s ease-in-out infinite",
          overflow: "hidden",
        }}
      >
        {/* halos */}
        <span style={{ position:"absolute", left:"50%", top:"18%", width:8, height:8, background:"radial-gradient(circle, rgba(247,181,0,.9), transparent 70%)", borderRadius:"50%", animation:"nuviaVictorySpark 1.6s ease-out .2s infinite" }} />
        <span style={{ position:"absolute", left:"30%", top:"40%", width:6, height:6, background:"radial-gradient(circle, rgba(46,204,113,.9), transparent 70%)", borderRadius:"50%", animation:"nuviaVictorySpark 1.9s ease-out .5s infinite" }} />
        <span style={{ position:"absolute", left:"70%", top:"36%", width:6, height:6, background:"radial-gradient(circle, rgba(77,124,254,.9), transparent 70%)", borderRadius:"50%", animation:"nuviaVictorySpark 2.1s ease-out .8s infinite" }} />

        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)",
            color: "#B9C6DE", borderRadius: 10, padding: 6, cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, rgba(247,181,0,.35), rgba(247,181,0,0) 70%), linear-gradient(145deg, #F7B500, #E28900)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 40px rgba(247,181,0,.45)",
          }}>
            <Trophy size={36} color="#1a1200" strokeWidth={2.4} />
          </div>

          <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700, color: "#9BE8B8", textTransform: "uppercase" }}>
            🏆 NUVIA · Victory
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, textAlign: "center", margin: 0 }}>
            {kindLabel}
          </h2>
          <div style={{ fontSize: 14, color: "#B9C6DE", textAlign: "center" }}>
            {isMine ? "¡Cerraste un nuevo caso!" : `${evt.analista} cerró un nuevo caso`}
          </div>
        </div>

        <div style={{
          marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
        }}>
          <InfoCell label="Analista" value={evt.analista} />
          <InfoCell label="Banco" value={evt.banco} />
          <InfoCell label="Cliente" value={evt.cliente} />
          <InfoCell label="Honorarios" value={formatMoney(evt.honorarios)} highlight />
        </div>

        <div style={{
          marginTop: 20, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999,
            background: "linear-gradient(90deg, rgba(46,204,113,.22), rgba(77,124,254,.22))",
            border: "1px solid rgba(46,204,113,.45)",
            fontSize: 12, fontWeight: 700, color: "#9BE8B8",
          }}>
            +1 cierre
          </span>
          {isMine && streak && streak.actual > 1 && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999,
              background: "rgba(247,181,0,.14)", border: "1px solid rgba(247,181,0,.45)",
              fontSize: 12, fontWeight: 700, color: "#FFD97A",
            }}>
              <Flame size={12} /> Racha ×{streak.actual}
              {streak.actual >= (streak.record ?? 0) && streak.actual > 1 ? " · Récord" : ""}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InfoCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 12,
      background: highlight ? "linear-gradient(135deg, rgba(46,204,113,.14), rgba(46,204,113,.06))" : "rgba(255,255,255,.04)",
      border: `1px solid ${highlight ? "rgba(46,204,113,.35)" : "rgba(255,255,255,.08)"}`,
    }}>
      <div style={{ fontSize: 10, color: "#8397B8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 14, fontWeight: 700, color: highlight ? "#9BE8B8" : "#E7EEFB", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

/* ---------------------------- Mute Floating Btn --------------------------- */

function MuteToggle() {
  const [muted, setMuted] = useState(() => isVictoryMuted());
  useEffect(() => {
    const fn = (e: Event) => setMuted(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener("nuvia:victory:mute", fn);
    return () => window.removeEventListener("nuvia:victory:mute", fn);
  }, []);
  return (
    <button
      onClick={() => setVictoryMuted(!muted)}
      title={muted ? "Activar sonido Victory" : "Silenciar Victory"}
      aria-label={muted ? "Activar sonido Victory" : "Silenciar Victory"}
      style={{
        position: "fixed", bottom: 18, left: 18, zIndex: 2147483500,
        width: 40, height: 40, borderRadius: 999,
        background: "rgba(9,16,32,.85)", color: "#B9C6DE",
        border: "1px solid rgba(255,255,255,.10)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(12px)", cursor: "pointer",
        boxShadow: "0 8px 24px rgba(0,0,0,.35)",
      }}
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}

function TestVictoryButton() {
  return (
    <button
      onClick={() => {
        void fireVictory({
          kind: "contrato_firmado",
          analistaId: null,
          analista: "Demo NUVIA",
          banco: "Banco de Bogotá",
          cliente: "Cliente Demo",
          honorarios: 4500000,
          expedienteId: null,
        });
      }}
      title="Probar Victory (cha-ching)"
      aria-label="Probar Victory"
      style={{
        position: "fixed", bottom: 18, left: 66, zIndex: 2147483500,
        width: 40, height: 40, borderRadius: 999,
        background: "linear-gradient(145deg,#F7B500,#E28900)", color: "#1a1200",
        border: "1px solid rgba(255,255,255,.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(247,181,0,.45)",
      }}
    >
      <PartyPopper size={16} />
    </button>
  );
}

/* ------------------------------ Provider ---------------------------------- */

export function VictoryProvider() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const currentRef = useRef<QueueItem | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // capturar user actual (best-effort)
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        currentUserIdRef.current = data.user?.id ?? null;
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    const enqueue = (evt: VictoryEvent, isMine: boolean) => {
      let streak: StreakState | undefined;
      if (isMine) streak = bumpStreak();
      setQueue((q) => [...q, { evt, isMine, streak }]);
    };
    const offLocal = subscribeVictoryLocal((evt) => enqueue(evt, true));
    const offRemote = subscribeVictoryBroadcast((evt) => {
      const isMine = !!currentUserIdRef.current && evt.analistaId === currentUserIdRef.current;
      // si el evento remoto es realmente mío (otra pestaña), evitar doble modal
      if (isMine) return;
      enqueue(evt, false);
    });
    return () => { offLocal(); offRemote(); };
  }, []);

  // procesar cola
  const current = queue[0] ?? null;
  useEffect(() => {
    if (!current || currentRef.current === current) return;
    currentRef.current = current;
    if (!isVictoryMuted()) playVictoryChime();
    const t = setTimeout(() => {
      currentRef.current = null;
      setQueue((q) => q.slice(1));
    }, 4200);
    return () => clearTimeout(t);
  }, [current]);

  return (
    <>
      {current && (
        <VictoryModal
          key={current.evt.id}
          item={current}
          onClose={() => { currentRef.current = null; setQueue((q) => q.slice(1)); }}
        />
      )}
      <MuteToggle />
    </>
  );
}

// re-export defaults
export { readStreak };
