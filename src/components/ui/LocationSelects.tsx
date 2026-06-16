// Selectores en cascada para Departamento / Ciudad / Municipio de Colombia.
// Usan el catálogo DANE completo de src/lib/colombiaLocations.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import {
  COLOMBIA_DEPARTAMENTOS,
  listDepartamentos,
  listAllMunicipios,
  municipiosDe,
  searchInList,
} from "@/lib/colombiaLocations";

interface BaseProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  options: string[];
  emptyHint?: string;
}

function ListCombo({ value, onChange, placeholder, disabled, options, emptyHint }: BaseProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const results = useMemo(() => searchInList(options, query, 200), [options, query]);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((s) => !s)}
        className="w-full inline-flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left disabled:opacity-50 disabled:cursor-not-allowed transition"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "#fff",
        }}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin size={13} style={{ color: "#84B98F" }} className="shrink-0" />
          <span style={{ color: value ? "#fff" : "rgba(225,232,248,0.45)" }}>
            {value || placeholder}
          </span>
        </span>
        <ChevronDown size={14} style={{ color: "rgba(225,232,248,0.55)" }} className="shrink-0" />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg overflow-hidden shadow-2xl"
          style={{
            background: "#0B1226",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div className="flex items-center gap-2 px-2 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <Search size={13} style={{ color: "rgba(225,232,248,0.45)" }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: "#fff" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) select(results[0]);
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-2 text-xs" style={{ color: "rgba(225,232,248,0.55)" }}>
                {emptyHint ?? "Selecciona primero el departamento."}
              </li>
            ) : results.length === 0 ? (
              <li className="px-3 py-2 text-xs" style={{ color: "rgba(225,232,248,0.55)" }}>Sin resultados.</li>
            ) : (
              results.map((item) => {
                const selected = item === value;
                return (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => select(item)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left transition hover:bg-white/[0.06]"
                      style={{ color: "#fff" }}
                    >
                      <span>{item}</span>
                      {selected && <Check size={13} style={{ color: "#84B98F" }} />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="px-3 py-1 text-[10px]" style={{ color: "rgba(225,232,248,0.45)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            Catálogo oficial DANE · {COLOMBIA_DEPARTAMENTOS.length} departamentos
          </div>
        </div>
      )}
    </div>
  );
}

export function DepartamentoSelect({
  value,
  onChange,
  placeholder = "Selecciona departamento…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <ListCombo
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      options={listDepartamentos()}
    />
  );
}

export function MunicipioSelect({
  departamento,
  value,
  onChange,
  placeholder = "Selecciona municipio…",
}: {
  departamento: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const options = useMemo(
    () => (departamento ? municipiosDe(departamento) : listAllMunicipios()),
    [departamento]
  );
  return (
    <ListCombo
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      options={options}
    />
  );
}
