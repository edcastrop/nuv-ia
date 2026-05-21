import { CORPORATIVO, NUVEX } from "./constants";

export function NuvexHeader({ onReset }: { onReset?: () => void }) {
  return (
    <header className="border-b border-[#E3E7EE] bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white" style={{ backgroundColor: NUVEX.negro }}>
            N
          </div>
          <div>
            <div className="text-sm font-semibold text-[#242424]">NUVEX</div>
            <div className="text-[11px] text-[#242424]/60 -mt-0.5">Finanzas Inteligentes</div>
          </div>
        </div>
        <div className="hidden md:block text-xs italic text-[#242424]/60">"{CORPORATIVO.tagline}"</div>
        {onReset && (
          <button
            onClick={onReset}
            className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] transition-colors hover:bg-[#F7F9FB]"
          >
            Cambiar simulador
          </button>
        )}
      </div>
    </header>
  );
}

export function NuvexFooter() {
  return (
    <footer className="border-t border-[#E3E7EE] bg-white">
      <div className="mx-auto max-w-7xl px-6 py-6 text-center text-xs text-[#242424]/70">
        <div className="font-semibold text-[#242424]">{CORPORATIVO.nombre}</div>
        <div className="mt-1">{CORPORATIVO.direccion}</div>
        <div>{CORPORATIVO.ciudades}</div>
        <div>{CORPORATIVO.telefono} · {CORPORATIVO.web}</div>
      </div>
    </footer>
  );
}
