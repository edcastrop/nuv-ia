import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * NUVIA · Inputs estándar (fuente: Login/Registro).
 * Garantiza el mismo estilo en TODOS los formularios del ERP.
 */

type InputProps = InputHTMLAttributes<HTMLInputElement>;
export const NuviaInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...rest }, ref) => (
    <input ref={ref} className={`nuvia-input ${className}`} {...rest} />
  ),
);
NuviaInput.displayName = "NuviaInput";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export const NuviaTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...rest }, ref) => (
    <textarea
      ref={ref}
      className={`nuvia-input ${className}`}
      style={{ minHeight: 96, resize: "vertical" }}
      {...rest}
    />
  ),
);
NuviaTextarea.displayName = "NuviaTextarea";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;
export const NuviaSelect = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", children, ...rest }, ref) => (
    <select ref={ref} className={`nuvia-input ${className}`} {...rest}>
      {children}
    </select>
  ),
);
NuviaSelect.displayName = "NuviaSelect";

/**
 * NuviaField — label compacto + slot para input/control + slot lateral derecho.
 */
export function NuviaField({
  label,
  right,
  children,
}: {
  label: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="nuvia-label">{label}</span>
        {right}
      </div>
      {children}
    </label>
  );
}
