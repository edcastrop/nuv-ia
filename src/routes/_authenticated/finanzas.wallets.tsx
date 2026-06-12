import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageLayout, ExecutiveHero, KpiGrid, KpiCard, NCard } from "@/components/nuvia";
import { NSelect } from "@/components/nuvia/NSelect";
import { formatCOP } from "@/lib/format";
import { WalletView } from "@/components/wallet/WalletView";
import {
  listWalletUsuarios,
  getWalletSaldos,
  crearAjusteWallet,
  anularAjusteWallet,
  listWalletAjustes,
  type WalletSaldos,
  type WalletAjuste,
} from "@/lib/wallet";
import { toast } from "sonner";
import { Search, Plus, Ban, Wallet, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/wallets")({
  component: WalletsContabilidadPage,
  head: () => ({ meta: [{ title: "Wallets — Contabilidad · NUVIA" }] }),
});

interface RowUser {
  user_id: string;
  nombre: string;
  email: string;
  saldos: WalletSaldos | null;
}

function WalletsContabilidadPage() {
  const [rows, setRows] = useState<RowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<RowUser | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const usuarios = await listWalletUsuarios();
      const enriched = await Promise.all(
        usuarios.map(async (u) => {
          try {
            const s = await getWalletSaldos(u.user_id);
            return { ...u, saldos: s };
          } catch {
            return { ...u, saldos: null };
          }
        }),
      );
      setRows(enriched);
      setLoading(false);
    })();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.nombre.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, filter]);

  const totales = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        if (!r.saldos) return acc;
        acc.disponible += r.saldos.disponible;
        acc.en_tramite += r.saldos.en_tramite;
        acc.pendiente_recaudo += r.saldos.pendiente_recaudo;
        acc.pagado_historico += r.saldos.pagado_historico;
        return acc;
      },
      { disponible: 0, en_tramite: 0, pendiente_recaudo: 0, pagado_historico: 0 },
    );
  }, [rows]);

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Wallet size={12} />, label: "Finanzas", tone: "blue" }}
        title="Wallets de colaboradores"
        description="Saldo de comisiones por colaborador. Los ajustes manuales (bonos, retenciones, descuentos) quedan auditados."
      />

      <KpiGrid cols={4}>
        <KpiCard label="Disponible total"   value={formatCOP(totales.disponible)}        tone="green"   icon={<CheckCircle2 size={14} />} />
        <KpiCard label="En trámite total"   value={formatCOP(totales.en_tramite)}        tone="blue"    icon={<Clock size={14} />} />
        <KpiCard label="Pendiente recaudo"  value={formatCOP(totales.pendiente_recaudo)} tone="warning" icon={<AlertCircle size={14} />} />
        <KpiCard label="Pagado histórico"   value={formatCOP(totales.pagado_historico)}  tone="neutral" icon={<Wallet size={14} />} />
      </KpiGrid>

      <NCard padding="none">
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
          <Search size={14} style={{ color: "var(--nuvia-text-muted)" }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="nuvia-input nuvia-input-sm flex-1"
          />
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm" style={{ color: "var(--nuvia-text-muted)" }}>Cargando wallets…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: "var(--nuvia-text-muted)" }}>Sin colaboradores con actividad.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide"  style={{ color: "var(--nuvia-text-muted)" }}>Colaborador</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Disponible</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>En trámite</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Pend. recaudo</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Retenido</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user_id} className="hover:bg-white/[0.03]" style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium" style={{ color: "var(--nuvia-text-primary)" }}>{r.nombre}</div>
                      <div className="text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>{r.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-accent-green)" }}>{formatCOP(r.saldos?.disponible ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>{formatCOP(r.saldos?.en_tramite ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-warning)" }}>{formatCOP(r.saldos?.pendiente_recaudo ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-danger)" }}>{formatCOP(r.saldos?.retenido ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setSelected(r)} className="text-[12px] font-medium hover:underline" style={{ color: "var(--nuvia-accent-blue)" }}>
                        Abrir →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NCard>

      {selected && (
        <DetalleWalletPanel
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </PageLayout>
  );
}

function DetalleWalletPanel({
  user, onClose, onChanged,
}: { user: RowUser; onClose: () => void; onChanged: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-[900px] overflow-y-auto p-6"
        style={{ background: "var(--nuvia-bg-primary)", borderLeft: "1px solid var(--nuvia-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{user.nombre}</h2>
            <p className="text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[12px] transition"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--nuvia-border)",
              color: "var(--nuvia-text-secondary)",
            }}
          >
            Cerrar
          </button>
        </div>

        <AjustesAcciones userId={user.user_id} onChanged={onChanged} />

        <div className="mt-4">
          <WalletView userId={user.user_id} />
        </div>
      </div>
    </div>
  );
}

const TIPO_OPTS = [
  { value: "ajuste_credito",      label: "Crédito (bono / a favor)" },
  { value: "ajuste_debito",       label: "Débito (descuento)" },
  { value: "retencion",           label: "Retención" },
  { value: "liberacion_retencion",label: "Liberar retención" },
];

function AjustesAcciones({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const [tipo, setTipo] = useState<WalletAjuste["tipo"]>("ajuste_credito");
  const [monto, setMonto] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [vigentes, setVigentes] = useState<WalletAjuste[]>([]);
  useEffect(() => {
    listWalletAjustes(userId).then((all) => setVigentes(all.filter((a) => !a.anulado)));
  }, [userId]);

  async function submit() {
    const m = Number(monto.replace(/[^\d.-]/g, ""));
    if (!(m > 0)) return toast.error("Monto inválido");
    if (motivo.trim().length < 5) return toast.error("Motivo mínimo 5 caracteres");
    setBusy(true);
    try {
      await crearAjusteWallet({ user_id: userId, tipo, monto: m, motivo });
      toast.success("Ajuste registrado");
      setMonto("");
      setMotivo("");
      const all = await listWalletAjustes(userId);
      setVigentes(all.filter((a) => !a.anulado));
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function anular(id: string) {
    const motivoAnul = prompt("Motivo de anulación (mín. 5 caracteres):");
    if (!motivoAnul) return;
    try {
      await anularAjusteWallet(id, motivoAnul);
      toast.success("Ajuste anulado");
      const all = await listWalletAjustes(userId);
      setVigentes(all.filter((a) => !a.anulado));
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <NCard padding="none">
      <div className="px-4 py-3 text-sm font-semibold" style={{ borderBottom: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}>
        Ajuste manual
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4">
        <NSelect
          value={tipo}
          onValueChange={(v) => setTipo(v as WalletAjuste["tipo"])}
          options={TIPO_OPTS}
          compact
        />
        <input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto COP"
          inputMode="decimal"
          className="nuvia-input nuvia-input-sm"
        />
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (obligatorio)"
          className="nuvia-input nuvia-input-sm md:col-span-2"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="md:col-span-4 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
        >
          <Plus size={14} /> Registrar ajuste
        </button>
      </div>

      {vigentes.length > 0 && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid var(--nuvia-border)" }}>
          <div className="mb-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Ajustes vigentes</div>
          <ul className="space-y-2 text-[12.5px]">
            {vigentes.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--nuvia-text-secondary)" }}>
                  <b style={{ color: "var(--nuvia-text-primary)" }}>{formatCOP(Number(a.monto))}</b> · {a.motivo}
                </span>
                <button
                  onClick={() => anular(a.id)}
                  className="inline-flex items-center gap-1 text-[11.5px] hover:underline"
                  style={{ color: "var(--nuvia-danger)" }}
                >
                  <Ban size={12} /> Anular
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </NCard>
  );
}
