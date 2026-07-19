// Laboratorio NUVIA · Pestaña VARIABLES
import type { VariableDetectada } from "@/lib/reconstructor/lab/types";

export interface LabVariablesTabProps {
  variables: VariableDetectada[];
  onToggleExcluir: (id: string) => void;
  onEditarValor: (id: string, nuevo: number | null) => void;
}

export function LabVariablesTab({ variables, onToggleExcluir, onEditarValor }: LabVariablesTabProps) {
  if (!variables.length) {
    return <p className="text-[13px] text-white/60">Aún no hay variables clasificadas.</p>;
  }
  return (
    <div className="overflow-auto rounded-xl border border-white/10">
      <table className="w-full text-[12.5px]">
        <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.14em] text-white/60">
          <tr>
            <th className="p-2 text-left" style={{ color: "rgba(255,255,255,0.8)" }}>Categoría</th>
            <th className="p-2 text-left" style={{ color: "rgba(255,255,255,0.8)" }}>Etiqueta original</th>
            <th className="p-2 text-right" style={{ color: "rgba(255,255,255,0.8)" }}>Valor</th>
            <th className="p-2 text-left" style={{ color: "rgba(255,255,255,0.8)" }}>Fuente</th>
            <th className="p-2 text-left" style={{ color: "rgba(255,255,255,0.8)" }}>Confianza</th>
            <th className="p-2 text-right" style={{ color: "rgba(255,255,255,0.8)" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {variables.map((v) => (
            <tr
              key={v.id}
              className={v.excluida ? "opacity-40" : ""}
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <td className="p-2" style={{ color: "rgba(255,255,255,0.95)" }}>{v.categoria}</td>
              <td className="p-2" style={{ color: "rgba(255,255,255,0.7)" }}>{v.etiquetaOriginal}</td>
              <td className="p-2 text-right" style={{ color: "rgba(255,255,255,0.95)" }}>
                <input
                  type="text"
                  value={v.valor ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const n = raw ? Number(raw.replace(",", ".")) : null;
                    onEditarValor(v.id, n === null || !Number.isFinite(n) ? null : n);
                  }}
                  className="w-32 rounded border border-white/10 bg-transparent px-2 py-0.5 text-right text-white"
                />
              </td>
              <td className="p-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                {v.fuente === "CORREGIDA_ANALISTA" ? "CORREGIDA POR ANALISTA" : v.fuente}
              </td>
              <td className="p-2" style={{ color: "rgba(255,255,255,0.7)" }}>{v.confianzaExtraccion}</td>
              <td className="p-2 text-right">
                <button
                  onClick={() => onToggleExcluir(v.id)}
                  className="rounded border border-white/10 px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/10"
                >
                  {v.excluida ? "Incluir" : "Excluir"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
