import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { Logo } from "@/components/nuvex/Logo";
import { getBrandConfig, updateBrandConfig } from "@/lib/brand.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  if (!isSuperAdmin) return <Navigate to="/" />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: form.color_negro }}>
          Configuración de Marca NUVEX
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Identidad institucional única. Visible solo para Super Admin. Los cambios afectan correos y plantillas globales.
        </p>
      </header>

      {/* Logos */}
      <Section title="Logos institucionales" color={form.color_azul}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LogoCard label="Principal (fondos claros)" bg="#ffffff"><Logo variant="color" height={60} /></LogoCard>
          <LogoCard label="Blanco (fondos oscuros)" bg={form.color_negro}><Logo variant="white" height={60} /></LogoCard>
          <LogoCard label="Corporativo" bg="#F4F6FB"><Logo variant="color" height={60} /></LogoCard>
        </div>
        <div className="mt-4">
          <Label className="text-xs">URL del logo (usado en correos)</Label>
          <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://..." />
        </div>
      </Section>

      {/* Paleta */}
      <Section title="Paleta corporativa" color={form.color_azul}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ColorField label="Azul" value={form.color_azul} onChange={(v) => set("color_azul", v)} />
          <ColorField label="Verde" value={form.color_verde} onChange={(v) => set("color_verde", v)} />
          <ColorField label="Negro" value={form.color_negro} onChange={(v) => set("color_negro", v)} />
        </div>
      </Section>

      {/* Datos */}
      <Section title="Datos institucionales" color={form.color_azul}>
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
        <Button
          variant="outline"
          onClick={() => data && setForm({ ...EMPTY, ...(data as Partial<Form>) })}
          disabled={isLoading || mut.isPending}
        >
          Descartar cambios
        </Button>
        <Button
          onClick={() => mut.mutate(form)}
          disabled={isLoading || mut.isPending}
          style={{ background: form.color_azul, color: "#fff" }}
        >
          {mut.isPending ? "Guardando…" : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color }}>{title}</h2>
      {children}
    </section>
  );
}

function LogoCard({ label, bg, children }: { label: string; bg: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex h-32 items-center justify-center" style={{ background: bg }}>{children}</div>
      <div className="px-3 py-2 text-xs text-center text-muted-foreground">{label}</div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="h-20" style={{ background: value }} />
      <div className="p-3 space-y-1">
        <Label className="text-[10px] uppercase tracking-wider">{label}</Label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
