import { useEffect, useState, useRef, useMemo } from "react";
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

    const delay = ctx.createDelay();
    delay.delayTime.value = 0.09;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    delay.connect(feedback).connect(delay).connect(master);

    const now = ctx.currentTime;

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

    const dings = [
      { t: 0.02, carrier: 1760, mod: 2637, modGain: 800 },
      { t: 0.22, carrier: 2093, mod: 3136, modGain: 950 },
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

/* ------------------------------- Types ------------------------------------ */

interface QueueItem { evt: VictoryEvent; isMine: boolean; streak?: StreakState }

function formatMoney(v: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

/* --------------------------- Money Rain Overlay --------------------------- */

function MoneyRain({ show }: { show: boolean }) {
  const particles = useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.6,
      duration: 4.2 + Math.random() * 1.8,
      size: 16 + Math.random() * 14,
      drift: (Math.random() - 0.5) * 60,
      rotate: (Math.random() - 0.5) * 40,
      symbol: Math.random() > 0.55 ? "$" : Math.random() > 0.5 ? "₿" : "€",
      hue: Math.random() > 0.5 ? "#84B98F" : "#F7B500",
    }));
  }, [show]);

  if (!show) return null;
  return createPortal(
    <div
      aria-hidden
      style={{
        position: "fixed", inset: 0, zIndex: 2147483400,
        pointerEvents: "none", overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes nuviaMoneyFall {
          0%   { transform: translate3d(0,-8vh,0) rotate(0deg); opacity: 0; }
          10%  { opacity: .55; }
          85%  { opacity: .35; }
          100% { transform: translate3d(var(--drift,0px), 108vh, 0) rotate(var(--rot,0deg)); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            fontSize: p.size,
            fontWeight: 800,
            color: p.hue,
            textShadow: `0 0 12px ${p.hue}55, 0 2px 6px rgba(0,0,0,.4)`,
            fontFamily: "Inter, ui-sans-serif, system-ui",
            ["--drift" as string]: `${p.drift}px`,
            ["--rot" as string]: `${p.rotate}deg`,
            animation: `nuviaMoneyFall ${p.duration}s ${p.delay}s linear forwards`,
            willChange: "transform, opacity",
          } as React.CSSProperties}
        >
          {p.symbol}
        </span>
      ))}
    </div>,
    document.body,
  );
}

/* ------------------------------ Toast ------------------------------------- */

function VictoryToast({ item, onClose, closing }: { item: QueueItem; onClose: () => void; closing: boolean }) {
  const { evt, isMine, streak } = item;
  const kindLabel = evt.kind === "contrato_firmado" ? "CONTRATO CERRADO" : "PODER FIRMADO";

  return createPortal(
    <div
      style={{
        position: "fixed", bottom: 32, right: 32, zIndex: 2147483600,
        width: 420, maxWidth: "calc(100vw - 40px)",
      }}
    >
      <style>{`
        @keyframes nuviaVictorySlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes nuviaVictorySlideOut {
          from { transform: translateX(0); opacity: 1; }
          to   { transform: translateX(120%); opacity: 0; }
        }
        @keyframes nuviaVictoryGlow {
          0%,100% { box-shadow: 0 0 0 1px rgba(77,124,254,.30), 0 18px 50px rgba(77,124,254,.28), 0 0 40px rgba(46,204,113,.20); }
          50%     { box-shadow: 0 0 0 1px rgba(46,204,113,.45), 0 22px 60px rgba(46,204,113,.35), 0 0 55px rgba(77,124,254,.30); }
        }
      `}</style>

      <div
        role="status"
        aria-live="polite"
        style={{
          position: "relative",
          minHeight: 120,
          padding: "16px 18px 16px 16px",
          borderRadius: 16,
          background: "linear-gradient(155deg, rgba(14,24,44,.94), rgba(9,16,32,.96))",
          border: "1px solid rgba(255,255,255,.10)",
          color: "#E7EEFB",
          fontFamily: "Inter, ui-sans-serif, system-ui",
          backdropFilter: "blur(14px)",
          animation: closing
            ? "nuviaVictorySlideOut .25s ease-in forwards"
            : "nuviaVictorySlideIn .35s cubic-bezier(.2,1,.3,1), nuviaVictoryGlow 2.4s ease-in-out infinite .35s",
          overflow: "hidden",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)",
            color: "#B9C6DE", borderRadius: 8, padding: 4, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={12} />
        </button>

        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{
            flex: "0 0 auto",
            width: 48, height: 48, borderRadius: 12,
            background: "radial-gradient(circle at 30% 30%, rgba(247,181,0,.35), rgba(247,181,0,0) 70%), linear-gradient(145deg,#F7B500,#E28900)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(247,181,0,.45)",
          }}>
            <Trophy size={24} color="#1a1200" strokeWidth={2.4} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 700, color: "#9BE8B8", textTransform: "uppercase" }}>
              NUVIA · Victory
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.2, marginTop: 2, color: "#FFFFFF" }}>
              {kindLabel}
            </div>
            <div style={{ fontSize: 12.5, color: "#B9C6DE", marginTop: 3, lineHeight: 1.35 }}>
              {isMine ? "¡Cerraste un nuevo caso!" : `${evt.analista} cerró un nuevo caso`}
              {evt.banco ? ` · ${evt.banco}` : ""}
            </div>

            <div style={{
              marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#8397B8", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                  Cliente
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#E7EEFB", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {evt.cliente || "—"}
                </div>
              </div>
              <div style={{
                padding: "6px 10px", borderRadius: 10,
                background: "linear-gradient(135deg, rgba(46,204,113,.18), rgba(46,204,113,.06))",
                border: "1px solid rgba(46,204,113,.4)",
                fontSize: 13, fontWeight: 800, color: "#9BE8B8",
                whiteSpace: "nowrap",
              }}>
                {formatMoney(evt.honorarios)}
              </div>
            </div>

            {isMine && streak && streak.actual > 1 && (
              <div style={{ marginTop: 8 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 8px", borderRadius: 999,
                  background: "rgba(247,181,0,.14)", border: "1px solid rgba(247,181,0,.4)",
                  fontSize: 10.5, fontWeight: 700, color: "#FFD97A",
                }}>
                  <Flame size={10} /> Racha ×{streak.actual}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
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
  const [closing, setClosing] = useState(false);
  const [rain, setRain] = useState(false);
  const currentRef = useRef<QueueItem | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
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
      if (isMine) return;
      enqueue(evt, false);
    });
    return () => { offLocal(); offRemote(); };
  }, []);

  const current = queue[0] ?? null;

  useEffect(() => {
    if (!current || currentRef.current === current) return;
    currentRef.current = current;
    setClosing(false);
    setRain(true);
    if (!isVictoryMuted()) playVictoryChime();

    const rainOff = setTimeout(() => setRain(false), 5200);
    const closeStart = setTimeout(() => setClosing(true), 4200);
    const dequeue = setTimeout(() => {
      currentRef.current = null;
      setClosing(false);
      setQueue((q) => q.slice(1));
    }, 4500);

    return () => {
      clearTimeout(rainOff);
      clearTimeout(closeStart);
      clearTimeout(dequeue);
    };
  }, [current]);

  const closeNow = () => {
    setClosing(true);
    setTimeout(() => {
      currentRef.current = null;
      setClosing(false);
      setRain(false);
      setQueue((q) => q.slice(1));
    }, 260);
  };

  return (
    <>
      <MoneyRain show={rain && !!current} />
      {current && (
        <VictoryToast
          key={current.evt.id}
          item={current}
          closing={closing}
          onClose={closeNow}
        />
      )}
      <MuteToggle />
      <TestVictoryButton />
    </>
  );
}

export { readStreak };
