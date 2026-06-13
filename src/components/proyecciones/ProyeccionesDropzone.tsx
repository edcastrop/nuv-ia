// Drag & drop para PROYECCIONES bancarias.
// - Acepta PDF, Excel (.xlsx/.xls), imágenes (PNG/JPG) y ZIP (los ZIP del
//   banco normalmente vienen sin contraseña pero traen un PDF con clave;
//   también soportamos PDF directo con clave).
// - Convierte cada archivo a imágenes/texto, llama al motor de IA
//   existente (extractStatement) y guarda los datos en la tabla
//   `expediente_proyecciones` junto al archivo en Storage.
// - Ofrece "Fusionar con extracto y reauditar" para que NUVIA continúe el
//   dictamen con los datos oficiales del banco.

import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  KeyRound,
  Trash2,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractStatement } from "@/lib/extracto.functions";
import {
  crearRegistroProyeccion,
  guardarDatosProyeccion,
  marcarErrorProyeccion,
  listarProyecciones,
  eliminarProyeccion,
  urlFirmadaProyeccion,
  fusionarConExtractoYReauditar,
  verificarCierreContraPropuesta,
} from "@/lib/proyecciones.functions";
import { auditarLecturaAutomatica } from "@/lib/qaAI.functions";

type ProyeccionRow = {
  id: string;
  archivo_nombre: string;
  archivo_path: string;
  mime: string;
  size_bytes: number | null;
  origen_zip: string | null;
  password_usada: boolean;
  momento: string;
  status: string;
  error: string | null;
  datos: Record<string, unknown> | null;
  parsed_at: string | null;
  created_at: string;
};

interface Props {
  expedienteId: string;
  /** Cuando termina la fusión + reauditoría (o verificación), refresca la vista que lo monta. */
  onReauditoria?: () => void;
  variant?: "expediente" | "qa";
  /** "auditoria" = proyección inicial para auditar el extracto. "cierre" = proyección final que emite el banco al cerrar. */
  momento?: "auditoria" | "cierre";
  /** Callback opcional cuando termina la verificación de cierre. */
  onVerificacionCierre?: () => void;
}

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

async function pdfToImagesAndText(
  buffer: ArrayBuffer,
  password?: string,
): Promise<{ images: { mime: string; dataUrl: string }[]; rawText: string; needsPassword: boolean; wrongPassword: boolean }> {
  const pdfjs = await loadPdfJs();
  try {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), password }).promise;
    const max = Math.min(pdf.numPages, 8);
    const images: { mime: string; dataUrl: string }[] = [];
    const pages: string[] = [];
    for (let i = 1; i <= max; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
      images.push({ mime: "image/jpeg", dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
      try {
        const content = await page.getTextContent();
        pages.push((content.items as Array<{ str?: string }>).map((it) => it.str ?? "").join(" "));
      } catch { /* ignore text */ }
    }
    return { images, rawText: pages.join("\n").slice(0, 180_000), needsPassword: false, wrongPassword: false };
  } catch (err: unknown) {
    const e = err as { name?: string; code?: number };
    if (e?.name === "PasswordException") return { images: [], rawText: "", needsPassword: true, wrongPassword: e.code === 2 };
    throw err;
  }
}

async function blobToImageDataUrl(blob: Blob, mime?: string): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img")); img.src = url; });
    const maxSide = 1900;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(mime ?? "image/jpeg", 0.86);
  } finally { URL.revokeObjectURL(url); }
}

async function xlsxToRawText(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const out: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    out.push(`### Hoja: ${name}`);
    out.push(XLSX.utils.sheet_to_csv(sheet, { FS: " | " }));
  }
  return out.join("\n").slice(0, 180_000);
}

type Pending = {
  file: File;
  origenZip?: string;
  needsPassword?: boolean;
  passwordTried?: boolean;
};

const ACCEPT = ".pdf,.zip,.xlsx,.xls,.png,.jpg,.jpeg,application/pdf,application/zip,image/png,image/jpeg,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function iconFor(mime: string) {
  if (mime.includes("pdf")) return <FileText size={14} />;
  if (mime.includes("sheet") || mime.includes("excel")) return <FileSpreadsheet size={14} />;
  if (mime.startsWith("image/")) return <ImageIcon size={14} />;
  return <FileText size={14} />;
}

function fmtBytes(b: number | null) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function ProyeccionesDropzone({ expedienteId, onReauditoria, variant = "qa", momento = "auditoria", onVerificacionCierre }: Props) {
  const isDark = variant === "qa";
  const esCierre = momento === "cierre";
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<ProyeccionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reauditando, setReauditando] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingPwd, setPendingPwd] = useState<Pending | null>(null);

  const fnList = useServerFn(listarProyecciones);
  const fnCrear = useServerFn(crearRegistroProyeccion);
  const fnGuardar = useServerFn(guardarDatosProyeccion);
  const fnError = useServerFn(marcarErrorProyeccion);
  const fnDelete = useServerFn(eliminarProyeccion);
  const fnFusionar = useServerFn(fusionarConExtractoYReauditar);
  const fnVerificar = useServerFn(verificarCierreContraPropuesta);
  const fnUrl = useServerFn(urlFirmadaProyeccion);
  const fnExtract = useServerFn(extractStatement);
  const fnAuditar = useServerFn(auditarLecturaAutomatica);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fnList({ data: { expedienteId, momento } });
      setItems((r.items ?? []) as ProyeccionRow[]);
    } finally { setLoading(false); }
  }, [expedienteId, fnList, momento]);

  useEffect(() => { void load(); }, [load]);

  const subirArchivoAStorage = useCallback(async (file: Blob, nombre: string, mime: string) => {
    const safe = nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${expedienteId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe}`;
    const { error } = await supabase.storage.from("proyecciones-banco").upload(path, file, {
      contentType: mime, upsert: false,
    });
    if (error) throw new Error("No se pudo subir el archivo: " + error.message);
    return path;
  }, [expedienteId]);

  const procesarUnArchivo = useCallback(async (
    file: File,
    opts: { origenZip?: string; password?: string } = {},
  ): Promise<"ok" | "needs-password"> => {
    const lower = file.name.toLowerCase();
    const mime = file.type || (lower.endsWith(".pdf") ? "application/pdf" : lower.endsWith(".zip") ? "application/zip" : lower.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : lower.endsWith(".xls") ? "application/vnd.ms-excel" : lower.endsWith(".png") ? "image/png" : "image/jpeg");

    let images: { mime: string; dataUrl: string }[] = [];
    let rawText = "";

    if (lower.endsWith(".pdf") || mime.includes("pdf")) {
      const buf = await file.arrayBuffer();
      const r = await pdfToImagesAndText(buf, opts.password);
      if (r.needsPassword) return "needs-password";
      images = r.images;
      rawText = r.rawText;
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("sheet") || mime.includes("excel")) {
      rawText = await xlsxToRawText(await file.arrayBuffer());
    } else if (mime.startsWith("image/") || /\.(png|jpe?g)$/.test(lower)) {
      const dataUrl = await blobToImageDataUrl(file, mime);
      images = [{ mime, dataUrl }];
    } else {
      throw new Error("Formato no soportado: " + file.name);
    }

    // 1) subir archivo original a storage
    const path = await subirArchivoAStorage(file, file.name, mime);
    // 2) crear registro pendiente
    const { id } = await fnCrear({ data: {
      expedienteId,
      archivoNombre: file.name,
      archivoPath: path,
      mime,
      sizeBytes: file.size,
      origenZip: opts.origenZip ?? null,
      passwordUsada: Boolean(opts.password),
      momento,
    } });
    // 3) llamar IA
    try {
      const ai = await fnExtract({ data: {
        rawText: rawText || undefined,
        images,
      } });
      if (ai.error || !ai.data) {
        await fnError({ data: { id, error: ai.error ?? "La IA no devolvió datos." } });
      } else {
        await fnGuardar({ data: { id, datos: ai.data as unknown as Record<string, unknown> } });
      }
    } catch (e) {
      await fnError({ data: { id, error: e instanceof Error ? e.message : "Error al analizar" } });
    }
    return "ok";
  }, [expedienteId, fnCrear, fnExtract, fnGuardar, fnError, subirArchivoAStorage, momento]);

  const procesarZip = useCallback(async (zipFile: File) => {
    const JSZip = (await import("jszip")).default;
    let zip;
    try {
      zip = await JSZip.loadAsync(zipFile);
    } catch {
      throw new Error("No se pudo abrir el ZIP. Si tiene contraseña a nivel ZIP, por favor descomprímelo manualmente y sube los archivos sueltos.");
    }
    const entries = Object.values(zip.files).filter((e) => !e.dir && !/^__MACOSX\//.test(e.name) && !/\/\.DS_Store$/.test(e.name));
    if (!entries.length) throw new Error("El ZIP no contiene archivos legibles.");
    let needsPwd = false;
    let firstPwdEntry: File | null = null;
    for (const entry of entries) {
      const blob = await entry.async("blob");
      const inner = new File([blob], entry.name.split("/").pop() ?? entry.name, { type: blob.type });
      const r = await procesarUnArchivo(inner, { origenZip: zipFile.name, password: password || undefined });
      if (r === "needs-password") {
        needsPwd = true;
        if (!firstPwdEntry) firstPwdEntry = inner;
      }
    }
    if (needsPwd && firstPwdEntry) setPendingPwd({ file: firstPwdEntry, origenZip: zipFile.name, needsPassword: true });
  }, [password, procesarUnArchivo]);

  const procesarArchivos = useCallback(async (files: FileList | File[]) => {
    setErr(null);
    const arr = Array.from(files);
    for (const f of arr) {
      setBusy(f.name);
      try {
        const lower = f.name.toLowerCase();
        if (lower.endsWith(".zip") || f.type === "application/zip") {
          await procesarZip(f);
        } else {
          const r = await procesarUnArchivo(f, { password: password || undefined });
          if (r === "needs-password") setPendingPwd({ file: f, needsPassword: true });
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error procesando archivo");
      }
    }
    setBusy(null);
    await load();
  }, [load, procesarUnArchivo, procesarZip, password]);

  const reintentarConPassword = useCallback(async () => {
    if (!pendingPwd) return;
    setBusy(pendingPwd.file.name);
    setErr(null);
    try {
      const r = await procesarUnArchivo(pendingPwd.file, { origenZip: pendingPwd.origenZip, password });
      if (r === "needs-password") setErr("Contraseña incorrecta. Intenta otra vez.");
      else setPendingPwd(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error procesando");
    } finally { setBusy(null); await load(); }
  }, [pendingPwd, password, procesarUnArchivo, load]);

  const descargar = useCallback(async (path: string) => {
    try {
      const { url } = await fnUrl({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo generar URL");
    }
  }, [fnUrl]);

  const eliminar = useCallback(async (id: string) => {
    await fnDelete({ data: { id } });
    await load();
  }, [fnDelete, load]);

  const fusionarYReauditar = useCallback(async () => {
    setReauditando(true); setErr(null);
    try {
      const analizadas = items.filter((i) => i.status === "analizado").map((i) => i.id);
      if (!analizadas.length) {
        setErr("No hay proyecciones analizadas todavía.");
        return;
      }
      const r = await fnFusionar({ data: { expedienteId, proyeccionIds: analizadas } });
      await fnAuditar({ data: { extractoLecturaId: r.extractoLecturaId } });
      onReauditoria?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo reauditar");
    } finally { setReauditando(false); }
  }, [items, fnFusionar, fnAuditar, expedienteId, onReauditoria]);

  // Tokens según contexto (dark dentro de QA, light dentro de Expediente)
  const tokens = isDark
    ? {
        cardBg: "var(--nuvia-surface)", border: "var(--nuvia-border)",
        text: "var(--nuvia-text-primary)", textDim: "var(--nuvia-text-secondary)",
        accent: "#A5B5E0", dropBg: "rgba(255,255,255,0.03)", dropBorder: "rgba(255,255,255,0.15)",
        chipBg: "rgba(255,255,255,0.05)", inputBg: "rgba(255,255,255,0.05)",
        successBg: "rgba(34,197,94,0.12)", errorBg: "rgba(239,68,68,0.12)",
      }
    : {
        cardBg: "#FFFFFF", border: "#E5E7EB", text: "#242424", textDim: "#475569",
        accent: "#445DA3", dropBg: "#F8FAFC", dropBorder: "#CBD5E1",
        chipBg: "#F1F5F9", inputBg: "#FFFFFF",
        successBg: "#DCFCE7", errorBg: "#FEE2E2",
      };

  const hayAnalizadas = items.some((i) => i.status === "analizado");

  return (
    <div style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 14, padding: 16 }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: tokens.text }}>
            <UploadCloud size={16} style={{ color: tokens.accent }} /> Proyecciones del banco
          </h3>
          <p className="text-[11px] mt-1" style={{ color: tokens.textDim }}>
            Suelta aquí PDF, Excel, imágenes o ZIP. NUVIA leerá saldo a capital, tasa, UVR, cuota, seguros y cuotas pendientes para continuar el dictamen.
          </p>
        </div>
        {hayAnalizadas && (
          <button
            onClick={fusionarYReauditar}
            disabled={reauditando}
            className="text-[11px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold"
            style={{ background: tokens.accent, color: "#FFFFFF", opacity: reauditando ? 0.6 : 1 }}
          >
            {reauditando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {reauditando ? "Reauditando…" : "Fusionar con extracto y reauditar"}
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          if (e.dataTransfer.files?.length) void procesarArchivos(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? tokens.accent : tokens.dropBorder}`,
          background: dragging ? "rgba(68,93,163,0.08)" : tokens.dropBg,
          borderRadius: 12, padding: "20px 16px", textAlign: "center",
          cursor: "pointer", transition: "all 0.15s",
        }}
      >
        <UploadCloud size={28} style={{ color: tokens.accent, margin: "0 auto 8px" }} />
        <p className="text-[13px] font-medium" style={{ color: tokens.text }}>
          Arrastra los archivos o haz click para seleccionar
        </p>
        <p className="text-[11px] mt-1" style={{ color: tokens.textDim }}>
          PDF · Excel · JPG/PNG · ZIP (con o sin contraseña en el PDF interno)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) void procesarArchivos(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <KeyRound size={14} style={{ color: tokens.textDim }} />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña del PDF (ej: cédula del cliente). Opcional."
          className="flex-1 text-[12px] px-3 py-1.5 rounded-md outline-none"
          style={{ background: tokens.inputBg, color: tokens.text, border: `1px solid ${tokens.border}` }}
        />
        {pendingPwd && (
          <button
            onClick={reintentarConPassword}
            disabled={!password || !!busy}
            className="text-[11px] px-3 py-1.5 rounded-md font-semibold"
            style={{ background: tokens.accent, color: "#FFFFFF", opacity: !password || busy ? 0.6 : 1 }}
          >
            Reintentar "{pendingPwd.file.name}"
          </button>
        )}
      </div>

      {busy && (
        <div className="mt-3 text-[12px] inline-flex items-center gap-2" style={{ color: tokens.textDim }}>
          <Loader2 size={12} className="animate-spin" /> Procesando {busy}…
        </div>
      )}

      {err && (
        <div className="mt-3 text-[12px] rounded-md px-3 py-2 inline-flex items-start gap-2" style={{ background: tokens.errorBg, color: "#991B1B" }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      <div className="mt-4">
        {loading && <p className="text-[12px]" style={{ color: tokens.textDim }}>Cargando proyecciones…</p>}
        {!loading && !items.length && (
          <p className="text-[12px]" style={{ color: tokens.textDim }}>Aún no hay proyecciones subidas para este expediente.</p>
        )}
        {!loading && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="rounded-lg px-3 py-2 flex items-center gap-3"
                style={{ background: tokens.chipBg, border: `1px solid ${tokens.border}` }}
              >
                <span style={{ color: tokens.accent }}>{iconFor(it.mime)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-medium truncate" style={{ color: tokens.text }}>{it.archivo_nombre}</span>
                    {it.origen_zip && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: tokens.chipBg, color: tokens.textDim, border: `1px solid ${tokens.border}` }}>
                        zip: {it.origen_zip}
                      </span>
                    )}
                    {it.password_usada && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: tokens.chipBg, color: tokens.textDim }}>
                        <KeyRound size={10} /> con clave
                      </span>
                    )}
                    {it.status === "analizado" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: tokens.successBg, color: "#166534" }}>
                        <CheckCircle2 size={10} /> NUVIA analizó
                      </span>
                    )}
                    {it.status === "error" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: tokens.errorBg, color: "#991B1B" }}>
                        <AlertTriangle size={10} /> error
                      </span>
                    )}
                    {it.status === "pendiente" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: tokens.chipBg, color: tokens.textDim }}>
                        <Sparkles size={10} /> pendiente
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: tokens.textDim }}>
                    {fmtBytes(it.size_bytes)} · {new Date(it.created_at).toLocaleString("es-CO")}
                    {it.error && <span style={{ color: "#991B1B" }}> · {it.error}</span>}
                  </div>
                  {it.status === "analizado" && it.datos && (
                    <ResumenDatos datos={it.datos} tokens={tokens} />
                  )}
                </div>
                <button
                  onClick={() => descargar(it.archivo_path)}
                  className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded hover:opacity-80"
                  style={{ color: tokens.accent }}
                  title="Descargar"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={() => eliminar(it.id)}
                  className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded hover:opacity-80"
                  style={{ color: "#DC2626" }}
                  title="Eliminar"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResumenDatos({ datos, tokens }: { datos: Record<string, unknown>; tokens: { text: string; textDim: string; chipBg: string; border: string } }) {
  const data = datos as Record<string, unknown>;
  const filas: Array<[string, string | undefined]> = [
    ["Saldo capital", fmtMoneda(data.saldoCapital)],
    ["Tasa EA cobrada", fmtPct(data.teaCobrada ?? data.tea)],
    ["UVR del día", fmtNumero(data.valorUVR)],
    ["Saldo en UVR", fmtNumero(data.saldoUVR)],
    ["Cuotas pendientes", typeof data.cuotasPendientes === "string" ? data.cuotasPendientes : undefined],
    ["Cuota actual", fmtMoneda(data.cuotaPagadaCliente ?? data.valorAPagar ?? data.cuotaMensual)],
    ["Seguros", fmtMoneda(data.seguros)],
  ];
  const visibles = filas.filter(([, v]) => v && String(v).trim());
  if (!visibles.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {visibles.map(([k, v]) => (
        <span key={k} className="text-[10.5px] px-2 py-0.5 rounded" style={{ background: tokens.chipBg, color: tokens.text, border: `1px solid ${tokens.border}` }}>
          <span style={{ color: tokens.textDim }}>{k}: </span>{v}
        </span>
      ))}
    </div>
  );
}

function fmtMoneda(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n === 0) return undefined;
  return "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}
function fmtPct(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return undefined;
  return n.toFixed(2) + "% EA";
}
function fmtNumero(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return undefined;
  return n.toLocaleString("es-CO", { maximumFractionDigits: 4 });
}
