/**
 * AnimatedBackground — fondo NUVIA con orbes flotantes claramente visibles.
 * Debe ir dentro de un contenedor `relative overflow-hidden`.
 */
export function AnimatedBackground() {
  return (
    <>
      {/* Grid sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(238,245,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(238,245,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.85), transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.85), transparent 70%)",
        }}
      />

      {/* Orbe azul — superior izquierda */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[640px] w-[640px] rounded-full animate-nuvia-orb-1"
        style={{
          top: "-180px",
          left: "-200px",
          background:
            "radial-gradient(circle at center, rgba(68,93,163,0.85) 0%, rgba(68,93,163,0.4) 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      {/* Orbe verde — superior derecha */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[580px] w-[580px] rounded-full animate-nuvia-orb-2"
        style={{
          top: "-120px",
          right: "-180px",
          background:
            "radial-gradient(circle at center, rgba(132,185,143,0.7) 0%, rgba(132,185,143,0.3) 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      {/* Orbe púrpura/azul profundo — centro inferior */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[520px] w-[520px] rounded-full animate-nuvia-orb-3"
        style={{
          top: "40%",
          left: "30%",
          background:
            "radial-gradient(circle at center, rgba(112,90,184,0.55) 0%, rgba(112,90,184,0.22) 40%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />
      {/* Orbe dorado — inferior derecha */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[420px] w-[420px] rounded-full animate-nuvia-orb-4"
        style={{
          bottom: "-160px",
          right: "10%",
          background:
            "radial-gradient(circle at center, rgba(201,168,76,0.45) 0%, rgba(201,168,76,0.18) 40%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />

      <style>{`
        @keyframes nuviaOrbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(120px, 80px) scale(1.1); }
        }
        @keyframes nuviaOrbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-90px, 100px) scale(1.08); }
        }
        @keyframes nuviaOrbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(80px, -80px) scale(1.12); }
          66%      { transform: translate(-60px, 60px) scale(0.95); }
        }
        @keyframes nuviaOrbFloat4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-100px, -120px) scale(1.15); }
        }
        .animate-nuvia-orb-1 { animation: nuviaOrbFloat1 20s ease-in-out infinite; }
        .animate-nuvia-orb-2 { animation: nuviaOrbFloat2 26s ease-in-out infinite; }
        .animate-nuvia-orb-3 { animation: nuviaOrbFloat3 32s ease-in-out infinite; }
        .animate-nuvia-orb-4 { animation: nuviaOrbFloat4 38s ease-in-out infinite; }
      `}</style>
    </>
  );
}
