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

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Supabase coloca el token en el hash; onAuthStateChange dispara
  // PASSWORD_RECOVERY cuando lo procesa. También cubrimos getSession()
  // por si el usuario llega con sesión ya hidratada.
  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && mounted) setReady(true);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Logo size={56} />
          <h1 className="text-xl font-semibold text-[#242424]">Restablecer contraseña</h1>
          <p className="text-sm text-[#242424]/65 text-center">
            Define una contraseña nueva para tu cuenta NUVEX.
          </p>
        </div>

        {!ready && !ok && (
          <div className="rounded-lg bg-[#FFF7E6] border border-[#F5D899] px-4 py-3 text-sm text-[#8A5A00]">
            Validando enlace de recuperación… Si no estás llegando desde el correo, vuelve a solicitar el enlace desde{" "}
            <Link to="/login" className="font-semibold underline">la pantalla de acceso</Link>.
          </div>
        )}

        {ready && !ok && (
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
