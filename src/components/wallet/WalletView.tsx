import { useEffect, useState } from "react";
import { NCard, KpiGrid, KpiCard, EmptyState } from "@/components/nuvia";
import { formatCOP } from "@/lib/format";
import {
  getWalletSaldos,
  listWalletMovimientos,
  listWalletAjustes,
  type WalletSaldos,
  type WalletMovimiento,
  type WalletAjuste,
  WALLET_MOV_LABEL,
  signoMov,
} from "@/lib/wallet";
import { Wallet, TrendingUp, Clock, CheckCircle2, AlertTriangle, Inbox } from "lucide-react";

interface Props {
  userId: string;
  actions?: React.ReactNode;
  compact?: boolean;
}

export function WalletView({ userId, actions, compact = false }: Props) {
  const [saldos, setSaldos] = useState<WalletSaldos | null>(null);
  const [movs, setMovs] = useState<WalletMovimiento[]>([]);
  const [ajustes, setAjustes] = useState<WalletAjuste[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [s, m, a] = await Promise.all([
          getWalletSaldos(userId),
          listWalletMovimientos(userId, 100),
          listWalletAjustes(userId),
        ]);
        if (cancel) return;
        setSaldos(s);
        setMovs(m);
        setAjustes(a);
      } catch (e) {
        if (cancel) return;
        setError(e instanceof Error ? e.message : "Error cargando wallet");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [userId]);

  if (loading) {
    return (
      <NCard>
        <p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando wallet…</p>
      </NCard>
    );
  }
  if (error) {
    return (
      <NCard>
        <p className="text-sm" style={{ color: "var(--nuvia-danger)" }}>{error}</p>
      </NCard>
    );
  }
  if (!saldos) return null;

  return (
    <div className="space-y-5">
      <KpiGrid cols={4}>
        <KpiCard
          label="Disponible"
          value={formatCOP(saldos.disponible)}
          icon={<Wallet size={14} />}
          tone="green"
          hint="Liberado · listo para CC"
        />
        <KpiCard
          label="En trámite"
          value={formatCOP(saldos.en_tramite)}
          icon={<Clock size={14} />}
          tone="blue"
          hint="Cuentas de cobro activas"
        />
        <KpiCard
          label="Pendiente recaudo"
          value={formatCOP(saldos.pendiente_recaudo)}
          icon={<TrendingUp size={14} />}
          tone="warning"
          hint="Por recaudar al cliente"
        />
        <KpiCard
          label="Pagado histórico"
          value={formatCOP(saldos.pagado_historico)}
          icon={<CheckCircle2 size={14} />}
          tone="neutral"
          hint="Acumulado pagado"
        />
      </KpiGrid>

      {(saldos.retenido > 0 || saldos.ajustes_credito > 0 || saldos.ajustes_debito > 0) && (
        <NCard padding="sm">
          <div className="flex flex-wrap gap-6 text-[12.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
            {saldos.retenido > 0 && (
              <div className="flex items-center gap-2" style={{ color: "var(--nuvia-danger)" }}>
                <AlertTriangle size={14} />
                <span>Retenido: <b>{formatCOP(saldos.retenido)}</b></span>
              </div>
            )}
            {saldos.ajustes_credito > 0 && (
              <div style={{ color: "var(--nuvia-success)" }}>
                Ajustes a favor: <b>{formatCOP(saldos.ajustes_credito)}</b>
              </div>
            )}
            {saldos.ajustes_debito > 0 && (
              <div style={{ color: "var(--nuvia-danger)" }}>
                Ajustes en contra: <b>{formatCOP(saldos.ajustes_debito)}</b>
              </div>
            )}
          </div>
        </NCard>
      )}

      {actions && <NCard padding="sm">{actions}</NCard>}

      {!compact && (
        <>
          <NCard padding="none">
            <div
              className="px-5 py-3 text-sm font-semibold"
              style={{
                borderBottom: "1px solid var(--nuvia-border)",
                color: "var(--nuvia-text-primary)",
              }}
            >
              Movimientos recientes
            </div>
            {movs.length === 0 ? (
              <EmptyState
                icon={<Inbox size={28} />}
                title="Sin movimientos"
                description="Aún no se han registrado movimientos en tu wallet."
                hint="NUVIA IA: cuando se libere tu primera comisión, aparecerá aquí automáticamente."
              />
            ) : (
              <DataTable
                head={["Fecha", "Tipo", "Descripción", "Monto"]}
                aligns={["left", "left", "left", "right"]}
              >
                {movs.map((m) => {
                  const s = signoMov(m.tipo);
                  const color =
                    s === "+"
                      ? "var(--nuvia-success)"
                      : s === "-"
                        ? "var(--nuvia-danger)"
                        : "var(--nuvia-text-primary)";
                  return (
                    <tr
                      key={m.id}
                      className="transition-colors"
                      style={{ borderTop: "1px solid var(--nuvia-border)" }}
                    >
                      <td className="px-5 py-2.5 whitespace-nowrap" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {new Date(m.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-5 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>{WALLET_MOV_LABEL[m.tipo]}</td>
                      <td className="px-5 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{m.descripcion || "—"}</td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums" style={{ color }}>
                        {s !== "·" ? s : ""} {formatCOP(Number(m.monto))}
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </NCard>

          {ajustes.length > 0 && (
            <NCard padding="none">
              <div
                className="px-5 py-3 text-sm font-semibold"
                style={{
                  borderBottom: "1px solid var(--nuvia-border)",
                  color: "var(--nuvia-text-primary)",
                }}
              >
                Ajustes manuales
              </div>
              <DataTable
                head={["Fecha", "Tipo", "Motivo", "Monto", "Estado"]}
                aligns={["left", "left", "left", "right", "left"]}
              >
                {ajustes.map((a) => (
                  <tr
                    key={a.id}
                    className={a.anulado ? "opacity-50" : ""}
                    style={{ borderTop: "1px solid var(--nuvia-border)" }}
                  >
                    <td className="px-5 py-2.5 whitespace-nowrap" style={{ color: "var(--nuvia-text-secondary)" }}>
                      {new Date(a.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-5 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>{WALLET_MOV_LABEL[a.tipo]}</td>
                    <td className="px-5 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{a.motivo}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                      {formatCOP(Number(a.monto))}
                    </td>
                    <td className="px-5 py-2.5">
                      {a.anulado ? (
                        <span style={{ color: "var(--nuvia-danger)" }}>Anulado</span>
                      ) : (
                        <span style={{ color: "var(--nuvia-success)" }}>Vigente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </NCard>
          )}
        </>
      )}
    </div>
  );
}

function DataTable({
  head,
  aligns,
  children,
}: {
  head: string[];
  aligns: ("left" | "right")[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.02)" }}>
            {head.map((h, i) => (
              <th
                key={h}
                className="px-5 py-2.5 font-semibold uppercase"
                style={{
                  textAlign: aligns[i],
                  fontSize: "10.5px",
                  letterSpacing: "0.12em",
                  color: "var(--nuvia-text-secondary)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
