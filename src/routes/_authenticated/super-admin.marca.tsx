import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Palette } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Logo } from "@/components/nuvex/Logo";
import { getBrandConfig, updateBrandConfig } from "@/lib/brand.functions";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/super-admin/marca")({
  component: MarcaPage,
});

type Form = {
  nombre_comercial: string;
  tagline: string;
  sitio_web: string;
  correo_juridica: string;
  correo_contratacion: string;
  direccion_bucaramanga: string;
  direccion_bogota: string;
  color_azul: string;
  color_verde: string;
  color_negro: string;
  logo_url: string;
};

const EMPTY: Form = {
  nombre_comercial: "",
  tagline: "",
  sitio_web: "",
  correo_juridica: "",
  correo_contratacion: "",
  direccion_bucaramanga: "",
  direccion_bogota: "",
  color_azul: "#445DA3",
  color_verde: "#84B98F",
  color_negro: "#242424",
  logo_url: "",
};

function MarcaPage() {
  const { isSuperAdmin, loading } = useUserRole();
  const fetchBrand = useServerFn(getBrandConfig);
  const saveBrand = useServerFn(updateBrandConfig);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["brand_config"],
    queryFn: () => fetchBrand(),
    enabled: !loading && isSuperAdmin,
  });

  const [form, setForm] = useState<Form>(EMPTY);
  useEffect(() => {
    if (data) setForm({ ...EMPTY, ...(data as Partial<Form>) });
  }, [data]);

  const mut = useMutation({
    mutationFn: (payload: Form) => saveBrand({ data: payload }),
    onSuccess: () => {
      toast.success("Configuración de marca actualizada");
      qc.invalidateQueries({ queryKey: ["brand_config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/inicio" />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <PageLayout maxWidth="6xl">
      <ExecutiveHero
        badge={{ icon: <Palette size={12} />, label: "Identidad NUVIA", tone: "blue" }}
        title="Configuración de Marca NUVEX"
        description="Identidad institucional única. Visible solo para Super Admin. Los cambios afectan correos y plantillas globales."
        meta={
          <Link to="/super-admin" className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--nuvia-accent-blue)" }}>
            <ArrowLeft size={12} /> Super Admin
          </Link>
        }
      />

      <Section title="Logos institucionales">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LogoCard label="Principal (fondos claros)" bg="#ffffff"><Logo variant="color" height={60} /></LogoCard>
          <LogoCard label="Blanco (fondos oscuros)" bg={form.color_negro}><Logo variant="white" height={60} /></LogoCard>
          <LogoCard label="Corporativo" bg="#F4F6FB"><Logo variant="color" height={60} /></LogoCard>
        </div>
        <div className="mt-4">
          <LabelN>URL del logo (usado en correos)</LabelN>
          <input className="nuvia-input" value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://..." />
        </div>
      </Section>

      <Section title="Paleta corporativa">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ColorField label="Azul" value={form.color_azul} onChange={(v) => set("color_azul", v)} />
          <ColorField label="Verde" value={form.color_verde} onChange={(v) => set("color_verde", v)} />
          <ColorField label="Negro" value={form.color_negro} onChange={(v) => set("color_negro", v)} />
        </div>
      </Section>

      <Section title="Datos institucionales">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Nombre comercial" value={form.nombre_comercial} onChange={(v) => set("nombre_comercial", v)} />
          <TextField label="Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} />
          <TextField label="Sitio web" value={form.sitio_web} onChange={(v) => set("sitio_web", v)} />
          <TextField label="Correo jurídico" value={form.correo_juridica} onChange={(v) => set("correo_juridica", v)} />
          <TextField label="Correo contratación" value={form.correo_contratacion} onChange={(v) => set("correo_contratacion", v)} />
          <div />
          <TextField label="Sede Bucaramanga" value={form.direccion_bucaramanga} onChange={(v) => set("direccion_bucaramanga", v)} />
          <TextField label="Sede Bogotá" value={form.direccion_bogota} onChange={(v) => set("direccion_bogota", v)} />
        </div>
      </Section>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => data && setForm({ ...EMPTY, ...(data as Partial<Form>) })}
          disabled={isLoading || mut.isPending}
          className="rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50"
          style={{
            border: "1px solid var(--nuvia-border)",
            background: "transparent",
            color: "var(--nuvia-text-secondary)",
          }}
        >
          Descartar cambios
        </button>
        <button
          type="button"
          onClick={() => mut.mutate(form)}
          disabled={isLoading || mut.isPending}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))",
            color: "#fff",
          }}
        >
          {mut.isPending ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </PageLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-6"
      style={{
        background: "var(--nuvia-bg-card)",
        border: "1px solid var(--nuvia-border)",
      }}
    >
      <h2
        className="text-[11px] font-bold uppercase tracking-[0.18em] mb-4"
        style={{ color: "var(--nuvia-accent-blue)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function LabelN({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[10px] uppercase tracking-[0.14em] mb-1.5 font-semibold"
      style={{ color: "var(--nuvia-text-secondary)" }}
    >
      {children}
    </label>
  );
}

function LogoCard({ label, bg, children }: { label: string; bg: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--nuvia-border)" }}
    >
      <div className="flex h-32 items-center justify-center" style={{ background: bg }}>{children}</div>
      <div
        className="px-3 py-2 text-xs text-center"
        style={{
          color: "var(--nuvia-text-secondary)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--nuvia-border)" }}
    >
      <div className="h-20" style={{ background: value }} />
      <div className="p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
        <LabelN>{label}</LabelN>
        <input
          className="nuvia-input nuvia-input-sm font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <LabelN>{label}</LabelN>
      <input className="nuvia-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
