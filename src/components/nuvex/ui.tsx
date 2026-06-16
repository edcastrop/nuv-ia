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
      <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: "rgba(225,232,248,0.65)" }}>{label}</span>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`nuvia-input ${readOnly ? "opacity-70 cursor-not-allowed" : ""}`}
      />
      {hint && <span className="text-[11px]" style={{ color: "#84B98F" }}>{hint}</span>}
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
      <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: "rgba(225,232,248,0.65)" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="nuvia-input"
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
      className={`relative rounded-2xl p-4 sm:p-5 ${className ?? ""}`}
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(18px)",
        boxShadow: "0 22px 55px -36px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function MetricCard({ label, value, accent }: { label: string; value: string; accent?: "default" | "green" | "blue" | "dark" }) {
  const palette =
    accent === "green"
      ? { bg: "rgba(132,185,143,0.14)", border: "rgba(132,185,143,0.40)", text: "#C8E4CE" }
      : accent === "blue"
        ? { bg: "rgba(68,93,163,0.18)", border: "rgba(68,93,163,0.45)", text: "#B8C7EF" }
        : accent === "dark"
          ? { bg: "rgba(10,12,22,0.6)", border: "rgba(255,255,255,0.12)", text: "#fff" }
          : { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "#fff" };
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
      <h2 className="text-xl font-semibold" style={{ color: "#fff" }}>{children}</h2>
      {sub && <p className="text-sm mt-1" style={{ color: "rgba(225,232,248,0.55)" }}>{sub}</p>}
    </div>
  );
}

export function Alert({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "error" | "info" }) {
  const styles =
    tone === "error"
      ? { bg: "rgba(251,113,133,0.10)", border: "rgba(251,113,133,0.45)", text: "#FCA5B0" }
      : tone === "info"
        ? { bg: "rgba(68,93,163,0.14)", border: "rgba(68,93,163,0.45)", text: "#B8C7EF" }
        : { bg: "rgba(248,211,106,0.10)", border: "rgba(248,211,106,0.40)", text: "#F8D36A" };
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
