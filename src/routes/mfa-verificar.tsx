import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { enviarCodigoMfaEmail, verificarCodigoMfaEmail, verificarCodigoTotp, getEstadoMfa } from "@/lib/seguridad.functions";
import { Logo } from "@/components/nuvex/Logo";
import { ShieldCheck, Mail, Smartphone, Send, Check, AlertCircle, Shield } from "lucide-react";

export const Route = createFileRoute("/mfa-verificar")({
  component: MfaPage,
  head: () => ({ meta: [{ title: "Verificación de seguridad · NUVIA" }] }),
});

function MfaPage() {
  const navigate = useNavigate();
  const enviar = useServerFn(enviarCodigoMfaEmail);
  const verificar = useServerFn(verificarCodigoMfaEmail);
  const verificarTotp = useServerFn(verificarCodigoTotp);
  const estadoMfa = useServerFn(getEstadoMfa);

  const [metodo, setMetodo] = useState<"email" | "totp">("email");
  const [totpEnrolado, setTotpEnrolado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
    });
    estadoMfa().then((s) => {
      setTotpEnrolado(s.totpEnrolado);
      if (s.totpEnrolado) setMetodo("totp");
    }).catch(() => {});
  }, [navigate, estadoMfa]);

  const handleEnviar = async () => {
    setErr(null); setInfo(null); setBusy(true);
    try {
      await enviar();
      setEnviado(true);
      setInfo("Te enviamos un código de 6 dígitos a tu correo. Expira en 10 minutos.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "No se pudo enviar el código.");
    } finally { setBusy(false); }
  };

  const handleVerificar = async () => {
    setErr(null); setBusy(true);
    try {
      if (metodo === "totp") {
        await verificarTotp({ data: { codigo } });
      } else {
        await verificar({ data: { codigo } });
      }
      navigate({ to: "/inicio" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Código inválido");
    } finally { setBusy(false); }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6 py-14 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 82% 18%, rgba(59,130,246,0.18), transparent 26%), radial-gradient(circle at 12% 88%, rgba(132,185,143,0.14), transparent 28%), radial-gradient(circle at 50% 50%, rgba(139,92,246,0.10), transparent 35%), linear-gradient(180deg, #060B1C 0%, #081028 50%, #060B1C 100%)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#F8FAFC",
      }}
    >
      <style>{`
        @keyframes nuvia-fade-up { from { opacity: 0; transform: translateY(14px); filter: blur(8px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        .nuvia-mfa-card { animation: nuvia-fade-up 360ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .nuvia-mfa-btn { transition: transform 220ms cubic-bezier(0.22,1,0.36,1), box-shadow 220ms ease, filter 220ms ease; }
        .nuvia-mfa-btn:hover:not(:disabled) { transform: translateY(-1px) scale(1.005); filter: brightness(1.06); box-shadow: 0 18px 50px -16px rgba(68,93,163,0.65), 0 0 0 1px rgba(132,185,143,0.25), 0 0 32px rgba(132,185,143,0.18); }
        .nuvia-mfa-seg { transition: all 240ms cubic-bezier(0.22,1,0.36,1); }
        .nuvia-mfa-seg:hover { background: rgba(255,255,255,0.04); }
        .nuvia-mfa-input { transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease; }
        .nuvia-mfa-input:focus { border-color: rgba(96,165,250,0.55); background: rgba(8,16,40,0.85); box-shadow: 0 0 0 3px rgba(59,130,246,0.18), 0 0 22px rgba(59,130,246,0.12); }
      `}</style>

      <div className="mt-2 mb-10 flex justify-center" style={{ filter: "drop-shadow(0 0 24px rgba(59,130,246,0.25))" }}>
        <Logo height={42} />
      </div>

      <div
        className="nuvia-mfa-card w-full"
        style={{
          maxWidth: 640,
          background: "linear-gradient(180deg, rgba(15,26,51,0.92) 0%, rgba(11,19,39,0.92) 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 20,
          padding: 44,
          backdropFilter: "blur(14px) saturate(140%)",
          boxShadow:
            "0 40px 90px -30px rgba(0,0,0,0.65), 0 0 0 1px rgba(59,130,246,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
          position: "relative",
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-5 mb-7">
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              background: "linear-gradient(135deg, rgba(68,93,163,0.28), rgba(132,185,143,0.22))",
              border: "1px solid rgba(132,185,143,0.30)",
              boxShadow: "0 0 30px rgba(68,93,163,0.35), inset 0 0 18px rgba(132,185,143,0.10)",
            }}
          >
            <ShieldCheck size={26} strokeWidth={1.6} color="#A7D7B0" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.15, color: "#F8FAFC" }}>
              Verificación de seguridad
            </h1>
            <div
              className="mt-2"
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: "#60A5FA" }}
            >
              Doble factor obligatorio
            </div>
          </div>
        </div>

        {/* Texto explicativo */}
        <p
          className="mb-8"
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.82)",
            fontWeight: 400,
          }}
        >
          Para proteger tu cuenta, NUVIA requiere una verificación adicional en cada nuevo dispositivo.
        </p>

        {/* Selector de método */}
        <div
          className="grid grid-cols-2 mb-8"
          style={{
            gap: 8,
            padding: 6,
            borderRadius: 14,
            background: "rgba(6,11,28,0.65)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {[
            { id: "email" as const, label: "Correo", Icon: Mail },
            { id: "totp" as const, label: "App auth", Icon: Smartphone },
          ].map(({ id, label, Icon }) => {
            const active = metodo === id;
            return (
              <button
                key={id}
                onClick={() => setMetodo(id)}
                className="nuvia-mfa-seg relative flex items-center justify-center gap-2.5"
                style={{
                  height: 52,
                  borderRadius: 10,
                  background: active
                    ? "linear-gradient(135deg, rgba(68,93,163,0.45), rgba(59,130,246,0.28))"
                    : "transparent",
                  border: active ? "1px solid rgba(96,165,250,0.55)" : "1px solid transparent",
                  boxShadow: active
                    ? "0 0 24px rgba(59,130,246,0.30), inset 0 1px 0 rgba(255,255,255,0.08)"
                    : "none",
                  color: active ? "#F8FAFC" : "rgba(255,255,255,0.55)",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                }}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
                {active && (
                  <span
                    className="ml-1 flex items-center justify-center"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: "rgba(132,185,143,0.20)",
                      border: "1px solid rgba(132,185,143,0.55)",
                    }}
                  >
                    <Check size={11} strokeWidth={2.8} color="#A7D7B0" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bloque según método */}
        {metodo === "email" ? (
          <div className="space-y-5">
            {!enviado ? (
              <button
                onClick={handleEnviar}
                disabled={busy}
                className="nuvia-mfa-btn w-full flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  height: 72,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #445DA3 0%, #5C7AC2 45%, #84B98F 100%)",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 14px 40px -16px rgba(68,93,163,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                <Send size={18} strokeWidth={1.8} />
                <span>{busy ? "Enviando código…" : "Enviar código al correo"}</span>
              </button>
            ) : (
              <CodeBlock
                codigo={codigo}
                setCodigo={setCodigo}
                onVerify={handleVerificar}
                onResend={handleEnviar}
                busy={busy}
                showResend
              />
            )}
          </div>
        ) : totpEnrolado ? (
          <div className="space-y-5">
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
              Abre tu app autenticadora (Google Authenticator, Authy, 1Password…) e ingresa el código de 6 dígitos para{" "}
              <span style={{ color: "#60A5FA", fontWeight: 700 }}>NUVIA</span>.
            </p>
            <CodeBlock
              codigo={codigo}
              setCodigo={setCodigo}
              onVerify={handleVerificar}
              onResend={handleEnviar}
              busy={busy}
              showResend={false}
            />
          </div>
        ) : (
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(96,165,250,0.18)",
              background: "rgba(8,16,40,0.65)",
              padding: 18,
              fontSize: 13,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <div style={{ fontWeight: 700, color: "#F8FAFC", marginBottom: 6, fontSize: 14 }}>App autenticadora</div>
            Aún no has configurado una app autenticadora. Inicia sesión por correo y, una vez dentro, actívala desde{" "}
            <span style={{ color: "#60A5FA", fontWeight: 600 }}>Mi Perfil → Seguridad</span>.
            <button
              onClick={() => setMetodo("email")}
              className="mt-4 inline-flex items-center gap-1.5"
              style={{ color: "#84B98F", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}
            >
              Usar verificación por correo →
            </button>
          </div>
        )}

        {/* Alerts */}
        {info && (
          <div
            className="mt-5 flex items-start gap-2.5"
            style={{
              borderRadius: 12,
              background: "rgba(132,185,143,0.10)",
              border: "1px solid rgba(132,185,143,0.30)",
              padding: "12px 14px",
              fontSize: 13,
              color: "#A7D7B0",
              lineHeight: 1.5,
            }}
          >
            <Check size={16} strokeWidth={2.2} className="mt-0.5 shrink-0" />
            <span>{info}</span>
          </div>
        )}
        {err && (
          <div
            className="mt-5 flex items-start gap-2.5"
            style={{
              borderRadius: 12,
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.35)",
              padding: "12px 14px",
              fontSize: 13,
              color: "#FCA5A5",
              lineHeight: 1.5,
            }}
          >
            <AlertCircle size={16} strokeWidth={2.2} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {/* Divisor con micro shield */}
        <div className="flex items-center gap-3 mt-9 mb-5" aria-hidden="true">
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)" }} />
          <span
            className="flex items-center justify-center"
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              background: "rgba(8,16,40,0.85)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Shield size={12} strokeWidth={1.8} color="rgba(255,255,255,0.45)" />
          </span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)" }} />
        </div>

        {/* Acción secundaria */}
        <div className="flex justify-center">
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="transition-colors"
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.45)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px 12px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#F8FAFC")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
          >
            Cancelar y cerrar sesión
          </button>
        </div>
      </div>

      <div className="mt-8 mb-2 text-center" style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
        NUVIA · Financial Intelligence Platform
      </div>
    </div>
  );
}

function CodeBlock({
  codigo,
  setCodigo,
  onVerify,
  onResend,
  busy,
  showResend,
}: {
  codigo: string;
  setCodigo: (v: string) => void;
  onVerify: () => void;
  onResend: () => void;
  busy: boolean;
  showResend: boolean;
}) {
  return (
    <div className="space-y-5">
      <label className="block">
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
          Código de 6 dígitos
        </span>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoFocus
          placeholder="••••••"
          className="nuvia-mfa-input mt-2 w-full"
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(6,11,28,0.75)",
            padding: "18px 16px",
            textAlign: "center",
            fontSize: 28,
            letterSpacing: "0.45em",
            fontWeight: 700,
            color: "#F8FAFC",
            outline: "none",
            fontFamily: "'Inter', monospace",
          }}
        />
      </label>
      <button
        onClick={onVerify}
        disabled={busy || codigo.length !== 6}
        className="nuvia-mfa-btn w-full flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          height: 72,
          borderRadius: 14,
          background: "linear-gradient(135deg, #445DA3 0%, #5C7AC2 45%, #84B98F 100%)",
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 14px 40px -16px rgba(68,93,163,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
          cursor: busy || codigo.length !== 6 ? "not-allowed" : "pointer",
        }}
      >
        <ShieldCheck size={18} strokeWidth={1.8} />
        <span>{busy ? "Verificando…" : "Verificar y continuar"}</span>
      </button>
      {showResend && (
        <button
          type="button"
          onClick={onResend}
          disabled={busy}
          className="w-full"
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "#60A5FA",
            background: "transparent",
            border: "none",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Reenviar código
        </button>
      )}
    </div>
  );
}
