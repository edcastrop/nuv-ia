import { Search } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";

/**
 * NUVIA · FilterBar (Fase 7.6.1B)
 * Barra de filtros uniforme.
 *
 *  <FilterBar
 *    search={{ value: q, onChange: setQ, placeholder: "Buscar..." }}
 *    chips={<>...</>}
 *    extra={<>...</>}
 *  />
 */
interface FilterBarProps {
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  /** Chips (botones toggle) — el componente solo provee el slot. */
  chips?: ReactNode;
  /** Slot derecho (selects, etc). */
  extra?: ReactNode;
}

export function FilterBar({ search, chips, extra }: FilterBarProps) {
  return (
    <div
      className="glass-card"
      style={{
        padding: "var(--nuvia-space-3) var(--nuvia-space-4)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--nuvia-space-3)",
      }}
    >
      {search && (
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--nuvia-text-secondary)" }}
          />
          <input
            type="text"
            value={search.value}
            onChange={(e: ChangeEvent<HTMLInputElement>) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Buscar..."}
            className="nuvia-input"
            style={{ paddingLeft: 36, height: 38 }}
          />
        </div>
      )}
      {chips && (
        <div className="flex flex-wrap items-center gap-2">{chips}</div>
      )}
      {extra && <div className="flex flex-wrap items-center gap-2">{extra}</div>}
    </div>
  );
}
