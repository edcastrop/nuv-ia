// Wrapper de CitySelect con la misma apariencia de TextField (label uppercase).
import { CitySelect } from "./CitySelect";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export function CityField({ label, value, onChange, required, className, placeholder }: Props) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs font-medium tracking-wide text-[#242424]/70 uppercase">
        {label}{required && <span className="text-[#C0392B]"> *</span>}
      </span>
      <CitySelect value={value || ""} onChange={onChange} required={required} placeholder={placeholder} />
    </label>
  );
}

export default CityField;
