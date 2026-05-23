import { useState } from "react";
import { Card, TextField, SelectField, SectionTitle } from "@/components/nuvex/ui";
import { CityField } from "@/components/ui/CityField";
import { NUVEX } from "@/components/nuvex/constants";
import { withFreshDerivados, FRESH_TIPOS, type FreshTipoBeneficio } from "@/lib/cobertura";
import type {
  ClienteMaestro, CotitularMaestro, CreditoMaestro,
  AsesorMaestro, LicenciadoMaestro, ApoderadoMaestro,
} from "@/lib/expedienteMaestro";
import type { CoberturaFresh } from "@/lib/proyeccion";
import { ChevronDown } from "lucide-react";

function Accordion({
  title, subtitle, defaultOpen = true, children,
}: { title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
            Sección
          </div>
          <h3 className="text-lg font-semibold text-[#242424]">{title}</h3>
          {subtitle && <p className="text-xs text-[#242424]/60 mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDown
          size={20}
          style={{ color: NUVEX.azul, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </button>
      {open && <div className="mt-5">{children}</div>}
    </Card>
  );
}

const ESTADOS_CIVIL = ["Soltero(a)", "Casado(a)", "Unión libre", "Divorciado(a)", "Viudo(a)"];
const PRODUCTOS = ["Pesos", "UVR"];
const TIPOS_DOC = ["CC", "CE", "PA", "TI", "NIT"];

interface Props {
  cliente: ClienteMaestro;
  cotitular: CotitularMaestro;
  credito: CreditoMaestro;
  fresh: CoberturaFresh;
  asesor: AsesorMaestro;
  licenciado: LicenciadoMaestro;
  apoderado: ApoderadoMaestro;
  onCliente: (v: ClienteMaestro) => void;
  onCotitular: (v: CotitularMaestro) => void;
  onCredito: (v: CreditoMaestro) => void;
  onFresh: (v: CoberturaFresh) => void;
  onAsesor: (v: AsesorMaestro) => void;
  onLicenciado: (v: LicenciadoMaestro) => void;
  onApoderado: (v: ApoderadoMaestro) => void;
}

export function MaestroEditor(p: Props) {
  const set = <T, K extends keyof T>(obj: T, k: K, v: T[K]) => ({ ...obj, [k]: v });

  return (
    <div className="space-y-4">
      <Accordion title="Datos del cliente" subtitle="Información personal del titular">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <TextField label="Nombre completo" value={p.cliente.nombre} onChange={(v) => p.onCliente(set(p.cliente, "nombre", v))} />
          <TextField label="Cédula" value={p.cliente.cedula} onChange={(v) => p.onCliente(set(p.cliente, "cedula", v))} />
          <TextField label="Expedida en" value={p.cliente.expedidaEn} onChange={(v) => p.onCliente(set(p.cliente, "expedidaEn", v))} />
          <TextField label="Fecha de nacimiento" value={p.cliente.fechaNacimiento} placeholder="DD/MM/AAAA" onChange={(v) => p.onCliente(set(p.cliente, "fechaNacimiento", v))} />
          <SelectField label="Estado civil" value={p.cliente.estadoCivil} options={ESTADOS_CIVIL} onChange={(v) => p.onCliente(set(p.cliente, "estadoCivil", v))} />
          <TextField label="Profesión" value={p.cliente.profesion} onChange={(v) => p.onCliente(set(p.cliente, "profesion", v))} />
          <TextField label="Teléfono" value={p.cliente.telefono} onChange={(v) => p.onCliente(set(p.cliente, "telefono", v))} />
          <TextField label="Email" value={p.cliente.email} onChange={(v) => p.onCliente(set(p.cliente, "email", v))} />
          <CityField label="Ciudad" value={p.cliente.ciudad} onChange={(v) => p.onCliente(set(p.cliente, "ciudad", v))} />
          <TextField label="Dirección" value={p.cliente.direccion} onChange={(v) => p.onCliente(set(p.cliente, "direccion", v))} className="md:col-span-2 lg:col-span-3" />
        </div>
      </Accordion>

      <Accordion title="Datos del cotitular" subtitle="Solo si el crédito tiene cotitular" defaultOpen={false}>
        <label className="flex items-center gap-2 mb-4 text-sm text-[#242424]">
          <input type="checkbox" checked={p.cotitular.activo} onChange={(e) => p.onCotitular(set(p.cotitular, "activo", e.target.checked))} />
          <span>El crédito tiene cotitular</span>
        </label>
        {p.cotitular.activo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextField label="Nombre completo" value={p.cotitular.nombre} onChange={(v) => p.onCotitular(set(p.cotitular, "nombre", v))} />
            <TextField label="Cédula" value={p.cotitular.cedula} onChange={(v) => p.onCotitular(set(p.cotitular, "cedula", v))} />
            <TextField label="Parentesco / Relación" value={p.cotitular.parentesco} onChange={(v) => p.onCotitular(set(p.cotitular, "parentesco", v))} />
            <TextField label="Expedida en" value={p.cotitular.expedidaEn} onChange={(v) => p.onCotitular(set(p.cotitular, "expedidaEn", v))} />
            <TextField label="Fecha de nacimiento" value={p.cotitular.fechaNacimiento} placeholder="DD/MM/AAAA" onChange={(v) => p.onCotitular(set(p.cotitular, "fechaNacimiento", v))} />
            <SelectField label="Estado civil" value={p.cotitular.estadoCivil} options={ESTADOS_CIVIL} onChange={(v) => p.onCotitular(set(p.cotitular, "estadoCivil", v))} />
            <TextField label="Profesión" value={p.cotitular.profesion} onChange={(v) => p.onCotitular(set(p.cotitular, "profesion", v))} />
            <TextField label="Teléfono" value={p.cotitular.telefono} onChange={(v) => p.onCotitular(set(p.cotitular, "telefono", v))} />
            <TextField label="Email" value={p.cotitular.email} onChange={(v) => p.onCotitular(set(p.cotitular, "email", v))} />
            <CityField label="Ciudad" value={p.cotitular.ciudad} onChange={(v) => p.onCotitular(set(p.cotitular, "ciudad", v))} />
            <TextField label="Dirección" value={p.cotitular.direccion} onChange={(v) => p.onCotitular(set(p.cotitular, "direccion", v))} className="md:col-span-2 lg:col-span-3" />
          </div>
        )}
      </Accordion>

      <Accordion title="Información jurídica" subtitle="Datos requeridos para generar Poder Especial y documentos legales">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Estos datos alimentan los documentos jurídicos (Poder Especial, Tutela, Derecho de Petición). Si fueron leídos del extracto por OCR aparecerán precargados; complétalos manualmente si falta alguno.
        </div>

        <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: NUVEX.azul }}>
          Titular
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <SelectField label="Tipo de documento" value={p.cliente.tipoDocumento || "CC"} options={TIPOS_DOC} onChange={(v) => p.onCliente(set(p.cliente, "tipoDocumento", v))} />
          <TextField label="Número de documento" value={p.cliente.cedula} onChange={(v) => p.onCliente(set(p.cliente, "cedula", v))} />
          <TextField label="Lugar de expedición" value={p.cliente.expedidaEn} onChange={(v) => p.onCliente(set(p.cliente, "expedidaEn", v))} />
          <TextField label="Fecha de expedición" value={p.cliente.fechaExpedicion || ""} placeholder="DD/MM/AAAA" onChange={(v) => p.onCliente(set(p.cliente, "fechaExpedicion", v))} />
          <CityField label="Ciudad de residencia" value={p.cliente.ciudad} onChange={(v) => p.onCliente(set(p.cliente, "ciudad", v))} required />
          <TextField label="Departamento" value={p.cliente.departamento || ""} onChange={(v) => p.onCliente(set(p.cliente, "departamento", v))} />
          <TextField label="Correo electrónico" value={p.cliente.email} onChange={(v) => p.onCliente(set(p.cliente, "email", v))} />
          <TextField label="Celular" value={p.cliente.telefono} onChange={(v) => p.onCliente(set(p.cliente, "telefono", v))} />
          <TextField label="Dirección" value={p.cliente.direccion} onChange={(v) => p.onCliente(set(p.cliente, "direccion", v))} className="md:col-span-2 lg:col-span-3" />
        </div>

        {p.cotitular.activo && (
          <>
            <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: NUVEX.azul }}>
              Cotitular / Colocatario
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <SelectField label="Tipo de documento" value={p.cotitular.tipoDocumento || "CC"} options={TIPOS_DOC} onChange={(v) => p.onCotitular(set(p.cotitular, "tipoDocumento", v))} />
              <TextField label="Número de documento" value={p.cotitular.cedula} onChange={(v) => p.onCotitular(set(p.cotitular, "cedula", v))} />
              <TextField label="Lugar de expedición" value={p.cotitular.expedidaEn} onChange={(v) => p.onCotitular(set(p.cotitular, "expedidaEn", v))} />
              <TextField label="Fecha de expedición" value={p.cotitular.fechaExpedicion || ""} placeholder="DD/MM/AAAA" onChange={(v) => p.onCotitular(set(p.cotitular, "fechaExpedicion", v))} />
              <TextField label="Ciudad de residencia" value={p.cotitular.ciudad} onChange={(v) => p.onCotitular(set(p.cotitular, "ciudad", v))} />
              <TextField label="Departamento" value={p.cotitular.departamento || ""} onChange={(v) => p.onCotitular(set(p.cotitular, "departamento", v))} />
              <TextField label="Correo electrónico" value={p.cotitular.email} onChange={(v) => p.onCotitular(set(p.cotitular, "email", v))} />
              <TextField label="Celular" value={p.cotitular.telefono} onChange={(v) => p.onCotitular(set(p.cotitular, "telefono", v))} />
              <TextField label="Dirección" value={p.cotitular.direccion} onChange={(v) => p.onCotitular(set(p.cotitular, "direccion", v))} className="md:col-span-2 lg:col-span-3" />
            </div>
          </>
        )}
      </Accordion>

      <Accordion title="Datos del crédito" subtitle="Información financiera vigente">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <TextField label="Banco" value={p.credito.banco} onChange={(v) => p.onCredito(set(p.credito, "banco", v))} />
          <TextField label="Número de crédito" value={p.credito.numeroCredito} onChange={(v) => p.onCredito(set(p.credito, "numeroCredito", v))} />
          <SelectField label="Tipo de producto" value={p.credito.tipoProducto} options={PRODUCTOS} onChange={(v) => p.onCredito(set(p.credito, "tipoProducto", v))} />
          <TextField label="Fecha de desembolso" value={p.credito.fechaDesembolso} placeholder="DD/MM/AAAA" onChange={(v) => p.onCredito(set(p.credito, "fechaDesembolso", v))} />
          <TextField label="Plazo original (meses)" value={p.credito.plazoOriginal} onChange={(v) => p.onCredito(set(p.credito, "plazoOriginal", v))} />
          <TextField label="Saldo capital" value={p.credito.saldoCapital} onChange={(v) => p.onCredito(set(p.credito, "saldoCapital", v))} />
          <TextField label="Cuota actual" value={p.credito.cuotaActual} onChange={(v) => p.onCredito(set(p.credito, "cuotaActual", v))} />
          <TextField label="Tasa (% EA)" value={p.credito.tasa} onChange={(v) => p.onCredito(set(p.credito, "tasa", v))} />
          <TextField label="Cuotas pagadas" value={p.credito.cuotasPagadas} onChange={(v) => p.onCredito(set(p.credito, "cuotasPagadas", v))} />
          <TextField label="Cuotas pendientes" value={p.credito.cuotasPendientes} onChange={(v) => p.onCredito(set(p.credito, "cuotasPendientes", v))} />
        </div>
      </Accordion>

      <Accordion title="Datos Fresh / Cobertura" subtitle="Subsidio o beneficio de tasa (FRECH, VIS, Mi Casa Ya...)">
        <label className="flex items-center gap-2 mb-4 text-sm text-[#242424]">
          <input
            type="checkbox"
            checked={p.fresh.activo}
            onChange={(e) => p.onFresh(withFreshDerivados({ ...p.fresh, activo: e.target.checked }))}
          />
          <span>El crédito tiene beneficio de cobertura activo</span>
        </label>
        {p.fresh.activo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SelectField
              label="Tipo de beneficio"
              value={p.fresh.tipoBeneficio ?? ""}
              options={FRESH_TIPOS.map((t) => t.label)}
              onChange={(label) => {
                const tipo = FRESH_TIPOS.find((t) => t.label === label)?.value as FreshTipoBeneficio | undefined;
                if (!tipo) return;
                p.onFresh(withFreshDerivados({ ...p.fresh, tipoBeneficio: tipo }));
              }}
            />
            <TextField
              label="Valor mensual"
              value={String(p.fresh.valorMensual || "")}
              onChange={(v) => p.onFresh(withFreshDerivados({ ...p.fresh, valorMensual: Number(v.replace(/[^\d.]/g, "")) || 0 }))}
            />
            <TextField
              label="Tasa cobertura (%)"
              value={String(p.fresh.tasa || "")}
              onChange={(v) => p.onFresh(withFreshDerivados({ ...p.fresh, tasa: Number(v.replace(/[^\d.]/g, "")) || 0 }))}
            />
            <TextField
              label="Cuotas totales Fresh"
              value={String(p.fresh.cuotasTotales || 84)}
              onChange={(v) => p.onFresh(withFreshDerivados({ ...p.fresh, cuotasTotales: Number(v.replace(/\D/g, "")) || 84 }))}
            />
            <TextField
              label="Cuotas Fresh pagadas"
              value={String(p.fresh.cuotasPagadas || 0)}
              onChange={(v) => p.onFresh(withFreshDerivados({ ...p.fresh, cuotasPagadas: Number(v.replace(/\D/g, "")) || 0 }))}
            />
            <TextField label="Cuotas Fresh pendientes" value={String(p.fresh.cuotasPendientes)} readOnly />
            <TextField label="Beneficio recibido" value={(p.fresh.beneficioRecibido ?? 0).toLocaleString("es-CO")} readOnly />
            <TextField label="Beneficio restante" value={(p.fresh.beneficioRestante ?? 0).toLocaleString("es-CO")} readOnly />
          </div>
        )}
      </Accordion>

      <Accordion title="Datos del asesor" subtitle="Asesor NUVEX responsable del caso" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <TextField label="Nombre" value={p.asesor.nombre} onChange={(v) => p.onAsesor(set(p.asesor, "nombre", v))} />
          <TextField label="Cédula" value={p.asesor.cedula} onChange={(v) => p.onAsesor(set(p.asesor, "cedula", v))} />
          <TextField label="Código asesor" value={p.asesor.codigo} onChange={(v) => p.onAsesor(set(p.asesor, "codigo", v))} />
          <TextField label="Teléfono" value={p.asesor.telefono} onChange={(v) => p.onAsesor(set(p.asesor, "telefono", v))} />
          <TextField label="Email" value={p.asesor.email} onChange={(v) => p.onAsesor(set(p.asesor, "email", v))} />
        </div>
      </Accordion>

      <Accordion title="Datos del licenciado" subtitle="Profesional que autoriza la propuesta" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <TextField label="Nombre" value={p.licenciado.nombre} onChange={(v) => p.onLicenciado(set(p.licenciado, "nombre", v))} />
          <TextField label="Cédula profesional" value={p.licenciado.cedulaProfesional} onChange={(v) => p.onLicenciado(set(p.licenciado, "cedulaProfesional", v))} />
          <TextField label="Teléfono" value={p.licenciado.telefono} onChange={(v) => p.onLicenciado(set(p.licenciado, "telefono", v))} />
          <TextField label="Email" value={p.licenciado.email} onChange={(v) => p.onLicenciado(set(p.licenciado, "email", v))} />
        </div>
      </Accordion>

      <Accordion title="Datos del apoderado" subtitle="Representante legal para gestión bancaria" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <TextField label="Nombre" value={p.apoderado.nombre} onChange={(v) => p.onApoderado(set(p.apoderado, "nombre", v))} />
          <TextField label="Cédula" value={p.apoderado.cedula} onChange={(v) => p.onApoderado(set(p.apoderado, "cedula", v))} />
          <TextField label="Teléfono" value={p.apoderado.telefono} onChange={(v) => p.onApoderado(set(p.apoderado, "telefono", v))} />
          <TextField label="Email" value={p.apoderado.email} onChange={(v) => p.onApoderado(set(p.apoderado, "email", v))} />
          <TextField label="Ciudad" value={p.apoderado.ciudad} onChange={(v) => p.onApoderado(set(p.apoderado, "ciudad", v))} />
          <TextField label="Número de poder" value={p.apoderado.numeroPoder} onChange={(v) => p.onApoderado(set(p.apoderado, "numeroPoder", v))} />
          <TextField label="Fecha de poder" value={p.apoderado.fechaPoder} placeholder="DD/MM/AAAA" onChange={(v) => p.onApoderado(set(p.apoderado, "fechaPoder", v))} />
          <TextField label="Dirección" value={p.apoderado.direccion} onChange={(v) => p.onApoderado(set(p.apoderado, "direccion", v))} className="md:col-span-2 lg:col-span-3" />
        </div>
      </Accordion>

      <div className="flex justify-end">
        <SectionTitle>&nbsp;</SectionTitle>
      </div>
    </div>
  );
}
