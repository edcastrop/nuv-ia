import { useEffect, useRef, useState } from "react";
import { NUVEX } from "./constants";

interface FieldProps {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  hint?: string;
  className?: string;
}

export function TextField({ label, value, onChange, placeholder, readOnly, hint, className }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[11px] font-semibold tracking-[0.08em] text-[#3A4660]/75 uppercase">{label}</span>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`rounded-xl border border-white/60 bg-white/55 backdrop-blur-md px-3.5 py-2.5 text-sm text-[#1F2A44] placeholder:text-[#1F2A44]/35 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(36,52,92,0.04)] transition-all focus:border-[#445DA3]/60 focus:bg-white/80 focus:ring-2 focus:ring-[#445DA3]/15 ${readOnly ? "bg-white/35 cursor-not-allowed text-[#1F2A44]/60" : ""}`}
      />
      {hint && <span className="text-[11px] text-[#445DA3]">{hint}</span>}
    </label>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function SelectField({ label, value, onChange, options, placeholder, className }: SelectProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[11px] font-semibold tracking-[0.08em] text-[#3A4660]/75 uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/60 bg-white/55 backdrop-blur-md px-3.5 py-2.5 text-sm text-[#1F2A44] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(36,52,92,0.04)] transition-all focus:border-[#445DA3]/60 focus:bg-white/80 focus:ring-2 focus:ring-[#445DA3]/15"
      >
        <option value="" disabled>{placeholder ?? "Seleccione..."}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Card({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative rounded-2xl border border-white/55 bg-white/55 backdrop-blur-xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_18px_44px_-22px_rgba(36,52,92,0.18),0_2px_8px_rgba(36,52,92,0.05)] sm:p-5 ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function MetricCard({ label, value, accent }: { label: string; value: string; accent?: "default" | "green" | "blue" | "dark" }) {
  const palette =
    accent === "green"
      ? { bg: NUVEX.verdeClaro, border: NUVEX.verde, text: NUVEX.verdeTextoFuerte }
      : accent === "blue"
        ? { bg: "#EEF1FA", border: NUVEX.azul, text: NUVEX.azul }
        : accent === "dark"
          ? { bg: NUVEX.negro, border: NUVEX.negro, text: "#fff" }
          : { bg: "#fff", border: "#E3E7EE", text: NUVEX.negro };
  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: palette.bg, borderColor: palette.border }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: palette.text, opacity: 0.75 }}>{label}</div>
      <div className="mt-1.5 text-lg font-semibold leading-tight" style={{ color: palette.text }}>{value}</div>
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-[#242424]">{children}</h2>
      {sub && <p className="text-sm text-[#242424]/60 mt-1">{sub}</p>}
    </div>
  );
}

export function Alert({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "error" | "info" }) {
  const styles =
    tone === "error"
      ? { bg: NUVEX.rojoBg, border: NUVEX.rojoBorde, text: NUVEX.rojoTexto }
      : tone === "info"
        ? { bg: "#EEF1FA", border: NUVEX.azul, text: NUVEX.azul }
        : { bg: "#FFF7E6", border: "#F0B429", text: "#8A5A00" };
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm"
      style={{ backgroundColor: styles.bg, borderColor: styles.border, color: styles.text }}
    >
      {children}
    </div>
  );
}

export function Badge({ children, color = NUVEX.verde }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

// Hook simple para debouncing visual de inputs si se necesita
export function useStable<T>(value: T, delay = 150) {
  const [v, setV] = useState(value);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setV(value), delay);
    return () => { if (t.current) clearTimeout(t.current); };
  }, [value, delay]);
  return v;
}
