import { ProductoBancarioSelect } from "./ProductoBancarioSelect";
import { TextField } from "./ui";
import { ClientCedulaButton, type ClientCedulaPayload } from "./ClientCedulaButton";
import type { ModalidadCat } from "@/lib/productosBancarios";
import type { Cobertura, Interviniente } from "./intervinientes";

export interface ClientData {
  nombre: string;
  cedula: string;
  numeroCredito: string;
  banco: string;
  tipoProducto: string;
  productoBancarioId?: string | null;
  asesor: string;
  plazoInicial: string;
  cuotasPagadas: string;
  porcentajeHonorarios: string;
  // Nuevos campos comerciales
  correo?: string;
  celular?: string;
  fechaDesembolso?: string;
  lugarExpedicionCedula?: string;
  fechaExpedicionCedula?: string;
  // Aditivos opcionales (persistidos en cliente_data jsonb)
  intervinientes?: Interviniente[];
  cobertura?: Cobertura;
}

export function ClientFields({
  data,
  onChange,
  cuotasPendientes,
  modalidad,
}: {
  data: ClientData;
  onChange: (next: ClientData) => void;
  /** @deprecated lista heredada — ignorada; ahora se carga del catálogo. */
  productos?: string[];
  cuotasPendientes: number;
  /** Restringe el catálogo a Pesos o UVR según el simulador. */
  modalidad?: ModalidadCat;
}) {
  const set = <K extends keyof ClientData>(k: K, v: ClientData[K]) =>
    onChange({ ...data, [k]: v });

  const handleCedulaAI = (p: ClientCedulaPayload) => {
    onChange({
      ...data,
      nombre: p.nombre || data.nombre,
      cedula: p.cedula || data.cedula,
      lugarExpedicionCedula: p.lugarExpedicion || data.lugarExpedicionCedula,
      fechaExpedicionCedula: p.fechaExpedicion || data.fechaExpedicionCedula,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ClientCedulaButton onApply={handleCedulaAI} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TextField label="Nombre completo" value={data.nombre} onChange={(v) => set("nombre", v)} />
        <TextField label="Número de cédula" value={data.cedula} onChange={(v) => set("cedula", v)} />
        <TextField
          label="Correo electrónico"
          value={data.correo ?? ""}
          onChange={(v) => set("correo", v)}
          placeholder="cliente@correo.com"
        />
        <TextField
          label="Celular"
          value={data.celular ?? ""}
          onChange={(v) => set("celular", v)}
          placeholder="3001234567"
        />
        <TextField
          label="Número de crédito"
          value={data.numeroCredito}
          onChange={(v) => set("numeroCredito", v)}
        />
        <TextField
          label="Asesor NUVEX"
          value={data.asesor}
          onChange={(v) => set("asesor", v)}
        />

        <div className="md:col-span-3">
          <ProductoBancarioSelect
            banco={data.banco}
            producto={data.tipoProducto}
            filtrarPorModalidad={modalidad}
            onChange={({ banco, producto, productoId }) =>
              onChange({ ...data, banco, tipoProducto: producto, productoBancarioId: productoId })
            }
          />
        </div>

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
        <TextField
          label="Honorarios NUVEX (%)"
          value={data.porcentajeHonorarios}
          onChange={(v) => set("porcentajeHonorarios", v)}
          placeholder="6"
        />
        <TextField
          label="Fecha desembolso"
          value={data.fechaDesembolso ?? ""}
          onChange={(v) => set("fechaDesembolso", v)}
          placeholder="YYYY-MM-DD"
        />
      </div>
    </div>
  );
}

export const defaultClient: ClientData = {
  nombre: "",
  cedula: "",
  numeroCredito: "",
  banco: "",
  tipoProducto: "",
  productoBancarioId: null,
  asesor: "",
  plazoInicial: "",
  cuotasPagadas: "",
  porcentajeHonorarios: "6",
  correo: "",
  celular: "",
  fechaDesembolso: "",
  lugarExpedicionCedula: "",
  fechaExpedicionCedula: "",
};
