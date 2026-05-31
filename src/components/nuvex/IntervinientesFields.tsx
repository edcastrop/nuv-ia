import { useEffect } from "react";
import { SectionTitle, TextField } from "./ui";
import { NUVEX } from "./constants";
import {
  defaultInterviniente,
  isLeasing,
  reasignarRoles,
  rolCotitular,
  rolTitular,
  type Interviniente,
} from "./intervinientes";
import { CedulaReader } from "./CedulaReader";

interface Props {
  producto?: string | null;
  data: Interviniente[];
  onChange: (next: Interviniente[]) => void;
  /** Sincroniza nombre/cédula del titular en los campos de cliente al leer la cédula. */
  onTitularSync?: (nombre: string, cedula: string) => void;
}

export function IntervinientesFields({ producto, data, onChange, onTitularSync }: Props) {
  const leasing = isLeasing(producto);
  const rolT = rolTitular(producto);
  const rolC = rolCotitular(producto);

  // Si cambia el producto (entre hipotecario y leasing) y los roles ya no coinciden,
  // los actualizamos automáticamente.
  useEffect(() => {
    if (!data.length) return;
    const expected0 = rolT;
    const expectedRest = rolC;
    const mismatch =
      data[0].rol !== expected0 ||
      data.slice(1).some((i) => i.rol !== expectedRest);
    if (mismatch) onChange(reasignarRoles(data, producto));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto]);

  const list = data.length ? data : [defaultInterviniente(rolT)];

  const update = (idx: number, patch: Partial<Interviniente>) => {
    const next = list.map((i, k) => (k === idx ? { ...i, ...patch } : i));
    onChange(next);
  };

  const add = () => {
    onChange([...list, defaultInterviniente(rolC)]);
  };

  const remove = (idx: number) => {
    if (idx === 0) return;
    onChange(list.filter((_, k) => k !== idx));
  };

  const titular = list[0];

  return (
    <div className="space-y-4">
      <SectionTitle sub={leasing ? "Locatario y colocatarios del contrato de leasing habitacional" : "Titular y cotitulares del crédito hipotecario"}>
        Datos de los intervinientes
      </SectionTitle>

      <CedulaReader
        intervinientes={list}
        producto={producto}
        onApply={(next) => onChange(next)}
        onTitularSync={onTitularSync}
      />

      {list.map((p, idx) => {
        const isTitular = idx === 0;
        const sameAsTitular =
          !isTitular &&
          !!titular.direccion &&
          p.direccion === titular.direccion;
        return (
          <div
            key={idx}
            className="rounded-xl border p-4"
            style={{
              borderColor: isTitular ? NUVEX.azul : "#E3E7EE",
              backgroundColor: isTitular ? "#F4F6FC" : NUVEX.gris,
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: isTitular ? NUVEX.azul : NUVEX.negro }}
              >
                {isTitular ? p.rol : `${p.rol} ${idx}`}
              </div>
              {!isTitular && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="rounded-md px-2 py-1 text-[11px] font-medium"
                  style={{ backgroundColor: NUVEX.rojoBg, color: NUVEX.rojoTexto }}
                >
                  Eliminar
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Nombre completo"
                value={p.nombreCompleto}
                onChange={(v) => update(idx, { nombreCompleto: v })}
              />
              <TextField
                label="Número de cédula"
                value={p.cedula}
                onChange={(v) => update(idx, { cedula: v })}
              />
              <TextField
                label="Lugar de expedición de la cédula"
                value={p.lugarExpedicionCedula}
                onChange={(v) => update(idx, { lugarExpedicionCedula: v })}
                placeholder="Bogotá D.C."
              />
              <TextField
                label="Dirección"
                value={p.direccion}
                onChange={(v) => update(idx, { direccion: v })}
                placeholder="Calle 123 # 45-67"
              />
            </div>

            {!isTitular && (
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[#242424]/75">
                <input
                  type="checkbox"
                  checked={sameAsTitular}
                  onChange={(e) => {
                    if (e.target.checked) update(idx, { direccion: titular.direccion });
                    else update(idx, { direccion: "" });
                  }}
                  className="h-4 w-4 rounded border-[#E3E7EE]"
                />
                La dirección del {p.rol.toLowerCase()} es la misma del {rolT.toLowerCase()}
              </label>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="rounded-lg border px-3 py-2 text-xs font-semibold"
        style={{ borderColor: NUVEX.azul, color: NUVEX.azul, backgroundColor: "#fff" }}
      >
        + Agregar {rolC.toLowerCase()}
      </button>
    </div>
  );
}
