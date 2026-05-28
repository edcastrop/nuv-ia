import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { enviarCodigoMfaEmail, verificarCodigoMfaEmail, verificarCodigoTotp, getEstadoMfa } from "@/lib/seguridad.functions";
import { Logo } from "@/components/nuvex/Logo";
import { ShieldCheck, Mail, Smartphone } from "lucide-react";

export const Route = createFileRoute("/mfa-verificar")({
  component: MfaPage,
  head: () => ({ meta: [{ title: "Verificación de seguridad · NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";
const NEGRO = "#242424";

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
      navigate({ to: "/" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Código inválido");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10" style={{ background: "#F5F7FB" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo height={40} /></div>
        <div className="rounded-2xl bg-white border border-[#E7EAF1] shadow-[0_20px_60px_-20px_rgba(36,36,36,0.18)] p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
                 style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: NEGRO }}>Verificación de seguridad</h2>
              <div className="text-xs text-[#242424]/60">Doble factor obligatorio</div>
            </div>
          </div>

          <p className="text-sm text-[#242424]/70 mb-5">
            Para proteger tu cuenta, NUVEX requiere verificación adicional en cada nuevo dispositivo.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              onClick={() => setMetodo("email")}
              className="rounded-xl border px-3 py-3 text-sm font-medium flex items-center gap-2 transition"
              style={metodo === "email"
                ? { background: AZUL, color: "#fff", borderColor: AZUL }
                : { background: "#fff", color: NEGRO, borderColor: "#E1E5EE" }}
            ><Mail size={16} /> Correo</button>
            <button
              onClick={() => setMetodo("totp")}
              className="rounded-xl border px-3 py-3 text-sm font-medium flex items-center gap-2 transition"
              style={metodo === "totp"
                ? { background: AZUL, color: "#fff", borderColor: AZUL }
                : { background: "#fff", color: NEGRO, borderColor: "#E1E5EE" }}
            ><Smartphone size={16} /> App auth</button>
          </div>

          {metodo === "email" ? (
            <div className="space-y-4">
              {!enviado ? (
                <button
                  onClick={handleEnviar}
                  disabled={busy}
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
                >{busy ? "Enviando…" : "Enviar código al correo"}</button>
              ) : (
                <>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/65">Código de 6 dígitos</span>
                    <input
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      autoFocus
                      placeholder="••••••"
                      className="mt-1.5 w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-3 text-center text-2xl tracking-[0.4em] font-semibold outline-none focus:border-[#445DA3] focus:bg-white"
                    />
                  </label>
                  <button
                    onClick={handleVerificar}
                    disabled={busy || codigo.length !== 6}
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
                  >{busy ? "Verificando…" : "Verificar y continuar"}</button>
                  <button
                    type="button"
                    onClick={handleEnviar}
                    disabled={busy}
                    className="w-full text-xs text-[#445DA3] hover:underline"
                  >Reenviar código</button>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[#E7EAF1] bg-[#FAFBFD] p-4 text-sm text-[#242424]/75">
              <div className="font-semibold mb-1.5" style={{ color: NEGRO }}>App autenticadora</div>
              La integración con app autenticadora (Google Authenticator / Authy) estará disponible próximamente.
              Por ahora, verifica con el código por correo.
              <button
                onClick={() => setMetodo("email")}
                className="mt-3 inline-block text-xs font-semibold hover:underline"
                style={{ color: AZUL }}
              >Usar verificación por correo →</button>
            </div>
          )}

          {info && <div className="mt-4 rounded-lg bg-[#EAF7EE] border border-[#84B98F] px-3 py-2 text-sm text-[#1F6D3D]">{info}</div>}
          {err && <div className="mt-4 rounded-lg bg-[#FDECEC] border border-[#F5C2C2] px-3 py-2 text-sm text-[#B42318]">{err}</div>}

          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="mt-6 w-full text-xs text-[#242424]/55 hover:text-[#242424]"
          >Cancelar y cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}
