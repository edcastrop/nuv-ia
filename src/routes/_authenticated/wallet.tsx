import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/nuvex/ui";
import { WalletView } from "@/components/wallet/WalletView";
import { Wallet as WalletIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: MiWalletPage,
  head: () => ({ meta: [{ title: "Mi Wallet · NUVEX" }] }),
});

function MiWalletPage() {
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  }
  if (!user) return <div className="p-12 text-center text-sm text-[#242424]/60">No autenticado.</div>;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6 space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white bg-gradient-to-br from-[#445DA3] to-[#84B98F]">
              <WalletIcon size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#0A1226]">Mi Wallet</h1>
              <p className="text-[12px] text-[#242424]/60">
                Saldo disponible, comisiones en trámite e historial de movimientos.
              </p>
            </div>
          </div>
          <Link
            to="/comisiones"
            className="rounded-lg bg-[#0A1226] px-4 py-2 text-[12.5px] font-medium text-white hover:opacity-90"
          >
            Solicitar pago (CC) →
          </Link>
        </div>
      </Card>

      <WalletView userId={user.id} />
    </div>
  );
}
