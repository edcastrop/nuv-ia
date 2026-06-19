import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Lightbulb } from "lucide-react";
import { formatCOP } from "../../lib/format";
import {
  generarAnalogia,
  type AnalogiaResultado,
  type PerfilCliente,
} from "../../lib/abonoAnalogias";

interface Props {
  abonoMensual: number;
  ahorroTotal: number;
  anosEliminados: number;
  cuotasEliminadas: number;
  perfil?: PerfilCliente;
  /** Rota automáticamente cada N segundos. 0 = sin auto-rotación. */
  autoRotateMs?: number;
}

/**
 * Traductor de Ahorro NUVIA: muestra una analogía humana del abono y del
 * ahorro, rota cada cierto tiempo y permite al asesor pedir otra a demanda.
 *
 * Se usa dentro de la propuesta recomendada para ayudar al cliente a
 * dimensionar los números en contexto cotidiano.
 */
export function AbonoInteligenteCard({
  abonoMensual,
  ahorroTotal,
  anosEliminados,
  cuotasEliminadas,
  perfil,
  autoRotateMs = 9000,
}: Props) {
  // Clave estable de inputs: si cambian, regeneramos la analogía base.
  const inputKey = useMemo(
    () =>
      `${Math.round(abonoMensual)}|${Math.round(ahorroTotal)}|${cuotasEliminadas}|${JSON.stringify(perfil ?? {})}`,
    [abonoMensual, ahorroTotal, cuotasEliminadas, perfil],
  );

  const [analogia, setAnalogia] = useState<AnalogiaResultado>(() =>
    generarAnalogia({ abonoMensual, ahorroTotal, anosEliminados, cuotasEliminadas, perfil }),
  );
  const [ultimoAbono, setUltimoAbono] = useState<string | null>(null);

  // Cuando cambian los inputs, regenera y resetea memoria.
  useEffect(() => {
    const nueva = generarAnalogia({
      abonoMensual,
      ahorroTotal,
      anosEliminados,
      cuotasEliminadas,
      perfil,
    });
    setAnalogia(nueva);
    setUltimoAbono(nueva.abonoComo);
  }, [inputKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotar = () => {
    const nueva = generarAnalogia({
      abonoMensual,
      ahorroTotal,
      anosEliminados,
      cuotasEliminadas,
      perfil,
      evitar: ultimoAbono,
    });
    setAnalogia(nueva);
    setUltimoAbono(nueva.abonoComo);
  };

  // Auto-rotación opcional
  useEffect(() => {
    if (!autoRotateMs || autoRotateMs <= 0) return;
    const id = window.setInterval(rotar, autoRotateMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotateMs, ultimoAbono, inputKey]);

  if (!Number.isFinite(abonoMensual) || abonoMensual <= 0 || ahorroTotal <= 0) {
    return null;
  }

  return (
    <div
      className="relative mx-5 mt-4 overflow-hidden rounded-2xl border px-4 py-3.5 backdrop-blur-md"
      style={{
        borderColor: "rgba(246,196,83,0.45)",
        background:
          "linear-gradient(135deg, rgba(246,196,83,0.16) 0%, rgba(132,185,143,0.14) 55%, rgba(20,28,54,0.55) 100%)",
        boxShadow:
          "0 14px 32px -20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Halo decorativo */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(246,196,83,0.35), transparent 70%)",
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Lightbulb size={13} style={{ color: "#F6C453" }} />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "#F6C453" }}
          >
            Ponlo en perspectiva
          </span>
        </div>
        <button
          type="button"
          onClick={rotar}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition hover:scale-105"
          style={{
            color: "rgba(230,236,255,0.7)",
            borderColor: "rgba(255,255,255,0.18)",
            background: "rgba(20,28,54,0.55)",
          }}
          title="Ver otra comparación"
        >
          <RefreshCw size={9} /> Otra
        </button>
      </div>

      <div className="relative mt-2 space-y-1.5">
        <p
          className="text-[13px] leading-snug"
          style={{ color: "#FFFFFF" }}
        >
          <span className="font-bold" style={{ color: "#FFE7A0" }}>
            {formatCOP(abonoMensual)}
          </span>{" "}
          extra al mes es como{" "}
          <span className="font-semibold" style={{ color: "#FFE7A0" }}>
            {analogia.abonoComo}
          </span>
          .
        </p>
        <p className="text-[13px] leading-snug" style={{ color: "#FFFFFF" }}>
          Y con eso te ahorras{" "}
          <span className="font-bold" style={{ color: "#A7E0B8" }}>
            {anosEliminados >= 1
              ? `${anosEliminados.toFixed(anosEliminados % 1 === 0 ? 0 : 1)} ${anosEliminados < 2 ? "año" : "años"}`
              : `${cuotasEliminadas} cuotas`}
          </span>{" "}
          y{" "}
          <span className="font-bold" style={{ color: "#A7E0B8" }}>
            {formatCOP(ahorroTotal)}
          </span>{" "}
          — el equivalente a{" "}
          <span className="font-semibold" style={{ color: "#A7E0B8" }}>
            {analogia.ahorroComo}
          </span>
          .
        </p>
        <p
          className="pt-1 text-[11px] italic"
          style={{ color: "rgba(230,236,255,0.7)" }}
        >
          {analogia.cierre}
        </p>
      </div>
    </div>
  );
}
