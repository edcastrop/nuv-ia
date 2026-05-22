import { BANCOS } from "./constants";
import { SelectField, TextField } from "./ui";
import type { Cobertura, Interviniente } from "./intervinientes";

export interface ClientData {
  nombre: string;
  cedula: string;
  numeroCredito: string;
  banco: string;
  tipoProducto: string;
  asesor: string;
  plazoInicial: string;
  cuotasPagadas: string;
  porcentajeHonorarios: string;
  // Aditivos opcionales (persistidos en cliente_data jsonb)
  intervinientes?: Interviniente[];
  cobertura?: Cobertura;
}

export function ClientFields({
  data,
  onChange,
  productos,
  cuotasPendientes,
}: {
  data: ClientData;
  onChange: (next: ClientData) => void;
  productos: string[];
  cuotasPendientes: number;
}) {
  const set = <K extends keyof ClientData>(k: K, v: ClientData[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <TextField label="Nombre del cliente" value={data.nombre} onChange={(v) => set("nombre", v)} />
      <TextField label="Número de cédula" value={data.cedula} onChange={(v) => set("cedula", v)} />
      <TextField label="Número de crédito" value={data.numeroCredito} onChange={(v) => set("numeroCredito", v)} />
      <SelectField label="Banco" value={data.banco} onChange={(v) => set("banco", v)} options={BANCOS} />
      <SelectField label="Tipo de producto" value={data.tipoProducto} onChange={(v) => set("tipoProducto", v)} options={productos} className="md:col-span-2" />
      <TextField label="Asesor NUVEX" value={data.asesor} onChange={(v) => set("asesor", v)} />
      <TextField label="Plazo inicial aprobado (meses)" value={data.plazoInicial} onChange={(v) => set("plazoInicial", v)} placeholder="240" />
      <TextField label="Cuotas pagadas" value={data.cuotasPagadas} onChange={(v) => set("cuotasPagadas", v)} placeholder="36" />
      <TextField label="Cuotas pendientes" value={String(cuotasPendientes)} readOnly hint="Calculado automáticamente" />
      <TextField label="Honorarios NUVEX (%)" value={data.porcentajeHonorarios} onChange={(v) => set("porcentajeHonorarios", v)} placeholder="6" />
    </div>
  );
}

export const defaultClient: ClientData = {
  nombre: "",
  cedula: "",
  numeroCredito: "",
  banco: "",
  tipoProducto: "",
  asesor: "",
  plazoInicial: "",
  cuotasPagadas: "",
  porcentajeHonorarios: "6",
};
