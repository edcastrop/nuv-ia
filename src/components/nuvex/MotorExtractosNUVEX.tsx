import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload, Sparkles, Loader2, FileText, CheckCircle2, AlertTriangle,
  ShieldCheck, X, KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  extractStatementMotor, type MotorResultado,
} from "@/lib/motorExtractos.functions";
import {
  CAMPOS_MOTOR, CAMPOS_CRITICOS, CAMPO_LABEL, type CampoMotor,
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
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as { default: string };
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
  if (score >= UMBRAL_BLOQUEO) return { bg: "rgba(132,185,143,0.15)", color: "#1F6D3D", label: "OK" };
  if (score >= 70) return { bg: "rgba(244,162,97,0.18)", color: "#a35d1c", label: "Verificar" };
  if (score > 0) return { bg: "rgba(244,67,54,0.10)", color: "#B42318", label: "Bajo" };
  return { bg: "#F1F3F6", color: "#6b7280", label: "Vacío" };
}

const MAX_SIZE = 20 * 1024 * 1024;
const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

export function MotorExtractosNUVEX({ expedienteId, onConfirm }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const motor = useServerFn(extractStatementMotor);
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
    setStage("idle"); setFile(null); setArchivoPath(null); setPassword("");
    setError(null); setResult(null); setEditado({}); setIsDragging(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startRead = async (selected: File, pwd?: string) => {
    setStage("reading"); setError(null);
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

      // Subir archivo a storage para trazabilidad (opcional, no bloqueante)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const path = `${user.id}/motor/${Date.now()}-${selected.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const up = await supabase.storage.from("extractos").upload(path, selected, { upsert: false });
          if (!up.error) setArchivoPath(path);
        }
      } catch { /* no bloqueante */ }

      const res = await motor({ data: { images } });
      if (res.error || !res.data) {
        setError(res.error || "Lectura sin datos."); setStage("error"); return;
      }
      setResult(res.data); setStage("review");
    } catch (e) {
      setError((e as Error).message); setStage("error");
    }
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    void startRead(f);
  };

  const onUnlock = async () => {
    if (!file || !password) return;
    await startRead(file, password);
  };

  const valor = (k: CampoMotor) => (editado[k] ?? result?.datos[k] ?? "");
  const setValor = (k: CampoMotor, v: string) => setEditado((e) => ({ ...e, [k]: v }));

  const confirmar = async () => {
    if (!result) return;
    setStage("saving");
    try {
      const datosFinales = { ...result.datos, ...editado };
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("extractos_lecturas").insert({
        expediente_id: expedienteId ?? null,
        asesor_id: user?.id,
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
      });
      if (insErr) throw insErr;
      onConfirm?.({ ...result, datos: datosFinales as Record<CampoMotor, string> });
      setStage("saved");
    } catch (e) {
      setError((e as Error).message); setStage("error");
    }
  };

  const camposBloqueados = result
    ? CAMPOS_CRITICOS.filter((k) => result.scores[k] < UMBRAL_BLOQUEO)
    : [];
  const puedeAprobar = !!result && camposBloqueados.every((k) => (editado[k] ?? "").trim().length > 0);

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: NUVEX.azul + "33" }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: NUVEX.azul }}>
            <Sparkles className="h-3.5 w-3.5" /> Motor Extractos NUVEX · V1 Beta
          </div>
          <h3 className="mt-1 text-lg font-semibold text-[#242424]">Lector inteligente por plantillas bancarias</h3>
          <p className="mt-1 text-xs text-[#242424]/60">
            Detección automática de banco, producto y moneda. Parser especializado por banco.
            Umbral de aprobación: <strong>{UMBRAL_BLOQUEO}%</strong> en variables críticas.
          </p>
        </div>
        {stage !== "idle" && (
          <button onClick={reset} className="text-xs text-[#445DA3] hover:underline flex items-center gap-1">
            <X className="h-3 w-3" /> Reiniciar
          </button>
        )}
      </div>

      {stage === "idle" && (
        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:bg-[#F7F9FB]"
          style={{ borderColor: NUVEX.azul + "55" }}>
          <Upload className="h-6 w-6" style={{ color: NUVEX.azul }} />
          <div className="text-sm font-medium text-[#242424]">Subir extracto bancario (PDF o imagen)</div>
          <div className="text-[11px] text-[#242424]/60">Bancos soportados: Bancolombia, Davivienda, Davibank, Caja Social, Banco de Bogotá, FNA, Banco Popular, Banco de Occidente, AV Villas, Credifamilia.</div>
          <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
      )}

      {stage === "password" && (
        <div className="rounded-lg border p-4" style={{ borderColor: NUVEX.azul + "33", background: "#F7F9FB" }}>
          <div className="flex items-center gap-2 text-sm font-medium mb-2"><KeyRound className="h-4 w-4" /> El PDF requiere contraseña</div>
          <div className="flex gap-2">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="flex-1 rounded border px-3 py-2 text-sm" placeholder="Contraseña del PDF" />
            <button onClick={onUnlock} className="rounded px-4 py-2 text-sm text-white" style={{ background: NUVEX.azul }}>Abrir</button>
          </div>
          {error && <div className="mt-2 text-xs text-[#B42318]">{error}</div>}
        </div>
      )}

      {stage === "reading" && (
        <div className="flex items-center gap-3 rounded-lg border p-4" style={{ borderColor: NUVEX.azul + "33" }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: NUVEX.azul }} />
          <div className="text-sm">Detectando banco y aplicando parser especializado…</div>
        </div>
      )}

      {stage === "error" && (
        <div className="rounded-lg border p-4" style={{ borderColor: "#F5C2C2", background: NUVEX.rojoBg }}>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: NUVEX.rojoTexto }}>
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
          <button onClick={reset} className="mt-3 text-xs underline" style={{ color: NUVEX.rojoTexto }}>Subir otro archivo</button>
        </div>
      )}

      {stage === "saved" && (
        <div className="rounded-lg border p-4" style={{ borderColor: NUVEX.verde, background: NUVEX.verdeClaro }}>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: NUVEX.verdeTextoFuerte }}>
            <CheckCircle2 className="h-4 w-4" /> Lectura aprobada y guardada en trazabilidad.
          </div>
          <button onClick={reset} className="mt-3 text-xs underline" style={{ color: NUVEX.verdeTextoFuerte }}>Procesar otro extracto</button>
        </div>
      )}

      {(stage === "review" || stage === "saving") && result && (
        <div className="space-y-4">
          {/* Cabecera detección */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <DetectChip label="Banco" value={result.banco} score={result.scores.banco} />
            <DetectChip label="Producto" value={result.producto || "—"} score={result.scores.producto} />
            <DetectChip label="Moneda" value={result.moneda || "—"} score={result.scores.moneda} />
            <div className="rounded-lg border p-3" style={{ borderColor: NUVEX.azul + "33", background: "#F7F9FB" }}>
              <div className="text-[10px] uppercase tracking-wide text-[#242424]/60">Confianza global</div>
              <div className="text-2xl font-semibold" style={{ color: result.confianzaGlobal >= UMBRAL_BLOQUEO ? NUVEX.verdeTextoFuerte : "#a35d1c" }}>
                {result.confianzaGlobal.toFixed(1)}%
              </div>
              <div className="text-[10px] text-[#242424]/60">Plantilla: {result.bankProfileId}</div>
            </div>
          </div>

          {camposBloqueados.length > 0 && (
            <div className="rounded-lg border p-3 text-xs" style={{ borderColor: "#F4A26155", background: "rgba(244,162,97,0.10)", color: "#a35d1c" }}>
              <div className="flex items-center gap-2 font-medium mb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Revisión manual requerida
              </div>
              {camposBloqueados.length} variable(s) crítica(s) por debajo del {UMBRAL_BLOQUEO}%. Corrige o completa antes de aprobar:
              {" "}{camposBloqueados.map((k) => CAMPO_LABEL[k]).join(", ")}.
            </div>
          )}

          {result.alertas.length > 0 && (
            <div className="rounded-lg border p-3 text-xs" style={{ borderColor: NUVEX.azul + "33", background: "#F7F9FB" }}>
              <div className="font-medium mb-1">Notas del parser</div>
              <ul className="list-disc pl-4 space-y-0.5 text-[#242424]/80">
                {result.alertas.map((a, i) => <li key={i}>{a}</li>)}
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
                        {isCritico && <div className="text-[10px]" style={{ color: NUVEX.azul }}>Crítico</div>}
                      </td>
                      <td className="px-3 py-2">
                        <input value={valor(k)} onChange={(e) => setValor(k, e.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm"
                          style={{ borderColor: s < UMBRAL_BLOQUEO && isCritico ? "#F4A261" : "#E5E7EB" }} />
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: badge.bg, color: badge.color }}>
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-xs" style={{ borderColor: "#E5E7EB", background: "#F7F9FB" }}>
            <div className="flex items-center gap-2 text-[#242424]/70">
              <FileText className="h-3.5 w-3.5" />
              {file?.name ?? "archivo"} {archivoPath ? "· almacenado para trazabilidad" : "· sin copia en storage"}
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: "#E5E7EB" }}>
                Descartar
              </button>
              <button
                onClick={confirmar}
                disabled={!puedeAprobar || stage === "saving"}
                className="rounded px-4 py-1.5 text-xs font-semibold text-white inline-flex items-center gap-1 disabled:opacity-50"
                style={{ background: NUVEX.verde }}
                title={!puedeAprobar ? "Completa los campos críticos en rojo antes de aprobar" : "Confirmar y guardar lectura"}
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
    <div className="rounded-lg border p-3" style={{ borderColor: NUVEX.azul + "33", background: "#fff" }}>
      <div className="text-[10px] uppercase tracking-wide text-[#242424]/60">{label}</div>
      <div className="text-sm font-semibold text-[#242424] truncate">{value || "—"}</div>
      <div className="text-[10px] mt-0.5" style={{ color: ok ? NUVEX.verdeTextoFuerte : "#a35d1c" }}>
        {score}% confianza
      </div>
    </div>
  );
}
