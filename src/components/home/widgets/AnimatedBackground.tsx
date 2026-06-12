/**
 * AnimatedBackground — fondo NUVIA con orbes flotantes.
 * Usa absolute dentro del contenedor padre (que debe ser relative + overflow-hidden).
 */
export function AnimatedBackground() {
  return (
    <>
      {/* Grid sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(238,245,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(238,245,255,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.85), transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.85), transparent 70%)",
        }}
      />

      {/* Orbe azul */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[560px] w-[560px] rounded-full blur-[120px] animate-nuvia-orb-1"
        style={{ background: "rgba(68,93,163,0.42)", top: "-120px", left: "-160px" }}
      />
      {/* Orbe verde */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[520px] w-[520px] rounded-full blur-[120px] animate-nuvia-orb-2"
        style={{ background: "rgba(132,185,143,0.32)", top: "-80px", right: "-160px" }}
      />
      {/* Orbe dorado sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-[120px] animate-nuvia-orb-3"
        style={{ background: "rgba(201,168,76,0.18)", bottom: "-160px", left: "30%" }}
      />

      <style>{`
        @keyframes nuviaOrbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(80px, 60px) scale(1.08); }
        }
        @keyframes nuviaOrbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-60px, 80px) scale(1.05); }
        }
        @keyframes nuviaOrbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(40px, -60px) scale(1.1); }
        }
        .animate-nuvia-orb-1 { animation: nuviaOrbFloat1 18s ease-in-out infinite; }
        .animate-nuvia-orb-2 { animation: nuviaOrbFloat2 24s ease-in-out infinite; }
        .animate-nuvia-orb-3 { animation: nuviaOrbFloat3 30s ease-in-out infinite; }
      `}</style>
    </>
  );
}
