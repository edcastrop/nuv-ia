import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload,
  Sparkles,
  FileText,
  // Loader2 replaced by NuviaReadingAnimation
  ShieldCheck,
  AlertTriangle,
  X,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NuviaReadingAnimation } from "./NuviaReadingAnimation";
import { extractStatement, type ExtractoData } from "@/lib/extracto.functions";
import { parseMontoExtracto } from "@/lib/cuotaBase";
import {
  useProductosBancarios,
  buscarProductoComercial,
  parseProductoComercial,
} from "@/lib/productosBancarios";

type Modo = "pesos" | "uvr";

type Stage = "idle" | "password" | "reading" | "review" | "applied" | "error";

type Confianza = "alta" | "media" | "baja" | "";

export type ExtractoApplyPayload = {
  cliente: {
    nombre?: string;
    cedula?: string;
    numeroCredito?: string;
    banco?: string;
    tipoProducto?: string;
    productoBancarioId?: string | null;
    plazoInicial?: string;
    cuotasPagadas?: string;
    cuotasPendientes?: string;
  };
  // Para pesos
  pesos?: {
    saldoCapital?: string;
    cuotaActual?: string;
    seguros?: string;
    tea?: string;
    valorDesembolsado?: string;
  };
  // Para UVR
  uvr?: {
    saldoUVR?: string;
    valorUVR?: string;
    saldoPesos?: string;
    valorDesembolsado?: string;
    cuotaActualPesos?: string;
    seguros?: string;
    teaCobrada?: string;
  };
  cobertura?: {
    activo: boolean;
    valorCobertura?: string;
    tasaCobertura?: string;
    tipoBeneficio?: string;
    cuotaPagadaCliente?: string;
    cuotaConInteresSinSeguros?: string;
    segurosMensuales?: string;
    cuotaBaseSimulacion?: string;
    requiereVerificacion?: boolean;
  };
  archivoPath?: string;
  /** Moneda detectada en el extracto (independiente del modo del simulador). */
  monedaDetectada?: "uvr" | "pesos";
  /**
   * Snapshot crudo del extracto (datos OCR + banco/producto/moneda) para que el
   * consumidor pueda persistir el extracto y disparar QA si corresponde. No se
   * usa por la lógica de simulación; sólo para auto-auditoría QA contextual.
   */
  raw?: {
    banco?: string;
    producto?: string;
    moneda?: string;
    datos?: Record<string, unknown>;
    archivoNombre?: string;
  };
};


interface Props {
  modo: Modo;
  onApply: (data: ExtractoApplyPayload) => boolean | void | Promise<boolean | void>;
  existingArchivoPath?: string | null;
}

// PDF.js dynamic loader (client-only)
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as {
    default: string;
  };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

async function renderPdfToImages(
  file: File,
  password?: string,
): Promise<{
  images: { mime: string; dataUrl: string }[];
  needsPassword: boolean;
  wrongPassword: boolean;
}> {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), password });
    const pdf = await loadingTask.promise;
    const max = Math.min(pdf.numPages, 6);
    const images: { mime: string; dataUrl: string }[] = [];
    for (let i = 1; i <= max; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      // pdfjs typings differ across versions; canvas is required
      await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
      images.push({ mime: "image/jpeg", dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
    }
    return { images, needsPassword: false, wrongPassword: false };
  } catch (err: unknown) {
    const e = err as { name?: string; code?: number; message?: string };
    // PasswordException codes: 1 = needs password, 2 = incorrect password
    if (e?.name === "PasswordException") {
      return { images: [], needsPassword: true, wrongPassword: e.code === 2 };
    }
    throw err;
  }
}

async function extractTextFromPdf(file: File, password?: string): Promise<string> {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), password });
  const pdf = await loadingTask.promise;
  const max = Math.min(pdf.numPages, 10);
  const pages: string[] = [];
  for (let i = 1; i <= max; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = item.str?.trim();
      const transform = item.transform;
      if (!str || !transform) continue;
      const x = Math.round(transform[4] ?? 0);
      const y = Math.round((transform[5] ?? 0) / 3) * 3;
      const row = lines.get(y) ?? [];
      row.push({ x, text: str });
      lines.set(y, row);
    }
    pages.push(
      Array.from(lines.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, row]) => row.sort((a, b) => a.x - b.x).map((part) => part.text).join(" "))
        .join("\n"),
    );
  }
  return pages.join("\n").slice(0, 200_000);
}

async function fileToDataUrl(file: File | Blob, forceMime?: string): Promise<string> {
  const targetMime = forceMime || file.type;
  if (targetMime?.startsWith("image/")) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("No se pudo preparar la captura para lectura."));
        img.src = objectUrl;
      });
      const maxSide = 1900;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.86);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = String(r.result);
      if (forceMime && result.startsWith("data:application/octet-stream")) {
        resolve(result.replace("data:application/octet-stream", `data:${forceMime}`));
      } else {
        resolve(result);
      }
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function renderBlobPdfToImages(blob: Blob): Promise<{ mime: string; dataUrl: string }[]> {
  const pdfjs = await loadPdfJs();
  const buffer = await blob.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const max = Math.min(pdf.numPages, 6);
  const images: { mime: string; dataUrl: string }[] = [];
  for (let i = 1; i <= max; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
    images.push({ mime: "image/jpeg", dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
  }
  return images;
}

async function extractImagesFromZip(file: File): Promise<{ mime: string; dataUrl: string }[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files)
    .filter((e) => !e.dir && !/^__MACOSX\//.test(e.name) && !/\/\.DS_Store$/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const images: { mime: string; dataUrl: string }[] = [];
  for (const entry of entries) {
    if (images.length >= 10) break;
    const lower = entry.name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      const blob = await entry.async("blob");
      const pdfImgs = await renderBlobPdfToImages(blob);
      for (const img of pdfImgs) {
        if (images.length >= 10) break;
        images.push(img);
      }
    } else if (/\.(png|jpe?g|webp)$/.test(lower)) {
      const mime = lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg";
      const blob = await entry.async("blob");
      const dataUrl = await fileToDataUrl(blob, mime);
      images.push({ mime, dataUrl });
    }
  }
  if (images.length === 0) {
    throw new Error("El ZIP no contiene PDFs ni imágenes (JPG/PNG/WebP).");
  }
  return images;
}

function getConfianza(data: ExtractoData | null, field: string): Confianza {
  const c = data?.confianza;
  if (!c || typeof c !== "object") return "";
  const v = (c as Record<string, string>)[field];
  return (v as Confianza) ?? "";
}

function confColor(c: Confianza, value: string) {
  if (!value)
    return {
      bg: "rgba(244,162,97,0.10)",
      border: "rgba(244,162,97,0.35)",
      label: "Requiere revisión",
      labelColor: "#F4A261",
    };
  if (c === "alta")
    return {
      bg: "rgba(132,185,143,0.10)",
      border: "rgba(132,185,143,0.35)",
      label: "Alta confianza",
      labelColor: "#84B98F",
    };
  if (c === "media")
    return {
      bg: "rgba(68,93,163,0.10)",
      border: "rgba(68,93,163,0.35)",
      label: "Media confianza",
      labelColor: "#7B8FCB",
    };
  if (c === "baja")
    return {
      bg: "rgba(244,162,97,0.12)",
      border: "rgba(244,162,97,0.40)",
      label: "Baja confianza · revisar",
      labelColor: "#F4A261",
    };
  return {
    bg: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.08)",
    label: "",
    labelColor: "#94a3b8",
  };
}

const STAGES: { id: Stage; label: string }[] = [
  { id: "idle", label: "Archivo cargado" },
  { id: "reading", label: "Leyendo extracto" },
  { id: "review", label: "Datos detectados" },
  { id: "applied", label: "Simulador completado" },
];

export function ExtractoReader({ modo, onApply, existingArchivoPath }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [wrongPassword, setWrongPassword] = useState(false);
  const [parsed, setParsed] = useState<ExtractoData | null>(null);
  const [archivoPath, setArchivoPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const { data: catalogoProductos = [] } = useProductosBancarios();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Evita que el navegador abra el archivo si el usuario suelta fuera de la zona
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const callExtract = useServerFn(extractStatement);

  const handleViewExisting = async () => {
    if (!existingArchivoPath) return;
    const { data, error } = await supabase.storage
      .from("extractos")
      .createSignedUrl(existingArchivoPath, 60 * 5);
    if (error) {
      alert(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };


  const reset = () => {
    setStage("idle");
    setErrorMsg(null);
    setFile(null);
    setPassword("");
    setWrongPassword(false);
    setParsed(null);
    setArchivoPath(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileSelect = async (f: File) => {
    setFile(f);
    setErrorMsg(null);
    setParsed(null);
    await processFile(f, undefined);
  };

  const uploadOriginal = async (f: File) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;
      const path = `${uid}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("extractos").upload(path, f, {
        cacheControl: "3600",
        upsert: false,
        contentType: f.type || "application/octet-stream",
      });
      if (!upErr) setArchivoPath(path);
    } catch (e) {
      console.warn("No se pudo subir el archivo a storage:", e);
    }
  };

  const processFile = async (f: File, pwd: string | undefined) => {
    setStage("reading");
    try {
      let images: { mime: string; dataUrl: string }[] = [];
      let rawText = "";
      const lowerName = f.name.toLowerCase();
      const isZip =
        f.type === "application/zip" ||
        f.type === "application/x-zip-compressed" ||
        lowerName.endsWith(".zip");
      if (f.type === "application/pdf" || lowerName.endsWith(".pdf")) {
        try {
          rawText = await extractTextFromPdf(f, pwd);
          if (rawText.trim().length > 250) {
            const deterministicResp = await callExtract({ data: { images: [], rawText } });
            if (deterministicResp.data) {
              await uploadOriginal(f);
              setParsed(
                normalizeExtractData(
                  recomputeDaviviendaHipotecario(
                    recomputeDaviviendaLeasing(recomputeBancolombia(deterministicResp.data)),
                  ),
                ),
              );
              setStage("review");
              return;
            }
          }
        } catch (textErr) {
          const e = textErr as { name?: string; code?: number };
          if (e?.name === "PasswordException") {
            setWrongPassword(e.code === 2);
            setStage("password");
            return;
          }
          console.warn("No se pudo extraer texto estructural del PDF:", textErr);
        }
        try {
          const result = await renderPdfToImages(f, pwd);
          if (result.needsPassword) {
            setWrongPassword(result.wrongPassword);
            setStage("password");
            return;
          }
          images = result.images;
        } catch (imageErr) {
          if (rawText.trim().length <= 250) throw imageErr;
          console.warn("No se pudieron generar imágenes del PDF; se usará texto extraído:", imageErr);
        }
        if (images.length === 0 && rawText.trim().length === 0) {
          throw new Error("No pude leer texto ni generar imágenes del PDF. Verifica que no esté dañado o sube una captura clara del extracto.");
        }
      } else if (f.type.startsWith("image/")) {
        const url = await fileToDataUrl(f);
        images = [{ mime: f.type, dataUrl: url }];
      } else if (isZip) {
        images = await extractImagesFromZip(f);
      } else {
        throw new Error(
          "Formato no soportado. Sube un PDF, imagen (JPG/PNG) o un ZIP con esos archivos.",
        );
      }

      // Subir archivo original a Supabase Storage (privado)
      await uploadOriginal(f);

      // Llamar IA
      const resp = await callExtract({ data: { images, rawText } });
      if (resp.error || !resp.data) {
        setErrorMsg(
          resp.error ||
            `No se pudieron extraer datos. Archivo: ${f.name}. Texto leído: ${rawText.trim().length} caracteres. Imágenes generadas: ${images.length}.`,
        );
        setStage("error");
        return;
      }
      setParsed(
        normalizeExtractData(
          recomputeDaviviendaHipotecario(recomputeDaviviendaLeasing(recomputeBancolombia(resp.data))),
        ),
      );
      setStage("review");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Error procesando el archivo.");
      setStage("error");
    }
  };

  const BANCOLOMBIA_KEYS = new Set([
    "valorSeguroVida",
    "valorSeguroIncendio",
    "valorSeguroTerremoto",
    "valorCuotaSinSubsidioGobierno",
    "valorSubsidioGobierno",
    "valorAPagar",
    "valorCuotaConSubsidio",
    "cuotaConInteresSinSeguros",
    "cuotaSinSeguros",
    "seguros",
    "cuotaPagadaCliente",
    "valorCobertura",
  ]);

  const DAVIVIENDA_LEASING_KEYS = new Set([
    "banco", "producto", "tipoCredito", "moneda", "sistemaAmortizacion",
    "plazoInicial", "cuotasPendientes", "cuotasPagadas", "cuotaMensual",
    "seguros", "tea", "teaCobrada", "teaPactada",
    "valorSeguroVida", "valorSeguroIncendio", "valorSeguroTerremoto", "valorCobertura",
    "tasaCobertura", "tipoBeneficio", "tieneCobertura", "cuotaBaseSimulacion",
    "saldoUVR", "valorUVR", "saldoCapital",
  ]);


  // Normaliza cuotasPagadas / cuotasPendientes. Misma lógica que el servidor
  // para que ZIP, PDF, imagen y ediciones manuales produzcan el mismo objeto.
  const normalizeExtractData = (data: ExtractoData): ExtractoData => {
    const intStr = (k: string) => {
      const v = data[k];
      if (typeof v !== "string") return 0;
      const n = parseInt(v.replace(/[^\d]/g, ""), 10);
      return Number.isFinite(n) ? n : 0;
    };
    const out: ExtractoData = { ...data };
    const cuotaActualNumero = intStr("cuotaActualNumero");
    let cuotasPagadas = intStr("cuotasPagadas");
    const plazoInicial = intStr("plazoInicial");
    const cuotasPendientesExt = intStr("cuotasPendientes");
    const advert: string[] = [];

    if (cuotasPagadas <= 0 && cuotaActualNumero > 0) {
      cuotasPagadas = cuotaActualNumero;
      out.cuotasPagadas = String(cuotaActualNumero);
    }
    const esBancolombia = typeof out.banco === "string" && /bancolombia/i.test(out.banco);
    const esFna = /fondo\s+nacional\s+del\s+ahorro|\bfna\b/i.test(`${out.banco ?? ""} ${out.producto ?? ""}`);
    if (cuotasPagadas <= 0 && plazoInicial > 0 && cuotasPendientesExt > 0) {
      cuotasPagadas = Math.max(0, plazoInicial - cuotasPendientesExt + (esFna ? 1 : 0));
      out.cuotasPagadas = String(cuotasPagadas);
    }
    if (plazoInicial > 0 && cuotasPagadas > 0 && !esBancolombia) {
      const calc = plazoInicial - cuotasPagadas + (esFna ? 1 : 0);
      if (calc >= 0) {
        if (cuotasPendientesExt > 0 && cuotasPendientesExt !== calc) {
          advert.push(
            esFna
              ? "FNA: se usará plazo inicial menos cuota facturada más la cuota actual del recibo."
              : "Las cuotas pendientes del extracto no coinciden con el cálculo NUVIA. Se usará plazo inicial menos cuotas pagadas.",
          );
        }
        out.cuotasPendientes = String(calc);
      }
    }
    if (cuotaActualNumero > 0 && cuotasPagadas <= 0) {
      advert.push(
        "Inconsistencia detectada: el extracto contiene número de cuota, pero cuotas pagadas aparece en cero.",
      );
    }
    out.advertenciasNormalizacion = advert.join("\n");
    return out;
  };


  const recomputeBancolombia = (data: ExtractoData): ExtractoData => {
    const g = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
    const m = (k: string) => parseMontoExtracto(g(k));
    const banco = g("banco").toLowerCase();
    if (!/bancolombia/.test(banco)) return data;

    const sVida = m("valorSeguroVida");
    const sInc = m("valorSeguroIncendio");
    const sTer = m("valorSeguroTerremoto");
    const segurosSum = sVida + sInc + sTer;
    const valorAPagar = m("valorAPagar");
    const cuotaConSub = m("valorCuotaConSubsidio");
    const subsGob = m("valorSubsidioGobierno");
    const cuotaSinSubGob = m("valorCuotaSinSubsidioGobierno");
    const cuotaSinSeg = m("cuotaConInteresSinSeguros") || m("cuotaSinSeguros");
    const out: ExtractoData = { ...data };

    if (segurosSum > 0) out.seguros = String(Math.round(segurosSum));
    const cuotaCli = valorAPagar > 0 ? valorAPagar : cuotaConSub;
    if (cuotaCli > 0) out.cuotaPagadaCliente = String(Math.round(cuotaCli));
    const tieneBeneficioBancolombia = subsGob > 0 || (cuotaSinSubGob > 0 && cuotaConSub > 0 && cuotaSinSubGob > cuotaConSub);
    if (tieneBeneficioBancolombia) {
      out.valorCobertura = String(Math.round(subsGob));
      out.tieneCobertura = "si";
      if (!g("tipoBeneficio")) out.tipoBeneficio = "Subsidio Gobierno";
    } else {
      out.valorCobertura = "";
      out.tasaCobertura = "";
      out.tipoBeneficio = "";
      out.tieneCobertura = "no";
      out.cuotaSinSubsidio = "";
    }

    const errores: string[] = [];
    let cuotaBase = 0;
    if (tieneBeneficioBancolombia && cuotaSinSubGob > 0 && segurosSum > 0) {
      cuotaBase = cuotaSinSubGob + segurosSum;
    } else if (tieneBeneficioBancolombia && cuotaSinSubGob > 0) {
      cuotaBase = cuotaSinSubGob;
      errores.push("No se detectaron los seguros (vida, incendio, terremoto).");
    } else if (!tieneBeneficioBancolombia && cuotaSinSeg > 0 && segurosSum > 0) {
      cuotaBase = cuotaSinSeg + segurosSum;
    } else if (!tieneBeneficioBancolombia && cuotaCli > 0) {
      cuotaBase = cuotaCli;
    } else {
      errores.push(
        "Falta 'Valor de la cuota sin seguros y sin comisiones' para calcular la cuota base.",
      );
    }

    if (cuotaSinSeg > 0 && segurosSum > 0) {
      if (Math.abs(segurosSum - cuotaSinSeg) < 1) {
        errores.push("Seguros mensuales = Cuota sin seguros. Lectura inconsistente.");
      }
      if (segurosSum > cuotaSinSeg * 0.3) {
        errores.push("Seguros mensuales > 30% de la cuota sin seguros.");
      }
    }
    if (cuotaBase > 0 && cuotaCli > 0) {
      const limite = cuotaCli + subsGob + segurosSum + 10;
      if (cuotaBase > limite) {
        errores.push("Cuota base > cuota pagada + beneficio + seguros.");
      }
      if (cuotaBase < cuotaCli) {
        errores.push("Cuota base < cuota pagada por cliente.");
      }
    }

    if (cuotaBase > 0) out.cuotaBaseSimulacion = String(Math.round(cuotaBase));
    out.erroresValidacion = errores.join("\n");
    out.mapeoBanco = "bancolombia";
    return out;
  };

  const recomputeDaviviendaHipotecario = (data: ExtractoData): ExtractoData => {
    const g = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
    const texto = `${g("banco")} ${g("producto")} ${g("tipoCredito")}`.toLowerCase();
    if (!/davivienda/.test(texto) || /leasing/.test(texto)) return data;

    const out: ExtractoData = { ...data };
    const valorCobertura = parseMontoExtracto(g("valorCobertura")) || parseMontoExtracto(g("valorSubsidioGobierno"));
    const tasaCobertura = parseMontoExtracto(g("tasaCobertura"));
    const cuotaSinSubsidio = parseMontoExtracto(g("cuotaSinSubsidio"));
    const cuotaCliente = parseMontoExtracto(g("cuotaPagadaCliente")) || parseMontoExtracto(g("valorAPagar")) || parseMontoExtracto(g("valorCuotaConSubsidio"));
    const tieneBeneficioReal = valorCobertura > 0 || tasaCobertura > 0 || (cuotaSinSubsidio > 0 && cuotaCliente > 0 && cuotaSinSubsidio > cuotaCliente);
    const cuota = cuotaSinSubsidio || parseMontoExtracto(g("cuotaBaseSimulacion")) || parseMontoExtracto(g("cuotaMensual")) || cuotaCliente;
    const esUVR = /\buvr\b/i.test(`${g("moneda")} ${g("producto")} ${g("sistemaAmortizacion")}`);
    out.banco = "Davivienda";
    out.tipoCredito = "CREDITO_HIPOTECARIO";
    out.moneda = esUVR ? "UVR" : "PESOS";
    out.producto = `Crédito Hipotecario en ${esUVR ? "UVR" : "pesos"} ${tieneBeneficioReal ? "con" : "sin"} Beneficio de Cobertura`;
    out.tieneCobertura = tieneBeneficioReal ? "si" : "no";
    out.valorCobertura = tieneBeneficioReal && valorCobertura > 0 ? String(Math.round(valorCobertura)) : "";
    out.tasaCobertura = tieneBeneficioReal ? g("tasaCobertura") : "";
    out.tipoBeneficio = tieneBeneficioReal ? g("tipoBeneficio") || "Cobertura de Tasa" : "";
    out.cuotaSinSubsidio = tieneBeneficioReal && cuota > 0 ? String(Math.round(cuota)) : "";
    out.valorDesembolsado = "";
    if (/^0+$/.test(g("cedula").trim())) out.cedula = "";
    if (cuota > 0) {
      out.cuotaMensual = String(Math.round(cuota));
      out.cuotaPagadaCliente = cuotaCliente > 0 ? String(Math.round(cuotaCliente)) : String(Math.round(cuota));
      out.cuotaBaseSimulacion = String(Math.round(cuota));
    }
    out.requiereVerificacionBeneficio = "no";
    out.alertaCuotaBase = "";
    out.erroresValidacion = "";
    out.mapeoBanco = "davivienda_hipotecario";
    return out;
  };

  const recomputeDaviviendaLeasing = (data: ExtractoData): ExtractoData => {
    const g = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
    const m = (k: string) => parseMontoExtracto(g(k));
    const texto = `${g("banco")} ${g("producto")} ${g("tipoCredito")}`.toLowerCase();
    if (!/davivienda/.test(texto) || !/leasing/.test(texto)) return data;

    const out: ExtractoData = { ...data };
    out.banco = "Davivienda";
    out.tipoCredito = "LEASING_HABITACIONAL";
    out.producto = g("producto") || "Extracto Contrato Leasing";

    // Detectar UVR a partir de varias señales del extracto Davivienda
    const sistema = g("sistemaAmortizacion").toLowerCase();
    const monedaActual = g("moneda").toUpperCase();
    const tieneSaldoUVR = m("saldoUVR") > 0;
    const tieneValorUVR = m("valorUVR") > 0;
    const esUVR =
      monedaActual === "UVR" ||
      /\buvr\b/.test(sistema) ||
      /\buvr\b/.test(g("producto").toLowerCase()) ||
      tieneSaldoUVR ||
      tieneValorUVR;
    out.moneda = esUVR ? "UVR" : "PESOS";

    const plazo = parseInt(g("plazoInicial").replace(/\D/g, ""), 10) || 0;
    const pendientes = parseInt(g("cuotasPendientes").replace(/\D/g, ""), 10) || 0;
    if (plazo > 0 && pendientes > 0) out.cuotasPagadas = String(Math.max(0, plazo - pendientes));

    // Seguros: sumar Vida + Incendio + Protección de Pagos (en pesos).
    // Si el motor entregó un valor agregado pero los desglosados suman > 0 y son mayores,
    // preferimos el desglose. Esto corrige casos donde "seguros" tomó solo una línea.
    const segurosDetallados = m("valorSeguroVida") + m("valorSeguroIncendio") + m("valorSeguroTerremoto");
    const segurosActual = m("seguros");
    if (segurosDetallados > 0 && (segurosActual === 0 || segurosDetallados > segurosActual * 1.2)) {
      out.seguros = String(Math.round(segurosDetallados));
    }

    if (!g("tea") && g("teaCobrada")) out.tea = g("teaCobrada");

    const submodalidad = /\bbaja\b/i.test(`${g("sistemaAmortizacion")} ${g("producto")}`)
      ? "Baja"
      : /\bmedia\b/i.test(`${g("sistemaAmortizacion")} ${g("producto")}`)
        ? "Media"
        : /\balta\b/i.test(`${g("sistemaAmortizacion")} ${g("producto")}`)
          ? "Alta"
          : "";
    const tieneBeneficioReal = m("valorCobertura") > 0 || parseMontoExtracto(g("tasaCobertura")) > 0;
    out.tieneCobertura = tieneBeneficioReal ? "si" : "no";
    out.producto = `Contrato leasing en ${esUVR ? `UVR${submodalidad ? ` ${submodalidad}` : ""}` : "Pesos"} ${tieneBeneficioReal ? "con" : "sin"} beneficio de cobertura`;
    if (!tieneBeneficioReal) {
      out.valorCobertura = "";
      out.tasaCobertura = "";
      out.tipoBeneficio = "";
      out.requiereVerificacionBeneficio = "no";
      out.alertaCuotaBase = "";
      out.erroresValidacion = "";
    }

    const cuota = m("cuotaMensual") || m("cuotaPagadaCliente") || m("cuotaBaseSimulacion");
    if (cuota > 0) {
      out.cuotaMensual = String(Math.round(cuota));
      out.cuotaPagadaCliente = String(Math.round(cuota));
      out.cuotaBaseSimulacion = String(Math.round(cuota));
      const seguros = parseMontoExtracto(out.seguros as string);
      if (seguros > 0) out.cuotaConInteresSinSeguros = String(Math.round(cuota - seguros));
    }
    out.mapeoBanco = "davivienda_leasing";
    return out;
  };

  const hasBeneficioReal = (data: ExtractoData, producto: string) => {
    const get = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
    const valorCobertura = parseMontoExtracto(get("valorCobertura"));
    const tasaCobertura = parseMontoExtracto(get("tasaCobertura"));
    const subsidioGobierno = parseMontoExtracto(get("valorSubsidioGobierno"));
    if (valorCobertura > 0 || tasaCobertura > 0 || subsidioGobierno > 0) return true;
    const cuotaSinSubsidio = parseMontoExtracto(get("cuotaSinSubsidio")) || parseMontoExtracto(get("valorCuotaSinSubsidioGobierno"));
    const cuotaCliente = parseMontoExtracto(get("cuotaPagadaCliente")) || parseMontoExtracto(get("valorCuotaConSubsidio"));
    return cuotaSinSubsidio > 0 && cuotaCliente > 0 && cuotaSinSubsidio > cuotaCliente;
  };


  const updateField = (key: string, value: string) => {
    setParsed((prev) => {
      if (!prev) return prev;
      let next: ExtractoData = { ...prev, [key]: value };
      if (BANCOLOMBIA_KEYS.has(key) || key === "banco") {
        next = recomputeBancolombia(next);
      }
      if (DAVIVIENDA_LEASING_KEYS.has(key)) {
        next = recomputeDaviviendaLeasing(next);
      }
      next = recomputeDaviviendaHipotecario(next);
      if (key === "cuotasPagadas" || key === "plazoInicial" || key === "cuotasPendientes" || key === "cuotaActualNumero") {
        next = normalizeExtractData(next);
      }
      return next;
    });
  };


  const handleConfirm = async () => {
    if (!parsed) return;
    const get = (k: string) => (typeof parsed[k] === "string" ? (parsed[k] as string) : "");
    // Validación dura: cuotasPagadas no puede ser 0 si hay número de cuota
    const _ip = (k: string) => {
      const v = parsed[k];
      if (typeof v !== "string") return 0;
      const n = parseInt(v.replace(/[^\d]/g, ""), 10);
      return Number.isFinite(n) ? n : 0;
    };
    const tieneMinimoParaSimular =
      parseMontoExtracto(get("saldoCapital")) > 0 &&
      parseMontoExtracto(get("cuotaBaseSimulacion") || get("cuotaMensual")) > 0;
    if (!tieneMinimoParaSimular && _ip("cuotasPagadas") <= 0 && _ip("cuotaActualNumero") > 0) {
      return;
    }
    if (!tieneMinimoParaSimular && (_ip("plazoInicial") <= 0 || _ip("cuotasPagadas") <= 0)) {
      return;
    }

    const tieneCob = hasBeneficioReal(parsed, get("producto"));
    let producto = get("producto");
    if (tieneCob && producto && !/con\s+beneficio\s+de\s+cobertura/i.test(producto)) {
      producto = `${producto} con Beneficio de Cobertura`;
    }
    // Normalizar banco: Colpatria -> Davibank (cambio de razón social)
    let banco = get("banco");
    if (/colpatria/i.test(banco)) banco = "Davibank";

    // Cuota base de simulación: si hay beneficio se usa la cuota real (sin subsidio)
    // como cuota del simulador. Si no hay beneficio, se usa la cuota mensual normal.
    const cuotaBaseStr = get("cuotaBaseSimulacion") || get("cuotaMensual");
    if (tieneCob && parseMontoExtracto(cuotaBaseStr) <= 0) {
      setParsed((prev) =>
        prev
          ? {
              ...prev,
              requiereVerificacionBeneficio: "si",
              alertaCuotaBase:
                "No se pudo identificar la cuota con interés sin seguros. Verifique manualmente.",
            }
          : prev,
      );
      cuotaBaseInputRef.current?.focus();
      return;
    }
    const cuotaParaSimulador = cuotaBaseStr;

    // Mapeo OCR → catálogo jerárquico de productos bancarios
    const parsedAttrs = parseProductoComercial(producto);
    const tipoLower = get("tipoCredito").toLowerCase();
    const esLeasingFinal = parsedAttrs.esLeasing || /leasing/.test(tipoLower);
    const monedaUpper = get("moneda").toUpperCase();
    const esUVRFinal = parsedAttrs.esUVR || monedaUpper === "UVR" || modo === "uvr";
    const matchExacto = buscarProductoComercial(catalogoProductos, {
      banco,
      esLeasing: esLeasingFinal,
      esUVR: esUVRFinal,
      cobertura: tieneCob,
    });
    const matchFallback = buscarProductoComercial(catalogoProductos, {
      banco,
      esLeasing: esLeasingFinal,
      esUVR: esUVRFinal,
    });
    const match = matchExacto ?? (matchFallback?.cobertura === tieneCob ? matchFallback : null);

    // Sanitizar cédula: descartar valores claramente placeholder/inválidos
    // (todo ceros, vacíos o longitud absurda). Evita que llegue "0000000000"
    // al expediente y luego al Director Financiero.
    const cedulaRaw = get("cedula").replace(/\D/g, "");
    const cedulaLimpia =
      cedulaRaw && !/^0+$/.test(cedulaRaw) && cedulaRaw.length >= 5 && cedulaRaw.length <= 12
        ? cedulaRaw
        : "";

    // Normalizar banco contra el catálogo (case-insensitive). Si "DAVIVIENDA"
    // llega del OCR y el catálogo tiene "Davivienda", se persiste el canónico.
    const bancoFinal = match?.banco ?? banco;
    const bancoCanon =
      catalogoProductos.find((p) => p.banco.toLowerCase() === bancoFinal.toLowerCase())?.banco ??
      bancoFinal;

    // Detectar moneda real del extracto a partir de los datos parseados,
    // independiente del modo del simulador. Requerimos AL MENOS una señal
    // concreta de UVR: producto/sistema con "UVR" o saldoUVR/valorUVR con
    // dígitos. El campo moneda="UVR" del OCR por sí solo no es suficiente
    // (el modelo a veces lo marca por error en extractos en pesos).
    const saldoUvrRaw = get("saldoUVR");
    const valorUvrRaw = get("valorUVR");
    const tieneDatosUvr =
      (saldoUvrRaw && saldoUvrRaw.replace(/[^\d]/g, "") !== "") ||
      (valorUvrRaw && valorUvrRaw.replace(/[^\d]/g, "") !== "");
    const sistemaAmortLower = get("sistemaAmortizacion").toLowerCase();
    const productoLower = get("producto").toLowerCase();
    const uvrEnTexto = /\buvr\b/.test(productoLower) || /\buvr\b/.test(sistemaAmortLower);
    const señalUvrFuerte = parsedAttrs.esUVR || tieneDatosUvr || uvrEnTexto;
    const monedaDetectada: "uvr" | "pesos" =
      señalUvrFuerte || (monedaUpper === "UVR" && tieneDatosUvr) ? "uvr" : "pesos";

    const payload: ExtractoApplyPayload = {
      cliente: {
        nombre: get("cliente"),
        cedula: cedulaLimpia,
        numeroCredito: get("numeroCredito"),
        banco: bancoCanon,
        tipoProducto: match?.nombre_comercial ?? producto,
        productoBancarioId: match?.id ?? null,
        plazoInicial: get("plazoInicial"),
        cuotasPagadas: get("cuotasPagadas"),
        cuotasPendientes: get("cuotasPendientes"),
      },
      archivoPath: archivoPath ?? undefined,
      monedaDetectada,
      raw: {
        banco: bancoCanon,
        producto,
        moneda: monedaDetectada,
        datos: parsed as unknown as Record<string, unknown>,
        archivoNombre: file?.name,
      },
    };

    if (modo === "pesos") {
      payload.pesos = {
        saldoCapital: get("saldoCapital"),
        cuotaActual: cuotaParaSimulador,
        seguros: get("seguros"),
        tea: get("tea"),
        valorDesembolsado: get("valorDesembolsado"),
      };
    } else {
      payload.uvr = {
        saldoUVR: get("saldoUVR"),
        valorUVR: get("valorUVR"),
        saldoPesos: get("saldoCapital"),
        valorDesembolsado: get("valorDesembolsado"),
        cuotaActualPesos: cuotaParaSimulador,
        seguros: get("seguros"),
        teaCobrada: get("tea"),
      };
    }
    if (tieneCob) {
      payload.cobertura = {
        activo: true,
        valorCobertura: get("valorCobertura"),
        tasaCobertura: get("tasaCobertura"),
        tipoBeneficio: get("tipoBeneficio") || "Beneficio detectado",
        cuotaPagadaCliente: get("cuotaPagadaCliente"),
        cuotaConInteresSinSeguros: get("cuotaConInteresSinSeguros"),
        segurosMensuales: get("seguros"),
        cuotaBaseSimulacion: cuotaBaseStr,
        requiereVerificacion: get("requiereVerificacionBeneficio").toLowerCase() === "si",
      };
    }
    const applied = await onApply(payload);
    if (applied === false) return;
    setStage("applied");
    setOpen(false);
    setTimeout(() => {
      reset();
    }, 250);
  };

  // Campos a mostrar según modo
  const fieldsBase: { key: string; label: string }[] = [
    { key: "banco", label: "Banco" },
    { key: "cliente", label: "Nombre del cliente" },
    { key: "cedula", label: "Cédula" },
    { key: "numeroCredito", label: "Número de crédito" },
    { key: "producto", label: "Producto" },
    { key: "moneda", label: "Moneda" },
    { key: "plazoInicial", label: "Plazo inicial (meses)" },
    { key: "cuotasPagadas", label: "Cuotas pagadas" },
    { key: "valorDesembolsado", label: "Valor desembolsado" },
    { key: "saldoCapital", label: "Saldo actual en pesos" },
    { key: "cuotaMensual", label: "Cuota mensual (con seguros)" },
    { key: "seguros", label: "Seguros mensuales" },
    { key: "teaCobrada", label: "Tasa de interés cobrada (%)" },
    { key: "teaPactada", label: "Tasa de interés pactada (%) · referencia" },
    { key: "tea", label: "Tasa usada para simulación (%)" },
    {
      key: "tipoBeneficio",
      label: "Tipo de beneficio (FRECH, Fresh, Cobertura VIS, Mi Casa Ya, etc.)",
    },
    { key: "valorCobertura", label: "Valor del beneficio mensual" },
    { key: "tasaCobertura", label: "Tasa de cobertura/subsidio (%)" },
    { key: "cuotaPagadaCliente", label: "Cuota pagada por cliente (con subsidio)" },
    { key: "cuotaConInteresSinSeguros", label: "Cuota con interés / sin seguros" },
    { key: "cuotaSinSubsidio", label: "Cuota sin subsidio (si el extracto la muestra)" },
    { key: "valorSeguroVida", label: "Seguro vida (mensual)" },
    { key: "valorSeguroIncendio", label: "Seguro incendio (mensual)" },
    { key: "valorSeguroTerremoto", label: "Seguro terremoto (mensual)" },
    { key: "valorAPagar", label: "Bancolombia · Valor a Pagar" },
    {
      key: "valorCuotaSinSubsidioGobierno",
      label: "Bancolombia · Valor cuota sin subsidio Gobierno",
    },
    { key: "valorSubsidioGobierno", label: "Bancolombia · Valor subsidio Gobierno" },
    { key: "valorCuotaConSubsidio", label: "Bancolombia · Valor cuota con subsidio" },
    { key: "fechaExtracto", label: "Fecha del extracto" },
  ];
  const fields =
    modo === "uvr"
      ? [
          ...fieldsBase,
          { key: "saldoUVR", label: "Saldo en UVR" },
          { key: "valorUVR", label: "Valor UVR del día" },
        ]
      : fieldsBase;

  const teaCobrada = (parsed?.teaCobrada as string) ?? "";
  const teaPactada = (parsed?.teaPactada as string) ?? "";
  const teaUsada = (parsed?.tea as string) ?? "";
  const soloPactada = !teaCobrada && !!teaPactada;

  // Resumen de interpretación del crédito (cuota base de simulación)
  const tipoBeneficio = (parsed?.tipoBeneficio as string) ?? "";
  const tieneCoberturaStr = ((parsed?.tieneCobertura as string) ?? "").toLowerCase() === "si";
  const tieneBeneficio =
    !!parsed &&
    hasBeneficioReal(parsed, (parsed.producto as string) ?? "") &&
    (tieneCoberturaStr || !!tipoBeneficio || !!(parsed?.valorCobertura as string) || !!(parsed?.tasaCobertura as string));
  const requiereVerificacion =
    ((parsed?.requiereVerificacionBeneficio as string) ?? "").toLowerCase() === "si";
  const alertaCuotaBase = (parsed?.alertaCuotaBase as string) ?? "";
  const erroresValidacion = ((parsed?.erroresValidacion as string) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const advertenciasNorm = ((parsed?.advertenciasNormalizacion as string) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const hayErrores = erroresValidacion.length > 0;
  const cuotaBaseLista = parseMontoExtracto((parsed?.cuotaBaseSimulacion as string) ?? "") > 0;

  const tieneMinimoSimulacion =
    parseMontoExtracto((parsed?.saldoCapital as string) ?? "") > 0 &&
    parseMontoExtracto(((parsed?.cuotaBaseSimulacion as string) || (parsed?.cuotaMensual as string) || "")) > 0;
  const confirmDisabled =
    (tieneBeneficio && !cuotaBaseLista) ||
    !tieneMinimoSimulacion;

  const fmtCO = (raw: string) => {
    const n = parseMontoExtracto(raw);
    return isFinite(n) && n > 0
      ? new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        }).format(n)
      : "—";
  };
  const cuotaBaseInputRef = useRef<HTMLInputElement>(null);

  const progressIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <>
      {/* Tarjeta principal de entrada */}
      <div
        className="relative overflow-hidden rounded-2xl transition-transform"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!dragActive) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.currentTarget === e.target) setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
          const f = e.dataTransfer?.files?.[0];
          if (f) {
            reset();
            setOpen(true);
            handleFileSelect(f);
          }
        }}
        style={{
          background:
            "linear-gradient(135deg, rgba(31,42,68,0.88) 0%, rgba(46,67,118,0.82) 45%, rgba(58,99,96,0.82) 100%)",
          border: `1px solid ${dragActive ? "rgba(132,185,143,0.65)" : "rgba(255,255,255,0.18)"}`,
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          boxShadow: dragActive
            ? "0 24px 60px -26px rgba(132,185,143,0.45), inset 0 1px 0 rgba(255,255,255,0.22)"
            : "0 28px 70px -30px rgba(31,42,68,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
          transform: dragActive ? "scale(1.005)" : "scale(1)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(112deg, rgba(255,255,255,0.42) 0%, transparent 18%, transparent 70%, rgba(255,255,255,0.12) 100%)",
          }}
        />
        {/* glow */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(68,93,163,0.08), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(132,185,143,0.08), transparent 70%)" }}
        />
        {dragActive && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
            style={{
              background: "rgba(132,185,143,0.10)",
              border: "2px dashed rgba(132,185,143,0.7)",
            }}
          >
            <div className="flex flex-col items-center gap-2 text-[#84B98F]">
              <Upload className="h-10 w-10" />
              <span className="text-sm font-semibold">Suelta el extracto para analizarlo</span>
            </div>
          </div>
        )}

        <div className="relative flex flex-col gap-4 p-5 sm:p-6">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(68,93,163,0.48), rgba(132,185,143,0.42))",
                boxShadow: "0 12px 32px -18px rgba(132,185,143,0.34)",
              }}
            >
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-[14px] font-semibold leading-snug text-white break-words">
                  Lectura automática de extracto
                </h3>
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                  style={{
                    background: "rgba(132,185,143,0.15)",
                    color: "#84B98F",
                    border: "1px solid rgba(132,185,143,0.35)",
                  }}
                >
                  NUVIA IA
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-white/65 break-words">
                Sube el extracto del cliente y NUVIA IA intentará identificar los datos principales
                para prellenar el simulador. Siempre podrás revisar y corregir antes de generar la
                propuesta.
              </p>
              <div
                className="mt-2 rounded-md px-2.5 py-1.5 text-[11px] leading-snug"
                style={{
                  background: "rgba(68,93,163,0.18)",
                  color: "#C9D6F2",
                  border: "1px solid rgba(132,185,143,0.28)",
                }}
              >
                ℹ️ La auditoría QA automática se ejecuta desde el Expediente Maestro cuando el extracto queda asociado a un expediente.
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2">
            <button
              onClick={() => {
                reset();
                fileRef.current?.click();
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, rgba(68,93,163,0.48), rgba(132,185,143,0.42))",
                boxShadow: "0 10px 28px -16px rgba(68,93,163,0.42)",
              }}
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="truncate">Subir extracto</span>
            </button>
            {existingArchivoPath && (
              <button
                onClick={handleViewExisting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold text-white/85 transition hover:text-white"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(132,185,143,0.35)",
                }}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">Ver extracto guardado</span>
              </button>
            )}
            <button
              onClick={() => {
                const el = document.getElementById("datos-cliente-card");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold text-white/80 transition hover:text-white"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.10)",
              }}
            >
              <span className="truncate">Diligenciar manualmente</span>
            </button>
          </div>


        </div>
      </div>

      {/* input file oculto */}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,application/zip,.zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setOpen(true);
            handleFileSelect(f);
          }
        }}
      />

      {/* Modal */}
      {open && portalReady && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(5,8,20,0.78)", backdropFilter: "blur(8px)" }}
          onClick={() => stage !== "reading" && setOpen(false)}
        >
          <div
            className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl"
            style={{
              background: "linear-gradient(145deg, rgba(238,245,255,0.26), rgba(238,245,255,0.13) 42%, rgba(238,245,255,0.06))",
              border: "1px solid rgba(238,245,255,0.52)",
              boxShadow: "0 46px 110px -48px rgba(0,0,0,0.98), inset 0 1px 0 rgba(255,255,255,0.56), inset 0 -1px 0 rgba(255,255,255,0.14)",
              backdropFilter: "blur(34px) saturate(155%)",
              WebkitBackdropFilter: "blur(34px) saturate(155%)",
              height: "min(92dvh, 860px)",
              maxHeight: "calc(100dvh - 2rem)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(112deg, rgba(255,255,255,0.24) 0%, transparent 15%, transparent 76%, rgba(255,255,255,0.075) 100%)",
              }}
            />
            <div
              className="relative flex shrink-0 items-center justify-between border-b px-6 py-4"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-white/70" />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {file?.name ?? "Subir extracto bancario"}
                  </div>
                  <div className="text-[11px] text-white/50">
                    Procesamiento privado · {modo.toUpperCase()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => stage !== "reading" && setOpen(false)}
                className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/5 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Progress */}
            <div className="relative shrink-0 border-b px-6 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                {STAGES.map((s, i) => {
                  const active = i <= progressIdx;
                  const current = s.id === stage;
                  return (
                    <div key={s.id} className="flex flex-1 items-center gap-2">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{
                          background: active
                            ? "linear-gradient(135deg, rgba(68,93,163,0.68), rgba(132,185,143,0.62))"
                            : "rgba(255,255,255,0.05)",
                          color: active ? "#fff" : "rgba(255,255,255,0.5)",
                          boxShadow: current ? "0 0 0 4px rgba(132,185,143,0.18)" : undefined,
                        }}
                      >
                        {i + 1}
                      </div>
                      <span className={`text-[11px] ${active ? "text-white" : "text-white/40"}`}>
                        {s.label}
                      </span>
                      {i < STAGES.length - 1 && (
                        <div
                          className="mx-2 h-px flex-1"
                          style={{
                            background: active
                              ? "linear-gradient(90deg, rgba(68,93,163,0.68), rgba(132,185,143,0.62))"
                              : "rgba(255,255,255,0.08)",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {stage === "idle" && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
                    if (!dragActive) setDragActive(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                  onClick={() => fileRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 text-center transition-all ${
                    dragActive ? "scale-[1.01]" : ""
                  }`}
                  style={{
                    borderColor: dragActive ? "#84B98F" : "rgba(255,255,255,0.15)",
                    background: dragActive ? "rgba(132,185,143,0.08)" : "transparent",
                  }}
                >
                  <Upload className={`h-10 w-10 ${dragActive ? "text-[#84B98F]" : "text-white/40"}`} />
                  <div className="text-sm text-white/70 pointer-events-none">
                    {dragActive ? "Suelta el archivo aquí" : "Arrastra el extracto o haz clic para seleccionar"}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileRef.current?.click();
                    }}
                    className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, rgba(68,93,163,0.56), rgba(132,185,143,0.48))" }}
                  >
                    Seleccionar archivo
                  </button>
                  <div className="text-[11px] text-white/40 pointer-events-none">PDF, JPG o PNG · hasta 6 páginas</div>
                </div>
              )}


              {stage === "reading" && <NuviaReadingAnimation />}

              {stage === "password" && (
                <div className="mx-auto max-w-md py-6">
                  <div
                    className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: "rgba(244,162,97,0.10)",
                      border: "1px solid rgba(244,162,97,0.30)",
                    }}
                  >
                    <KeyRound className="h-5 w-5 text-[#F4A261]" />
                    <div className="text-sm text-white">
                      {wrongPassword
                        ? "La clave no es correcta. Inténtalo de nuevo."
                        : "Este extracto parece estar protegido con contraseña. Por favor ingresa la clave para continuar."}
                    </div>
                  </div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/60">
                    Clave del PDF
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    className="mt-2 w-full rounded-lg px-4 py-3 text-sm text-white outline-none transition"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && file && password) processFile(file, password);
                    }}
                  />
                  <button
                    onClick={() => file && password && processFile(file, password)}
                    disabled={!password}
                    className="mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, rgba(68,93,163,0.56), rgba(132,185,143,0.48))" }}
                  >
                    Leer extracto
                  </button>
                </div>
              )}

              {stage === "error" && (
                <div className="mx-auto max-w-lg py-8 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-[#F04438]" />
                  <div className="mt-3 text-sm font-semibold text-white">
                    No se pudo procesar el extracto
                  </div>
                  <div className="mt-1 text-xs text-white/60">{errorMsg}</div>
                  <button
                    onClick={reset}
                    className="mt-5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}

              {stage === "review" && parsed && (
                <div>
                  <div
                    className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3"
                    style={{
                      background: "rgba(132,185,143,0.08)",
                      border: "1px solid rgba(132,185,143,0.30)",
                    }}
                  >
                    <ShieldCheck className="h-5 w-5 text-[#84B98F]" />
                    <div className="text-xs text-white/80">
                      Datos detectados por IA. Revisa y corrige antes de llenar el simulador. Tu
                      validación es obligatoria.
                    </div>
                  </div>

                  {/* Resumen de tasas */}
                  {(teaCobrada || teaPactada || teaUsada) && (
                    <div
                      className="mb-4 rounded-xl px-4 py-3"
                      style={{
                        background: soloPactada ? "rgba(244,162,97,0.10)" : "rgba(68,93,163,0.10)",
                        border: `1px solid ${soloPactada ? "rgba(244,162,97,0.40)" : "rgba(68,93,163,0.30)"}`,
                      }}
                    >
                      <div className="grid gap-2 text-xs text-white/85 md:grid-cols-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/55">
                            Tasa cobrada detectada
                          </div>
                          <div className="mt-0.5 font-semibold text-white">
                            {teaCobrada ? `${teaCobrada}%` : "— no detectada"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/55">
                            Tasa pactada detectada
                          </div>
                          <div className="mt-0.5 font-semibold text-white">
                            {teaPactada ? `${teaPactada}%` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/55">
                            Tasa usada para simulación
                          </div>
                          <div
                            className="mt-0.5 font-semibold"
                            style={{ color: teaUsada ? "#84B98F" : "#F4A261" }}
                          >
                            {teaUsada ? `${teaUsada}%` : "— pendiente"}
                          </div>
                        </div>
                      </div>
                      {soloPactada ? (
                        <div
                          className="mt-2 flex items-start gap-2 text-[11px] font-semibold"
                          style={{ color: "#F4A261" }}
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                          No se detectó tasa de interés cobrada. Verifique manualmente antes de
                          simular. La tasa pactada NO se usará automáticamente.
                        </div>
                      ) : teaUsada ? (
                        <div className="mt-2 text-[11px] text-white/65">
                          Se usa la tasa de interés cobrada para la proyección.
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* RESUMEN DE INTERPRETACIÓN DEL CRÉDITO — Cuota Base de Simulación */}
                  <div
                    className="mb-4 rounded-xl p-4"
                    style={{
                      background: tieneBeneficio
                        ? "linear-gradient(135deg, rgba(132,185,143,0.10), rgba(68,93,163,0.08))"
                        : "rgba(255,255,255,0.03)",
                      border: `1px solid ${tieneBeneficio ? "rgba(132,185,143,0.45)" : "rgba(255,255,255,0.10)"}`,
                    }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" style={{ color: "#84B98F" }} />
                      <div className="text-[12px] font-bold uppercase tracking-wider text-white">
                        Resumen de interpretación del crédito
                      </div>
                      {tieneBeneficio && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{
                            background: "rgba(132,185,143,0.18)",
                            color: "#84B98F",
                            border: "1px solid rgba(132,185,143,0.45)",
                          }}
                        >
                          Beneficio: {tipoBeneficio || "Cobertura detectada"}
                        </span>
                      )}
                    </div>

                    {(requiereVerificacion || alertaCuotaBase) && !hayErrores && (
                      <div
                        className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]"
                        style={{
                          background: "rgba(244,162,97,0.12)",
                          border: "1px solid rgba(244,162,97,0.45)",
                          color: "#F4A261",
                        }}
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {alertaCuotaBase ||
                            "Se detectó un posible beneficio de cobertura o subsidio. Verifique manualmente la cuota base de simulación."}
                        </span>
                      </div>
                    )}

                    {advertenciasNorm.length > 0 && (
                      <div
                        className="mb-3 rounded-lg px-3 py-2 text-[12px]"
                        style={{
                          background: "rgba(244,162,97,0.12)",
                          border: "1px solid rgba(244,162,97,0.45)",
                          color: "#F4A261",
                        }}
                      >
                        <div className="mb-1 flex items-center gap-2 font-bold uppercase tracking-wider">
                          <AlertTriangle className="h-4 w-4" />
                          Revisión necesaria
                        </div>
                        <ul className="ml-5 list-disc space-y-0.5">
                          {advertenciasNorm.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}




                    {hayErrores && (
                      <div
                        className="mb-3 rounded-lg px-3 py-2 text-[12px]"
                        style={{
                          background: "rgba(240,68,56,0.12)",
                          border: "1px solid rgba(240,68,56,0.5)",
                          color: "#F04438",
                        }}
                      >
                        <div className="mb-1 flex items-center gap-2 font-bold uppercase tracking-wider">
                          <AlertTriangle className="h-4 w-4" />
                          Lectura inconsistente. Revise manualmente los valores detectados.
                        </div>
                        <ul className="ml-5 list-disc space-y-0.5">
                          {erroresValidacion.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-white/55">
                          Cuota pagada por cliente
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-white">
                          {fmtCO(parsed.cuotaPagadaCliente as string)}
                        </div>
                      </div>
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-white/55">
                          Cuota con interés / sin seguros
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-white">
                          {fmtCO(parsed.cuotaConInteresSinSeguros as string)}
                        </div>
                      </div>
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-white/55">
                          Beneficio aplicado
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-white">
                          {tieneBeneficio ? fmtCO(parsed.valorCobertura as string) : "—"}
                        </div>
                      </div>
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-white/55">
                          Seguros totales
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-white">
                          {fmtCO(parsed.seguros as string)}
                        </div>
                      </div>
                      <div
                        className="rounded-lg p-2.5"
                        style={{
                          background: "rgba(132,185,143,0.12)",
                          border: "1px solid rgba(132,185,143,0.45)",
                        }}
                      >
                        <div
                          className="text-[10px] uppercase tracking-wider"
                          style={{ color: "#84B98F" }}
                        >
                          Cuota base de simulación (editable)
                        </div>
                        <input
                          ref={cuotaBaseInputRef}
                          value={(parsed.cuotaBaseSimulacion as string) ?? ""}
                          onChange={(e) =>
                            updateField(
                              "cuotaBaseSimulacion",
                              e.target.value.replace(/[^\d,.]/g, ""),
                            )
                          }
                          placeholder="0"
                          className="mt-1 w-full rounded-md bg-transparent px-2 py-1 text-sm font-bold text-white outline-none"
                          style={{ border: "1px solid rgba(132,185,143,0.45)" }}
                        />
                      </div>
                      <div
                        className="rounded-lg p-2.5"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="text-[10px] uppercase tracking-wider text-white/55">
                          Tasa utilizada
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-white">
                          {teaUsada ? `${teaUsada}%` : "—"}
                        </div>
                      </div>
                    </div>

                    {tieneBeneficio && (
                      <div
                        className="mt-3 rounded-lg px-3 py-2"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.10)",
                        }}
                      >
                        <p className="text-[11px] leading-relaxed text-white/70">
                          Confirma que la cuota base de simulación corresponde a la cuota real del
                          crédito antes de subsidios/coberturas.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {fields.map((f) => {
                      const val = (parsed[f.key] as string) ?? "";
                      const c = getConfianza(parsed, f.key);
                      const style = confColor(c, val);
                      return (
                        <div
                          key={f.key}
                          className="rounded-xl p-3"
                          style={{ background: style.bg, border: `1px solid ${style.border}` }}
                        >
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                              {f.label}
                            </label>
                            {style.label && (
                              <span
                                className="text-[10px] font-semibold"
                                style={{ color: style.labelColor }}
                              >
                                {style.label}
                              </span>
                            )}
                          </div>
                          <input
                            value={val}
                            onChange={(e) => updateField(f.key, e.target.value)}
                            placeholder={val ? "" : "Sin dato detectado"}
                            className="mt-1.5 w-full rounded-md bg-transparent px-2 py-1.5 text-sm text-white outline-none"
                            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {stage === "applied" && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <CheckCircle2 className="h-12 w-12 text-[#84B98F]" />
                  <div className="text-sm font-semibold text-white">
                    Simulador prellenado correctamente
                  </div>
                  <div className="text-xs text-white/50">
                    Revisa los campos del simulador y genera tus propuestas.
                  </div>
                </div>
              )}
            </div>

            {stage === "review" && (
              <div
                  className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-6 py-4"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              >
                <button
                  onClick={reset}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-white/70 hover:text-white"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  Cargar otro extracto
                </button>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => cuotaBaseInputRef.current?.focus()}
                    className="rounded-xl px-5 py-3 text-sm font-semibold text-white/85 transition hover:text-white"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    EDITAR CUOTA BASE
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={confirmDisabled}
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
                    style={{
                      background: "linear-gradient(135deg, rgba(68,93,163,0.56), rgba(132,185,143,0.48))",
                      boxShadow: "0 10px 28px -14px rgba(132,185,143,0.42)",
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    APLICAR AL SIMULADOR
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
