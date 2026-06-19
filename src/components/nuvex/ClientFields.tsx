import { ProductoBancarioSelect } from "./ProductoBancarioSelect";
import { TextField } from "./ui";
import { ClientCedulaButton, type ClientCedulaPayload } from "./ClientCedulaButton";
import { DepartamentoSelect, MunicipioSelect } from "@/components/ui/LocationSelects";
import { departamentoDeMunicipio } from "@/lib/colombiaLocations";
import type { ModalidadCat } from "@/lib/productosBancarios";
import type { Cobertura, Interviniente } from "./intervinientes";
import type { IngresosCliente } from "./PerfilIngresosEnVivo";

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
  expedidaEn?: string;
  lugarExpedicionDepartamento?: string;
  lugarExpedicionCiudad?: string;
  lugarExpedicionMunicipio?: string;
  fechaExpedicionCedula?: string;
  fechaExpedicion?: string;
  tipoDocumento?: string;
  // Ubicación del cliente
  direccion?: string;
  departamento?: string;
  ciudad?: string;
  municipio?: string;
  // Aditivos opcionales (persistidos en cliente_data jsonb)
  intervinientes?: Interviniente[];
  informacionJuridica?: Record<string, unknown>;
  cobertura?: Cobertura;
  /** Perfil opcional del cliente para personalizar las analogías del abono inteligente. */
  perfil?: {
    tieneHijos?: boolean;
    tieneCarro?: boolean;
    leGustaViajar?: boolean;
    esEmprendedor?: boolean;
  };
  /** Perfil de ingresos capturado en vivo durante la llamada — alimenta la validación de capacidad 30%/40%. */
  ingresos?: IngresosCliente;
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
    const nombre = p.nombre || data.nombre;
    const cedula = p.cedula || data.cedula;
    const expedidaEn = p.lugarExpedicion || data.lugarExpedicionCedula || "";
    const fechaExpedicion = p.fechaExpedicion || data.fechaExpedicionCedula || "";
    const intervinientes = data.intervinientes?.length
      ? data.intervinientes.map((it, idx) => idx === 0 ? {
          ...it,
          nombreCompleto: nombre || it.nombreCompleto,
          cedula: cedula || it.cedula,
          lugarExpedicionCedula: expedidaEn || it.lugarExpedicionCedula,
        } : it)
      : [{ rol: "Titular" as const, nombreCompleto: nombre, cedula, lugarExpedicionCedula: expedidaEn, direccion: data.direccion || "" }];
    onChange({
      ...data,
      nombre,
      cedula,
      lugarExpedicionCedula: expedidaEn,
      expedidaEn,
      lugarExpedicionDepartamento: p.lugarExpedicionDepartamento || data.lugarExpedicionDepartamento,
      lugarExpedicionCiudad: p.lugarExpedicionCiudad || data.lugarExpedicionCiudad,
      lugarExpedicionMunicipio: p.lugarExpedicionMunicipio || data.lugarExpedicionMunicipio,
      fechaExpedicionCedula: fechaExpedicion,
      fechaExpedicion,
      tipoDocumento: "CC",
      intervinientes,
      informacionJuridica: {
        ...((data as unknown as { informacionJuridica?: Record<string, unknown> }).informacionJuridica ?? {}),
        titular: {
          ...(((data as unknown as { informacionJuridica?: { titular?: Record<string, unknown> } }).informacionJuridica?.titular) ?? {}),
          nombre,
          cedula,
          tipoDocumento: "CC",
          expedidaEn,
          fechaExpedicion,
          telefono: data.celular || "",
          email: data.correo || "",
          direccion: data.direccion || "",
          ciudad: data.ciudad || data.municipio || "",
          departamento: data.departamento || "",
        },
      },
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
          <label className="block text-xs font-medium mb-1" style={{ color: "rgba(225,232,248,0.65)" }}>
            Lugar de expedición de la cédula
          </label>
          <div className="space-y-1.5 rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
          <label className="block text-xs font-medium mb-1" style={{ color: "rgba(225,232,248,0.65)" }}>
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
          <label className="block text-xs font-medium mb-1" style={{ color: "rgba(225,232,248,0.65)" }}>
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
          <label className="block text-xs font-medium mb-1" style={{ color: "rgba(225,232,248,0.65)" }}>
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

      {/* Perfil del cliente — para personalizar las analogías del abono inteligente */}
      <PerfilClienteSection
        value={data.perfil ?? {}}
        onChange={(perfil) => onChange({ ...data, perfil })}
      />
    </div>
  );
}

function PerfilClienteSection({
  value,
  onChange,
}: {
  value: NonNullable<ClientData["perfil"]>;
  onChange: (next: NonNullable<ClientData["perfil"]>) => void;
}) {
  const toggle = (k: keyof NonNullable<ClientData["perfil"]>) =>
    onChange({ ...value, [k]: !value[k] });

  const items: Array<{ k: keyof NonNullable<ClientData["perfil"]>; label: string; emoji: string }> = [
    { k: "tieneHijos", label: "Tiene hijos", emoji: "👨‍👩‍👧" },
    { k: "tieneCarro", label: "Tiene carro", emoji: "🚗" },
    { k: "leGustaViajar", label: "Le gusta viajar", emoji: "✈️" },
    { k: "esEmprendedor", label: "Es emprendedor", emoji: "💼" },
  ];

  return (
    <div
      className="mt-4 rounded-xl border p-3"
      style={{
        background: "rgba(20,28,54,0.45)",
        borderColor: "rgba(255,255,255,0.10)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "#F6C453" }}
          >
            Perfil del cliente (opcional)
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: "rgba(230,236,255,0.6)" }}>
            Marca lo que aplique. Lo usamos para humanizar las propuestas con analogías personalizadas.
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {items.map((it) => {
          const active = !!value[it.k];
          return (
            <button
              key={it.k}
              type="button"
              onClick={() => toggle(it.k)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:scale-[1.03]"
              style={{
                background: active
                  ? "linear-gradient(135deg, rgba(246,196,83,0.22), rgba(132,185,143,0.18))"
                  : "rgba(20,28,54,0.55)",
                color: active ? "#FFE7A0" : "rgba(230,236,255,0.7)",
                borderColor: active ? "rgba(246,196,83,0.55)" : "rgba(255,255,255,0.14)",
              }}
            >
              <span>{it.emoji}</span> {it.label}
            </button>
          );
        })}
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
  expedidaEn: "",
  lugarExpedicionDepartamento: "",
  lugarExpedicionCiudad: "",
  lugarExpedicionMunicipio: "",
  fechaExpedicionCedula: "",
  fechaExpedicion: "",
  tipoDocumento: "CC",
  direccion: "",
  departamento: "",
  ciudad: "",
  municipio: "",
  perfil: {},
  ingresos: { tipoCredito: "NoVIS", ocupaciones: [], fuentes: [] },
};
