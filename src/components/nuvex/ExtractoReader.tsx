import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Sparkles, FileText, Loader2, ShieldCheck, AlertTriangle, X, KeyRound, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractStatement, type ExtractoData } from "@/lib/extracto.functions";

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
    plazoInicial?: string;
    cuotasPagadas?: string;
  };
  // Para pesos
  pesos?: {
    saldoCapital?: string;
    cuotaActual?: string;
    seguros?: string;
    tea?: string;
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
    cuotaBaseSimulacion?: string;
    requiereVerificacion?: boolean;
  };
  archivoPath?: string;
};

interface Props {
  modo: Modo;
  onApply: (data: ExtractoApplyPayload) => void;
}

// PDF.js dynamic loader (client-only)
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}


async function renderPdfToImages(file: File, password?: string): Promise<{ images: { mime: string; dataUrl: string }[]; needsPassword: boolean; wrongPassword: boolean }> {
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

async function fileToDataUrl(file: File | Blob, forceMime?: string): Promise<string> {
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
  if (!value) return { bg: "rgba(244,162,97,0.10)", border: "rgba(244,162,97,0.35)", label: "Requiere revisión", labelColor: "#F4A261" };
  if (c === "alta") return { bg: "rgba(132,185,143,0.10)", border: "rgba(132,185,143,0.35)", label: "Alta confianza", labelColor: "#84B98F" };
  if (c === "media") return { bg: "rgba(68,93,163,0.10)", border: "rgba(68,93,163,0.35)", label: "Media confianza", labelColor: "#7B8FCB" };
  if (c === "baja") return { bg: "rgba(244,162,97,0.12)", border: "rgba(244,162,97,0.40)", label: "Baja confianza · revisar", labelColor: "#F4A261" };
  return { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)", label: "", labelColor: "#94a3b8" };
}

const STAGES: { id: Stage; label: string }[] = [
  { id: "idle", label: "Archivo cargado" },
  { id: "reading", label: "Leyendo extracto" },
  { id: "review", label: "Datos detectados" },
  { id: "applied", label: "Simulador completado" },
];

export function ExtractoReader({ modo, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [wrongPassword, setWrongPassword] = useState(false);
  const [parsed, setParsed] = useState<ExtractoData | null>(null);
  const [archivoPath, setArchivoPath] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const callExtract = useServerFn(extractStatement);

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

  const processFile = async (f: File, pwd: string | undefined) => {
    setStage("reading");
    try {
      let images: { mime: string; dataUrl: string }[] = [];
      const lowerName = f.name.toLowerCase();
      const isZip = f.type === "application/zip" || f.type === "application/x-zip-compressed" || lowerName.endsWith(".zip");
      if (f.type === "application/pdf" || lowerName.endsWith(".pdf")) {
        const result = await renderPdfToImages(f, pwd);
        if (result.needsPassword) {
          setWrongPassword(result.wrongPassword);
          setStage("password");
          return;
        }
        images = result.images;
      } else if (f.type.startsWith("image/")) {
        const url = await fileToDataUrl(f);
        images = [{ mime: f.type, dataUrl: url }];
      } else if (isZip) {
        images = await extractImagesFromZip(f);
      } else {
        throw new Error("Formato no soportado. Sube un PDF, imagen (JPG/PNG) o un ZIP con esos archivos.");
      }

      // Subir archivo original a Supabase Storage (privado)
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (uid) {
          const path = `${uid}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error: upErr } = await supabase.storage.from("extractos").upload(path, f, {
            cacheControl: "3600",
            upsert: false,
            contentType: f.type || "application/octet-stream",
          });
          if (!upErr) setArchivoPath(path);
        }
      } catch (e) {
        console.warn("No se pudo subir el archivo a storage:", e);
      }

      // Llamar IA
      const resp = await callExtract({ data: { images } });
      if (resp.error || !resp.data) {
        setErrorMsg(resp.error || "No se pudieron extraer datos.");
        setStage("error");
        return;
      }
      setParsed(resp.data);
      setStage("review");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Error procesando el archivo.");
      setStage("error");
    }
  };

  const updateField = (key: string, value: string) => {
    setParsed((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleConfirm = () => {
    if (!parsed) return;
    const get = (k: string) => (typeof parsed[k] === "string" ? (parsed[k] as string) : "");
    const tieneCob = get("tieneCobertura").toLowerCase() === "si"
      || /con\s+beneficio\s+de\s+cobertura/i.test(get("producto"))
      || !!get("valorCobertura")
      || !!get("tasaCobertura");
    let producto = get("producto");
    if (tieneCob && producto && !/con\s+beneficio\s+de\s+cobertura/i.test(producto)) {
      producto = `${producto} con Beneficio de Cobertura`;
    }
    // Normalizar banco: Colpatria -> Davibank (cambio de razón social)
    let banco = get("banco");
    if (/colpatria/i.test(banco)) banco = "Davibank";
    const payload: ExtractoApplyPayload = {
      cliente: {
        nombre: get("cliente"),
        cedula: get("cedula"),
        numeroCredito: get("numeroCredito"),
        banco,
        tipoProducto: producto,
        plazoInicial: get("plazoInicial"),
        cuotasPagadas: get("cuotasPagadas"),
      },
      archivoPath: archivoPath ?? undefined,
    };
    if (modo === "pesos") {
      payload.pesos = {
        saldoCapital: get("saldoCapital"),
        cuotaActual: get("cuotaMensual"),
        seguros: get("seguros"),
        tea: get("tea"),
      };
    } else {
      payload.uvr = {
        saldoUVR: get("saldoUVR"),
        valorUVR: get("valorUVR"),
        saldoPesos: get("saldoCapital"),
        valorDesembolsado: get("valorDesembolsado"),
        cuotaActualPesos: get("cuotaMensual"),
        seguros: get("seguros"),
        teaCobrada: get("tea"),
      };
    }
    if (tieneCob) {
      payload.cobertura = {
        activo: true,
        valorCobertura: get("valorCobertura"),
        tasaCobertura: get("tasaCobertura"),
      };
    }
    onApply(payload);
    setStage("applied");
    setTimeout(() => {
      setOpen(false);
      reset();
    }, 1200);
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
    { key: "valorCobertura", label: "Valor de cobertura (si aplica)" },
    { key: "tasaCobertura", label: "Tasa de cobertura (%) (si aplica)" },
    { key: "fechaExtracto", label: "Fecha del extracto" },
  ];
  const fields = modo === "uvr"
    ? [...fieldsBase, { key: "saldoUVR", label: "Saldo en UVR" }, { key: "valorUVR", label: "Valor UVR del día" }]
    : fieldsBase;

  const teaCobrada = (parsed?.teaCobrada as string) ?? "";
  const teaPactada = (parsed?.teaPactada as string) ?? "";
  const teaUsada = (parsed?.tea as string) ?? "";
  const soloPactada = !teaCobrada && !!teaPactada;

  const progressIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <>
      {/* Tarjeta principal de entrada */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(10,18,38,0.92), rgba(7,22,45,0.92))",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 60px -30px rgba(68,93,163,0.45)",
        }}
      >
        {/* glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(68,93,163,0.35), transparent 70%)" }} />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(132,185,143,0.28), transparent 70%)" }} />

        <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #445DA3, #84B98F)",
                boxShadow: "0 12px 32px -12px rgba(132,185,143,0.6)",
              }}
            >
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Lectura automática de extracto</h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(132,185,143,0.15)", color: "#84B98F", border: "1px solid rgba(132,185,143,0.35)" }}
                >
                  NUVEX IA
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm text-white/65">
                Sube el extracto del cliente y NUVEX IA intentará identificar los datos principales para prellenar el simulador. Siempre podrás revisar y corregir antes de generar la propuesta.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <button
              onClick={() => {
                reset();
                setOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #445DA3, #84B98F)",
                boxShadow: "0 10px 28px -10px rgba(68,93,163,0.7)",
              }}
            >
              <Upload className="h-4 w-4" />
              Subir extracto
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("datos-cliente-card");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold text-white/80 transition hover:text-white"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.10)" }}
            >
              Diligenciar manualmente
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
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(5,8,20,0.78)", backdropFilter: "blur(8px)" }}
          onClick={() => stage !== "reading" && setOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl"
            style={{
              background: "linear-gradient(180deg, #0A1226, #07162D)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 40px 80px -20px rgba(0,0,0,0.7)",
              maxHeight: "92vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-white/70" />
                <div>
                  <div className="text-sm font-semibold text-white">{file?.name ?? "Subir extracto bancario"}</div>
                  <div className="text-[11px] text-white/50">Procesamiento privado · {modo.toUpperCase()}</div>
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
            <div className="border-b px-6 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                {STAGES.map((s, i) => {
                  const active = i <= progressIdx;
                  const current = s.id === stage;
                  return (
                    <div key={s.id} className="flex flex-1 items-center gap-2">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{
                          background: active ? "linear-gradient(135deg, #445DA3, #84B98F)" : "rgba(255,255,255,0.05)",
                          color: active ? "#fff" : "rgba(255,255,255,0.5)",
                          boxShadow: current ? "0 0 0 4px rgba(132,185,143,0.18)" : undefined,
                        }}
                      >
                        {i + 1}
                      </div>
                      <span className={`text-[11px] ${active ? "text-white" : "text-white/40"}`}>{s.label}</span>
                      {i < STAGES.length - 1 && (
                        <div className="mx-2 h-px flex-1" style={{ background: active ? "linear-gradient(90deg,#445DA3,#84B98F)" : "rgba(255,255,255,0.08)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
              {stage === "idle" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                  onClick={() => fileRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 text-center transition-colors hover:border-white/30"
                  style={{ borderColor: "rgba(255,255,255,0.15)" }}
                >
                  <Upload className="h-10 w-10 text-white/40" />
                  <div className="text-sm text-white/70">Arrastra el extracto o haz clic para seleccionar</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}
                  >
                    Seleccionar archivo
                  </button>
                  <div className="text-[11px] text-white/40">PDF, JPG o PNG · hasta 6 páginas</div>
                </div>
              )}


              {stage === "reading" && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[#84B98F]" />
                  <div className="text-sm font-semibold text-white">NUVEX IA está leyendo el extracto…</div>
                  <div className="text-xs text-white/50">Esto puede tardar entre 10 y 30 segundos.</div>
                </div>
              )}

              {stage === "password" && (
                <div className="mx-auto max-w-md py-6">
                  <div className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(244,162,97,0.10)", border: "1px solid rgba(244,162,97,0.30)" }}>
                    <KeyRound className="h-5 w-5 text-[#F4A261]" />
                    <div className="text-sm text-white">
                      {wrongPassword
                        ? "La clave no es correcta. Inténtalo de nuevo."
                        : "Este extracto parece estar protegido con contraseña. Por favor ingresa la clave para continuar."}
                    </div>
                  </div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/60">Clave del PDF</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    className="mt-2 w-full rounded-lg px-4 py-3 text-sm text-white outline-none transition"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && file && password) processFile(file, password);
                    }}
                  />
                  <button
                    onClick={() => file && password && processFile(file, password)}
                    disabled={!password}
                    className="mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}
                  >
                    Leer extracto
                  </button>
                </div>
              )}

              {stage === "error" && (
                <div className="mx-auto max-w-lg py-8 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-[#F04438]" />
                  <div className="mt-3 text-sm font-semibold text-white">No se pudo procesar el extracto</div>
                  <div className="mt-1 text-xs text-white/60">{errorMsg}</div>
                  <button
                    onClick={reset}
                    className="mt-5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}

              {stage === "review" && parsed && (
                <div>
                  <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: "rgba(132,185,143,0.08)", border: "1px solid rgba(132,185,143,0.30)" }}>
                    <ShieldCheck className="h-5 w-5 text-[#84B98F]" />
                    <div className="text-xs text-white/80">
                      Datos detectados por IA. Revisa y corrige antes de llenar el simulador. Tu validación es obligatoria.
                    </div>
                  </div>

                  {/* Resumen de tasas */}
                  {(teaCobrada || teaPactada || teaUsada) && (
                    <div className="mb-4 rounded-xl px-4 py-3" style={{ background: soloPactada ? "rgba(244,162,97,0.10)" : "rgba(68,93,163,0.10)", border: `1px solid ${soloPactada ? "rgba(244,162,97,0.40)" : "rgba(68,93,163,0.30)"}` }}>
                      <div className="grid gap-2 text-xs text-white/85 md:grid-cols-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/55">Tasa cobrada detectada</div>
                          <div className="mt-0.5 font-semibold text-white">{teaCobrada ? `${teaCobrada}%` : "— no detectada"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/55">Tasa pactada detectada</div>
                          <div className="mt-0.5 font-semibold text-white">{teaPactada ? `${teaPactada}%` : "—"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-white/55">Tasa usada para simulación</div>
                          <div className="mt-0.5 font-semibold" style={{ color: teaUsada ? "#84B98F" : "#F4A261" }}>{teaUsada ? `${teaUsada}%` : "— pendiente"}</div>
                        </div>
                      </div>
                      {soloPactada ? (
                        <div className="mt-2 flex items-start gap-2 text-[11px] font-semibold" style={{ color: "#F4A261" }}>
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                          No se detectó tasa de interés cobrada. Verifique manualmente antes de simular. La tasa pactada NO se usará automáticamente.
                        </div>
                      ) : teaUsada ? (
                        <div className="mt-2 text-[11px] text-white/65">
                          Se usa la tasa de interés cobrada para la proyección.
                        </div>
                      ) : null}
                    </div>
                  )}

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
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{f.label}</label>
                            {style.label && (
                              <span className="text-[10px] font-semibold" style={{ color: style.labelColor }}>
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
                  <div className="text-sm font-semibold text-white">Simulador prellenado correctamente</div>
                  <div className="text-xs text-white/50">Revisa los campos del simulador y genera tus propuestas.</div>
                </div>
              )}
            </div>

            {stage === "review" && (
              <div className="flex items-center justify-between gap-3 border-t px-6 py-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <button
                  onClick={reset}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-white/70 hover:text-white"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  Cargar otro extracto
                </button>
                <button
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                  style={{
                    background: "linear-gradient(135deg, #445DA3, #84B98F)",
                    boxShadow: "0 10px 28px -10px rgba(132,185,143,0.6)",
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar y llenar simulador
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
