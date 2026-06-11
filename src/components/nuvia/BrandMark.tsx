/**
 * NUVIA · BrandMark
 * Logo cuadrado con gradiente azul→verde. Fuente: Login/Registro.
 */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-xl shrink-0"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #445DA3, #84B98F)",
        boxShadow: "0 8px 24px -8px rgba(68,93,163,0.6)",
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 19V5l8 10V5l8 14"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-[0.22em] text-white">NUVIA</div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-white/45">
          Inteligencia Financiera
        </div>
      </div>
    </div>
  );
}
