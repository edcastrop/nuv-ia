// Combobox buscable para departamentos/municipios de Colombia.
// Reemplaza los inputs de texto en todos los campos de ciudad del sistema.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { COLOMBIA_CITIES, cityLabel, searchCities, type CityRecord } from "@/lib/colombiaCities";

interface Props {
  value: string;
  onChange: (label: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Permite escribir texto libre cuando no hay match. */
  allowFreeText?: boolean;
}

export function CitySelect({ value, onChange, placeholder = "Selecciona un municipio…", required, allowFreeText = true }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const results = useMemo<CityRecord[]>(() => searchCities(query, 50), [query]);
  const empty = required && !value.trim();

  const select = (c: CityRecord) => {
    onChange(cityLabel(c));
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full inline-flex items-center justify-between gap-2 rounded-lg border bg-white px-2 py-1.5 text-sm text-left"
        style={{ borderColor: empty ? "#F5C2C2" : "#E3E7EE" }}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin size={13} className="text-[#445DA3] shrink-0" />
          <span className={value ? "text-[#242424]" : "text-[#242424]/40"}>
            {value || placeholder}
          </span>
        </span>
        <ChevronDown size={14} className="text-[#242424]/50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#E3E7EE] bg-white shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#E3E7EE] px-2 py-1.5">
            <Search size={13} className="text-[#242424]/40" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar municipio o departamento…"
              className="w-full bg-transparent text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) select(results[0]);
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className="px-3 py-2 text-xs text-[#242424]/60">
                Sin resultados en el catálogo NUVEX
                {allowFreeText && query.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                    className="ml-2 text-[#445DA3] hover:underline"
                  >
                    Usar "{query.trim()}"
                  </button>
                )}
              </li>
            ) : (
              results.map((c) => {
                const label = cityLabel(c);
                const selected = label === value;
                return (
                  <li key={`${c.dane ?? c.city}-${c.department}`}>
                    <button
                      type="button"
                      onClick={() => select(c)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-[#F7F9FB] text-left"
                    >
                      <span>
                        <span className="font-medium text-[#242424]">{c.city}</span>
                        <span className="text-[11px] text-[#242424]/60">, {c.department}</span>
                      </span>
                      {selected && <Check size={13} className="text-[#1F6D3D]" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-[#E3E7EE] px-3 py-1 text-[10px] text-[#242424]/50">
            {COLOMBIA_CITIES.length} municipios oficiales · catálogo NUVEX
          </div>
        </div>
      )}
    </div>
  );
}

export default CitySelect;
