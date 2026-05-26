import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/nuvex/Logo";
import { ArrowRight, ShieldCheck, Lock } from "lucide-react";

export const Route = createFileRoute("/registro")({
  component: RegistroPage,
  head: () => ({ meta: [{ title: "Solicitar acceso · NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";
const NEGRO = "#242424";

const ROLES_SOLICITABLES = [
  { v: "licenciado", label: "Licenciado" },
  { v: "operaciones", label: "Operaciones" },
  { v: "juridica", label: "Jurídica" },
  { v: "finanzas_tesoreria", label: "Finanzas y Tesorería" },
  { v: "contabilidad", label: "Contabilidad" },
  { v: "gerencia_comercial", label: "Gerencia Comercial" },
  { v: "super_admin", label: "Super Admin" },
];

function RegistroPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: "", email: "", password: "",
    telefono: "", ciudad: "", equipo: "",
    rol_solicitado: "licenciado",
  });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (form.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            nombre: form.nombre,
            telefono: form.telefono,
            ciudad: form.ciudad,
            equipo: form.equipo,
            rol_solicitado: form.rol_solicitado,
          },
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/login" : undefined,
        },
      });
      if (error) throw error;
      await supabase.auth.signOut();
      setDone(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 overflow-hidden"
        style={{ background: "linear-gradient(155deg, #F0F4FA 0%, #F8FAFF 40%, #EDF2F9 100%)" }}>
        <BackgroundBlobs />
        <div className="relative z-10 w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Logo height={52} />
          </div>
          <div className="rounded-[28px] bg-white/90 backdrop-blur-sm border border-[#E5EAF2] shadow-[0_24px_72px_-24px_rgba(68,93,163,0.22)] p-10 text-center">
            <div className="mx-auto mb-5 h-16 w-16 rounded-full flex items-center justify-center text-white text-2xl shadow-lg"
                 style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}>
              <ShieldCheck className="w-7 h-7" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-semibold" style={{ color: NEGRO }}>Solicitud enviada</h2>
            <p className="mt-3 text-sm text-[#242424]/70 leading-relaxed">
              Tu cuenta quedó en <b>estado pendiente</b>. Un administrador NUVEX revisará y aprobará tu acceso.
              Recibirás una notificación cuando puedas iniciar sesión.
            </p>
            <button
              onClick={() => navigate({ to: "/login" })}
              className="mt-7 w-full rounded-[18px] px-4 py-3.5 text-sm font-semibold uppercase tracking-wider text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
            >Volver al login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-10 overflow-hidden"
      style={{ background: "linear-gradient(155deg, #F0F4FA 0%, #F8FAFF 40%, #EDF2F9 100%)" }}>
      <BackgroundBlobs />
      <div className="relative z-10 w-full max-w-[760px]">
        <div className="flex justify-center mb-8">
          <Logo height={52} />
        </div>
        <div className="rounded-[28px] bg-white/90 backdrop-blur-sm border border-[#E5EAF2] shadow-[0_24px_72px_-24px_rgba(68,93,163,0.22)] px-6 sm:px-10 md:px-12 py-10 sm:py-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#445DA3]/8 px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] font-semibold mb-4" style={{ color: AZUL }}>
            <span className="h-2 w-2 rounded-full" style={{ background: VERDE }} />
            Solicitud de acceso
          </div>
          <h2 className="text-[26px] sm:text-[28px] font-semibold tracking-tight leading-tight" style={{ color: NEGRO }}>
            Crear cuenta NUVEX
          </h2>
          <p className="mt-2 text-sm sm:text-[15px] text-[#242424]/60 leading-relaxed max-w-lg">
            Solicita tu acceso a la plataforma operativa de NUVEX. Un administrador revisará y aprobará tu cuenta antes de iniciar sesión.
          </p>

          <form onSubmit={submit} className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Nombre completo *">
              <Input value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required />
            </Field>
            <Field label="Correo corporativo *">
              <Input type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
            </Field>
            <Field label="Contraseña *">
              <Input type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
            </Field>
            <Field label="Teléfono / WhatsApp *">
              <Input value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} required placeholder="+57 …" />
            </Field>
            <Field label="Ciudad *">
              <Input value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} required />
            </Field>
            <Field label="Equipo / Sede">
              <Input value={form.equipo} onChange={(v) => setForm({ ...form, equipo: v })} placeholder="Ej. Bogotá Norte" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Rol solicitado *">
                <select
                  value={form.rol_solicitado}
                  onChange={(e) => setForm({ ...form, rol_solicitado: e.target.value })}
                  className="w-full h-14 rounded-[14px] border border-[#DDE2EB] bg-[#FAFBFD] px-4 text-sm text-[#242424] outline-none focus:border-[#445DA3] focus:bg-white focus:ring-4 focus:ring-[#445DA3]/12 transition-all duration-200 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23445DA3' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center" }}
                >
                  {ROLES_SOLICITABLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                </select>
              </Field>
            </div>

            {err && (
              <div className="sm:col-span-2 rounded-xl bg-[#FDECEC] border border-[#F5C2C2] px-4 py-3 text-sm text-[#B42318]">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="sm:col-span-2 h-[60px] mt-1 rounded-[18px] px-6 text-sm font-semibold uppercase tracking-wider text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Enviando…
                </span>
              ) : (
                <>
                  <Lock className="w-4 h-4" strokeWidth={2.5} />
                  Solicitar acceso
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#242424]/60">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: VERDE }} />
            <span className="text-center leading-relaxed">
              Tu solicitud será revisada por el equipo administrador de NUVEX antes de habilitar el acceso.
            </span>
          </div>

          <div className="mt-6 pt-5 border-t border-[#E5EAF2] text-center text-sm text-[#242424]/60">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-semibold hover:underline transition-colors" style={{ color: AZUL }}>Iniciar sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackgroundBlobs() {
  return (
    <>
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full opacity-30 blur-[100px]"
        style={{ background: "radial-gradient(circle, #445DA3 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[420px] w-[420px] rounded-full opacity-25 blur-[100px]"
        style={{ background: "radial-gradient(circle, #84B98F 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-[360px] w-[360px] rounded-full opacity-20 blur-[100px]"
        style={{ background: "radial-gradient(circle, #445DA3 0%, transparent 70%)" }} />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#242424]/55">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Input(props: { value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      required={props.required}
      placeholder={props.placeholder}
      className="w-full h-14 rounded-[14px] border border-[#DDE2EB] bg-[#FAFBFD] px-4 text-sm text-[#242424] outline-none placeholder:text-[#242424]/30 focus:border-[#445DA3] focus:bg-white focus:ring-4 focus:ring-[#445DA3]/12 transition-all duration-200"
    />
  );
}
