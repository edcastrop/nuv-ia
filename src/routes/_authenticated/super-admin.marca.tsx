import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useUserRole } from "@/hooks/useUserRole";
import { NUVEX_BRAND } from "@/lib/brandConfig";
import { Logo } from "@/components/nuvex/Logo";

export const Route = createFileRoute("/_authenticated/super-admin/marca")({
  component: MarcaPage,
});

function MarcaPage() {
  const { role, loading } = useUserRole();
  if (loading) return null;
  if (role !== "super_admin") return <Navigate to="/" />;

  const B = NUVEX_BRAND;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: B.colores.negro }}>
          Configuración de Marca NUVEX
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Identidad institucional única para toda la plataforma. Visible solo para Super Admin.
        </p>
      </header>

      {/* Logos */}
      <Section title="Logos institucionales">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LogoCard label="Principal (fondos claros)" bg="#ffffff">
            <Logo variant="color" height={60} />
          </LogoCard>
          <LogoCard label="Blanco (fondos oscuros)" bg={B.colores.negro}>
            <Logo variant="white" height={60} />
          </LogoCard>
          <LogoCard label="Corporativo (azul)" bg="#F4F6FB">
            <Logo variant="color" height={60} />
          </LogoCard>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Archivo fuente: <code>src/assets/logo-nuvex.png</code> · favicon: <code>/favicon.png</code>
        </p>
      </Section>

      {/* Paleta */}
      <Section title="Paleta corporativa">
        <div className="grid grid-cols-3 gap-4">
          <ColorSwatch name="Azul" value={B.colores.azul} />
          <ColorSwatch name="Verde" value={B.colores.verde} />
          <ColorSwatch name="Negro" value={B.colores.negro} />
        </div>
      </Section>

      {/* Datos institucionales */}
      <Section title="Datos institucionales">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Field label="Nombre comercial" value={B.nombreComercial} />
          <Field label="Sitio web" value={B.sitioWeb} />
          <Field label="Correo jurídico" value={B.correos.juridica} />
          <Field label="Correo contratación" value={B.correos.contratacion} />
          <Field label="Sede Bucaramanga" value={B.direcciones.bucaramanga} />
          <Field label="Sede Bogotá" value={B.direcciones.bogota} />
        </div>
      </Section>

      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        Los valores aquí mostrados están definidos en <code>src/lib/brandConfig.ts</code> y son la
        fuente única de verdad. Para editarlos, modifica ese archivo o solicita una versión
        persistida en base de datos.
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: NUVEX_BRAND.colores.azul }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function LogoCard({ label, bg, children }: { label: string; bg: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex h-32 items-center justify-center" style={{ background: bg }}>
        {children}
      </div>
      <div className="px-3 py-2 text-xs text-center text-muted-foreground">{label}</div>
    </div>
  );
}

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="h-24" style={{ background: value }} />
      <div className="px-3 py-2 flex items-center justify-between text-xs">
        <span className="font-semibold">{name}</span>
        <code className="text-muted-foreground">{value}</code>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-sm" style={{ color: NUVEX_BRAND.colores.negro }}>{value}</div>
    </div>
  );
}
