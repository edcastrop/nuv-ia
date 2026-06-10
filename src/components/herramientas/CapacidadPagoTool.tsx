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
    return <p className="text-xs text-muted-foreground">Requeridos: <b>3 últimas nóminas mensuales</b> + carta laboral + última declaración de renta.</p>;
  if (tipo === "empleado_quincenal")
    return <p className="text-xs text-muted-foreground">Requeridos: <b>6 últimas nóminas quincenales</b> + carta laboral + última declaración de renta.</p>;
  return <p className="text-xs text-muted-foreground">Requeridos: <b>3 últimos extractos bancarios</b> + última declaración de renta.</p>;
}

function SemaforoBadge({ s }: { s: "verde" | "amarillo" | "rojo" | "sin_datos" }) {
  const map = {
    verde: { bg: "bg-emerald-500", label: "🟢 Aprobado por regla", Icon: ShieldCheck },
    amarillo: { bg: "bg-amber-500", label: "🟡 Marginal", Icon: AlertTriangle },
    rojo: { bg: "bg-red-600", label: "🔴 Excede política", Icon: AlertOctagon },
    sin_datos: { bg: "bg-slate-400", label: "Sin datos", Icon: FileText },
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
    <Card className="p-6 border-2 border-[#445DA3]/20 bg-gradient-to-br from-white to-slate-50">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-[#445DA3]" />
            <h3 className="text-xl font-bold text-slate-900">Análisis de capacidad de pago</h3>
            <Badge variant="outline" className="text-xs">Herramienta libre</Badge>
          </div>
          <p className="text-sm text-slate-600">
            Calcula el % de endeudamiento del cliente sin crear caso. Regla: la cuota no debe superar el <b>{esVis ? "40%" : "30%"}</b> ({esVis ? "VIS" : "No VIS"}).
          </p>
        </div>
      </div>

      <div className="mb-4 p-3 rounded-lg border-2 border-[#445DA3]/30 bg-white">
        <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Tipo de crédito</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setEsVis(false)}
            className={`px-4 py-3 rounded-lg border-2 text-left transition ${!esVis ? "border-[#445DA3] bg-[#445DA3] text-white shadow" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
            <div className="text-sm font-bold">No VIS</div>
            <div className={`text-xs ${!esVis ? "text-white/80" : "text-slate-500"}`}>Límite del 30%</div>
          </button>
          <button type="button" onClick={() => setEsVis(true)}
            className={`px-4 py-3 rounded-lg border-2 text-left transition ${esVis ? "border-emerald-600 bg-emerald-600 text-white shadow" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
            <div className="text-sm font-bold">VIS</div>
            <div className={`text-xs ${esVis ? "text-white/80" : "text-slate-500"}`}>Límite del 40%</div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 p-4 bg-slate-100/60 rounded-lg">
        <div>
          <Label className="text-xs text-slate-600">Cuota propuesta al banco</Label>
          <Input type="number" value={cuota || ""} onChange={(e) => setCuota(Number(e.target.value))} className="font-bold" />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Límite aplicable</Label>
          <div className={`text-2xl font-bold ${esVis ? "text-emerald-600" : "text-[#445DA3]"}`}>{Math.round(limiteAplicable * 100)}%</div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Ingreso mínimo requerido</Label>
          <div className="text-2xl font-bold text-slate-900">{cuota > 0 ? formatCOP(cuota / limiteAplicable) : "—"}</div>
        </div>
      </div>

      {personas.map((p, idx) => (
        <div key={p.rol} className="mb-5 p-4 border rounded-lg bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge className={p.rol === "titular" ? "bg-[#445DA3]" : "bg-slate-600"}>{p.rol === "titular" ? "TITULAR" : "CODEUDOR"}</Badge>
              <Select value={p.tipoPersona} onValueChange={(v) => setTipoPersona(idx, v as TipoPersona)}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empleado_mensual">Empleado · pago mensual</SelectItem>
                  <SelectItem value="empleado_quincenal">Empleado · pago quincenal</SelectItem>
                  <SelectItem value="independiente">Independiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {p.rol === "codeudor" && (<Button variant="ghost" size="sm" onClick={quitarCodeudor}><X className="w-4 h-4" /></Button>)}
          </div>
          <MinDocsHint tipo={p.tipoPersona} />
          <div className="mt-3">
            <label
              onDragEnter={(e) => { e.preventDefault(); setDragIdx(idx); }}
              onDragOver={(e) => { e.preventDefault(); setDragIdx(idx); }}
              onDragLeave={(e) => { e.preventDefault(); setDragIdx((cur) => cur === idx ? null : cur); }}
              onDrop={(e) => { e.preventDefault(); setDragIdx(null); const files = e.dataTransfer?.files; if (files?.length) handleFiles(idx, files); }}
              className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg p-5 cursor-pointer transition ${dragIdx === idx ? "border-[#445DA3] bg-[#445DA3]/10" : "border-slate-300 hover:bg-slate-50"}`}>
              <div className="flex items-center gap-2"><Upload className="w-4 h-4" /><span className="text-sm font-medium">{dragIdx === idx ? "Suelta los archivos" : "Arrastra archivos o haz clic"}</span></div>
              <span className="text-xs text-muted-foreground">PDF / imágenes / .ZIP · máx 10 MB por archivo</span>
              <input type="file" multiple accept="image/*,application/pdf,.zip,application/zip,application/x-zip-compressed" className="hidden"
                onChange={(e) => { handleFiles(idx, e.target.files); e.currentTarget.value = ""; }} />
            </label>
          </div>
          {p.archivos.length > 0 && (
            <ul className="mt-3 space-y-1">
              {p.archivos.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm p-2 bg-slate-50 rounded">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="truncate flex-1">{a.nombre}</span>
                  <Select value={a.tipo} onValueChange={(v) => setTipoDoc(idx, a.id, v as TipoDoc)}>
                    <SelectTrigger className="w-[150px] h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nomina">Nómina</SelectItem>
                      <SelectItem value="carta_laboral">Carta laboral</SelectItem>
                      <SelectItem value="renta">Renta</SelectItem>
                      <SelectItem value="extracto">Extracto bancario</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => removeArchivo(idx, a.id)}><X className="w-3 h-3" /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {personas.length < 2 && (<Button variant="outline" size="sm" onClick={agregarCodeudor}>+ Agregar codeudor</Button>)}
        <Button onClick={correrAnalisis} disabled={analizando || totalArchivos === 0 || cuota <= 0} className="bg-[#445DA3] hover:bg-[#3a4f8a] ml-auto">
          {analizando ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando con IA…</>) : (<><Sparkles className="w-4 h-4 mr-2" />Ejecutar análisis</>)}
        </Button>
      </div>

      {resultado && (
        <div className="border-t pt-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="md:col-span-2 p-5 rounded-xl bg-slate-900 text-white">
              <div className="text-xs uppercase tracking-wide opacity-70 mb-1">% Endeudamiento</div>
              <div className="text-5xl font-bold">{(resultado.porcentajeEndeudamiento * 100).toFixed(1)}%</div>
              <div className="text-sm opacity-80 mt-1">Límite: {Math.round(resultado.limiteAplicable * 100)}%</div>
              <div className="mt-3"><SemaforoBadge s={resultado.semaforo} /></div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs text-emerald-700 uppercase">Ingreso total</div>
              <div className="text-2xl font-bold text-emerald-900">{formatCOP(resultado.ingresoTotal)}</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-xs text-blue-700 uppercase">Cuota</div>
              <div className="text-2xl font-bold text-blue-900">{formatCOP(resultado.cuotaPropuesta)}</div>
              <div className="text-xs text-blue-700 mt-1">{resultado.esVis ? "VIS" : "No VIS"}</div>
            </div>
          </div>
          <div className={`p-4 rounded-lg mb-4 ${resultado.semaforo === "verde" ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : resultado.semaforo === "amarillo" ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-red-50 text-red-900 border border-red-200"}`}>
            <p className="text-sm font-medium">{resultado.mensaje}</p>
          </div>
          {resultado.personas.map((per) => (
            <div key={per.rol} className="mb-3 p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{per.rol.toUpperCase()}</Badge>
                <span className="text-sm font-semibold">{formatCOP(per.ingresoMensualPromedio)} / mes</span>
                <Badge variant="secondary" className="text-xs">Confianza {per.confianza}</Badge>
              </div>
              {per.observaciones.length > 0 && (
                <ul className="mt-2 text-xs text-slate-600 list-disc pl-5">
                  {per.observaciones.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
