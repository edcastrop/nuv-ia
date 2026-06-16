// Bloque "Análisis de Capacidad de Pago" para sustentación bancaria.
// Visible en expedientes radicados en bancos que exigen documentación
// financiera (Davivienda, Bco Bogotá, Bco Occidente, AV Villas, Davibank).
// Aplica regla 30% (No VIS) / 40% (VIS).

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Upload, X, ShieldCheck, AlertTriangle, AlertOctagon, FileText, Sparkles, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCOP } from "@/lib/format";
import { analizarCapacidadPago, type AnalisisCapacidadResultado } from "@/lib/analisisCapacidad.functions";
import { enviarSolicitudPlazoBanco } from "@/lib/solicitudPlazoBanco.functions";
import { unzipSync } from "fflate";

export const BANCOS_REQUIEREN_CAPACIDAD = [
  "davivienda",
  "davibank",
  "banco de bogota",
  "banco de bogotá",
  "bco bogota",
  "banco de occidente",
  "bco occidente",
  "av villas",
  "banco av villas",
];

export function bancoRequiereAnalisisCapacidad(banco: string | undefined | null): boolean {
  if (!banco) return false;
  const n = banco.toLowerCase().trim();
  return BANCOS_REQUIEREN_CAPACIDAD.some((b) => n.includes(b));
}

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

interface Props {
  expedienteId: string;
  banco: string;
  cuotaPropuesta: number;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ZIP_MAX_BYTES = 50 * 1024 * 1024;

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

function isZip(f: File): boolean {
  const n = f.name.toLowerCase();
  return n.endsWith(".zip") || f.type === "application/zip" || f.type === "application/x-zip-compressed";
}

function isCompressedUnsupported(f: File): boolean {
  const n = f.name.toLowerCase();
  return n.endsWith(".rar") || n.endsWith(".7z") || n.endsWith(".tar") || n.endsWith(".gz");
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  // Avoid stack overflow for big files
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
  if (tipo === "empleado_mensual") {
    return <p className="text-xs text-muted-foreground">Requeridos: <b>3 últimas nóminas mensuales</b> + carta laboral + última declaración de renta.</p>;
  }
  if (tipo === "empleado_quincenal") {
    return <p className="text-xs text-muted-foreground">Requeridos: <b>6 últimas nóminas quincenales</b> + carta laboral + última declaración de renta.</p>;
  }
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

export function AnalisisCapacidadPagoBlock({ expedienteId, banco, cuotaPropuesta }: Props) {
  const ejecutar = useServerFn(analizarCapacidadPago);
  const enviarSolicitud = useServerFn(enviarSolicitudPlazoBanco);

  const [esVis, setEsVis] = useState(false);
  const [cuota, setCuota] = useState<number>(cuotaPropuesta || 0);
  const [personas, setPersonas] = useState<PersonaForm[]>([nuevaPersona("titular")]);
  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState<AnalisisCapacidadResultado["data"] | null>(null);
  const [cargandoUltimo, setCargandoUltimo] = useState(true);

  // Modal "Construir solicitud al banco"
  const [openSolicitud, setOpenSolicitud] = useState(false);
  const [plazoNuevo, setPlazoNuevo] = useState<number>(0);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  useEffect(() => {
    setCuota(cuotaPropuesta || 0);
  }, [cuotaPropuesta]);

  // Cargar último análisis guardado
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("analisis_capacidad_pago")
        .select("*")
        .eq("expediente_id", expedienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setEsVis(!!data.es_vis);
        setCuota(Number(data.cuota_propuesta));
        setResultado({
          cuotaPropuesta: Number(data.cuota_propuesta),
          esVis: !!data.es_vis,
          limiteAplicable: Number(data.limite_aplicable),
          ingresoTotal: Number(data.ingreso_total),
          porcentajeEndeudamiento: Number(data.porcentaje_endeudamiento ?? 0),
          semaforo: data.semaforo as "verde" | "amarillo" | "rojo" | "sin_datos",
          mensaje: "Último análisis guardado.",
          personas: (data.payload_ia as { personas?: unknown[] })?.personas as never ?? [],
          modelo: data.modelo_ia ?? "",
        });
      }
      setCargandoUltimo(false);
    })();
  }, [expedienteId]);

  const limiteAplicable = esVis ? 0.40 : 0.30;
  const totalArchivos = useMemo(() => personas.reduce((s, p) => s + p.archivos.length, 0), [personas]);

  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const tipoDocFromName = (name: string): TipoDoc => {
    const n = name.toLowerCase();
    if (n.includes("extract") || n.includes("estado de cuenta") || n.includes("statement")) return "extracto";
    if (n.includes("nomi") || n.includes("desprend") || n.includes("payroll")) return "nomina";
    if (n.includes("carta") || n.includes("labor")) return "carta_laboral";
    if (n.includes("renta") || n.includes("dian") || n.includes("declarac")) return "renta";
    return "otro";
  };

  const procesarArchivo = async (f: File): Promise<ArchivoLocal[]> => {
    if (isCompressedUnsupported(f)) {
      toast.error(`${f.name}: solo soportamos .zip. Recomprime el archivo.`);
      return [];
    }
    if (isZip(f)) {
      if (f.size > ZIP_MAX_BYTES) {
        toast.error(`${f.name} excede 50 MB.`);
        return [];
      }
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        const entries = unzipSync(buf);
        const out: ArchivoLocal[] = [];
        for (const [name, bytes] of Object.entries(entries)) {
          if (name.endsWith("/")) continue; // dir
          const base = name.split("/").pop() || name;
          if (base.startsWith(".") || base.startsWith("__MACOSX")) continue;
          const ext = base.toLowerCase();
          const valid = ext.endsWith(".pdf") || ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg") || ext.endsWith(".webp") || ext.endsWith(".gif");
          if (!valid) continue;
          if (bytes.length > MAX_BYTES) {
            toast.warning(`${base} dentro del zip excede 10 MB, se omite.`);
            continue;
          }
          const mime = mimeFromName(base);
          out.push({
            id: crypto.randomUUID(),
            nombre: base,
            mime,
            size: bytes.length,
            tipo: tipoDocFromName(base),
            dataUrl: bytesToDataUrl(bytes, mime),
          });
        }
        if (out.length === 0) toast.warning(`${f.name}: no se encontraron PDFs o imágenes válidos.`);
        else toast.success(`${f.name}: ${out.length} documento(s) extraído(s).`);
        return out;
      } catch (e) {
        console.error(e);
        toast.error(`No se pudo descomprimir ${f.name}.`);
        return [];
      }
    }
    if (f.size > MAX_BYTES) {
      toast.error(`${f.name} excede 10 MB.`);
      return [];
    }
    const dataUrl = await fileToDataUrl(f);
    return [{
      id: crypto.randomUUID(),
      nombre: f.name,
      mime: f.type || mimeFromName(f.name),
      size: f.size,
      tipo: tipoDocFromName(f.name),
      dataUrl,
    }];
  };

  const handleFiles = async (idxPersona: number, files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const nuevos: ArchivoLocal[] = [];
    for (const f of arr) {
      const extraidos = await procesarArchivo(f);
      nuevos.push(...extraidos);
    }
    if (nuevos.length === 0) return;
    setPersonas((prev) => prev.map((p, i) => i === idxPersona ? { ...p, archivos: [...p.archivos, ...nuevos] } : p));
  };

  const removeArchivo = (idxPersona: number, idArchivo: string) => {
    setPersonas((prev) => prev.map((p, i) => i === idxPersona ? { ...p, archivos: p.archivos.filter((a) => a.id !== idArchivo) } : p));
  };

  const setTipoDoc = (idxPersona: number, idArchivo: string, tipo: TipoDoc) => {
    setPersonas((prev) => prev.map((p, i) => i === idxPersona ? {
      ...p,
      archivos: p.archivos.map((a) => a.id === idArchivo ? { ...a, tipo } : a),
    } : p));
  };

  const setTipoPersona = (idxPersona: number, tipo: TipoPersona) => {
    setPersonas((prev) => prev.map((p, i) => i === idxPersona ? { ...p, tipoPersona: tipo } : p));
  };

  const agregarCodeudor = () => {
    if (personas.length >= 2) return;
    setPersonas((prev) => [...prev, nuevaPersona("codeudor")]);
  };
  const quitarCodeudor = () => setPersonas((prev) => prev.filter((p) => p.rol !== "codeudor"));

  const subirArchivosAlBucket = async () => {
    // Solo persistencia opcional. No bloquea el análisis.
    for (const p of personas) {
      for (const a of p.archivos) {
        const path = `${expedienteId}/${p.rol}/${Date.now()}_${a.nombre}`;
        const blob = await (await fetch(a.dataUrl)).blob();
        const { error } = await supabase.storage.from("capacidad-pago-docs").upload(path, blob, {
          contentType: a.mime, upsert: false,
        });
        if (error) console.warn("Upload error", error.message);
      }
    }
  };

  const correrAnalisis = async () => {
    if (cuota <= 0) { toast.error("Define la cuota propuesta."); return; }
    if (totalArchivos === 0) { toast.error("Sube al menos un soporte financiero."); return; }
    setAnalizando(true);
    try {
      const res = await ejecutar({
        data: {
          expedienteId,
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
      if (!res.data) { setAnalizando(false); return; }
      setResultado(res.data);

      // Guardar en BD + subir archivos en background
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp.user?.id ?? null;
      await supabase.from("analisis_capacidad_pago").insert({
        expediente_id: expedienteId,
        tipo_persona: personas[0].tipoPersona,
        es_vis: esVis,
        cuota_propuesta: cuota,
        ingreso_titular: res.data.personas.find((p) => p.rol === "titular")?.ingresoMensualPromedio ?? 0,
        ingreso_codeudor: res.data.personas.find((p) => p.rol === "codeudor")?.ingresoMensualPromedio ?? 0,
        porcentaje_endeudamiento: res.data.porcentajeEndeudamiento,
        limite_aplicable: res.data.limiteAplicable,
        semaforo: res.data.semaforo,
        modelo_ia: res.data.modelo,
        confianza: res.data.personas.find((p) => p.rol === "titular")?.confianza === "alta" ? 0.9
                  : res.data.personas.find((p) => p.rol === "titular")?.confianza === "media" ? 0.65 : 0.4,
        observaciones: res.data.personas.flatMap((p) => p.observaciones.map((o) => `[${p.rol}] ${o}`)),
        detalle_titular: res.data.personas.find((p) => p.rol === "titular") ?? {},
        detalle_codeudor: res.data.personas.find((p) => p.rol === "codeudor") ?? {},
        payload_ia: JSON.parse(JSON.stringify(res.data)),
        created_by: userId,
      });

      // Subir archivos sin bloquear UI
      subirArchivosAlBucket().catch(() => {/* silencioso */});
      toast.success("Análisis completado.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo ejecutar el análisis.");
    } finally {
      setAnalizando(false);
    }
  };

  const construirYEnviarSolicitud = async () => {
    if (!resultado) { toast.error("Primero ejecuta el análisis de capacidad."); return; }
    if (!plazoNuevo || plazoNuevo <= 0) { toast.error("Indica el nuevo plazo en meses."); return; }
    const archivos = personas.flatMap((p) => p.archivos);
    if (archivos.length === 0) { toast.error("No hay soportes adjuntos."); return; }

    setEnviandoSolicitud(true);
    try {
      const adjuntos = archivos.map((a) => ({
        filename: a.nombre,
        contentBase64: a.dataUrl.includes(",") ? a.dataUrl.split(",")[1] : a.dataUrl,
        contentType: a.mime || "application/octet-stream",
      }));
      const documentos = archivos.map((a) => `${a.tipo === "otro" ? "Documento" : a.tipo.replace("_", " ")} — ${a.nombre}`);

      const titular = personas.find((p) => p.rol === "titular") ?? personas[0];

      await enviarSolicitud({
        data: {
          expedienteId,
          plazoNuevoMeses: plazoNuevo,
          cuotaProyectada: cuota,
          esVis,
          tipoPersona: titular.tipoPersona,
          documentos,
          adjuntos,
        },
      });
      toast.success("Solicitud enviada a Jurídica (juridica@nuvex.com.co).");
      setOpenSolicitud(false);
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || "No se pudo enviar la solicitud.");
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  if (!bancoRequiereAnalisisCapacidad(banco)) return null;

  return (
    <Card className="p-6 glass-panel">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5" style={{ color: "var(--nuvia-accent-primary)" }} />
            <h3 className="text-xl font-bold" style={{ color: "var(--nuvia-text-primary)" }}>Análisis de capacidad de pago</h3>
            <Badge variant="outline" className="text-xs">{banco}</Badge>
          </div>
          <p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
            Sustentación obligatoria para radicar. Regla del banco: la nueva cuota no debe superar el <b>{esVis ? "40%" : "30%"}</b> de los ingresos
            ({esVis ? "crédito VIS" : "crédito No VIS"}).
          </p>
        </div>
      </div>

      {/* Selector tipo de crédito (prominente) */}
      <div className="mb-4 p-3 rounded-lg glass-panel" style={{ border: "1px solid var(--nuvia-border-medium)" }}>
        <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--nuvia-text-secondary)" }}>Tipo de crédito (define la regla aplicable)</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (resultado && esVis) toast.info("Cambiaste a No VIS. Vuelve a ejecutar el análisis para recalcular con el límite del 30%.");
              setEsVis(false);
            }}
            className="px-4 py-3 rounded-lg border text-left transition"
            style={{
              borderColor: !esVis ? "var(--nuvia-accent-primary)" : "var(--nuvia-border-soft)",
              background: !esVis ? "rgba(122,160,255,0.16)" : "rgba(255,255,255,0.02)",
              color: "var(--nuvia-text-primary)",
            }}
          >
            <div className="text-sm font-bold">No VIS</div>
            <div className="text-xs" style={{ color: "var(--nuvia-text-tertiary)" }}>Límite del 30% de ingresos</div>
          </button>
          <button
            type="button"
            onClick={() => {
              if (resultado && !esVis) toast.info("Cambiaste a VIS. Vuelve a ejecutar el análisis para recalcular con el límite del 40%.");
              setEsVis(true);
            }}
            className="px-4 py-3 rounded-lg border text-left transition"
            style={{
              borderColor: esVis ? "rgba(132,185,143,0.6)" : "var(--nuvia-border-soft)",
              background: esVis ? "rgba(132,185,143,0.16)" : "rgba(255,255,255,0.02)",
              color: "var(--nuvia-text-primary)",
            }}
          >
            <div className="text-sm font-bold">VIS</div>
            <div className="text-xs" style={{ color: "var(--nuvia-text-tertiary)" }}>Límite del 40% de ingresos</div>
          </button>
        </div>
      </div>

      {/* Cuota a validar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--nuvia-border-soft)" }}>
        <div>
          <Label className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>Cuota propuesta al banco</Label>
          <Input type="number" value={cuota || ""} onChange={(e) => setCuota(Number(e.target.value))} className="nuvia-input font-bold" />
          <p className="text-xs mt-1" style={{ color: "var(--nuvia-text-tertiary)" }}>Tomada del simulador NUVEX.</p>
        </div>
        <div>
          <Label className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>Límite aplicable</Label>
          <div className="text-2xl font-bold" style={{ color: esVis ? "rgb(132,185,143)" : "var(--nuvia-accent-primary)" }}>{Math.round(limiteAplicable * 100)}% <span className="text-sm font-medium">({esVis ? "VIS" : "No VIS"})</span></div>
        </div>
        <div>
          <Label className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>Ingreso mínimo requerido</Label>
          <div className="text-2xl font-bold" style={{ color: "var(--nuvia-text-primary)" }}>{cuota > 0 ? formatCOP(cuota / limiteAplicable) : "—"}</div>
        </div>
      </div>


      {/* Personas */}
      {personas.map((p, idx) => (
        <div key={p.rol} className="mb-5 p-4 border rounded-lg bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge className={p.rol === "titular" ? "bg-[#445DA3]" : "bg-slate-600"}>
                {p.rol === "titular" ? "TITULAR" : "CODEUDOR"}
              </Badge>
              <Select value={p.tipoPersona} onValueChange={(v) => setTipoPersona(idx, v as TipoPersona)}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empleado_mensual">Empleado · pago mensual</SelectItem>
                  <SelectItem value="empleado_quincenal">Empleado · pago quincenal</SelectItem>
                  <SelectItem value="independiente">Independiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {p.rol === "codeudor" && (
              <Button variant="ghost" size="sm" onClick={quitarCodeudor}><X className="w-4 h-4" /></Button>
            )}
          </div>

          <MinDocsHint tipo={p.tipoPersona} />

          <div className="mt-3">
            <label
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragIdx(idx); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragIdx(idx); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragIdx((cur) => cur === idx ? null : cur); }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation();
                setDragIdx(null);
                const files = e.dataTransfer?.files;
                if (files && files.length) handleFiles(idx, files);
              }}
              className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg p-5 cursor-pointer transition ${
                dragIdx === idx ? "border-[#445DA3] bg-[#445DA3]/10" : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {dragIdx === idx ? "Suelta los archivos aquí" : "Arrastra archivos o haz clic para subir"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                PDF, imágenes (JPG/PNG/WEBP) o <b>.ZIP</b> con varios documentos · máx. 10 MB por archivo, 50 MB por zip
              </span>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,.zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={(e) => { handleFiles(idx, e.target.files); e.currentTarget.value = ""; }}
              />
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
        {personas.length < 2 && (
          <Button variant="outline" size="sm" onClick={agregarCodeudor}>+ Agregar codeudor</Button>
        )}
        <Button
          onClick={correrAnalisis}
          disabled={analizando || totalArchivos === 0 || cuota <= 0}
          className="bg-[#445DA3] hover:bg-[#3a4f8a] ml-auto"
        >
          {analizando ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando con IA…</>) : (<><Sparkles className="w-4 h-4 mr-2" />Ejecutar análisis</>)}
        </Button>
        <Button
          onClick={() => { setPlazoNuevo(0); setOpenSolicitud(true); }}
          disabled={!resultado || totalArchivos === 0}
          variant="outline"
          className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
          title={!resultado ? "Ejecuta primero el análisis" : "Construir y enviar a Jurídica"}
        >
          <Mail className="w-4 h-4 mr-2" /> Construir solicitud al banco
        </Button>
      </div>

      {/* Resultado */}
      {cargandoUltimo ? null : resultado && (
        <div className="border-t pt-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="md:col-span-2 p-5 rounded-xl bg-slate-900 text-white">
              <div className="text-xs uppercase tracking-wide opacity-70 mb-1">% Endeudamiento</div>
              <div className="text-5xl font-bold">{(resultado.porcentajeEndeudamiento * 100).toFixed(1)}%</div>
              <div className="text-sm opacity-80 mt-1">Límite del banco: {Math.round(resultado.limiteAplicable * 100)}%</div>
              <div className="mt-3"><SemaforoBadge s={resultado.semaforo} /></div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-xs text-emerald-700 uppercase">Ingreso total detectado</div>
              <div className="text-2xl font-bold text-emerald-900">{formatCOP(resultado.ingresoTotal)}</div>
              <div className="text-xs text-emerald-700 mt-1">Titular + codeudor</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-xs text-blue-700 uppercase">Cuota propuesta</div>
              <div className="text-2xl font-bold text-blue-900">{formatCOP(resultado.cuotaPropuesta)}</div>
              <div className="text-xs text-blue-700 mt-1">{resultado.esVis ? "Crédito VIS" : "Crédito No VIS"}</div>
            </div>
          </div>

          <div className={`p-4 rounded-lg mb-4 ${
            resultado.semaforo === "verde" ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
            : resultado.semaforo === "amarillo" ? "bg-amber-50 text-amber-900 border border-amber-200"
            : "bg-red-50 text-red-900 border border-red-200"
          }`}>
            <p className="text-sm font-medium">{resultado.mensaje}</p>
          </div>

          {resultado.personas.map((per) => (
            <div key={per.rol} className="mb-3 p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{per.rol.toUpperCase()}</Badge>
                  <span className="text-sm font-semibold">{formatCOP(per.ingresoMensualPromedio)} / mes</span>
                  <Badge variant="secondary" className="text-xs">Confianza {per.confianza}</Badge>
                </div>
              </div>
              {per.ingresosDetectados.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="text-slate-500">
                    <tr><th className="text-left">Documento</th><th className="text-left">Periodo</th><th className="text-left">Tipo</th><th className="text-right">Valor</th></tr>
                  </thead>
                  <tbody>
                    {per.ingresosDetectados.map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-1">{d.documento}</td>
                        <td>{d.periodo || "—"}</td>
                        <td>{d.tipo}</td>
                        <td className="text-right font-mono">{formatCOP(d.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {per.observaciones.length > 0 && (
                <ul className="mt-2 text-xs text-slate-600 list-disc pl-5">
                  {per.observaciones.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={openSolicitud} onOpenChange={setOpenSolicitud}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Construir solicitud al banco</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-xs bg-slate-50 border rounded-lg p-3">
              <div><b>Destinatario:</b> juridica@nuvex.com.co</div>
              <div><b>Banco:</b> {banco}</div>
              <div><b>Cuota proyectada:</b> {formatCOP(cuota)} · <b>{esVis ? "VIS (40%)" : "No VIS (30%)"}</b></div>
              <div><b>Soportes adjuntos:</b> {totalArchivos}</div>
            </div>

            <div>
              <Label className="text-xs">Nuevo plazo solicitado (meses)</Label>
              <Input
                type="number"
                min={1}
                max={360}
                value={plazoNuevo || ""}
                onChange={(e) => setPlazoNuevo(Number(e.target.value))}
                placeholder="Ej. 180"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Solicitud formal de <b>disminución de plazo</b> conforme a la Ley 546 de 1999.
              </p>
            </div>

            <div className="text-[11px] text-slate-600">
              Se adjuntarán los {totalArchivos} documento(s) cargados en el módulo
              (nóminas/extractos, carta laboral y renta según aplique) y se enviará
              copia (CC) al asesor del caso.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSolicitud(false)} disabled={enviandoSolicitud}>
              Cancelar
            </Button>
            <Button
              onClick={construirYEnviarSolicitud}
              disabled={enviandoSolicitud || !plazoNuevo || plazoNuevo <= 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {enviandoSolicitud ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando…</>) : (<><Mail className="w-4 h-4 mr-2" />Enviar a Jurídica</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
