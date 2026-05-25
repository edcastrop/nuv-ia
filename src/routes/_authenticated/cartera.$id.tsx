import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/nuvex/ui";
import {
  getCartera, listPagos, listCuotas, listAcuerdos, listComunicaciones, listAuditoria,
  CARTERA_ESTADO_BY_KEY, diasMora, TIPO_COMUNICACION_LABEL,
  type CarteraConExpediente, type CarteraPago, type CarteraCuota, type CarteraAcuerdo,
  type CarteraComunicacion, type CarteraAuditoria,
} from "@/lib/cartera";
import {
  registrarPago, crearAcuerdo, enviarPrejuridico, enviarCorreoCartera, registrarComunicacion,
} from "@/lib/cartera.functions";
import {
  listCuentasReceptoras, getParametrosFinancieros, calcularDesgloseWompi,
  METODOS_PAGO, type CuentaReceptora, type MetodoPago,
} from "@/lib/cuentasReceptoras";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/_authenticated/cartera/$id")({
  component: CarteraDetail,
  head: () => ({ meta: [{ title: "Cartera · NUVEX" }] }),
});

function money(n: number) { return "$" + Math.round(n).toLocaleString("es-CO"); }

function CarteraDetail() {
  const { id } = Route.useParams();
  const { roles } = useUserRole();
  const puedeGestionar = roles.some((r) => ["super_admin", "admin", "gerencia", "cartera"].includes(r));

  const [c, setC] = useState<CarteraConExpediente | null>(null);
  const [pagos, setPagos] = useState<CarteraPago[]>([]);
  const [cuotas, setCuotas] = useState<CarteraCuota[]>([]);
  const [acuerdos, setAcuerdos] = useState<CarteraAcuerdo[]>([]);
  const [coms, setComs] = useState<CarteraComunicacion[]>([]);
  const [aud, setAud] = useState<CarteraAuditoria[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    Promise.all([
      getCartera(id), listPagos(id), listCuotas(id), listAcuerdos(id), listComunicaciones(id), listAuditoria(id),
    ]).then(([cc, pp, cu, ac, co, au]) => {
      setC(cc); setPagos(pp); setCuotas(cu); setAcuerdos(ac); setComs(co); setAud(au);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, [id]);

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando cartera…</div>;
  if (!c) return <div className="p-12 text-center text-sm text-[#B42318]">No encontrada.</div>;

  const saldo = Number(c.honorarios_totales) - Number(c.pagado);
  const dm = diasMora(c.fecha_vencimiento);
  const def = CARTERA_ESTADO_BY_KEY[c.estado_cartera];

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#242424]/55">Cartera</div>
            <h1 className="text-xl font-semibold text-[#242424]">{c.expediente?.cliente_nombre}</h1>
            <div className="text-[12px] text-[#242424]/60">
              CC {c.expediente?.cedula ?? "—"} · {c.expediente?.banco ?? "—"} · {c.expediente?.producto ?? "—"}
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/cartera" className="text-[11px] text-[#445DA3] hover:underline">← Cartera</Link>
            {c.expediente && (
              <Link to="/casos/$id" params={{ id: c.expediente.id }} className="text-[11px] text-[#445DA3] hover:underline">Expediente →</Link>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Honorarios" value={money(Number(c.honorarios_totales))} />
        <Metric label="Pagado" value={money(Number(c.pagado))} accent="#1F7A45" />
        <Metric label="Saldo" value={money(saldo)} accent="#445DA3" />
        <Metric label="Vencimiento" value={c.fecha_vencimiento} accent={dm > 0 ? "#B42318" : "#242424"} />
        <Metric label="Estado" value={def.label} accent={def.color} />
      </div>

      {dm > 0 && saldo > 0 && (
        <Card>
          <div className="text-[12.5px] text-[#B42318] font-semibold">⚠ Mora de {dm} día(s). Aplicación banco: {c.fecha_aplicacion_banco}.</div>
        </Card>
      )}

      <Card>
        <SectionTitle>Acciones</SectionTitle>
        {!puedeGestionar ? (
          <div className="text-[12px] text-[#242424]/60">Solo consulta (rol sin permisos de gestión).</div>
        ) : (
          <AccionesCartera carteraId={c.id} onChanged={reload} />
        )}
      </Card>

      {cuotas.length > 0 && (
        <Card>
          <SectionTitle>Cuotas (financiado)</SectionTitle>
          <table className="w-full text-[12.5px]">
            <thead className="text-[11px] uppercase text-[#242424]/55"><tr className="border-b border-[#E5E7EB]">
              <th className="text-left py-1.5"># </th><th className="text-right">Valor</th><th className="text-left pl-3">Vence</th><th className="text-right">Pagado</th><th className="text-left pl-3">Estado</th>
            </tr></thead>
            <tbody>
              {cuotas.map((q) => (
                <tr key={q.id} className="border-b border-[#F3F4F6]">
                  <td className="py-1.5">{q.numero}</td><td className="text-right">{money(Number(q.valor))}</td>
                  <td className="pl-3">{q.fecha_vencimiento}</td><td className="text-right">{money(Number(q.pagado))}</td>
                  <td className="pl-3">{q.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <SectionTitle>Pagos</SectionTitle>
        {pagos.length === 0 ? <div className="text-[12px] text-[#242424]/55">Sin pagos.</div> : (
          <table className="w-full text-[12.5px]">
            <thead className="text-[11px] uppercase text-[#242424]/55"><tr className="border-b border-[#E5E7EB]">
              <th className="text-left py-1.5">Fecha</th>
              <th className="text-right">Bruto</th>
              <th className="text-right pl-3">Fee</th>
              <th className="text-right pl-3">IVA</th>
              <th className="text-right pl-3">Neto</th>
              <th className="text-left pl-3">Método</th>
              <th className="text-left pl-3">Transacción</th>
              <th className="text-left pl-3">Soporte</th>
            </tr></thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className="border-b border-[#F3F4F6]">
                  <td className="py-1.5">{p.fecha}</td>
                  <td className="text-right">{money(Number(p.valor_bruto ?? p.valor))}</td>
                  <td className="text-right pl-3">{p.fee_wompi ? money(Number(p.fee_wompi)) : "—"}</td>
                  <td className="text-right pl-3">{p.iva_fee ? money(Number(p.iva_fee)) : "—"}</td>
                  <td className="text-right pl-3 font-semibold">{money(Number(p.valor_neto ?? p.valor))}</td>
                  <td className="pl-3">{p.metodo_pago ?? p.metodo ?? "—"}</td>
                  <td className="pl-3">{p.numero_transaccion ?? p.comprobante_num ?? "—"}</td>
                  <td className="pl-3">{p.comprobante_url ? <span className="text-[#1F7A45]">✓</span> : <span className="text-[#B42318]">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <SectionTitle>Acuerdos</SectionTitle>
        {acuerdos.length === 0 ? <div className="text-[12px] text-[#242424]/55">Sin acuerdos.</div> : (
          <ul className="text-[12.5px] space-y-1">
            {acuerdos.map((a) => (
              <li key={a.id} className="border-b border-[#F3F4F6] py-1.5">
                {money(Number(a.valor_total))} en {a.numero_cuotas} cuotas · {a.fecha_inicio} → {a.fecha_fin} · <b>{a.estado}</b>
                {a.observaciones && <div className="text-[11.5px] text-[#242424]/60">{a.observaciones}</div>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Comunicaciones</SectionTitle>
        {coms.length === 0 ? <div className="text-[12px] text-[#242424]/55">Sin comunicaciones.</div> : (
          <ul className="text-[12.5px] space-y-1">
            {coms.map((m) => (
              <li key={m.id} className="border-b border-[#F3F4F6] py-1.5">
                <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/55 mr-2">{new Date(m.created_at).toLocaleString("es-CO")}</span>
                <b>{TIPO_COMUNICACION_LABEL[m.tipo] ?? m.tipo}</b> · {m.canal} · {m.estado}
                {m.destinatario && <div className="text-[11.5px] text-[#242424]/60">→ {m.destinatario}</div>}
                {m.asunto && <div className="text-[11.5px] text-[#242424]/70">{m.asunto}</div>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Auditoría</SectionTitle>
        {aud.length === 0 ? <div className="text-[12px] text-[#242424]/55">Sin movimientos.</div> : (
          <ul className="text-[12px] space-y-1">
            {aud.map((a) => (
              <li key={a.id} className="border-b border-[#F3F4F6] py-1">
                <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/55 mr-2">{new Date(a.created_at).toLocaleString("es-CO")}</span>
                <b>{a.accion}</b>{a.canal && <> · {a.canal}</>}
                {a.observacion && <span className="text-[#242424]/70"> — {a.observacion}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <div className="text-[10.5px] uppercase tracking-wider text-[#242424]/55">{label}</div>
      <div className="text-[16px] font-semibold mt-1" style={{ color: accent ?? "#242424" }}>{value}</div>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wider text-[#242424]/55 mb-2">{children}</div>;
}

function AccionesCartera({ carteraId, onChanged }: { carteraId: string; onChanged: () => void }) {
  const pagar = useServerFn(registrarPago);
  const acordar = useServerFn(crearAcuerdo);
  const prejur = useServerFn(enviarPrejuridico);
  const correo = useServerFn(enviarCorreoCartera);
  const comManual = useServerFn(registrarComunicacion);

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // pago
  const [pFecha, setPFecha] = useState(new Date().toISOString().slice(0, 10));
  const [pValor, setPValor] = useState("");
  const [pMetodo, setPMetodo] = useState("");
  const [pBanco, setPBanco] = useState("");
  const [pComp, setPComp] = useState("");
  const [pObs, setPObs] = useState("");

  // acuerdo
  const [aValor, setAValor] = useState("");
  const [aCuotas, setACuotas] = useState("");
  const [aIni, setAIni] = useState(new Date().toISOString().slice(0, 10));
  const [aFin, setAFin] = useState("");
  const [aObs, setAObs] = useState("");

  // prejuridico
  const [pjObs, setPjObs] = useState("");

  // whatsapp manual
  const [waNum, setWaNum] = useState("");
  const [waTipo, setWaTipo] = useState("whatsapp_recordatorio");

  async function run<T>(key: string, fn: () => Promise<T>) {
    setBusy(key); setErr(null);
    try { await fn(); onChanged(); } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      {err && <div className="text-[11.5px] text-[#B42318]">{err}</div>}

      <div>
        <div className="text-[11.5px] font-semibold mb-1">Enviar correo</div>
        <div className="flex flex-wrap gap-2">
          {[
            ["email_cuenta_cobro", "Cuenta de cobro"],
            ["email_recordatorio", "Recordatorio"],
            ["email_vencimiento", "Vencimiento"],
            ["email_mora_7", "Mora 7"],
            ["email_mora_15", "Mora 15"],
            ["email_prejuridico", "Prejurídico"],
          ].map(([t, label]) => (
            <button key={t} disabled={busy !== null}
              onClick={() => run(`mail-${t}`, () => correo({ data: { carteraId, tipo: t as never } }))}
              className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-[11.5px] hover:bg-[#F9FAFB] disabled:opacity-50"
            >{busy === `mail-${t}` ? "Enviando…" : label}</button>
          ))}
        </div>
      </div>

      <Divider />

      <div>
        <div className="text-[11.5px] font-semibold mb-1">Registrar pago</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Input label="Fecha" type="date" value={pFecha} onChange={setPFecha} />
          <Input label="Valor" type="number" value={pValor} onChange={setPValor} />
          <Input label="Método" value={pMetodo} onChange={setPMetodo} placeholder="Transferencia/Efectivo" />
          <Input label="Banco" value={pBanco} onChange={setPBanco} />
          <Input label="Comprobante #" value={pComp} onChange={setPComp} />
          <Input label="Notas" value={pObs} onChange={setPObs} />
        </div>
        <button disabled={busy !== null || !pValor}
          onClick={() => run("pago", async () => {
            await pagar({ data: { carteraId, fecha: pFecha, valor: Number(pValor), metodo: pMetodo || undefined, bancoReceptor: pBanco || undefined, comprobanteNum: pComp || undefined, observaciones: pObs || undefined } });
            setPValor(""); setPMetodo(""); setPBanco(""); setPComp(""); setPObs("");
          })}
          className="mt-2 rounded-md bg-[#1F7A45] px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50"
        >{busy === "pago" ? "Registrando…" : "Registrar pago"}</button>
      </div>

      <Divider />

      <div>
        <div className="text-[11.5px] font-semibold mb-1">Acuerdo de pago</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Input label="Valor total" type="number" value={aValor} onChange={setAValor} />
          <Input label="# Cuotas" type="number" value={aCuotas} onChange={setACuotas} />
          <Input label="Inicio" type="date" value={aIni} onChange={setAIni} />
          <Input label="Fin" type="date" value={aFin} onChange={setAFin} />
          <Input label="Notas" value={aObs} onChange={setAObs} />
        </div>
        <button disabled={busy !== null || !aValor || !aCuotas || !aFin}
          onClick={() => run("acuerdo", async () => {
            await acordar({ data: { carteraId, valorTotal: Number(aValor), numeroCuotas: Number(aCuotas), fechaInicio: aIni, fechaFin: aFin, observaciones: aObs || undefined } });
            setAValor(""); setACuotas(""); setAFin(""); setAObs("");
          })}
          className="mt-2 rounded-md bg-[#445DA3] px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50"
        >{busy === "acuerdo" ? "Creando…" : "Crear acuerdo"}</button>
      </div>

      <Divider />

      <div>
        <div className="text-[11.5px] font-semibold mb-1">WhatsApp manual</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Input label="Número/Destinatario" value={waNum} onChange={setWaNum} placeholder="+57…" />
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">Tipo</span>
            <select value={waTipo} onChange={(e) => setWaTipo(e.target.value)} className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white">
              {Object.entries(TIPO_COMUNICACION_LABEL).filter(([k]) => k.startsWith("whatsapp_")).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <button disabled={busy !== null}
          onClick={() => run("wa", async () => {
            await comManual({ data: { carteraId, tipo: waTipo, canal: "whatsapp", destinatario: waNum || undefined } });
            setWaNum("");
          })}
          className="mt-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-[11.5px] hover:bg-[#F9FAFB] disabled:opacity-50"
        >{busy === "wa" ? "Registrando…" : "Registrar WhatsApp enviado"}</button>
      </div>

      <Divider />

      <div>
        <div className="text-[11.5px] font-semibold mb-1 text-[#B42318]">Enviar a prejurídico</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input label="Observación" value={pjObs} onChange={setPjObs} placeholder="Motivo…" />
        </div>
        <button disabled={busy !== null}
          onClick={() => { if (!confirm("¿Enviar a prejurídico? El caso quedará en estado prejurídico.")) return; run("pj", async () => { await prejur({ data: { carteraId, observacion: pjObs || undefined } }); setPjObs(""); }); }}
          className="mt-2 rounded-md bg-[#7F1D1D] px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50"
        >{busy === "pj" ? "Enviando…" : "Enviar a prejurídico"}</button>
      </div>
    </div>
  );
}

function Divider() { return <div className="h-px bg-[#E5E7EB]" />; }
function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-[#242424]/60">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="text-[12px] border border-[#E5E7EB] rounded px-2 py-1.5 bg-white" />
    </label>
  );
}
