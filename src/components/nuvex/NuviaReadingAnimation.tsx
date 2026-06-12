import { useEffect, useState } from "react";
import { Sparkles, FileText, Brain, ScanLine, CheckCircle2 } from "lucide-react";

const STEPS = [
  { icon: FileText, label: "Procesando páginas", detail: "Renderizando imágenes en alta resolución" },
  { icon: ScanLine, label: "Escaneando con visión", detail: "Detectando campos, montos y cuotas" },
  { icon: Brain, label: "NUVIA IA interpretando", detail: "Cruzando con productos bancarios" },
  { icon: Sparkles, label: "Estructurando datos", detail: "Construyendo la propuesta" },
];

const FACTS = [
  "Tip NUVIA: detectamos automáticamente seguros, TEA y cuotas pagadas.",
  "¿Sabías? Los reestructuradores top revisan el extracto antes de simular.",
  "NUVIA cruza el extracto con la base de productos bancarios de Colombia.",
  "El campo más sensible suele ser la TEA. NUVIA lo verifica dos veces.",
  "Cada segundo invertido aquí te ahorra minutos diligenciando manualmente.",
];

export function NuviaReadingAnimation() {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(8);
  const [factIdx, setFactIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        // ease toward 92, never finish (real completion driven by parent)
        const target = 92;
        const next = p + (target - p) * 0.06;
        return Math.min(target, Math.max(p + 0.4, next));
      });
    }, 180);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 4200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 py-8">
      {/* Orbital scanner */}
      <div className="relative h-44 w-44">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(132,185,143,0.55) 0%, rgba(68,93,163,0.35) 45%, transparent 70%)",
            animation: "nuviaPulseGlow 2.6s ease-in-out infinite",
          }}
        />
        {/* Outer orbit ring */}
        <div
          className="absolute inset-0 rounded-full border border-white/15"
          style={{ animation: "nuviaSpinSlow 8s linear infinite" }}
        >
          <div
            className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full"
            style={{
              background: "#84B98F",
              boxShadow: "0 0 16px 4px rgba(132,185,143,0.8)",
            }}
          />
        </div>
        {/* Middle orbit ring */}
        <div
          className="absolute inset-3 rounded-full border border-white/10"
          style={{ animation: "nuviaSpinRev 6s linear infinite" }}
        >
          <div
            className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
            style={{
              background: "#445DA3",
              boxShadow: "0 0 14px 3px rgba(68,93,163,0.85)",
            }}
          />
          <div
            className="absolute top-1/2 -right-1 h-2 w-2 -translate-y-1/2 rounded-full"
            style={{
              background: "#C9A84C",
              boxShadow: "0 0 12px 3px rgba(201,168,76,0.8)",
            }}
          />
        </div>
        {/* Inner core */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 backdrop-blur-md"
            style={{
              background:
                "linear-gradient(135deg, rgba(68,93,163,0.35), rgba(132,185,143,0.3))",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.25), 0 12px 32px rgba(68,93,163,0.35)",
              animation: "nuviaBreath 2.4s ease-in-out infinite",
            }}
          >
            <Brain className="h-9 w-9 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
            {/* Scan line */}
            <div
              className="pointer-events-none absolute inset-x-2 h-[2px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(132,185,143,0.95), transparent)",
                boxShadow: "0 0 12px rgba(132,185,143,0.9)",
                animation: "nuviaScan 1.8s ease-in-out infinite",
              }}
            />
          </div>
        </div>
        {/* Sparkle particles */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/90"
            style={{
              top: `${15 + (i * 53) % 70}%`,
              left: `${10 + (i * 71) % 80}%`,
              animation: `nuviaTwinkle ${1.6 + (i % 4) * 0.4}s ease-in-out ${i * 0.25}s infinite`,
              boxShadow: "0 0 6px rgba(255,255,255,0.9)",
            }}
          />
        ))}
      </div>

      {/* Title */}
      <div className="text-center">
        <div className="bg-gradient-to-r from-[#A8C6FF] via-white to-[#B8E0BE] bg-clip-text text-base font-semibold text-transparent">
          NUVIA IA está leyendo el extracto
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/40">
          Visión + comprensión financiera
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, #445DA3 0%, #6E8AD6 45%, #84B98F 100%)",
              boxShadow:
                "0 0 14px rgba(132,185,143,0.5), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          />
          {/* shimmer */}
          <div
            className="pointer-events-none absolute inset-y-0 w-1/3 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
              animation: "nuviaShimmer 1.6s linear infinite",
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/45">
          <span>Procesando</span>
          <span className="font-mono text-white/70">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Steps */}
      <div className="grid w-full max-w-md grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1.5 text-center transition-all"
              style={{ opacity: active ? 1 : done ? 0.85 : 0.35 }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-md transition-all"
                style={{
                  borderColor: active
                    ? "rgba(132,185,143,0.65)"
                    : done
                      ? "rgba(132,185,143,0.35)"
                      : "rgba(255,255,255,0.12)",
                  background: active
                    ? "linear-gradient(135deg, rgba(68,93,163,0.4), rgba(132,185,143,0.4))"
                    : done
                      ? "rgba(132,185,143,0.18)"
                      : "rgba(255,255,255,0.04)",
                  boxShadow: active
                    ? "0 0 22px rgba(132,185,143,0.45), inset 0 1px 0 rgba(255,255,255,0.2)"
                    : "none",
                  transform: active ? "scale(1.08)" : "scale(1)",
                }}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-[#B8E0BE]" />
                ) : (
                  <Icon className="h-4 w-4 text-white" />
                )}
              </div>
              <div className="text-[10px] font-medium leading-tight text-white/75">
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live caption */}
      <div className="h-10 w-full max-w-md text-center text-[12px] text-white/55">
        <div key={step} className="animate-[nuviaFadeUp_0.4s_ease-out]">
          {STEPS[step].detail}
        </div>
        <div
          key={`fact-${factIdx}`}
          className="mt-1 animate-[nuviaFadeUp_0.5s_ease-out] text-[11px] italic text-white/35"
        >
          {FACTS[factIdx]}
        </div>
      </div>

      <style>{`
        @keyframes nuviaSpinSlow { to { transform: rotate(360deg); } }
        @keyframes nuviaSpinRev { to { transform: rotate(-360deg); } }
        @keyframes nuviaBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes nuviaPulseGlow {
          0%, 100% { opacity: 0.55; transform: scale(0.95); }
          50% { opacity: 0.9; transform: scale(1.1); }
        }
        @keyframes nuviaScan {
          0% { top: 18%; opacity: 0; }
          15% { opacity: 1; }
          50% { top: 80%; opacity: 1; }
          85% { opacity: 1; }
          100% { top: 18%; opacity: 0; }
        }
        @keyframes nuviaShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes nuviaTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.6); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes nuviaFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
