// Wrapper de CitySelect con la misma apariencia de TextField (label uppercase).
import { CitySelect } from "./CitySelect";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
  variant?: "light" | "dark";
}

export function CityField({ label, value, onChange, required, className, placeholder, variant = "light" }: Props) {
  const dark = variant === "dark";
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span
        className="text-xs font-medium tracking-wide uppercase"
        style={{ color: dark ? "var(--nuvia-text-secondary)" : undefined }}
      >
        <span className={dark ? "" : "text-[#242424]/70"}>{label}</span>
        {required && <span className="text-[#C0392B]"> *</span>}
      </span>
      <CitySelect value={value || ""} onChange={onChange} required={required} placeholder={placeholder} variant={variant} />
    </label>
  );
}

export default CityField;
