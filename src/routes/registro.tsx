import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/nuvex/Logo";

export const Route = createFileRoute("/registro")({
  component: RegistroPage,
  head: () => ({ meta: [{ title: "Solicitar acceso · NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";
const NEGRO = "#242424";

const ROLES_SOLICITABLES = [
  { v: "licenciado", label: "Licenciado" },
  { v: "asesor", label: "Comercial / Asesor" },
  { v: "juridica", label: "Jurídica" },
  { v: "operaciones", label: "Operaciones" },
  { v: "contabilidad", label: "Contabilidad" },
  { v: "director_financiero_qa", label: "Dirección / QA" },
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
      // Cerrar sesión por si Supabase auto-loguea — el flujo exige aprobación.
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
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#F5F7FB" }}>
        <div className="w-full max-w-md rounded-2xl bg-white border border-[#E7EAF1] shadow-[0_20px_60px_-20px_rgba(36,36,36,0.18)] p-10 text-center">
          <div className="mx-auto mb-5 h-14 w-14 rounded-full flex items-center justify-center text-white text-2xl"
               style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}>✓</div>
          <h2 className="text-xl font-semibold" style={{ color: NEGRO }}>Solicitud enviada</h2>
          <p className="mt-3 text-sm text-[#242424]/70 leading-relaxed">
            Tu cuenta quedó en <b>estado pendiente</b>. Un administrador NUVEX revisará y aprobará tu acceso.
            Recibirás una notificación cuando puedas iniciar sesión.
          </p>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="mt-7 w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white"
            style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
          >Volver al login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10" style={{ background: "#F5F7FB" }}>
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <Logo height={40} />
        </div>
        <div className="rounded-2xl bg-white border border-[#E7EAF1] shadow-[0_20px_60px_-20px_rgba(36,36,36,0.18)] p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#445DA3]/10 px-3 py-1 text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: AZUL }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: VERDE }} /> Solicitud de acceso
          </div>
          <h2 className="text-2xl font-semibold tracking-tight" style={{ color: NEGRO }}>Crear cuenta NUVEX</h2>
          <p className="mt-1.5 text-sm text-[#242424]/60">
            Tu cuenta requiere aprobación de un administrador antes de poder iniciar sesión.
          </p>

          <form onSubmit={submit} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  className="w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm"
                >
                  {ROLES_SOLICITABLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                </select>
              </Field>
            </div>

            {err && (
              <div className="sm:col-span-2 rounded-lg bg-[#FDECEC] border border-[#F5C2C2] px-3 py-2 text-sm text-[#B42318]">{err}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="sm:col-span-2 mt-2 rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow disabled:opacity-60"
              style={{ background: `linear-gradient(135deg,${AZUL},${VERDE})` }}
            >{busy ? "Enviando…" : "Solicitar acceso"}</button>
          </form>

          <div className="mt-6 text-center text-sm text-[#242424]/70">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: AZUL }}>Iniciar sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/65">{label}</span>
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
      className="w-full rounded-[10px] border border-[#E1E5EE] bg-[#FAFBFD] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3] focus:bg-white focus:ring-4 focus:ring-[#445DA3]/15 transition"
    />
  );
}
