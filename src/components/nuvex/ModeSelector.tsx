import { NUVEX } from "./constants";

export function ModeSelector({ onPick }: { onPick: (m: "pesos" | "uvr") => void }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="text-center">
        <div className="inline-flex items-center rounded-full bg-[#EEF1FA] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#445DA3]">
          Acceso licenciados NUVEX
        </div>
        <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight text-[#242424]">
          Simulador NUVEX de Optimización de Créditos
        </h1>
        <p className="mt-3 text-[#242424]/65">
          Seleccione el tipo de simulador para iniciar la propuesta de optimización financiera.
        </p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <button
          onClick={() => onPick("pesos")}
          className="group rounded-2xl border-2 border-[#E3E7EE] bg-white p-8 text-left transition-all hover:border-[#445DA3] hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: NUVEX.azul }}>
              PESOS
            </div>
            <span className="text-2xl text-[#445DA3] opacity-0 transition-opacity group-hover:opacity-100">→</span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[#242424]">Simulador en Pesos</h2>
          <p className="mt-2 text-sm text-[#242424]/65">
            Créditos hipotecarios y leasing habitacional denominados en pesos colombianos con o sin beneficio de cobertura.
          </p>
        </button>
        <button
          onClick={() => onPick("uvr")}
          className="group rounded-2xl border-2 border-[#E3E7EE] bg-white p-8 text-left transition-all hover:border-[#84B98F] hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: NUVEX.verde }}>
              UVR
            </div>
            <span className="text-2xl text-[#84B98F] opacity-0 transition-opacity group-hover:opacity-100">→</span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[#242424]">Simulador en UVR</h2>
          <p className="mt-2 text-sm text-[#242424]/65">
            Créditos hipotecarios y leasing habitacional en UVR con proyección de corrección monetaria.
          </p>
        </button>
      </div>
    </div>
  );
}
