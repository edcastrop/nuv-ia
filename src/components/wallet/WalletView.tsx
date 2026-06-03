import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
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
import { Wallet, TrendingUp, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  userId: string;
  /** Acciones extra (p.ej. botón Solicitar pago, ajuste manual). */
  actions?: React.ReactNode;
  /** Compacto: oculta historial y ajustes. */
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

  if (loading) return <Card><p className="text-sm text-[#242424]/60">Cargando wallet…</p></Card>;
  if (error) return <Card><p className="text-sm text-red-600">{error}</p></Card>;
  if (!saldos) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Saldo label="Disponible" value={saldos.disponible} color="#1F7A45" Icon={Wallet} hint="Liberado · listo para CC" />
        <Saldo label="En trámite" value={saldos.en_tramite} color="#445DA3" Icon={Clock} hint="Cuentas de cobro activas" />
        <Saldo label="Pendiente recaudo" value={saldos.pendiente_recaudo} color="#8A5A00" Icon={TrendingUp} hint="Por recaudar al cliente" />
        <Saldo label="Pagado histórico" value={saldos.pagado_historico} color="#0A1226" Icon={CheckCircle2} hint="Acumulado pagado" />
      </div>

      {(saldos.retenido > 0 || saldos.ajustes_credito > 0 || saldos.ajustes_debito > 0) && (
        <Card>
          <div className="flex flex-wrap gap-6 px-1 py-1 text-[12.5px]">
            {saldos.retenido > 0 && (
              <div className="flex items-center gap-2 text-[#991B1B]">
                <AlertTriangle size={14} />
                <span>Retenido: <b>{formatCOP(saldos.retenido)}</b></span>
              </div>
            )}
            {saldos.ajustes_credito > 0 && (
              <div className="text-[#1F7A45]">Ajustes a favor: <b>{formatCOP(saldos.ajustes_credito)}</b></div>
            )}
            {saldos.ajustes_debito > 0 && (
              <div className="text-[#991B1B]">Ajustes en contra: <b>{formatCOP(saldos.ajustes_debito)}</b></div>
            )}
          </div>
        </Card>
      )}

      {actions && <Card>{actions}</Card>}

      {!compact && (
        <>
          <Card>
            <div className="border-b border-[#E3E7EE] px-4 py-3 text-sm font-semibold text-[#0A1226]">
              Movimientos recientes
            </div>
            {movs.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#242424]/60">Sin movimientos.</div>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7EE]">
                  {movs.map((m) => {
                    const s = signoMov(m.tipo);
                    const color = s === "+" ? "#1F7A45" : s === "-" ? "#991B1B" : "#242424";
                    return (
                      <tr key={m.id} className="hover:bg-[#F7F9FB]">
                        <td className="px-4 py-2 text-[#242424]/70 whitespace-nowrap">
                          {new Date(m.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "2-digit" })}
                        </td>
                        <td className="px-4 py-2">{WALLET_MOV_LABEL[m.tipo]}</td>
                        <td className="px-4 py-2 text-[#242424]/70">{m.descripcion || "—"}</td>
                        <td className="px-4 py-2 text-right font-semibold" style={{ color }}>
                          {s !== "·" ? s : ""} {formatCOP(Number(m.monto))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          {ajustes.length > 0 && (
            <Card>
              <div className="border-b border-[#E3E7EE] px-4 py-3 text-sm font-semibold text-[#0A1226]">
                Ajustes manuales
              </div>
              <table className="w-full text-[12.5px]">
                <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-left">Motivo</th>
                    <th className="px-4 py-2 text-right">Monto</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E7EE]">
                  {ajustes.map((a) => (
                    <tr key={a.id} className={a.anulado ? "opacity-50" : "hover:bg-[#F7F9FB]"}>
                      <td className="px-4 py-2 text-[#242424]/70 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-2">{WALLET_MOV_LABEL[a.tipo]}</td>
                      <td className="px-4 py-2 text-[#242424]/70">{a.motivo}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCOP(Number(a.monto))}</td>
                      <td className="px-4 py-2">
                        {a.anulado ? (
                          <span className="text-[#991B1B]">Anulado</span>
                        ) : (
                          <span className="text-[#1F7A45]">Vigente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Saldo({
  label, value, color, Icon, hint,
}: { label: string; value: number; color: string; Icon: typeof Wallet; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#242424]/60">
        <Icon size={14} style={{ color }} />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold" style={{ color }}>{formatCOP(value)}</div>
      {hint && <div className="mt-0.5 text-[10.5px] text-[#242424]/50">{hint}</div>}
    </div>
  );
}
