import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import {
  listCuentasReceptoras, upsertCuentaReceptora, deleteCuentaReceptora,
  getParametrosFinancieros, setParametroFinanciero,
  type CuentaReceptora,
} from "@/lib/cuentasReceptoras";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/_authenticated/finanzas/cuentas-receptoras")({
  component: Page,
  head: () => ({ meta: [{ title: "Cuentas receptoras · NUVEX" }] }),
});

function Page() {
  const { roles, loading } = useUserRole();
  const puede = roles.some((r) => ["super_admin", "admin", "gerencia", "contabilidad"].includes(r));

  const [cuentas, setCuentas] = useState<CuentaReceptora[]>([]);
  const [params, setParams] = useState<Record<string, number>>({});
  const [edit, setEdit] = useState<Partial<CuentaReceptora> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => {
    listCuentasReceptoras().then(setCuentas).catch((e) => setErr(e.message));
    getParametrosFinancieros().then(setParams).catch(() => {});
  };
  useEffect(() => { reload(); }, []);

  if (loading) return <div className="p-12 text-center text-sm">Cargando…</div>;
  if (!puede) return <div className="p-12 text-center text-sm text-[#B42318]">Sin permisos.</div>;

  async function save() {
    if (!edit?.banco) return;
    try { await upsertCuentaReceptora(edit as never); setEdit(null); reload(); }
    catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
      <Card>
        <h1 className="text-xl font-semibold text-[#242424]">Cuentas receptoras y parámetros</h1>
        <p className="text-[12px] text-[#242424]/60 mt-1">Catálogo de cuentas donde los clientes pagan los honorarios + parámetros del fee Wompi y comisiones.</p>
      </Card>

      {err && <Card><div className="text-[12px] text-[#B42318]">{err}</div></Card>}

      <Card>
        <div className="text-[11px] uppercase tracking-wider text-[#242424]/55 mb-2">Parámetros financieros</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            ["fee_wompi_porcentaje", "Fee Wompi (%)"],
            ["iva_fee_wompi_porcentaje", "IVA del fee (%)"],
            ["comision_predeterminada_licenciado", "Comisión Analista F. Comercial por defecto (%)"],
          ].map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">{label}</span>
              <input
                type="number"
                step="0.01"
                defaultValue={params[k] ?? ""}
                onBlur={async (e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) {
                    try { await setParametroFinanciero(k, v); reload(); }
                    catch (err) { setErr((err as Error).message); }
                  }
                }}
                className="text-[13px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white"
              />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-[#242424]/55">Cuentas receptoras</div>
          <button onClick={() => setEdit({ banco: "", tipo: "ahorros", activa: true })}
            className="rounded-md bg-[#445DA3] px-3 py-1.5 text-[11.5px] font-semibold text-white">+ Nueva cuenta</button>
        </div>
        <table className="w-full text-[12.5px]">
          <thead className="text-[11px] uppercase text-[#242424]/55"><tr className="border-b border-[#E5E7EB]">
            <th className="text-left py-1.5">Banco</th><th className="text-left pl-3">Tipo</th>
            <th className="text-left pl-3">Número</th><th className="text-left pl-3">Titular</th>
            <th className="text-left pl-3">NIT</th><th className="text-left pl-3">Estado</th><th></th>
          </tr></thead>
          <tbody>
            {cuentas.map((c) => (
              <tr key={c.id} className="border-b border-[#F3F4F6]">
                <td className="py-1.5">{c.banco}</td>
                <td className="pl-3">{c.tipo}</td>
                <td className="pl-3">{c.numero ?? "—"}</td>
                <td className="pl-3">{c.titular ?? "—"}</td>
                <td className="pl-3">{c.nit ?? "—"}</td>
                <td className="pl-3">{c.activa ? <span className="text-[#1F7A45] font-semibold">Activa</span> : <span className="text-[#242424]/55">Inactiva</span>}</td>
                <td className="pl-3 text-right">
                  <button onClick={() => setEdit(c)} className="text-[11px] text-[#445DA3] hover:underline mr-2">Editar</button>
                  <button onClick={async () => { if (confirm("¿Eliminar?")) { await deleteCuentaReceptora(c.id); reload(); } }}
                    className="text-[11px] text-[#B42318] hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {edit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-lg w-full space-y-3">
            <div className="text-[13px] font-semibold">{edit.id ? "Editar cuenta" : "Nueva cuenta receptora"}</div>
            <div className="grid grid-cols-2 gap-2">
              <Fld label="Banco *"><input value={edit.banco ?? ""} onChange={(e) => setEdit({ ...edit, banco: e.target.value })} className="inp" /></Fld>
              <Fld label="Tipo"><select value={edit.tipo ?? "ahorros"} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })} className="inp">
                <option value="ahorros">Ahorros</option><option value="corriente">Corriente</option><option value="billetera">Billetera</option>
              </select></Fld>
              <Fld label="Número"><input value={edit.numero ?? ""} onChange={(e) => setEdit({ ...edit, numero: e.target.value })} className="inp" /></Fld>
              <Fld label="Titular"><input value={edit.titular ?? ""} onChange={(e) => setEdit({ ...edit, titular: e.target.value })} className="inp" /></Fld>
              <Fld label="NIT"><input value={edit.nit ?? ""} onChange={(e) => setEdit({ ...edit, nit: e.target.value })} className="inp" /></Fld>
              <Fld label="Estado"><select value={edit.activa ? "1" : "0"} onChange={(e) => setEdit({ ...edit, activa: e.target.value === "1" })} className="inp">
                <option value="1">Activa</option><option value="0">Inactiva</option>
              </select></Fld>
            </div>
            <Fld label="Observaciones"><textarea value={edit.observaciones ?? ""} onChange={(e) => setEdit({ ...edit, observaciones: e.target.value })} className="inp" rows={2} /></Fld>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEdit(null)} className="text-[12px] px-3 py-1.5 rounded border border-[#E5E7EB]">Cancelar</button>
              <button onClick={save} className="text-[12px] px-3 py-1.5 rounded bg-[#1F7A45] text-white font-semibold">Guardar</button>
            </div>
          </div>
          <style>{`.inp{font-size:12px;border:1px solid #E5E7EB;border-radius:4px;padding:6px 8px;background:white;width:100%}`}</style>
        </div>
      )}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">{label}</span>
      {children}
    </label>
  );
}
