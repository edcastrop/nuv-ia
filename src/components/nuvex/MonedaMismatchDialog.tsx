import { useCallback, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type Args = {
  detectada: "uvr" | "pesos";
  simulador: "uvr" | "pesos";
};

type ResolverFn = (ok: boolean) => void;

/**
 * Modal de alerta de moneda al estilo Nuvex (no usa window.confirm).
 * Devuelve un objeto con el `dialog` que debe renderizarse y una función
 * `confirm({ detectada, simulador })` que retorna una Promise<boolean>.
 */
export function useMonedaMismatchAlert() {
  const [open, setOpen] = useState(false);
  const [args, setArgs] = useState<Args | null>(null);
  const resolverRef = useRef<ResolverFn | null>(null);

  const confirm = useCallback((a: Args): Promise<boolean> => {
    setArgs(a);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleResolve = useCallback((value: boolean) => {
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(value);
  }, []);

  const detectada = args?.detectada ?? "uvr";
  const simulador = args?.simulador ?? "pesos";
  const tipoExtracto = detectada === "uvr" ? "UVR" : "Pesos";
  const tipoSim = simulador === "uvr" ? "UVR" : "Pesos";

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleResolve(false);
      }}
    >
      <AlertDialogContent
        className="
          max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none
        "
      >
        <div
          className="
            relative rounded-2xl border border-amber-400/20
            bg-gradient-to-br from-[#1a1408] via-[#13100a] to-[#0b0a08]
            shadow-[0_30px_80px_-20px_rgba(251,191,36,0.25),0_0_0_1px_rgba(251,191,36,0.08)]
          "
        >
          {/* Glow superior */}
          <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />

          {/* Cerrar */}
          <button
            type="button"
            onClick={() => handleResolve(false)}
            className="
              absolute right-4 top-4 z-10 rounded-full p-1.5 text-white/40
              transition hover:bg-white/[0.06] hover:text-white/80
            "
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-4 px-7 pt-7">
            <div
              className="
                relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
                bg-gradient-to-br from-amber-400/30 to-amber-600/10
                ring-1 ring-amber-300/30
              "
            >
              <div className="absolute inset-0 animate-pulse rounded-xl bg-amber-400/10" />
              <AlertTriangle className="relative h-6 w-6 text-amber-300" strokeWidth={2.2} />
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
                Alerta crítica
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-white">
                Moneda del extracto no coincide
              </h2>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="px-7 pb-5 pt-5">
            <p className="text-sm leading-relaxed text-white/70">
              El sistema detectó que el extracto que cargaste y el simulador en uso
              están en monedas distintas. Si continúas, la proyección puede quedar
              mal calculada.
            </p>

            {/* Comparativa */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div
                className="
                  rounded-xl border border-white/[0.06] bg-white/[0.02] p-4
                "
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  Extracto cargado
                </p>
                <p className="mt-2 font-mono text-lg font-semibold text-amber-300">
                  {tipoExtracto}
                </p>
              </div>
              <div
                className="
                  rounded-xl border border-white/[0.06] bg-white/[0.02] p-4
                "
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  Simulador actual
                </p>
                <p className="mt-2 font-mono text-lg font-semibold text-white/90">
                  {tipoSim}
                </p>
              </div>
            </div>

            {/* Recomendación */}
            <div
              className="
                mt-5 rounded-lg border border-amber-400/15 bg-amber-400/[0.04]
                px-4 py-3 text-xs leading-relaxed text-amber-100/80
              "
            >
              <span className="font-semibold text-amber-200">Recomendado:</span>{" "}
              cancela esta carga y usa el simulador de {tipoExtracto} para mantener
              la integridad de los cálculos.
            </div>
          </div>

          {/* Footer */}
          <AlertDialogFooter
            className="
              flex flex-row items-center justify-end gap-2 border-t border-white/[0.05]
              bg-black/30 px-7 py-4
            "
          >
            <AlertDialogAction
              onClick={() => handleResolve(true)}
              className="
                order-1 h-10 rounded-lg border border-white/[0.08] bg-transparent
                px-4 text-xs font-medium text-white/50
                hover:bg-white/[0.04] hover:text-white/70
              "
            >
              Aplicar de todos modos
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => handleResolve(false)}
              className="
                order-2 mt-0 h-10 rounded-lg border-0
                bg-gradient-to-b from-amber-300 to-amber-400
                px-5 text-sm font-semibold text-amber-950
                shadow-[0_8px_20px_-8px_rgba(251,191,36,0.6)]
                hover:from-amber-200 hover:to-amber-300 hover:text-amber-950
              "
            >
              Cancelar carga
            </AlertDialogCancel>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { dialog, confirm };
}
