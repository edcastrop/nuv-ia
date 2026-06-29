import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/nuvex/Logo";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Restablecer contraseña · NUVEX" }] }),
});

const NUVEX_AZUL = "#445DA3";
const NUVEX_VERDE = "#84B98F";

type Stage = "verifying" | "ready" | "expired" | "request";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");

  // Procesa todos los formatos posibles de enlace de recuperación:
  // 1) ?code=...                          (PKCE — exchangeCodeForSession)
  // 2) ?token_hash=...&type=recovery      (OTP token — verifyOtp)
  // 3) #access_token=...&type=recovery    (hash legacy — sesión ya hidratada por SDK)
  // 4) ?error=...&error_code=otp_expired  (link expirado en /verify de Supabase)
  useEffect(() => {
    let mounted = true;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const errParam = url.searchParams.get("error") || hash.get("error");
    const errCode = url.searchParams.get("error_code") || hash.get("error_code");
    if (errParam) {
      const expired = errCode === "otp_expired" || /expired/i.test(errParam);
      setStage(expired ? "expired" : "request");
      setErr(
        expired
          ? "El enlace de recuperación expiró o ya fue usado. Solicita uno nuevo."
          : `No pudimos validar el enlace (${errParam}). Solicita uno nuevo.`,
      );
      return;
    }

    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");

    const cleanUrl = () => {
      try {
        window.history.replaceState({}, "", url.pathname);
      } catch { /* noop */ }
    };

    const finish = (ready: boolean, reason?: string) => {
      if (!mounted) return;
      if (ready) {
        setStage("ready");
        cleanUrl();
      } else {
        setStage("expired");
        setErr(reason ?? "El enlace de recuperación expiró o ya fue usado. Solicita uno nuevo.");
      }
    };

    (async () => {
      // 1) PKCE
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return finish(true);
        return finish(false, error.message);
      }
      // 2) OTP token_hash
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "recovery",
        });
        if (!error) return finish(true);
        return finish(false, error.message);
      }
      // 3) Hash legacy — esperar a PASSWORD_RECOVERY / SIGNED_IN
      const { data } = await supabase.auth.getSession();
      if (data.session) return finish(true);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStage("ready");
      }
    });

    // Si tras 4s no llegó nada y no hay params válidos, ofrecer solicitar uno nuevo.
    const t = window.setTimeout(() => {
      if (!mounted) return;
      setStage((s) => {
        if (s === "verifying") {
          setErr("No detectamos un enlace válido. Solicita uno nuevo a continuación.");
          return "request";
        }
        return s;
      });
    }, 4000);

    return () => { mounted = false; subscription.unsubscribe(); window.clearTimeout(t); };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setOk(true);
      setTimeout(() => { void supabase.auth.signOut().then(() => navigate({ to: "/login" })); }, 1800);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "No se pudo actualizar la contraseña.");
    } finally {
      setBusy(false);
    }
  };

  const requestNewLink = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!requestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestEmail)) {
      return setErr("Ingresa un correo válido.");
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(requestEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setInfo("Te enviamos un nuevo enlace. Revísalo desde el mismo dispositivo y navegador donde lo abrirás, dentro de los próximos 10 minutos.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "No pudimos enviar el enlace.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Logo />
          <h1 className="text-xl font-semibold text-[#242424]">Restablecer contraseña</h1>
          <p className="text-sm text-[#242424]/65 text-center">
            Define una contraseña nueva para tu cuenta NUVEX.
          </p>
        </div>

        {stage === "verifying" && !ok && (
          <div className="rounded-lg bg-[#FFF7E6] border border-[#F5D899] px-4 py-3 text-sm text-[#8A5A00]">
            Validando enlace de recuperación…
          </div>
        )}

        {stage === "ready" && !ok && (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60 mb-1">Nueva contraseña</label>
              <input
                type="password" autoComplete="new-password" required minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#CBD2DF] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60 mb-1">Confirmar contraseña</label>
              <input
                type="password" autoComplete="new-password" required minLength={8}
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-[#CBD2DF] px-3 py-2 text-sm"
              />
            </div>
            {err && <div className="rounded-lg bg-[#FDECEC] border border-[#F5C2C2] px-3 py-2 text-sm text-[#B42318]">{err}</div>}
            <button
              type="submit" disabled={busy}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${NUVEX_AZUL} 0%, ${NUVEX_VERDE} 100%)` }}
            >
              {busy ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}

        {(stage === "expired" || stage === "request") && !ok && (
          <form onSubmit={requestNewLink} className="space-y-3">
            {err && <div className="rounded-lg bg-[#FDECEC] border border-[#F5C2C2] px-3 py-2 text-sm text-[#B42318]">{err}</div>}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60 mb-1">Tu correo</label>
              <input
                type="email" required value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full rounded-lg border border-[#CBD2DF] px-3 py-2 text-sm"
              />
            </div>
            {info && <div className="rounded-lg bg-[#EAF7EE] border border-[#84B98F] px-3 py-2 text-sm text-[#1F6D3D]">{info}</div>}
            <button
              type="submit" disabled={busy}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${NUVEX_AZUL} 0%, ${NUVEX_VERDE} 100%)` }}
            >
              {busy ? "Enviando…" : "Enviar nuevo enlace"}
            </button>
            <p className="text-[11px] text-[#242424]/55 text-center leading-relaxed">
              Tip: abre el enlace del correo desde el <strong>mismo dispositivo y navegador</strong> donde lo solicitaste, dentro de los <strong>10 minutos</strong> siguientes. Algunos antivirus o filtros corporativos pueden invalidar el enlace si lo escanean primero.
            </p>
          </form>
        )}

        {ok && (
          <div className="rounded-lg bg-[#EAF7EE] border border-[#84B98F] px-4 py-3 text-sm text-[#1F6D3D] text-center">
            Contraseña actualizada. Redirigiendo al acceso…
          </div>
        )}

        <div className="text-center text-[12px] text-[#242424]/60">
          <Link to="/login" className="hover:underline" style={{ color: NUVEX_AZUL }}>
            ← Volver al acceso
          </Link>
        </div>
      </div>
    </div>
  );
}
