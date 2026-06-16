import type { ReactNode } from "react";

/**
 * NUVIA · PageLayout (Fase 7.6.1B)
 * Wrapper canónico de toda pantalla del ERP.
 *
 *   <PageLayout>
 *     <ExecutiveHero ... />
 *     <KpiGrid>...</KpiGrid>
 *     <InsightCard scope="dashboard" />
 *     <PageLayout.Body>
 *       <PageLayout.Main>{...tabla / pipeline / kanban}</PageLayout.Main>
 *       <PageLayout.Aside>{...actividad}</PageLayout.Aside>
 *     </PageLayout.Body>
 *   </PageLayout>
 */
interface PageLayoutProps {
  children: ReactNode;
  /** max-w del contenedor central. Default 7xl. */
  maxWidth?: "5xl" | "6xl" | "7xl" | "full";
}

export function PageLayout({ children, maxWidth = "7xl" }: PageLayoutProps) {
  const cls =
    maxWidth === "full"
      ? "w-full"
      : maxWidth === "5xl"
        ? "max-w-5xl"
        : maxWidth === "6xl"
          ? "max-w-6xl"
          : "max-w-7xl";

  return (
    <div className="min-h-screen relative" style={{ background: "var(--nuvia-bg-primary)", color: "var(--nuvia-text-primary)" }}>
      {/* Halo decorativo único compartido por todas las pantallas */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full opacity-[0.14] blur-[140px]"
          style={{ background: "var(--nuvia-accent-blue)" }}
        />
        <div
          className="absolute top-40 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.10] blur-[140px]"
          style={{ background: "var(--nuvia-accent-green)" }}
        />
      </div>

      <div
        className={`relative mx-auto ${cls} px-6 py-8 animate-fade-in`}
        style={{ display: "flex", flexDirection: "column", gap: "var(--nuvia-space-6)" }}
      >
        {children}
      </div>
    </div>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid gap-6"
      style={{ gridTemplateColumns: "minmax(0,1fr)" }}
    >
      {children}
    </div>
  );
}

function BodyWithAside({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">{children}</div>
  );
}

function Main({ children }: { children: ReactNode }) {
  return <div className="min-w-0 space-y-6">{children}</div>;
}

function Aside({ children }: { children: ReactNode }) {
  return <aside className="space-y-6 min-w-0">{children}</aside>;
}

PageLayout.Body = Body;
PageLayout.BodyWithAside = BodyWithAside;
PageLayout.Main = Main;
PageLayout.Aside = Aside;
