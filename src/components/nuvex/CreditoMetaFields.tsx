import { ProductoBancarioSelect } from "./ProductoBancarioSelect";
import { TextField } from "./ui";
import type { ClientData } from "./ClientFields";
import type { ModalidadCat } from "@/lib/productosBancarios";

interface Props {
  data: ClientData;
  onChange: (next: ClientData) => void;
  cuotasPendientes: number;
  modalidad?: ModalidadCat;
}

/**
 * Campos descriptivos del crédito (banco, producto, número, plazo, cuotas).
 * Se renderiza dentro del bloque "Datos del crédito" de cada simulador.
 */
export function CreditoMetaFields({ data, onChange, cuotasPendientes, modalidad }: Props) {
  const set = <K extends keyof ClientData>(k: K, v: ClientData[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <div className="space-y-4">
      <ProductoBancarioSelect
        banco={data.banco}
        producto={data.tipoProducto}
        filtrarPorModalidad={modalidad}
        onChange={({ banco, producto, productoId }) =>
          onChange({ ...data, banco, tipoProducto: producto, productoBancarioId: productoId })
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <TextField
          label="Número de crédito"
          value={data.numeroCredito}
          onChange={(v) => set("numeroCredito", v)}
        />
        <TextField
          label="Plazo inicial aprobado (meses)"
          value={data.plazoInicial}
          onChange={(v) => set("plazoInicial", v)}
          placeholder="240"
        />
        <TextField
          label="Cuotas pagadas"
          value={data.cuotasPagadas}
          onChange={(v) => set("cuotasPagadas", v)}
          placeholder="36"
        />
        <TextField
          label="Cuotas pendientes"
          value={String(cuotasPendientes)}
          readOnly
          hint="Calculado automáticamente"
        />
      </div>
    </div>
  );
}
