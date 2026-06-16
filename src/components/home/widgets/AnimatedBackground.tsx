/**
 * AnimatedBackground — fondo NUVIA "Soft ambient glow".
 *
 * Tres auras grandes con blur extremo y opacidad muy baja (5–10%) que
 * se desplazan lentamente (25–35 s) por los bordes de la pantalla.
 * Nada de nodos, links, ni paquetes de datos. Solo luz que respira.
 *
 * CSS: keyframes `nuvia-drift` / `nuvia-drift-slow` en src/styles.css.
 * Respeta prefers-reduced-motion: las auras se quedan estáticas.
 * Debe ir dentro de un contenedor `relative overflow-hidden`.
 */
const BLUE = "#445DA3";
const GREEN = "#84B98F";
const VIOLET = "#2A3B6A";

export function AnimatedBackground() {
  return (
    <>
      {/* Capa base — gradiente NUVIA oscuro (estático) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 700px at 20% 10%, rgba(68,93,163,0.28), transparent 60%), radial-gradient(900px 600px at 90% 90%, rgba(132,185,143,0.22), transparent 55%), linear-gradient(160deg, #0A0B10 0%, #0F121C 55%, #0A0B10 100%)",
        }}
      />

      {/* Grid sutil (estático) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />

      {/* ── Auras borrosas que se desplazan lentamente ── */}
      {/* Aura 1 — Blue, arriba-izquierda, 25s */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[10%] -left-[10%] h-[60%] w-[60%] rounded-full blur-[120px] nuvia-drift"
        style={{
          background: BLUE,
          opacity: 0.08,
        }}
      />

      {/* Aura 2 — Green, abajo-derecha, 35s (reverse) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[10%] -right-[10%] h-[50%] w-[50%] rounded-full blur-[100px] nuvia-drift-slow"
        style={{
          background: GREEN,
          opacity: 0.05,
        }}
      />

      {/* Aura 3 — Violet, centro, estática (sin drift) para anclaje */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[40%] w-[40%] rounded-full blur-[150px]"
        style={{
          background: VIOLET,
          opacity: 0.06,
        }}
      />

      {/* Vignette sutil para oscurecer bordes y centrar la atención */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(10,11,16,0.35) 100%)",
        }}
      />
    </>
  );
}
