import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/nuvex/Logo";
import {
  CheckCircle2, ChevronRight, Sparkles, User, Map, GraduationCap,
  ClipboardCheck, PlayCircle, ArrowRight,
} from "lucide-react";
import { logOnboarding, updateOnboarding, profileIsComplete, type OnboardingProfile } from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
  head: () => ({ meta: [{ title: "Bienvenido · NUVEX" }] }),
});

type Config = { video_bienvenida_url: string | null; mensaje_bienvenida: string; descripcion_empresa: string };

const STEPS = [
  { key: "bienvenida", label: "Bienvenida", Icon: Sparkles },
  { key: "perfil", label: "Perfil", Icon: User },
  { key: "tour", label: "Tour", Icon: Map },
  { key: "academia", label: "Academia", Icon: GraduationCap },
  { key: "checklist", label: "Checklist", Icon: ClipboardCheck },
] as const;

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      const p = data as unknown as OnboardingProfile;
      setProfile(p);
      setStep(Math.min(p?.onboarding_paso ?? 0, 4));
      const { data: cfg } = await supabase.from("onboarding_config" as never).select("*").maybeSingle();
      setConfig(cfg as unknown as Config);
    })();
  }, [user]);

  const goto = async (s: number) => {
    setStep(s);
    if (user) await updateOnboarding(user.id, { onboarding_paso: s });
  };

  if (!profile || !user) return <Loading />;

  return (
    <div className="min-h-screen text-white" style={{ background: "linear-gradient(135deg, #050814, #0A1226 60%, #07162D)" }}>
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Logo variant="white" height={28} />
        <button onClick={() => navigate({ to: "/" })} className="text-xs text-white/50 hover:text-white">Saltar onboarding →</button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Stepper step={step} />

        <section className="mt-8 rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {step === 0 && <StepBienvenida config={config} onNext={async () => {
            await updateOnboarding(user.id, { bienvenida_vista: true });
            await logOnboarding(user.id, "bienvenida_vista");
            await goto(1);
          }} />}
          {step === 1 && <StepPerfil profile={profile} userId={user.id} saving={saving} setSaving={setSaving}
            onUpdate={(p) => setProfile({ ...profile, ...p })}
            onNext={async () => {
              const complete = profileIsComplete(profile);
              if (complete) {
                await updateOnboarding(user.id, { perfil_completo: true });
                await logOnboarding(user.id, "perfil_completado");
              }
              await goto(2);
            }} />}
          {step === 2 && <StepTour onNext={async () => {
            await updateOnboarding(user.id, { tour_completo: true });
            await logOnboarding(user.id, "tour_completado");
            await goto(3);
          }} />}
          {step === 3 && <StepAcademia rol={profile.rol_solicitado} onNext={() => goto(4)} />}
          {step === 4 && <StepChecklist profile={profile} onFinish={async () => {
            await updateOnboarding(user.id, {
              checklist_completo: true,
              onboarding_estado: "completado" as never,
              onboarding_completed_at: new Date().toISOString() as never,
              onboarding_paso: 5,
            } as never);
            await logOnboarding(user.id, "fin_onboarding");
            navigate({ to: "/" });
          }} />}
        </section>

        <div className="mt-4 flex justify-between">
          <button disabled={step === 0} onClick={() => goto(Math.max(0, step - 1))} className="text-sm text-white/50 disabled:opacity-30">← Anterior</button>
          <button onClick={() => goto(Math.min(4, step + 1))} className="text-sm text-white/50">Siguiente →</button>
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return <div className="min-h-screen flex items-center justify-center text-white/60 text-sm" style={{ background: "#050814" }}>Cargando…</div>;
}

function Stepper({ step }: { step: number }) {
  const pct = (step / (STEPS.length - 1)) * 100;
  return (
    <div className="relative">
      {/* Track */}
      <div className="absolute left-4 right-4 top-[18px] h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #445DA3, #84B98F)" }}
        />
      </div>
      <div className="relative flex items-start justify-between">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.key} className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <div
                className="h-9 w-9 rounded-full inline-flex items-center justify-center text-xs font-semibold shadow-md ring-2 ring-[#0A1226]"
                style={{
                  background: done
                    ? "linear-gradient(135deg, #84B98F, #5fa36c)"
                    : active
                      ? "linear-gradient(135deg, #445DA3, #84B98F)"
                      : "#1a2440",
                  color: done || active ? "#fff" : "rgba(255,255,255,0.55)",
                  border: active ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: active ? "0 0 0 4px rgba(68,93,163,0.25)" : undefined,
                }}
              >
                {done ? <CheckCircle2 size={16} /> : <s.Icon size={14} />}
              </div>
              <span className={`text-[11px] text-center ${active ? "text-white font-medium" : done ? "text-white/70" : "text-white/40"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== STEPS =====

function StepBienvenida({ config, onNext }: { config: Config | null; onNext: () => void }) {
  const videoEmbed = useMemo(() => {
    const url = config?.video_bienvenida_url;
    if (!url) return null;
    const ytMatch = url.match(/(?:youtu\.be\/|v=)([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    return url;
  }, [config]);

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
        <Sparkles />
      </div>
      <h1 className="text-3xl font-semibold mb-2">🎉 Bienvenido a NUVEX</h1>
      <p className="text-white/70 max-w-2xl mx-auto">{config?.mensaje_bienvenida ?? "Nos alegra tenerte en el equipo."}</p>

      {videoEmbed && (
        <div className="mt-6 max-w-2xl mx-auto aspect-video rounded-xl overflow-hidden border border-white/10">
          <iframe src={videoEmbed} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      )}

      {!videoEmbed && (
        <div className="mt-6 max-w-2xl mx-auto rounded-xl p-8 border border-white/10 text-white/60 text-sm" style={{ background: "rgba(255,255,255,0.02)" }}>
          <PlayCircle className="mx-auto mb-2" /> El Super Admin puede configurar un video de bienvenida.
        </div>
      )}

      <p className="text-sm text-white/60 mt-6 max-w-2xl mx-auto">{config?.descripcion_empresa}</p>

      <button onClick={onNext} className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
        Comenzar <ArrowRight size={16} />
      </button>
    </div>
  );
}

function StepPerfil({
  profile, userId, saving, setSaving, onUpdate, onNext,
}: {
  profile: OnboardingProfile; userId: string; saving: boolean;
  setSaving: (v: boolean) => void;
  onUpdate: (p: Partial<OnboardingProfile>) => void;
  onNext: () => void;
}) {
  const [f, setF] = useState({
    nombre: profile.nombre ?? "",
    celular: profile.celular ?? "",
    ciudad: profile.ciudad ?? "",
    pais: profile.pais ?? "Colombia",
  });

  const save = async () => {
    setSaving(true);
    await supabase.from("profiles").update(f).eq("id", userId);
    onUpdate(f);
    setSaving(false);
    onNext();
  };

  const complete = f.nombre.trim() && f.celular.trim() && f.ciudad.trim() && f.pais.trim();

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Completa tu perfil</h2>
      <p className="text-white/60 text-sm mb-6">Estos datos nos ayudan a personalizar tu experiencia en NUVEX.</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre completo" value={f.nombre} onChange={(v) => setF({ ...f, nombre: v })} />
        <Field label="Celular" value={f.celular} onChange={(v) => setF({ ...f, celular: v })} />
        <Field label="Ciudad" value={f.ciudad} onChange={(v) => setF({ ...f, ciudad: v })} />
        <Field label="País" value={f.pais} onChange={(v) => setF({ ...f, pais: v })} />
      </div>
      <div className="mt-3 text-xs text-white/50">
        Tu avatar y datos avanzados los puedes completar en <Link to="/mi-perfil" className="underline">Mi Perfil</Link>.
      </div>
      <div className="mt-6 flex justify-end">
        <button onClick={save} disabled={!complete || saving} className="px-6 py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
          {saving ? "Guardando…" : "Guardar y continuar"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-white/60 mb-1.5 block">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
    </label>
  );
}

const TOUR_ITEMS = [
  { to: "/", label: "Simulador", desc: "Proyecta y simula casos en segundos." },
  { to: "/casos", label: "Casos", desc: "Tu pipeline comercial y operativo." },
  { to: "/expediente-maestro", label: "Expediente", desc: "Toda la información del cliente centralizada." },
  { to: "/proyeccion", label: "Proyección", desc: "Análisis financiero detallado." },
  { to: "/colaboracion", label: "Colaboración", desc: "Chat de equipo y canales por caso." },
  { to: "/academia", label: "Academia", desc: "Tu plan de formación NUVEX." },
  { to: "/nuvex-ia", label: "NUVEX IA", desc: "Asistente inteligente especializado." },
  { to: "/mi-perfil", label: "Mi Perfil", desc: "Datos personales y bancarios." },
  { to: "/notificaciones", label: "Notificaciones", desc: "Alertas y recordatorios." },
];

function StepTour({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Conoce la plataforma</h2>
      <p className="text-white/60 text-sm mb-6">Estos son los módulos principales que tienes disponibles:</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TOUR_ITEMS.map((it) => (
          <div key={it.to} className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-sm font-semibold text-white">{it.label}</div>
            <div className="text-xs text-white/60 mt-1">{it.desc}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <button onClick={onNext} className="px-6 py-2.5 rounded-xl font-semibold text-white" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
          Continuar <ChevronRight className="inline" size={14} />
        </button>
      </div>
    </div>
  );
}

function StepAcademia({ rol, onNext }: { rol: string | null; onNext: () => void }) {
  const [curso, setCurso] = useState<{ titulo: string; descripcion: string | null } | null>(null);
  useEffect(() => {
    if (!rol) return;
    supabase.from("academia_cursos").select("titulo, descripcion").eq("rol_destino", rol as never).eq("activo", true).maybeSingle()
      .then(({ data }) => setCurso(data as never));
  }, [rol]);
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
        <GraduationCap />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Tu academia está lista</h2>
      {curso ? (
        <>
          <p className="text-white/70">Te asignamos automáticamente la <b>{curso.titulo}</b></p>
          {curso.descripcion && <p className="text-white/50 text-sm mt-2 max-w-xl mx-auto">{curso.descripcion}</p>}
        </>
      ) : (
        <p className="text-white/60 text-sm">Pronto tendrás tu plan formativo activado.</p>
      )}
      <div className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-amber-200" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
        La academia es <b className="ml-1">no bloqueante</b>: puedes operar desde ya.
      </div>
      <div className="mt-6 flex gap-3 justify-center">
        <Link to="/academia" className="px-5 py-2.5 rounded-xl text-sm text-white border border-white/15 hover:bg-white/5">Ver mi academia</Link>
        <button onClick={onNext} className="px-6 py-2.5 rounded-xl font-semibold text-white" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
          Continuar <ChevronRight className="inline" size={14} />
        </button>
      </div>
    </div>
  );
}

function StepChecklist({ profile, onFinish }: { profile: OnboardingProfile; onFinish: () => void }) {
  const items = [
    { ok: profile.perfil_completo || profileIsComplete(profile), label: "Perfil completado" },
    { ok: !!profile.avatar_url, label: "Avatar cargado (opcional)" },
    { ok: profile.tour_completo, label: "Tour realizado" },
    { ok: profile.academia_asignada, label: "Academia asignada" },
    { ok: true, label: "Centro de colaboración activado" },
    { ok: true, label: "NUVEX IA disponible" },
  ];
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Checklist de ingreso</h2>
      <p className="text-white/60 text-sm mb-6">Confirma que todo está listo para comenzar a operar.</p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="h-6 w-6 rounded-full inline-flex items-center justify-center"
              style={{ background: it.ok ? "#84B98F" : "rgba(255,255,255,0.05)", color: it.ok ? "#fff" : "rgba(255,255,255,0.4)" }}>
              {it.ok ? <CheckCircle2 size={14} /> : <span className="text-xs">○</span>}
            </div>
            <span className={`text-sm ${it.ok ? "text-white" : "text-white/50"}`}>{it.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-end">
        <button onClick={onFinish} className="px-6 py-2.5 rounded-xl font-semibold text-white" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
          Finalizar y entrar a NUVEX <ArrowRight className="inline" size={14} />
        </button>
      </div>
    </div>
  );
}
