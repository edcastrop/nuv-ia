/**
 * AnimatedBackground — fondo NUVIA con orbes flotantes y gradiente sutil.
 * No intrusivo, paleta suave alineada a NUVIA Home.
 */
export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
      {/* Capa base con grid sutil */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(238,245,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(238,245,255,0.4) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 50% 0%, rgba(0,0,0,0.9), transparent 70%)",
        }}
      />

      {/* Orbe azul flotante */}
      <div
        className="absolute h-[520px] w-[520px] rounded-full opacity-[0.18] blur-[140px] animate-orb-1"
        style={{ background: "var(--nuvia-accent-blue)" }}
      />
      {/* Orbe verde flotante */}
      <div
        className="absolute h-[480px] w-[480px] rounded-full opacity-[0.14] blur-[140px] animate-orb-2"
        style={{ background: "var(--nuvia-accent-green)" }}
      />
      {/* Orbe cálido sutil */}
      <div
        className="absolute h-[360px] w-[360px] rounded-full opacity-[0.08] blur-[120px] animate-orb-3"
        style={{ background: "#c9a84c" }}
      />

      <style>{`
        @keyframes nuviaOrb1 {
          0%, 100% { transform: translate(-10%, -10%); }
          50%      { transform: translate(8%, 14%); }
        }
        @keyframes nuviaOrb2 {
          0%, 100% { transform: translate(70%, -5%); }
          50%      { transform: translate(55%, 25%); }
        }
        @keyframes nuviaOrb3 {
          0%, 100% { transform: translate(30%, 80%); }
          50%      { transform: translate(50%, 60%); }
        }
        .animate-orb-1 { top: 0; left: 0; animation: nuviaOrb1 22s ease-in-out infinite; }
        .animate-orb-2 { top: 0; left: 0; animation: nuviaOrb2 28s ease-in-out infinite; }
        .animate-orb-3 { top: 0; left: 0; animation: nuviaOrb3 34s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
