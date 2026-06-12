// Versión standalone del análisis de capacidad de pago (sin expediente).
// Pensada para analistas y comerciales que necesitan calcular el % de
// endeudamiento antes de construir el caso, para enviar propuestas al cliente.

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, X, ShieldCheck, AlertTriangle, AlertOctagon, FileText, Sparkles } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { analizarCapacidadPago, type AnalisisCapacidadResultado } from "@/lib/analisisCapacidad.functions";
import { unzipSync } from "fflate";

type TipoDoc = "nomina" | "carta_laboral" | "renta" | "extracto" | "otro";
type TipoPersona = "empleado_mensual" | "empleado_quincenal" | "independiente";
type Rol = "titular" | "codeudor";

type ArchivoLocal = {
  id: string;
  nombre: string;
  mime: string;
  size: number;
  tipo: TipoDoc;
  dataUrl: string;
};

type PersonaForm = {
  rol: Rol;
  tipoPersona: TipoPersona;
  archivos: ArchivoLocal[];
};

const MAX_BYTES = 10 * 1024 * 1024;
const ZIP_MAX_BYTES = 50 * 1024 * 1024;
const PLACEHOLDER_EXPEDIENTE_ID = "00000000-0000-0000-0000-000000000000";

function fileToDataUrl(f: File | Blob, nombre?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(f instanceof File ? f : new File([f], nombre || "file"));
  });
}

function mimeFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function isZip(f: File) {
  const n = f.name.toLowerCase();
  return n.endsWith(".zip") || f.type === "application/zip" || f.type === "application/x-zip-compressed";
}
function isCompressedUnsupported(f: File) {
  const n = f.name.toLowerCase();
  return n.endsWith(".rar") || n.endsWith(".7z") || n.endsWith(".tar") || n.endsWith(".gz");
}

function bytesToDataUrl(bytes: Uint8Array, mime: string) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function nuevaPersona(rol: Rol): PersonaForm {
  return { rol, tipoPersona: "empleado_mensual", archivos: [] };
}

function MinDocsHint({ tipo }: { tipo: TipoPersona }) {
  if (tipo === "empleado_mensual")
    return <p className="text-xs text-white/60">Requeridos: <b className="text-white/90">3 últimas nóminas mensuales</b> + carta laboral + última declaración de renta.</p>;
  if (tipo === "empleado_quincenal")
    return <p className="text-xs text-white/60">Requeridos: <b className="text-white/90">6 últimas nóminas quincenales</b> + carta laboral + última declaración de renta.</p>;
  return <p className="text-xs text-white/60">Requeridos: <b className="text-white/90">3 últimos extractos bancarios</b> + última declaración de renta.</p>;
}

function SemaforoBadge({ s }: { s: "verde" | "amarillo" | "rojo" | "sin_datos" }) {
  const map = {
    verde: { bg: "bg-emerald-500/90", label: "🟢 Aprobado por regla", Icon: ShieldCheck },
    amarillo: { bg: "bg-amber-500/90", label: "🟡 Marginal", Icon: AlertTriangle },
    rojo: { bg: "bg-red-600/90", label: "🔴 Excede política", Icon: AlertOctagon },
    sin_datos: { bg: "bg-white/20", label: "Sin datos", Icon: FileText },
  } as const;
  const { bg, label, Icon } = map[s];
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm font-semibold ${bg}`}>
      <Icon className="w-4 h-4" /> {label}
    </span>
  );
}

export function CapacidadPagoTool() {
  const ejecutar = useServerFn(analizarCapacidadPago);

  const [esVis, setEsVis] = useState(false);
  const [cuota, setCuota] = useState<number>(0);
  const [personas, setPersonas] = useState<PersonaForm[]>([nuevaPersona("titular")]);
  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState<AnalisisCapacidadResultado["data"] | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const limiteAplicable = esVis ? 0.40 : 0.30;
  const totalArchivos = useMemo(() => personas.reduce((s, p) => s + p.archivos.length, 0), [personas]);

  const tipoDocFromName = (name: string): TipoDoc => {
    const n = name.toLowerCase();
    if (n.includes("extract") || n.includes("estado de cuenta") || n.includes("statement")) return "extracto";
    if (n.includes("nomi") || n.includes("desprend") || n.includes("payroll")) return "nomina";
    if (n.includes("carta") || n.includes("labor")) return "carta_laboral";
    if (n.includes("renta") || n.includes("dian") || n.includes("declarac")) return "renta";
    return "otro";
  };

  const procesarArchivo = async (f: File): Promise<ArchivoLocal[]> => {
    if (isCompressedUnsupported(f)) { toast.error(`${f.name}: solo soportamos .zip.`); return []; }
    if (isZip(f)) {
      if (f.size > ZIP_MAX_BYTES) { toast.error(`${f.name} excede 50 MB.`); return []; }
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        const entries = unzipSync(buf);
        const out: ArchivoLocal[] = [];
        for (const [name, bytes] of Object.entries(entries)) {
          if (name.endsWith("/")) continue;
          const base = name.split("/").pop() || name;
          if (base.startsWith(".") || base.startsWith("__MACOSX")) continue;
          const ext = base.toLowerCase();
          const valid = ext.endsWith(".pdf") || ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg") || ext.endsWith(".webp") || ext.endsWith(".gif");
          if (!valid) continue;
          if (bytes.length > MAX_BYTES) { toast.warning(`${base} dentro del zip excede 10 MB, se omite.`); continue; }
          const mime = mimeFromName(base);
          out.push({
            id: crypto.randomUUID(), nombre: base, mime, size: bytes.length,
            tipo: tipoDocFromName(base), dataUrl: bytesToDataUrl(bytes, mime),
          });
        }
        if (out.length === 0) toast.warning(`${f.name}: no se encontraron PDFs o imágenes válidos.`);
        else toast.success(`${f.name}: ${out.length} documento(s) extraído(s).`);
        return out;
      } catch (e) { console.error(e); toast.error(`No se pudo descomprimir ${f.name}.`); return []; }
    }
    if (f.size > MAX_BYTES) { toast.error(`${f.name} excede 10 MB.`); return []; }
    const dataUrl = await fileToDataUrl(f);
    return [{ id: crypto.randomUUID(), nombre: f.name, mime: f.type || mimeFromName(f.name), size: f.size, tipo: tipoDocFromName(f.name), dataUrl }];
  };

  const handleFiles = async (idx: number, files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const nuevos: ArchivoLocal[] = [];
    for (const f of arr) nuevos.push(...(await procesarArchivo(f)));
    if (nuevos.length === 0) return;
    setPersonas((prev) => prev.map((p, i) => i === idx ? { ...p, archivos: [...p.archivos, ...nuevos] } : p));
  };

  const removeArchivo = (idx: number, id: string) =>
    setPersonas((prev) => prev.map((p, i) => i === idx ? { ...p, archivos: p.archivos.filter((a) => a.id !== id) } : p));
  const setTipoDoc = (idx: number, id: string, tipo: TipoDoc) =>
    setPersonas((prev) => prev.map((p, i) => i === idx ? { ...p, archivos: p.archivos.map((a) => a.id === id ? { ...a, tipo } : a) } : p));
  const setTipoPersona = (idx: number, tipo: TipoPersona) =>
    setPersonas((prev) => prev.map((p, i) => i === idx ? { ...p, tipoPersona: tipo } : p));
  const agregarCodeudor = () => personas.length < 2 && setPersonas((prev) => [...prev, nuevaPersona("codeudor")]);
  const quitarCodeudor = () => setPersonas((prev) => prev.filter((p) => p.rol !== "codeudor"));

  const correrAnalisis = async () => {
    if (cuota <= 0) { toast.error("Define la cuota propuesta."); return; }
    if (totalArchivos === 0) { toast.error("Sube al menos un soporte financiero."); return; }
    setAnalizando(true);
    try {
      const res = await ejecutar({
        data: {
          expedienteId: PLACEHOLDER_EXPEDIENTE_ID,
          cuotaPropuesta: cuota,
          esVis,
          personas: personas.map((p) => ({
            rol: p.rol,
            tipoPersona: p.tipoPersona,
            archivos: p.archivos.map((a) => ({ nombre: a.nombre, mime: a.mime, dataUrl: a.dataUrl, tipo: a.tipo })),
          })),
        },
      });
      if (res.error) toast.warning(res.error);
      if (!res.data) return;
      setResultado(res.data);
      toast.success("Análisis completado.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo ejecutar el análisis.");
    } finally {
      setAnalizando(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-[#84B98F]" />
            <h3 className="text-xl font-bold text-white">Análisis de capacidad de pago</h3>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/15 text-white/70">Herramienta libre</span>
          </div>
          <p className="text-sm text-white/70">
            Calcula el % de endeudamiento del cliente sin crear caso. Regla: la cuota no debe superar el <b className="text-white">{esVis ? "40%" : "30%"}</b> ({esVis ? "VIS" : "No VIS"}).
          </p>
        </div>
      </div>

      <div className="mb-5 p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <Label className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.18em]">Tipo de crédito</Label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setEsVis(false)}
            className={`px-4 py-3 rounded-xl border text-left transition backdrop-blur-xl ${!esVis ? "border-[#445DA3] bg-gradient-to-br from-[#445DA3]/80 to-[#445DA3]/40 text-white shadow-lg shadow-[#445DA3]/30" : "border-white/10 bg-white/[0.03] text-white/80 hover:border-white/25"}`}>
            <div className="text-sm font-bold">No VIS</div>
            <div className={`text-xs ${!esVis ? "text-white/80" : "text-white/50"}`}>Límite del 30%</div>
          </button>
          <button type="button" onClick={() => setEsVis(true)}
            className={`px-4 py-3 rounded-xl border text-left transition backdrop-blur-xl ${esVis ? "border-emerald-400 bg-gradient-to-br from-emerald-500/80 to-emerald-600/40 text-white shadow-lg shadow-emerald-500/30" : "border-white/10 bg-white/[0.03] text-white/80 hover:border-white/25"}`}>
            <div className="text-sm font-bold">VIS</div>
            <div className={`text-xs ${esVis ? "text-white/80" : "text-white/50"}`}>Límite del 40%</div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Cuota propuesta al banco</Label>
          <Input
            type="number"
            value={cuota || ""}
            onChange={(e) => setCuota(Number(e.target.value))}
            placeholder="$ 0"
            className="mt-2 font-bold bg-white/[0.05] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-[#84B98F]"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Límite aplicable</Label>
          <div className={`mt-2 text-3xl font-bold ${esVis ? "text-emerald-400" : "text-[#9BB1E8]"}`}>{Math.round(limiteAplicable * 100)}%</div>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Ingreso mínimo requerido</Label>
          <div className="mt-2 text-2xl font-bold text-white">{cuota > 0 ? formatCOP(cuota / limiteAplicable) : "—"}</div>
        </div>
      </div>

      {personas.map((p, idx) => (
        <div key={p.rol} className="mb-5 p-5 border border-white/10 rounded-2xl bg-white/[0.03] backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full ${p.rol === "titular" ? "bg-[#445DA3] text-white" : "bg-white/15 text-white"}`}>
                {p.rol === "titular" ? "TITULAR" : "CODEUDOR"}
              </span>
              <Select value={p.tipoPersona} onValueChange={(v) => setTipoPersona(idx, v as TipoPersona)}>
                <SelectTrigger className="w-[240px] bg-white/[0.05] border-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empleado_mensual">Empleado · pago mensual</SelectItem>
                  <SelectItem value="empleado_quincenal">Empleado · pago quincenal</SelectItem>
                  <SelectItem value="independiente">Independiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {p.rol === "codeudor" && (
              <Button variant="ghost" size="sm" onClick={quitarCodeudor} className="text-white/70 hover:text-white hover:bg-white/10">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <MinDocsHint tipo={p.tipoPersona} />
          <div className="mt-4">
            <label
              onDragEnter={(e) => { e.preventDefault(); setDragIdx(idx); }}
              onDragOver={(e) => { e.preventDefault(); setDragIdx(idx); }}
              onDragLeave={(e) => { e.preventDefault(); setDragIdx((cur) => cur === idx ? null : cur); }}
              onDrop={(e) => { e.preventDefault(); setDragIdx(null); const files = e.dataTransfer?.files; if (files?.length) handleFiles(idx, files); }}
              className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl p-6 cursor-pointer transition ${dragIdx === idx ? "border-[#84B98F] bg-[#84B98F]/10" : "border-white/20 hover:border-white/40 hover:bg-white/[0.04]"}`}>
              <div className="flex items-center gap-2 text-white">
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">{dragIdx === idx ? "Suelta los archivos" : "Arrastra archivos o haz clic"}</span>
              </div>
              <span className="text-xs text-white/50">PDF / imágenes / .ZIP · máx 10 MB por archivo</span>
              <input type="file" multiple accept="image/*,application/pdf,.zip,application/zip,application/x-zip-compressed" className="hidden"
                onChange={(e) => { handleFiles(idx, e.target.files); e.currentTarget.value = ""; }} />
            </label>
          </div>
          {p.archivos.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {p.archivos.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm p-2.5 bg-white/[0.04] border border-white/10 rounded-lg">
                  <FileText className="w-4 h-4 text-white/60" />
                  <span className="truncate flex-1 text-white/90">{a.nombre}</span>
                  <Select value={a.tipo} onValueChange={(v) => setTipoDoc(idx, a.id, v as TipoDoc)}>
                    <SelectTrigger className="w-[150px] h-7 text-xs bg-white/[0.05] border-white/15 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nomina">Nómina</SelectItem>
                      <SelectItem value="carta_laboral">Carta laboral</SelectItem>
                      <SelectItem value="renta">Renta</SelectItem>
                      <SelectItem value="extracto">Extracto bancario</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => removeArchivo(idx, a.id)} className="text-white/60 hover:text-white hover:bg-white/10">
                    <X className="w-3 h-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {personas.length < 2 && (
          <Button variant="outline" size="sm" onClick={agregarCodeudor} className="border-white/20 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
            + Agregar codeudor
          </Button>
        )}
        <Button
          onClick={correrAnalisis}
          disabled={analizando || totalArchivos === 0 || cuota <= 0}
          className="ml-auto text-white border-0 shadow-lg shadow-[#445DA3]/30 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${NUVEX_AZUL}, ${NUVEX_VERDE})` }}
        >
          {analizando ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando con IA…</>) : (<><Sparkles className="w-4 h-4 mr-2" />Ejecutar análisis</>)}
        </Button>
      </div>

      {resultado && (
        <div className="border-t border-white/10 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="md:col-span-2 p-5 rounded-2xl border border-white/15 bg-gradient-to-br from-[#445DA3]/40 to-[#84B98F]/20 backdrop-blur-xl">
              <div className="text-[10px] uppercase tracking-widest text-white/70 mb-1">% Endeudamiento</div>
              <div className="text-5xl font-bold text-white">{(resultado.porcentajeEndeudamiento * 100).toFixed(1)}%</div>
              <div className="text-sm text-white/70 mt-1">Límite: {Math.round(resultado.limiteAplicable * 100)}%</div>
              <div className="mt-3"><SemaforoBadge s={resultado.semaforo} /></div>
            </div>
            <div className="p-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 backdrop-blur-xl">
              <div className="text-[10px] uppercase tracking-widest text-emerald-300">Ingreso total</div>
              <div className="text-xl font-bold text-white mt-1">{formatCOP(resultado.ingresoTotal)}</div>
            </div>
            <div className="p-4 rounded-2xl border border-[#9BB1E8]/30 bg-[#445DA3]/20 backdrop-blur-xl">
              <div className="text-[10px] uppercase tracking-widest text-[#9BB1E8]">Cuota</div>
              <div className="text-xl font-bold text-white mt-1">{formatCOP(resultado.cuotaPropuesta)}</div>
              <div className="text-xs text-white/60 mt-1">{resultado.esVis ? "VIS" : "No VIS"}</div>
            </div>
          </div>
          <div className={`p-4 rounded-xl mb-4 border backdrop-blur-xl ${resultado.semaforo === "verde" ? "bg-emerald-500/15 text-emerald-100 border-emerald-400/30" : resultado.semaforo === "amarillo" ? "bg-amber-500/15 text-amber-100 border-amber-400/30" : "bg-red-500/15 text-red-100 border-red-400/30"}`}>
            <p className="text-sm font-medium">{resultado.mensaje}</p>
          </div>
          {resultado.personas.map((per) => (
            <div key={per.rol} className="mb-3 p-4 border border-white/10 rounded-2xl bg-white/[0.03] backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-white/20 text-white/90">{per.rol.toUpperCase()}</span>
                <span className="text-sm font-semibold text-white">{formatCOP(per.ingresoMensualPromedio)} / mes</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/80">Confianza {per.confianza}</span>
              </div>
              {per.observaciones.length > 0 && (
                <ul className="mt-2 text-xs text-white/70 list-disc pl-5 space-y-1">
                  {per.observaciones.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NUVEX_AZUL = "#445DA3";
const NUVEX_VERDE = "#84B98F";
