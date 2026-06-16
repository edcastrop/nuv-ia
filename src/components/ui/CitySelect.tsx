// Combobox buscable para departamentos/municipios de Colombia.
// Reemplaza los inputs de texto en todos los campos de ciudad del sistema.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { COLOMBIA_CITIES, cityLabel, searchCities, type CityRecord } from "@/lib/colombiaCities";

interface Props {
  value: string;
  onChange: (label: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Permite escribir texto libre cuando no hay match. */
  allowFreeText?: boolean;
  variant?: "light" | "dark";
}

export function CitySelect({ value, onChange, placeholder = "Selecciona un municipio…", required, allowFreeText = true, variant = "light" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const dark = variant === "dark";

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const results = useMemo<CityRecord[]>(() => searchCities(query, 50), [query]);
  const empty = required && !value.trim();

  const select = (c: CityRecord) => {
    onChange(cityLabel(c));
    setOpen(false);
    setQuery("");
  };

  const triggerCls = dark
    ? "w-full inline-flex items-center justify-between gap-2 rounded-lg border bg-white/[0.05] px-2 py-1.5 text-sm text-left text-white"
    : "w-full inline-flex items-center justify-between gap-2 rounded-lg border bg-white px-2 py-1.5 text-sm text-left";
  const triggerBorder = dark
    ? (empty ? "rgba(255,107,107,0.55)" : "rgba(255,255,255,0.10)")
    : (empty ? "#F5C2C2" : "#E3E7EE");
  const valueText = dark
    ? (value ? "text-white" : "text-white/45")
    : (value ? "text-[#242424]" : "text-[#242424]/40");
  const chev = dark ? "text-white/60" : "text-[#242424]/50";

  const panelCls = dark
    ? "rounded-lg border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl"
    : "rounded-lg border border-[#E3E7EE] bg-white shadow-xl overflow-hidden";
  const panelStyle: React.CSSProperties = dark
    ? { background: "linear-gradient(180deg, #0F1A36 0%, #0A1226 100%)", color: "var(--nuvia-text-primary)" }
    : {};
  const searchBorder = dark ? "border-white/10" : "border-[#E3E7EE]";
  const searchIcon = dark ? "text-white/50" : "text-[#242424]/40";
  const searchInputCls = dark
    ? "w-full bg-transparent text-sm outline-none text-white placeholder:text-white/45"
    : "w-full bg-transparent text-sm outline-none";
  const itemHover = dark ? "hover:bg-white/[0.06]" : "hover:bg-[#F7F9FB]";
  const itemMain = dark ? "font-medium text-white" : "font-medium text-[#242424]";
  const itemSub = dark ? "text-[11px] text-white/55" : "text-[11px] text-[#242424]/60";
  const emptyTxt = dark ? "text-white/55" : "text-[#242424]/60";
  const footerCls = dark
    ? "border-t border-white/10 px-3 py-1 text-[10px] text-white/45"
    : "border-t border-[#E3E7EE] px-3 py-1 text-[10px] text-[#242424]/50";
  const linkCls = dark ? "ml-2 text-[#A5B5E0] hover:underline" : "ml-2 text-[#445DA3] hover:underline";

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={triggerCls}
        style={{ borderColor: triggerBorder }}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin size={13} className={dark ? "text-[#A5B5E0] shrink-0" : "text-[#445DA3] shrink-0"} />
          <span className={valueText}>{value || placeholder}</span>
        </span>
        <ChevronDown size={14} className={`${chev} shrink-0`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          className={panelCls}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, ...panelStyle }}
        >
          <div className={`flex items-center gap-2 border-b ${searchBorder} px-2 py-1.5`}>
            <Search size={13} className={searchIcon} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar municipio o departamento…"
              className={searchInputCls}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) select(results[0]);
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 ? (
              <li className={`px-3 py-2 text-xs ${emptyTxt}`}>
                Sin resultados en el catálogo NUVEX
                {allowFreeText && query.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                    className={linkCls}
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
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm ${itemHover} text-left`}
                    >
                      <span>
                        <span className={itemMain}>{c.city}</span>
                        <span className={itemSub}>, {c.department}</span>
                      </span>
                      {selected && <Check size={13} className="text-[#84B98F]" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className={footerCls}>
            {COLOMBIA_CITIES.length} municipios oficiales · catálogo NUVEX
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default CitySelect;
