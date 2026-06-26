import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload,
  Sparkles,
  Loader2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  X,
  KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractStatementMotor, type MotorResultado } from "@/lib/motorExtractos.functions";
import { auditarLecturaAutomatica } from "@/lib/qaAI.functions";
import { QABadge, type QACategoria } from "@/components/qa-ai/QABadge";
import {
  CAMPOS_MOTOR,
  CAMPOS_CRITICOS,
  CAMPO_LABEL,
  type CampoMotor,
} from "@/lib/motorExtractos/bankProfiles";
import { NUVEX } from "@/components/nuvex/constants";


interface Props {
  expedienteId?: string | null;
  onConfirm?: (r: MotorResultado) => void;
}

type Stage = "idle" | "password" | "reading" | "review" | "saving" | "saved" | "error";

const UMBRAL_BLOQUEO = 90;

// PDF.js loader (idéntico al ExtractoReader actual)
async function loadPdfJs() {
  const { ensurePdfJsPolyfills } = await import("@/lib/pdfjsPolyfill");
  ensurePdfJsPolyfills();
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as {
    default: string;
  };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

async function renderPdfToImages(file: File, password?: string) {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  try {
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), password });
    const pdf = await task.promise;
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
    return { images, needsPassword: false, wrongPassword: false };
  } catch (err) {
    const e = err as { name?: string; code?: number };
    if (e?.name === "PasswordException") {
      return { images: [], needsPassword: true, wrongPassword: e.code === 2 };
    }
    throw err;
  }
}

async function fileToImages(file: File): Promise<{ mime: string; dataUrl: string }[]> {
  const r = new FileReader();
  return new Promise((resolve, reject) => {
    r.onload = () => resolve([{ mime: file.type || "image/jpeg", dataUrl: String(r.result) }]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function scoreBadge(score: number) {
  if (score >= UMBRAL_BLOQUEO)
    return { bg: "rgba(132,185,143,0.15)", color: "#1F6D3D", label: "OK" };
  if (score >= 70) return { bg: "rgba(244,162,97,0.18)", color: "#a35d1c", label: "Verificar" };
  if (score > 0) return { bg: "rgba(244,67,54,0.10)", color: "#B42318", label: "Bajo" };
  return { bg: "#F1F3F6", color: "#6b7280", label: "Vacío" };
}

const MAX_SIZE = 20 * 1024 * 1024;
const fmtSize = (b: number) =>
  b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

export function MotorExtractosNUVEX({ expedienteId, onConfirm }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const motor = useServerFn(extractStatementMotor);
  const autoAudit = useServerFn(auditarLecturaAutomatica);
  const [autoQa, setAutoQa] = useState<null | { auditoriaId: string; score: number; categoria: QACategoria; dictamen: string; hallazgos: number; criticos: number }>(null);
  const [autoQaState, setAutoQaState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [autoQaError, setAutoQaError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [archivoPath, setArchivoPath] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MotorResultado | null>(null);
  const [editado, setEditado] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [readingPhase, setReadingPhase] = useState<"upload" | "ocr" | "analyze">("upload");

  const reset = () => {
    setStage("idle");
    setFile(null);
    setArchivoPath(null);
    setPassword("");
    setError(null);
    setResult(null);
    setEditado({});
    setIsDragging(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startRead = async (selected: File, pwd?: string) => {
    setStage("reading");
    setError(null);
    setReadingPhase("upload");
    try {
      let images: { mime: string; dataUrl: string }[] = [];
      if (selected.type === "application/pdf" || selected.name.toLowerCase().endsWith(".pdf")) {
        const r = await renderPdfToImages(selected, pwd);
        if (r.needsPassword) {
          setStage("password");
          if (r.wrongPassword) setError("Contraseña incorrecta. Intenta de nuevo.");
          return;
        }
        images = r.images;
      } else {
        images = await fileToImages(selected);
      }
      if (!images.length) throw new Error("No se pudieron generar imágenes del archivo.");
      setReadingPhase("ocr");

      // Subir archivo a storage para trazabilidad (opcional, no bloqueante)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const path = `${user.id}/motor/${Date.now()}-${selected.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const up = await supabase.storage
            .from("extractos")
            .upload(path, selected, { upsert: false });
          if (!up.error) setArchivoPath(path);
        }
      } catch {
        /* no bloqueante */
      }

      setReadingPhase("analyze");
      const res = await motor({ data: { images } });
      if (res.error || !res.data) {
        setError(res.error || "Lectura sin datos.");
        setStage("error");
        return;
      }
      setResult(res.data);
      setStage("review");
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Solo se permiten archivos PDF. JPG, PNG, DOCX y XLSX no están soportados.");
      setStage("error");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError(`El archivo supera 20 MB (${fmtSize(f.size)}).`);
      setStage("error");
      return;
    }
    setFile(f);
    void startRead(f);
  };

  const onUnlock = async () => {
    if (!file || !password) return;
    await startRead(file, password);
  };

  const valor = (k: CampoMotor) => editado[k] ?? result?.datos[k] ?? "";
  const setValor = (k: CampoMotor, v: string) => setEditado((e) => ({ ...e, [k]: v }));

  const confirmar = async () => {
    if (!result) return;
    setStage("saving");
    try {
      const datosFinales = { ...result.datos, ...editado };
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: exp } = expedienteId
        ? await supabase.from("expedientes" as never).select("asesor_id").eq("id", expedienteId).maybeSingle()
        : { data: null };
      const analistaId = (exp as { asesor_id?: string | null } | null)?.asesor_id ?? user?.id ?? null;
      const { data: inserted, error: insErr } = await supabase.from("extractos_lecturas").insert({
        expediente_id: expedienteId ?? null,
        asesor_id: analistaId,
        aprobado_por: user?.id,
        banco: result.banco,
        producto: result.producto || null,
        moneda: result.moneda || null,
        archivo_path: archivoPath,
        archivo_nombre: file?.name ?? null,
        datos: datosFinales,
        scores: result.scores,
        confianza_global: result.confianzaGlobal,
        estado: "aprobado",
        motor_version: "v1",
      }).select("id").single();
      if (insErr) throw insErr;
      onConfirm?.({ ...result, datos: datosFinales as Record<CampoMotor, string> });
      setStage("saved");

      // Disparo automático de NUVIA Financial QA AI (sólo si hay expediente)
      if (expedienteId && inserted?.id) {
        setAutoQaState("running");
        setAutoQaError(null);
        try {
          const r = await autoAudit({ data: { extractoLecturaId: inserted.id } });
          setAutoQa({
            auditoriaId: r.auditoriaId,
            score: r.score,
            categoria: r.categoria as QACategoria,
            dictamen: r.dictamen,
            hallazgos: r.hallazgos,
            criticos: r.criticos,
          });
          setAutoQaState("done");
        } catch (qaErr) {
          setAutoQaError(qaErr instanceof Error ? qaErr.message : "No se pudo ejecutar la auditoría QA");
          setAutoQaState("error");
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setStage("error");
    }
  };

  const camposBloqueados = result
    ? CAMPOS_CRITICOS.filter((k) => result.scores[k] < UMBRAL_BLOQUEO && !valor(k).trim())
    : [];
  const puedeAprobar =
    !!result && camposBloqueados.every((k) => (editado[k] ?? "").trim().length > 0);

  return (
    <div
      className="rounded-xl border bg-white p-5 shadow-sm"
      style={{ borderColor: NUVEX.azul + "33" }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: NUVEX.azul }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Motor Extractos NUVEX · V1 Beta
          </div>
          <h3 className="mt-1 text-lg font-semibold text-[#242424]">
            Lector inteligente por plantillas bancarias
          </h3>
          <p className="mt-1 text-xs text-[#242424]/60">
            Detección automática de banco, producto y moneda. Parser especializado por banco. Umbral
            de aprobación: <strong>{UMBRAL_BLOQUEO}%</strong> en variables críticas.
          </p>
        </div>
        {stage !== "idle" && (
          <button
            onClick={reset}
            className="text-xs text-[#445DA3] hover:underline flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Reiniciar
          </button>
        )}
      </div>

      {stage === "idle" && (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0] ?? null;
            onFile(f);
          }}
          className="rounded-xl border-2 border-dashed p-8 transition-colors"
          style={{
            borderColor: isDragging ? NUVEX.azul : NUVEX.azul + "55",
            background: isDragging ? NUVEX.azul + "10" : "#FBFCFD",
          }}
        >
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: NUVEX.azul + "15" }}
            >
              <FileText className="h-6 w-6" style={{ color: NUVEX.azul }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#242424]">
                📄 Cargar Extracto Bancario
              </div>
              <div className="mt-1 text-xs text-[#242424]/70">
                {isDragging
                  ? "Suelte el archivo para cargarlo"
                  : "Arrastre aquí el PDF del extracto"}
              </div>
            </div>
            {!isDragging && (
              <>
                <div className="text-[11px] text-[#242424]/50">o</div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                  style={{ background: NUVEX.azul }}
                >
                  <Upload className="h-3.5 w-3.5" /> Seleccionar archivo
                </button>
                <div className="mt-2 text-[10px] text-[#242424]/55">
                  Formato permitido: <strong>PDF</strong> · Tamaño máximo: <strong>20 MB</strong>
                </div>
                <div className="text-[10px] text-[#242424]/45 max-w-md">
                  Bancos soportados: Bancolombia, Davivienda, Davibank, Caja Social, Banco de
                  Bogotá, FNA, Banco Popular, Banco de Occidente, AV Villas, Credifamilia.
                </div>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      )}

      {stage === "password" && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: NUVEX.azul + "33", background: "#F7F9FB" }}
        >
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <KeyRound className="h-4 w-4" /> El PDF requiere contraseña
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Contraseña del PDF"
            />
            <button
              onClick={onUnlock}
              className="rounded px-4 py-2 text-sm text-white"
              style={{ background: NUVEX.azul }}
            >
              Abrir
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-[#B42318]">{error}</div>}
        </div>
      )}

      {stage === "reading" && (
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: NUVEX.azul + "33", background: "#F7F9FB" }}
        >
          {file && (
            <div className="flex items-center gap-2 text-xs text-[#242424]/80">
              <CheckCircle2 className="h-4 w-4" style={{ color: NUVEX.verdeTextoFuerte }} />
              <span className="font-medium">{file.name}</span>
              <span className="text-[#242424]/50">· {fmtSize(file.size)}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: NUVEX.azul }} />
            <div className="text-sm font-medium text-[#242424]">
              {readingPhase === "upload" && "Subiendo archivo…"}
              {readingPhase === "ocr" && "Procesando OCR…"}
              {readingPhase === "analyze" && "Analizando extracto…"}
            </div>
          </div>
          <div className="flex gap-1">
            {(["upload", "ocr", "analyze"] as const).map((p, i) => {
              const order = { upload: 0, ocr: 1, analyze: 2 }[readingPhase];
              const done = i <= order;
              return (
                <div
                  key={p}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{ background: done ? NUVEX.azul : NUVEX.azul + "22" }}
                />
              );
            })}
          </div>
        </div>
      )}

      {stage === "error" && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: "#F5C2C2", background: NUVEX.rojoBg }}
        >
          <div
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: NUVEX.rojoTexto }}
          >
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
          <button
            onClick={reset}
            className="mt-3 text-xs underline"
            style={{ color: NUVEX.rojoTexto }}
          >
            Subir otro archivo
          </button>
        </div>
      )}

      {stage === "saved" && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: NUVEX.verde, background: NUVEX.verdeClaro }}
        >
          <div
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: NUVEX.verdeTextoFuerte }}
          >
            <CheckCircle2 className="h-4 w-4" /> Lectura aprobada y guardada en trazabilidad.
          </div>

          {expedienteId && (
            <div className="mt-3 rounded-md bg-white/70 border border-white px-3 py-2 text-[12px]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: NUVEX.azul }} />
                <span className="font-semibold text-[#242424]">NUVIA Financial QA AI</span>
                {autoQaState === "running" && (
                  <span className="text-[#445DA3] inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Auditando automáticamente…
                  </span>
                )}
                {autoQaState === "done" && autoQa && (
                  <QABadge
                    categoria={autoQa.categoria}
                    score={autoQa.score}
                    auditoriaId={autoQa.auditoriaId}
                    size="sm"
                  />
                )}
                {autoQaState === "error" && (
                  <span className="text-[#991B1B]">Auditoría QA falló (la lectura quedó guardada).</span>
                )}
              </div>
              {autoQaState === "done" && autoQa && (
                <div className="mt-1 text-[11px] text-[#242424]/70">
                  {autoQa.hallazgos} hallazgo(s) · {autoQa.criticos} crítico(s)
                  {autoQa.categoria === "rechazado" && (
                    <span className="ml-2 text-[#991B1B] font-semibold">
                      Caso bloqueado para avanzar. Corrija y reauditar.
                    </span>
                  )}
                </div>
              )}
              {autoQaState === "error" && autoQaError && (
                <div className="mt-1 text-[11px] text-[#991B1B]/80">{autoQaError}</div>
              )}
            </div>
          )}

          <button
            onClick={reset}
            className="mt-3 text-xs underline"
            style={{ color: NUVEX.verdeTextoFuerte }}
          >
            Procesar otro extracto
          </button>
        </div>
      )}


      {(stage === "review" || stage === "saving") && result && (
        <div className="space-y-4">
          {/* Cabecera detección */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <DetectChip label="Banco" value={result.banco} score={result.scores.banco} />
            <DetectChip
              label="Producto"
              value={result.producto || "—"}
              score={result.scores.producto}
            />
            <DetectChip label="Moneda" value={result.moneda || "—"} score={result.scores.moneda} />
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: NUVEX.azul + "33", background: "#F7F9FB" }}
            >
              <div className="text-[10px] uppercase tracking-wide text-[#242424]/60">
                Confianza global
              </div>
              <div
                className="text-2xl font-semibold"
                style={{
                  color:
                    result.confianzaGlobal >= UMBRAL_BLOQUEO ? NUVEX.verdeTextoFuerte : "#a35d1c",
                }}
              >
                {result.confianzaGlobal.toFixed(1)}%
              </div>
              <div className="text-[10px] text-[#242424]/60">Plantilla: {result.bankProfileId}</div>
            </div>
          </div>

          {/* Costo IA */}
          {result.costo && (
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: NUVEX.azul + "33", background: "#FBFCFD" }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[#242424]/60">
                    Costo de procesamiento (IA)
                  </div>
                  <div className="text-lg font-semibold text-[#242424]">
                    USD ${result.costo.totalUSD.toFixed(4)}
                    <span className="ml-2 text-[11px] font-normal text-[#242424]/60">
                      ≈ COP ${Math.round(result.costo.totalUSD * 4000).toLocaleString("es-CO")}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-[#242424]/70 space-y-0.5">
                  {result.costo.llamadas.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="font-medium capitalize">{l.paso}:</span>
                      <span>{l.modelo.replace("google/", "")}</span>
                      <span>· in {l.tokensInput.toLocaleString()}</span>
                      <span>· out {l.tokensOutput.toLocaleString()}</span>
                      <span>· ${l.costoUSD.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {camposBloqueados.length > 0 && (
            <div
              className="rounded-lg border p-3 text-xs"
              style={{
                borderColor: "#F4A26155",
                background: "rgba(244,162,97,0.10)",
                color: "#a35d1c",
              }}
            >
              <div className="flex items-center gap-2 font-medium mb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Revisión manual requerida
              </div>
              {camposBloqueados.length} variable(s) crítica(s) por debajo del {UMBRAL_BLOQUEO}%.
              Corrige o completa antes de aprobar:{" "}
              {camposBloqueados.map((k) => CAMPO_LABEL[k]).join(", ")}.
            </div>
          )}

          {result.alertas.length > 0 && (
            <div
              className="rounded-lg border p-3 text-xs"
              style={{ borderColor: NUVEX.azul + "33", background: "#F7F9FB" }}
            >
              <div className="font-medium mb-1">Notas del parser</div>
              <ul className="list-disc pl-4 space-y-0.5 text-[#242424]/80">
                {result.alertas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabla de campos */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#E5E7EB" }}>
            <table className="w-full text-sm">
              <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
                <tr>
                  <th className="text-left px-3 py-2">Campo</th>
                  <th className="text-left px-3 py-2">Valor extraído</th>
                  <th className="text-left px-3 py-2 w-32">Confianza</th>
                </tr>
              </thead>
              <tbody>
                {CAMPOS_MOTOR.filter((k) => k !== "banco").map((k) => {
                  const s = result.scores[k] ?? 0;
                  const badge = scoreBadge(s);
                  const isCritico = CAMPOS_CRITICOS.includes(k);
                  return (
                    <tr key={k} className="border-t" style={{ borderColor: "#EEF1F5" }}>
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-[#242424]">{CAMPO_LABEL[k]}</div>
                        {isCritico && (
                          <div className="text-[10px]" style={{ color: NUVEX.azul }}>
                            Crítico
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={valor(k)}
                          onChange={(e) => setValor(k, e.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm"
                          style={{
                            borderColor: s < UMBRAL_BLOQUEO && isCritico ? "#F4A261" : "#E5E7EB",
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {s}% · {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Trazabilidad */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-xs"
            style={{ borderColor: "#E5E7EB", background: "#F7F9FB" }}
          >
            <div className="flex items-center gap-2 text-[#242424]/70">
              <FileText className="h-3.5 w-3.5" />
              {file?.name ?? "archivo"}{" "}
              {archivoPath ? "· almacenado para trazabilidad" : "· sin copia en storage"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="rounded border px-3 py-1.5 text-xs"
                style={{ borderColor: "#E5E7EB" }}
              >
                Descartar
              </button>
              <button
                onClick={confirmar}
                disabled={!puedeAprobar || stage === "saving"}
                className="rounded px-4 py-1.5 text-xs font-semibold text-white inline-flex items-center gap-1 disabled:opacity-50"
                style={{ background: NUVEX.verde }}
                title={
                  !puedeAprobar
                    ? "Completa los campos críticos en rojo antes de aprobar"
                    : "Confirmar y guardar lectura"
                }
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {stage === "saving" ? "Guardando…" : "✓ Confirmar datos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetectChip({ label, value, score }: { label: string; value: string; score: number }) {
  const ok = score >= UMBRAL_BLOQUEO;
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: NUVEX.azul + "33", background: "#fff" }}
    >
      <div className="text-[10px] uppercase tracking-wide text-[#242424]/60">{label}</div>
      <div className="text-sm font-semibold text-[#242424] truncate">{value || "—"}</div>
      <div
        className="text-[10px] mt-0.5"
        style={{ color: ok ? NUVEX.verdeTextoFuerte : "#a35d1c" }}
      >
        {score}% confianza
      </div>
    </div>
  );
}
