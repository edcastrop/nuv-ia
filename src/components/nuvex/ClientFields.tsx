import { ProductoBancarioSelect } from "./ProductoBancarioSelect";
import { TextField } from "./ui";
import { ClientCedulaButton, type ClientCedulaPayload } from "./ClientCedulaButton";
import { DepartamentoSelect, MunicipioSelect } from "@/components/ui/LocationSelects";
import { departamentoDeMunicipio } from "@/lib/colombiaLocations";
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
  cuotasPendientes?: string;
  porcentajeHonorarios: string;
  // Nuevos campos comerciales
  correo?: string;
  celular?: string;
  fechaDesembolso?: string;
  lugarExpedicionCedula?: string; // etiqueta combinada "Municipio, Ciudad, Departamento"
  lugarExpedicionDepartamento?: string;
  lugarExpedicionCiudad?: string;
  lugarExpedicionMunicipio?: string;
  fechaExpedicionCedula?: string;
  // Ubicación del cliente
  direccion?: string;
  departamento?: string;
  ciudad?: string;
  municipio?: string;
  // Aditivos opcionales (persistidos en cliente_data jsonb)
  intervinientes?: Interviniente[];
  cobertura?: Cobertura;
}

export function ClientFields({
  data,
  onChange,
  cuotasPendientes,
  modalidad,
  hideCreditFields = false,
}: {
  data: ClientData;
  onChange: (next: ClientData) => void;
  /** @deprecated lista heredada — ignorada; ahora se carga del catálogo. */
  productos?: string[];
  cuotasPendientes: number;
  /** Restringe el catálogo a Pesos o UVR según el simulador. */
  modalidad?: ModalidadCat;
  /** Oculta banco/producto/número/plazo/cuotas — viven en "Datos del crédito". */
  hideCreditFields?: boolean;
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

        <div>
          <label className="block text-xs font-medium text-[#242424]/70 mb-1">
            Lugar de expedición de la cédula
          </label>
          <div className="space-y-1.5 rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-2">
            <DepartamentoSelect
              value={data.lugarExpedicionDepartamento ?? ""}
              onChange={(v) =>
                onChange({
                  ...data,
                  lugarExpedicionDepartamento: v,
                  lugarExpedicionCiudad: "",
                  lugarExpedicionMunicipio: "",
                  lugarExpedicionCedula: v,
                })
              }
            />
            <MunicipioSelect
              departamento={data.lugarExpedicionDepartamento ?? ""}
              value={data.lugarExpedicionCiudad ?? ""}
              onChange={(v) => {
                const dep =
                  data.lugarExpedicionDepartamento ||
                  departamentoDeMunicipio(v);
                onChange({
                  ...data,
                  lugarExpedicionDepartamento: dep,
                  lugarExpedicionCiudad: v,
                  lugarExpedicionCedula: [data.lugarExpedicionMunicipio, v, dep]
                    .filter(Boolean)
                    .join(", "),
                });
              }}
              placeholder="Ciudad…"
            />
            <MunicipioSelect
              departamento={data.lugarExpedicionDepartamento ?? ""}
              value={data.lugarExpedicionMunicipio ?? ""}
              onChange={(v) => {
                const dep =
                  data.lugarExpedicionDepartamento ||
                  departamentoDeMunicipio(v);
                onChange({
                  ...data,
                  lugarExpedicionDepartamento: dep,
                  lugarExpedicionMunicipio: v,
                  lugarExpedicionCedula: [v, data.lugarExpedicionCiudad, dep]
                    .filter(Boolean)
                    .join(", "),
                });
              }}
              placeholder="Municipio…"
            />
          </div>
        </div>
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
        {!hideCreditFields && (
          <TextField
            label="Número de crédito"
            value={data.numeroCredito}
            onChange={(v) => set("numeroCredito", v)}
          />
        )}
        <TextField
          label="Asesor NUVEX"
          value={data.asesor}
          onChange={(v) => set("asesor", v)}
        />

        {!hideCreditFields && (
          <>
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
          </>
        )}
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

        <div className="md:col-span-3">
          <TextField
            label="Dirección de residencia"
            value={data.direccion ?? ""}
            onChange={(v) => set("direccion", v)}
            placeholder="Calle 123 # 45-67, Apto 101"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#242424]/70 mb-1">
            Departamento
          </label>
          <DepartamentoSelect
            value={data.departamento ?? ""}
            onChange={(v) =>
              onChange({ ...data, departamento: v, ciudad: "", municipio: "" })
            }
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#242424]/70 mb-1">
            Ciudad
          </label>
          <MunicipioSelect
            departamento={data.departamento ?? ""}
            value={data.ciudad ?? ""}
            onChange={(v) => {
              const dep = data.departamento || departamentoDeMunicipio(v);
              onChange({ ...data, departamento: dep, ciudad: v });
            }}
            placeholder="Selecciona ciudad…"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#242424]/70 mb-1">
            Municipio
          </label>
          <MunicipioSelect
            departamento={data.departamento ?? ""}
            value={data.municipio ?? ""}
            onChange={(v) => {
              const dep = data.departamento || departamentoDeMunicipio(v);
              onChange({ ...data, departamento: dep, municipio: v });
            }}
            placeholder="Selecciona municipio…"
          />
        </div>
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
  cuotasPendientes: "",
  porcentajeHonorarios: "6",
  correo: "",
  celular: "",
  fechaDesembolso: "",
  lugarExpedicionCedula: "",
  lugarExpedicionDepartamento: "",
  lugarExpedicionCiudad: "",
  lugarExpedicionMunicipio: "",
  fechaExpedicionCedula: "",
  direccion: "",
  departamento: "",
  ciudad: "",
  municipio: "",
};
