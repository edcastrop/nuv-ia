import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { NUVEX } from "@/components/nuvex/constants";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Acceso · NUVEX" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nombre },
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
        setInfo("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.");
        setMode("signin");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (r.error) throw r.error;
      // If redirected, browser takes over
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error con Google");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E3E7EE] bg-white p-8 shadow-[0_8px_24px_rgba(36,36,36,0.06)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg font-bold text-white" style={{ backgroundColor: NUVEX.negro }}>N</div>
          <div>
            <div className="text-sm font-semibold text-[#242424]">NUVEX</div>
            <div className="text-[11px] text-[#242424]/60 -mt-0.5">Plataforma de Asesores</div>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-[#242424]">
          {mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>
        <p className="text-sm text-[#242424]/60 mt-1">
          {mode === "signin" ? "Accede a tu panel NUVEX." : "Solo personal licenciado NUVEX."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs font-medium text-[#242424]/70 uppercase">Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
                className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15" />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-[#242424]/70 uppercase">Correo</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#242424]/70 uppercase">Contraseña</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15" />
          </label>

          {err && <div className="rounded-lg bg-[#FDECEC] border border-[#F5C2C2] px-3 py-2 text-sm text-[#B42318]">{err}</div>}
          {info && <div className="rounded-lg bg-[#EAF7EE] border border-[#2E8B57] px-3 py-2 text-sm text-[#1F7A45]">{info}</div>}

          <button type="submit" disabled={busy}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ backgroundColor: NUVEX.negro }}>
            {busy ? "Procesando…" : mode === "signin" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E3E7EE]" />
          <span className="text-[11px] uppercase tracking-wider text-[#242424]/50">o</span>
          <div className="flex-1 h-px bg-[#E3E7EE]" />
        </div>
        <button onClick={google} disabled={busy}
          className="w-full rounded-lg border border-[#E3E7EE] bg-white px-4 py-2.5 text-sm font-medium text-[#242424] hover:bg-[#F7F9FB] disabled:opacity-60">
          Continuar con Google
        </button>

        <div className="mt-6 text-center text-sm text-[#242424]/70">
          {mode === "signin" ? (
            <>¿No tienes cuenta?{" "}
              <button onClick={() => setMode("signup")} className="font-semibold text-[#445DA3] hover:underline">Crear una</button>
            </>
          ) : (
            <>¿Ya tienes cuenta?{" "}
              <button onClick={() => setMode("signin")} className="font-semibold text-[#445DA3] hover:underline">Iniciar sesión</button>
            </>
          )}
        </div>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-[#242424]/50 hover:underline">Volver</Link>
        </div>
      </div>
    </div>
  );
}
