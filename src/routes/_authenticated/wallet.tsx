import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { WalletView } from "@/components/wallet/WalletView";
import { Wallet as WalletIcon, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: MiWalletPage,
  head: () => ({ meta: [{ title: "Mi Wallet · NUVIA" }] }),
});

function MiWalletPage() {
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <PageLayout>
        <div className="py-12 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
          Cargando…
        </div>
      </PageLayout>
    );
  }
  if (!user) {
    return (
      <PageLayout>
        <div className="py-12 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
          No autenticado.
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="6xl">
      <ExecutiveHero
        badge={{ icon: <WalletIcon size={12} />, label: "Mi Wallet", tone: "blue" }}
        title="Wallet personal"
        description="Saldo disponible, comisiones en trámite e historial de movimientos."
        actions={
          <Link
            to="/comisiones"
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))",
              color: "#fff",
              boxShadow: "0 8px 24px -10px rgba(68,93,163,0.6)",
            }}
          >
            Solicitar pago (CC)
            <ArrowRight size={14} />
          </Link>
        }
      />
      <WalletView userId={user.id} />
    </PageLayout>
  );
}
