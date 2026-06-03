import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
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
import { Search, Plus, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/wallets")({
  component: WalletsContabilidadPage,
  head: () => ({ meta: [{ title: "Wallets — Contabilidad · NUVEX" }] }),
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

  if (loading) return <Card><p className="text-sm text-[#242424]/60">Cargando wallets…</p></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-semibold text-[#0A1226]">Wallets de colaboradores</h1>
        <p className="text-[12px] text-[#242424]/60">
          Saldo de comisiones por colaborador. Puedes hacer ajustes manuales (bonos, retenciones, descuentos) que quedan auditados.
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Disponible total" value={formatCOP(totales.disponible)} color="#1F7A45" />
        <Stat label="En trámite total" value={formatCOP(totales.en_tramite)} color="#445DA3" />
        <Stat label="Pendiente recaudo" value={formatCOP(totales.pendiente_recaudo)} color="#8A5A00" />
        <Stat label="Pagado histórico" value={formatCOP(totales.pagado_historico)} color="#0A1226" />
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-[#E3E7EE] px-4 py-3">
          <Search size={14} className="text-[#242424]/50" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#242424]/40"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#242424]/60">Sin colaboradores con actividad.</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
              <tr>
                <th className="px-4 py-2 text-left">Colaborador</th>
                <th className="px-4 py-2 text-right">Disponible</th>
                <th className="px-4 py-2 text-right">En trámite</th>
                <th className="px-4 py-2 text-right">Pend. recaudo</th>
                <th className="px-4 py-2 text-right">Retenido</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EE]">
              {filtered.map((r) => (
                <tr key={r.user_id} className="hover:bg-[#F7F9FB]">
                  <td className="px-4 py-2">
                    <div className="font-medium text-[#0A1226]">{r.nombre}</div>
                    <div className="text-[11px] text-[#242424]/60">{r.email}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-[#1F7A45]">{formatCOP(r.saldos?.disponible ?? 0)}</td>
                  <td className="px-4 py-2 text-right">{formatCOP(r.saldos?.en_tramite ?? 0)}</td>
                  <td className="px-4 py-2 text-right text-[#8A5A00]">{formatCOP(r.saldos?.pendiente_recaudo ?? 0)}</td>
                  <td className="px-4 py-2 text-right text-[#991B1B]">{formatCOP(r.saldos?.retenido ?? 0)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setSelected(r)}
                      className="text-[12px] text-[#445DA3] hover:underline"
                    >
                      Abrir →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selected && (
        <DetalleWalletPanel
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">{label}</div>
      <div className="mt-1 text-lg font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

function DetalleWalletPanel({
  user, onClose, onChanged,
}: { user: RowUser; onClose: () => void; onChanged: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-[900px] overflow-y-auto bg-[#F7F9FB] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0A1226]">{user.nombre}</h2>
            <p className="text-[12px] text-[#242424]/60">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-[12px] hover:bg-[#F7F9FB]"
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
    <Card>
      <div className="border-b border-[#E3E7EE] px-4 py-3 text-sm font-semibold text-[#0A1226]">
        Ajuste manual
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as WalletAjuste["tipo"])}
          className="rounded-lg border border-[#E3E7EE] px-3 py-2 text-[13px]"
        >
          <option value="ajuste_credito">Crédito (bono / a favor)</option>
          <option value="ajuste_debito">Débito (descuento)</option>
          <option value="retencion">Retención</option>
          <option value="liberacion_retencion">Liberar retención</option>
        </select>
        <input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto COP"
          inputMode="decimal"
          className="rounded-lg border border-[#E3E7EE] px-3 py-2 text-[13px]"
        />
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (obligatorio)"
          className="rounded-lg border border-[#E3E7EE] px-3 py-2 text-[13px] md:col-span-2"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="md:col-span-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A1226] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={14} /> Registrar ajuste
        </button>
      </div>

      {vigentes.length > 0 && (
        <div className="border-t border-[#E3E7EE] px-4 py-3">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-[#242424]/60">Ajustes vigentes</div>
          <ul className="space-y-2 text-[12.5px]">
            {vigentes.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <span className="text-[#242424]/80">
                  <b>{formatCOP(Number(a.monto))}</b> · {a.motivo}
                </span>
                <button
                  onClick={() => anular(a.id)}
                  className="inline-flex items-center gap-1 text-[11.5px] text-[#991B1B] hover:underline"
                >
                  <Ban size={12} /> Anular
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
