import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useResolvedHomeRole } from "@/hooks/useResolvedHomeRole";
import { roleLabel } from "@/lib/roleLabels";
import { supabase } from "@/integrations/supabase/client";
import { HOME_CONFIG, type RoleHomeKpi } from "@/lib/homeConfig";
import {
  HeroRolCard,
  NuviaIAPromptCard,
  KpiCard,
  QuickActionGrid,
  CriticalAlertList,
  ActivityFeed,
  IARecomendacionesCard,
  MotivationalQuote,
  AnimatedBackground,
  type CriticalAlert,
  type ActivityItem,
} from "@/components/home/widgets";
import { Rocket } from "lucide-react";


interface RoleHomeProps {
  onLanzarSimulador: () => void;
}

type Counts = Partial<Record<NonNullable<RoleHomeKpi["source"]>, number>>;

/**
 * RoleHome — Home maestro NUVIA por rol. Resuelve rol prioritario, permite
 * cambiar la "vista" (no permisos) cuando el usuario tiene varios roles
 * y renderiza la configuración declarativa de `homeConfig`.
 *
 * Fase 6: no modifica lógica de módulos congelados. Los KPIs leen contadores
 * existentes en tablas ya consultadas por el resto del ERP (sólo SELECT count).
 */
export function RoleHome({ onLanzarSimulador }: RoleHomeProps) {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const { activeRole, setActiveRole, multiRol, loading } = useResolvedHomeRole();
  const [nombre, setNombre] = useState<string>("");
  const [counts, setCounts] = useState<Counts>({});

  // Cargar nombre del usuario (igual estrategia que NuviaHome — no toca lógica)
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles" as never)
          .select("nombre")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancel && data) {
          const nm = (data as { nombre?: string }).nombre;
          if (nm) setNombre(nm);
        }
      } catch {
        /* ignorar */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  // Contadores livianos para KPIs declarativos (solo SELECT count, no muta nada)
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const tryCount = async (
        q: PromiseLike<{ count: number | null }>,
        key: keyof Counts,
      ) => {
        try {
          const { count } = await q;
          if (!cancel && typeof count === "number") {
            setCounts((prev) => ({ ...prev, [key]: count }));
          }
        } catch {
          /* tabla puede no existir o no tener acceso — silencioso */
        }
      };

      await Promise.all([
        tryCount(
          supabase
            .from("expedientes" as never)
            .select("id", { count: "exact", head: true }) as unknown as PromiseLike<{ count: number | null }>,
          "expedientes.total",
        ),
        tryCount(
          supabase
            .from("expedientes" as never)
            .select("id", { count: "exact", head: true })
            .eq("asesor_id", user.id) as unknown as PromiseLike<{ count: number | null }>,
          "expedientes.activos.miAsesor",
        ),
      ]);
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  const config = activeRole ? HOME_CONFIG[activeRole] : null;

  const saludo = useMemo(() => {
    const hora = new Date().getHours();
    const greet = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
    const base = nombre || user?.email?.split("@")[0] || "Bienvenido";
    // Solo el primer nombre
    const primer = base.split(/\s+/)[0];
    return `${greet}, ${primer}`;
  }, [nombre, user]);

  const resolveValue = (k: RoleHomeKpi) => {
    if (k.staticValue) return k.staticValue;
    if (!k.source || k.source === "static") return "—";
    const v = counts[k.source];
    return typeof v === "number" ? String(v) : "—";
  };

  const metricaEstrella = useMemo(() => {
    if (!config?.metricaEstrella) return undefined;
    const m = config.metricaEstrella;
    const raw =
      m.staticValue ??
      (m.source && m.source !== "static" ? counts[m.source] : undefined);
    return {
      label: m.label,
      value: typeof raw === "number" ? String(raw) : raw ?? "—",
      tone: m.tone,
    };
  }, [config, counts]);

  // Si el usuario no tiene rol mapeado o sigue cargando, mostramos el Home
  // genérico previo para no romper la experiencia. Esto preserva el flujo
  // del simulador en `/_authenticated/index.tsx`.
  if (loading) {
    return (
      <div
        className="min-h-[60vh] flex items-center justify-center text-sm"
        style={{ color: "var(--nuvia-text-muted)" }}
      >
        Cargando tu espacio NUVIA…
      </div>
    );
  }

  if (!config) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center text-sm"
        style={{ color: "var(--nuvia-text-secondary)" }}
      >
        Tu rol aún no tiene un Home configurado. Contacta a un administrador.
      </div>
    );
  }

  const handleAsk = (prompt: string) => {
    try {
      navigator.clipboard?.writeText(prompt);
      toast.success("Prompt copiado. Abre NUVIA IA y pégalo.");
    } catch {
      toast.message("Abre NUVIA IA para preguntar.");
    }
  };

  // Alertas / actividad / recomendaciones: en Fase 6 quedan vacías o desde config.
  // La cola se llenará en fases posteriores leyendo notificaciones reales.
  const alerts: CriticalAlert[] = [];
  const activity: ActivityItem[] = [];

  return (
    <div
      className="relative min-h-screen"
      style={{ background: "var(--nuvia-bg-primary)", color: "var(--nuvia-text-primary)" }}
    >
      {/* Fondo animado NUVIA */}
      <AnimatedBackground />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 space-y-8 animate-fade-in">
        {/* ZONA 1 — HERO */}
        <HeroRolCard
          saludo={saludo}
          rolLabel={config.rolLabel}
          subtitle={config.subtitle}
          metricaEstrella={metricaEstrella}
          roles={roles}
          activeRole={activeRole ?? undefined}
          onChangeRole={multiRol ? setActiveRole : undefined}
          roleLabelFor={(r) => roleLabel(r)}
        />

        {/* Frase motivacional dinámica */}
        <MotivationalQuote />

        {/* ZONA 2 — NUVIA IA PROMPT */}
        <NuviaIAPromptCard
          prompt={config.iaPrompt.prompt}
          hint={config.iaPrompt.hint}
          onAsk={handleAsk}
        />

        {/* ZONA 3 — KPIs */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

          {config.kpis.map((k) => (
            <KpiCard
              key={k.id}
              icon={k.icon}
              label={k.label}
              value={resolveValue(k)}
              hint={k.hint}
              tone={k.tone}
            />
          ))}
        </section>

        {/* ZONA 4 — ACCESOS RÁPIDOS */}
        <QuickActionGrid actions={config.quickActions} />

        {/* ZONA 5 — PENDIENTES CRÍTICOS */}
        <CriticalAlertList alerts={alerts} emptyLabel="Sin pendientes críticos por ahora." />

        {/* ZONAS 6 + 7 — ACTIVIDAD + RECOMENDACIONES */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ActivityFeed items={activity} />
          </div>
          <div className="lg:col-span-2">
            <IARecomendacionesCard items={config.recomendaciones} onOpenIA={() => handleAsk(config.iaPrompt.prompt)} />
          </div>
        </div>

        {/* Acceso al simulador clásico (preserva flujo previo) */}
        <div className="pt-4 text-center">
          <button
            onClick={onLanzarSimulador}
            className="text-[11.5px] uppercase tracking-[0.18em] hover:underline"
            style={{ color: "var(--nuvia-text-muted)" }}
          >
            Abrir simulador clásico →
          </button>
        </div>

        {config.excluye.length > 0 && (
          <div
            className="rounded-xl px-4 py-3 text-[11px]"
            style={{
              background: "rgba(5,8,22,0.4)",
              border: "1px solid var(--nuvia-border)",
              color: "var(--nuvia-text-muted)",
            }}
          >
            <span className="font-semibold uppercase tracking-wider">No incluido en esta vista:</span>{" "}
            {config.excluye.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
