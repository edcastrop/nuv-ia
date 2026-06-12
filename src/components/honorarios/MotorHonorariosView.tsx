import { useEffect, useMemo, useState } from "react";

import {
  DollarSign, Calculator, ListChecks, ShieldCheck, BarChart3,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, Send, RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { useUserRole } from "@/hooks/useUserRole";
import {
  calcularMotor, semaforoAutorizacion, indiceRentabilidad,
  ETIQUETA_CLASIFICACION, COLOR_CLASIFICACION,
  type ResultadoMotor, type TipoCreditoMH,
} from "@/lib/motorHonorarios";
import {
  crearCalculo, listarMisCalculos, listarAprobaciones,
  solicitarAprobacion, decidirAprobacion,
  type HonorarioCalculoRow, type AprobacionRow,
} from "@/lib/honorariosMotor";
import { formatCOP, parseCurrency } from "@/lib/format";

const COLORS = { bg: "#0E0E0E", panel: "#161616", line: "rgba(255,255,255,0.06)", text: "#FFFFFF", muted: "rgba(255,255,255,0.55)", brand: "#445DA3", green: "#84B98F", dark: "#242424" };

interface InitialData {
  expedienteId?: string;
  clienteNombre?: string;
  cedula?: string;
  banco?: string;
  tipoCredito?: TipoCreditoMH;
  plazoOriginal?: number;
  saldoCapital?: number;
  ahorroIntereses?: number;
  ahorroSeguros?: number;
}

export function MotorHonorariosView({ initial }: { initial?: InitialData }) {
  const { roles } = useUserRole();
  const isAprobador = roles.some((r) => ["super_admin", "admin", "gerencia"].includes(r));
  const [tab, setTab] = useState("calculadora");

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, color: COLORS.text }}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Header />
        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList className="bg-white/[0.04] border border-white/[0.06]">
            <TabsTrigger value="calculadora"><Calculator className="h-4 w-4 mr-2" />Calculadora</TabsTrigger>
            <TabsTrigger value="mis"><ListChecks className="h-4 w-4 mr-2" />Mis cálculos</TabsTrigger>
            {isAprobador && <TabsTrigger value="aprob"><ShieldCheck className="h-4 w-4 mr-2" />Aprobaciones</TabsTrigger>}
            {isAprobador && <TabsTrigger value="reportes"><BarChart3 className="h-4 w-4 mr-2" />Reportes</TabsTrigger>}
          </TabsList>
          <TabsContent value="calculadora" className="mt-6"><Calculadora initial={initial} /></TabsContent>
          <TabsContent value="mis" className="mt-6"><MisCalculos /></TabsContent>
          {isAprobador && <TabsContent value="aprob" className="mt-6"><Aprobaciones /></TabsContent>}
          {isAprobador && <TabsContent value="reportes" className="mt-6"><Reportes /></TabsContent>}
        </Tabs>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)", boxShadow: "0 18px 40px -16px rgba(132,185,143,0.5)" }}>
        <DollarSign className="h-7 w-7 text-white" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Motor de Honorarios NUVEX</h1>
        <p className="text-sm" style={{ color: COLORS.muted }}>
          Pricing engine empresarial — calcula, controla, audita y protege la rentabilidad.
        </p>
      </div>
    </div>
  );
}

// ──────────────────── Calculadora ────────────────────

function Calculadora({ initial }: { initial?: InitialData }) {
  const [cliente, setCliente] = useState(initial?.clienteNombre ?? "");
  const [cedula, setCedula] = useState(initial?.cedula ?? "");
  const [banco, setBanco] = useState(initial?.banco ?? "");
  const [tipoCredito, setTipoCredito] = useState<TipoCreditoMH>(initial?.tipoCredito ?? "pesos");
  const [plazoOriginal, setPlazoOriginal] = useState<string>(initial?.plazoOriginal ? String(initial.plazoOriginal) : "");
  const [saldoCapital, setSaldoCapital] = useState<string>(initial?.saldoCapital ? String(initial.saldoCapital) : "");
  const [ahorroIntereses, setAhorroIntereses] = useState<string>(initial?.ahorroIntereses ? String(initial.ahorroIntereses) : "");
  const [ahorroSeguros, setAhorroSeguros] = useState<string>(initial?.ahorroSeguros ? String(initial.ahorroSeguros) : "");
  const [honorarioOfertado, setHonorarioOfertado] = useState<string>("");
  const [openSolicitud, setOpenSolicitud] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const ai = parseCurrency(ahorroIntereses);
  const as = parseCurrency(ahorroSeguros);
  const plazoNum = Number(plazoOriginal) || undefined;

  const resultado: ResultadoMotor | null = useMemo(() => {
    if (ai + as <= 0) return null;
    return calcularMotor({
      ahorroIntereses: ai,
      ahorroSeguros: as,
      tipoCredito,
      plazoOriginalMeses: plazoNum,
    });
  }, [ai, as, tipoCredito, plazoNum]);

  const ofertaNum = parseCurrency(honorarioOfertado) || (resultado?.honorarioRecomendado ?? 0);
  const sem = resultado ? semaforoAutorizacion(ofertaNum, resultado.honorarioRecomendado) : null;
  const rent = resultado ? indiceRentabilidad(ofertaNum, resultado.honorarioRecomendado) : null;

  useEffect(() => {
    if (resultado && !honorarioOfertado) {
      setHonorarioOfertado(String(resultado.honorarioRecomendado));
    }
  }, [resultado, honorarioOfertado]);

  async function guardarOferta() {
    if (!resultado || !cliente.trim()) { toast.error("Falta cliente y/o cálculo"); return; }
    try {
      const row = await crearCalculo({
        expedienteId: initial?.expedienteId ?? null,
        clienteNombre: cliente.trim(),
        cedula: cedula || undefined,
        banco: banco || undefined,
        tipoCredito,
        plazoOriginal: plazoNum,
        saldoCapital: parseCurrency(saldoCapital) || undefined,
        ahorroIntereses: ai,
        ahorroSeguros: as,
        resultado,
        honorarioOfertado: ofertaNum,
      });
      setSavedId(row.id);
      toast.success("Cálculo guardado", { description: `Honorario ofertado: ${formatCOP(ofertaNum)}` });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
      {/* Inputs */}
      <Panel title="Datos del caso">
        <div className="space-y-3">
          <Field label="Cliente" value={cliente} onChange={setCliente} placeholder="Nombre completo" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cédula" value={cedula} onChange={setCedula} />
            <Field label="Banco" value={banco} onChange={setBanco} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/55">Tipo de crédito</Label>
              <Select value={tipoCredito} onValueChange={(v) => setTipoCredito(v as TipoCreditoMH)}>
                <SelectTrigger className="mt-1 bg-white/[0.04] border-white/[0.06] text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pesos">Pesos</SelectItem>
                  <SelectItem value="uvr">UVR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Plazo original (meses)" value={plazoOriginal} onChange={setPlazoOriginal} placeholder="360" />
          </div>
          <Field label="Saldo a capital" value={saldoCapital} onChange={setSaldoCapital} placeholder="$" />
          <Field label="Ahorro en intereses" value={ahorroIntereses} onChange={setAhorroIntereses} placeholder="$" />
          <Field label="Ahorro en seguros" value={ahorroSeguros} onChange={setAhorroSeguros} placeholder="$" />
        </div>
      </Panel>

      {/* Dashboard */}
      <div className="space-y-6">
        {!resultado ? (
          <Panel title="Dashboard de Honorarios">
            <div className="py-12 text-center text-sm text-white/45">
              Ingresa los ahorros para activar el motor de cálculo.
            </div>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="Ahorro Total" value={formatCOP(resultado.ahorroTotal)} accent={COLORS.green} icon={TrendingUp} />
              <Kpi label="Honorario Teórico" value={formatCOP(resultado.honorarioTeorico)} accent={COLORS.brand} />
              <Kpi label="% Aplicado" value={`${resultado.porcentajeAplicado}%`} accent={COLORS.brand} />
              <Kpi label="Honorario Comercial" value={formatCOP(resultado.honorarioRecomendado)} accent="#84B98F" highlight />
              <Kpi label="Clasificación" value={ETIQUETA_CLASIFICACION[resultado.clasificacion]} accent={COLOR_CLASIFICACION[resultado.clasificacion]} />
              <Kpi label="Descuento Máx." value={`${resultado.descuentoMaximoPct}%`} accent="#D97706" />
              <Kpi label="Rentabilidad" value={rent ? `${rent.pct.toFixed(0)}% · ${rent.etiqueta}` : "—"} accent={rent ? semColor(rent.color) : COLORS.muted} />
              <Kpi label="Estado de Tope" value={resultado.alertaTope === "maximo" ? "Topado al máx." : resultado.alertaTope === "minimo" ? "Subido al mín." : "Normal"} accent={resultado.alertaTope ? "#D97706" : COLORS.green} />
            </div>

            {resultado.alertaTope && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
                <div>
                  <b>Alerta de tope:</b> el cálculo fue {resultado.alertaTope === "maximo" ? "limitado al máximo ($14.000.000)" : "elevado al mínimo ($2.000.000)"}. Revisa con dirección comercial.
                </div>
              </div>
            )}

            {/* Generador de ofertas */}
            <Panel title="Generador automático de ofertas">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {resultado.ofertas.map((o) => (
                  <button
                    key={o.etiqueta}
                    onClick={() => setHonorarioOfertado(String(o.valor))}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-[#84B98F]/50 hover:bg-white/[0.05]"
                  >
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.muted }}>{o.etiqueta}</div>
                    <div className="mt-1 text-lg font-semibold">{formatCOP(o.valor)}</div>
                    <div className="mt-1 text-xs" style={{ color: COLORS.green }}>{o.descuentoPct > 0 ? `-${o.descuentoPct}% descuento` : "Sin descuento"}</div>
                  </button>
                ))}
              </div>
            </Panel>

            {/* Oferta y semáforo */}
            <Panel title="Oferta comercial">
              <div className="grid gap-4 md:grid-cols-[1fr,auto]">
                <div>
                  <Label className="text-xs text-white/55">Honorario a ofertar</Label>
                  <Input
                    value={honorarioOfertado}
                    onChange={(e) => setHonorarioOfertado(e.target.value)}
                    placeholder="$"
                    className="mt-1 bg-white/[0.04] border-white/[0.06] text-white text-lg"
                  />
                </div>
                {sem && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: semBg(sem.color), border: `1px solid ${semBorder(sem.color)}` }}>
                    <div className="flex items-center gap-2 font-medium" style={{ color: semColor(sem.color) }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: semColor(sem.color) }} />
                      {sem.color === "verde" ? "Autorizado" : sem.color === "amarillo" ? "Atención" : "Requiere aprobación"}
                    </div>
                    <div className="mt-1 text-xs text-white/70">{sem.mensaje}</div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={guardarOferta} disabled={!cliente.trim()} style={{ background: "#84B98F", color: "#0E0E0E" }}>
                  Guardar oferta
                </Button>
                {sem?.requiereAprobacion && (
                  <Button variant="outline" onClick={() => setOpenSolicitud(true)} className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
                    <Send className="h-4 w-4 mr-2" /> Solicitar aprobación
                  </Button>
                )}
              </div>
            </Panel>
          </>
        )}
      </div>

      <SolicitudAprobacionDialog
        open={openSolicitud}
        onOpenChange={setOpenSolicitud}
        cliente={cliente}
        ahorroTotal={resultado?.ahorroTotal ?? 0}
        recomendado={resultado?.honorarioRecomendado ?? 0}
        solicitado={ofertaNum}
        savedId={savedId}
        onPrepareSave={async () => {
          if (savedId) return savedId;
          await guardarOferta();
          // savedId se actualizó en estado, pero asincrónicamente; releemos vía return del crearCalculo
          return null;
        }}
      />
    </div>
  );
}

// ──────────────────── Mis cálculos ────────────────────

function MisCalculos() {
  const [rows, setRows] = useState<HonorarioCalculoRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try { setRows(await listarMisCalculos()); } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  return (
    <Panel title="Cálculos guardados" right={<Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="h-4 w-4" /></Button>}>
      {loading ? <div className="py-8 text-center text-white/45 text-sm">Cargando…</div> :
       rows.length === 0 ? <div className="py-8 text-center text-white/45 text-sm">Aún no hay cálculos.</div> :
       <div className="overflow-x-auto">
         <table className="min-w-full text-sm">
           <thead>
             <tr className="text-left text-white/45 border-b border-white/[0.06]">
               <th className="py-2 pr-4">Cliente</th><th className="py-2 pr-4">Banco</th>
               <th className="py-2 pr-4">Clasif.</th><th className="py-2 pr-4 text-right">Ahorro</th>
               <th className="py-2 pr-4 text-right">Recomendado</th><th className="py-2 pr-4 text-right">Ofertado</th>
               <th className="py-2 pr-4 text-right">Rent.</th><th className="py-2 pr-4">Estado</th>
             </tr>
           </thead>
           <tbody>
             {rows.map((r) => (
               <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                 <td className="py-2 pr-4">{r.cliente_nombre}</td>
                 <td className="py-2 pr-4">{r.banco ?? "—"}</td>
                 <td className="py-2 pr-4">
                   <Badge variant="outline" style={{ borderColor: COLOR_CLASIFICACION[r.clasificacion], color: COLOR_CLASIFICACION[r.clasificacion] }}>
                     {ETIQUETA_CLASIFICACION[r.clasificacion]}
                   </Badge>
                 </td>
                 <td className="py-2 pr-4 text-right">{formatCOP(r.ahorro_total)}</td>
                 <td className="py-2 pr-4 text-right">{formatCOP(r.honorario_topado)}</td>
                 <td className="py-2 pr-4 text-right">{r.honorario_ofertado != null ? formatCOP(r.honorario_ofertado) : "—"}</td>
                 <td className="py-2 pr-4 text-right">{r.rentabilidad_pct != null ? `${Number(r.rentabilidad_pct).toFixed(0)}%` : "—"}</td>
                 <td className="py-2 pr-4"><EstadoBadge estado={r.estado} /></td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
      }
    </Panel>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const color = estado === "aprobado" ? "#84B98F"
    : estado === "rechazado" ? "#EF4444"
    : estado === "pendiente_aprobacion" ? "#D97706"
    : estado === "contraofertado" ? "#445DA3"
    : "#9CA3AF";
  return <span className="text-xs font-medium" style={{ color }}>{estado.replace(/_/g, " ")}</span>;
}

// ──────────────────── Aprobaciones ────────────────────

function Aprobaciones() {
  const [rows, setRows] = useState<AprobacionRow[]>([]);
  const [calculos, setCalculos] = useState<Record<string, HonorarioCalculoRow>>({});
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<AprobacionRow | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const ap = await listarAprobaciones();
      setRows(ap);
      const cs = await listarMisCalculos();
      const map: Record<string, HonorarioCalculoRow> = {};
      for (const c of cs) map[c.id] = c;
      setCalculos(map);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  const pendientes = rows.filter((r) => !r.decision);
  const historicas = rows.filter((r) => !!r.decision);

  return (
    <div className="space-y-6">
      <Panel title={`Solicitudes pendientes (${pendientes.length})`} right={<Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="h-4 w-4" /></Button>}>
        {loading ? <div className="py-6 text-center text-white/45 text-sm">Cargando…</div> :
         pendientes.length === 0 ? <div className="py-6 text-center text-white/45 text-sm">Sin pendientes.</div> :
         <div className="grid gap-3">
           {pendientes.map((r) => {
             const c = calculos[r.calculo_id];
             const desc = r.honorario_recomendado > 0 ? ((r.honorario_recomendado - r.honorario_solicitado) / r.honorario_recomendado) * 100 : 0;
             return (
               <div key={r.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                 <div className="flex items-start justify-between gap-4">
                   <div>
                     <div className="font-medium">{c?.cliente_nombre ?? "Cliente"}</div>
                     <div className="text-xs text-white/55">{c?.banco ?? ""} · Ahorro {formatCOP(c?.ahorro_total ?? 0)}</div>
                     <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                       <Mini label="Recomendado" value={formatCOP(r.honorario_recomendado)} />
                       <Mini label="Solicitado" value={formatCOP(r.honorario_solicitado)} accent="#D97706" />
                       <Mini label="Descuento" value={`${desc.toFixed(1)}%`} accent="#D97706" />
                     </div>
                     <div className="mt-3 text-xs text-white/70"><b>Motivo:</b> {r.motivo_solicitud}</div>
                   </div>
                   <Button size="sm" onClick={() => setSel(r)} style={{ background: COLORS.brand, color: "#fff" }}>
                     Revisar
                   </Button>
                 </div>
               </div>
             );
           })}
         </div>
        }
      </Panel>

      <Panel title={`Histórico (${historicas.length})`}>
        <div className="grid gap-2">
          {historicas.slice(0, 20).map((r) => {
            const c = calculos[r.calculo_id];
            return (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
                <div>
                  <div>{c?.cliente_nombre ?? "Cliente"}</div>
                  <div className="text-xs text-white/45">{new Date(r.decidido_at ?? r.created_at).toLocaleDateString("es-CO")}</div>
                </div>
                <Badge variant="outline" style={{ borderColor: r.decision === "aprobado" ? "#84B98F" : r.decision === "rechazado" ? "#EF4444" : "#445DA3", color: r.decision === "aprobado" ? "#84B98F" : r.decision === "rechazado" ? "#EF4444" : "#445DA3" }}>
                  {r.decision}
                </Badge>
              </div>
            );
          })}
        </div>
      </Panel>

      <DecisionDialog aprobacion={sel} onClose={() => setSel(null)} onDone={reload} />
    </div>
  );
}

function DecisionDialog({ aprobacion, onClose, onDone }: { aprobacion: AprobacionRow | null; onClose: () => void; onDone: () => void }) {
  const [comentarios, setComentarios] = useState("");
  const [contraoferta, setContraoferta] = useState("");
  if (!aprobacion) return null;

  async function decidir(decision: "aprobado" | "rechazado" | "contraofertado") {
    if (!aprobacion) return;
    try {
      await decidirAprobacion({
        aprobacionId: aprobacion.id,
        calculoId: aprobacion.calculo_id,
        decision,
        contraoferta: decision === "contraofertado" ? parseCurrency(contraoferta) : undefined,
        comentarios,
      });
      toast.success(`Solicitud ${decision}`);
      onClose(); onDone();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open={!!aprobacion} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#161616] text-white border-white/[0.08]">
        <DialogHeader>
          <DialogTitle>Revisar solicitud</DialogTitle>
          <DialogDescription className="text-white/55">
            Recomendado {formatCOP(aprobacion.honorario_recomendado)} · Solicitado {formatCOP(aprobacion.honorario_solicitado)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-white/55">Motivo del analista</div>
          <div className="rounded-lg bg-white/[0.03] p-3 text-sm">{aprobacion.motivo_solicitud}</div>
          <div>
            <Label className="text-xs text-white/55">Comentarios</Label>
            <Textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} className="mt-1 bg-white/[0.04] border-white/[0.06] text-white" />
          </div>
          <div>
            <Label className="text-xs text-white/55">Contraoferta (opcional)</Label>
            <Input value={contraoferta} onChange={(e) => setContraoferta(e.target.value)} placeholder="$" className="mt-1 bg-white/[0.04] border-white/[0.06] text-white" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => decidir("rechazado")} className="border-red-500/40 text-red-300 hover:bg-red-500/10">
            <XCircle className="h-4 w-4 mr-2" />Rechazar
          </Button>
          <Button variant="outline" onClick={() => decidir("contraofertado")} disabled={!contraoferta} className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10">
            Contraofertar
          </Button>
          <Button onClick={() => decidir("aprobado")} style={{ background: "#84B98F", color: "#0E0E0E" }}>
            <CheckCircle2 className="h-4 w-4 mr-2" />Aprobar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────── Reportes ────────────────────

function Reportes() {
  const [rows, setRows] = useState<HonorarioCalculoRow[]>([]);
  useEffect(() => { listarMisCalculos().then(setRows).catch(() => {}); }, []);

  const kpis = useMemo(() => {
    const ofertados = rows.filter((r) => r.honorario_ofertado != null);
    const totalVendido = ofertados.reduce((a, r) => a + Number(r.honorario_ofertado ?? 0), 0);
    const totalRecomendado = ofertados.reduce((a, r) => a + Number(r.honorario_topado ?? 0), 0);
    const descProm = ofertados.length ? ofertados.reduce((a, r) => a + Number(r.descuento_aplicado_pct ?? 0), 0) / ofertados.length : 0;
    const rentProm = totalRecomendado > 0 ? (totalVendido / totalRecomendado) * 100 : 0;
    const aprobados = rows.filter((r) => r.estado === "aprobado").length;
    const rechazados = rows.filter((r) => r.estado === "rechazado").length;
    const pendientes = rows.filter((r) => r.estado === "pendiente_aprobacion").length;
    const promedio = ofertados.length ? totalVendido / ofertados.length : 0;
    return { totalVendido, descProm, rentProm, aprobados, rechazados, pendientes, promedio, cuenta: ofertados.length };
  }, [rows]);

  const porMes = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      if (r.honorario_ofertado == null) return;
      const d = new Date(r.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(k, (map.get(k) ?? 0) + Number(r.honorario_ofertado));
    });
    return Array.from(map.entries()).map(([mes, total]) => ({ mes, total })).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Honorarios vendidos" value={formatCOP(kpis.totalVendido)} accent={COLORS.green} highlight />
        <Kpi label="Promedio por caso" value={formatCOP(kpis.promedio)} accent={COLORS.brand} />
        <Kpi label="Descuento promedio" value={`${kpis.descProm.toFixed(1)}%`} accent="#D97706" />
        <Kpi label="Rentabilidad promedio" value={`${kpis.rentProm.toFixed(0)}%`} accent={kpis.rentProm >= 90 ? COLORS.green : kpis.rentProm >= 80 ? "#D97706" : "#EF4444"} />
        <Kpi label="Aprobados" value={String(kpis.aprobados)} accent={COLORS.green} />
        <Kpi label="Rechazados" value={String(kpis.rechazados)} accent="#EF4444" />
        <Kpi label="Pendientes" value={String(kpis.pendientes)} accent="#D97706" />
        <Kpi label="Cálculos totales" value={String(rows.length)} accent={COLORS.brand} />
      </div>

      <Panel title="Honorarios vendidos por mes">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="mes" stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatCOP(v)} contentStyle={{ background: "#161616", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} />
              <Bar dataKey="total" fill={COLORS.green} radius={[8, 8, 0, 0]}>
                {porMes.map((_, i) => <Cell key={i} fill={COLORS.green} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

// ──────────────────── Dialog solicitud ────────────────────

function SolicitudAprobacionDialog({
  open, onOpenChange, cliente, ahorroTotal, recomendado, solicitado, savedId, onPrepareSave,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  cliente: string; ahorroTotal: number; recomendado: number; solicitado: number;
  savedId: string | null;
  onPrepareSave: () => Promise<string | null>;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (motivo.trim().length < 10) { toast.error("Describe el motivo (mínimo 10 caracteres)"); return; }
    setEnviando(true);
    try {
      let id = savedId;
      if (!id) {
        // El padre guarda; el caller debe llamar guardarOferta antes idealmente, pero hacemos best-effort
        id = await onPrepareSave();
        if (!id) {
          toast.error("Guarda primero el cálculo antes de solicitar aprobación.");
          setEnviando(false);
          return;
        }
      }
      await solicitarAprobacion({
        calculoId: id,
        honorarioRecomendado: recomendado,
        honorarioSolicitado: solicitado,
        motivo: motivo.trim(),
      });
      toast.success("Solicitud enviada a Dirección Comercial");
      onOpenChange(false);
      setMotivo("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setEnviando(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#161616] text-white border-white/[0.08]">
        <DialogHeader>
          <DialogTitle>Solicitud de aprobación</DialogTitle>
          <DialogDescription className="text-white/55">
            Esta oferta requiere autorización de Dirección Comercial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Mini label="Cliente" value={cliente || "—"} />
            <Mini label="Ahorro total" value={formatCOP(ahorroTotal)} />
            <Mini label="Recomendado" value={formatCOP(recomendado)} />
            <Mini label="Solicitado" value={formatCOP(solicitado)} accent="#D97706" />
          </div>
          <div>
            <Label className="text-xs text-white/55">Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Justifica el descuento solicitado…" className="mt-1 bg-white/[0.04] border-white/[0.06] text-white" rows={4} />
          </div>
          {!savedId && (
            <div className="text-xs text-amber-300/80">
              Si aún no guardas el cálculo, presiona primero "Guardar oferta" y luego solicita la aprobación.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={enviar} disabled={enviando || !savedId} style={{ background: COLORS.brand, color: "#fff" }}>
            <Send className="h-4 w-4 mr-2" />Enviar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────── Helpers UI ────────────────────

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-3xl p-6" style={{ background: COLORS.panel, border: `1px solid ${COLORS.line}` }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: COLORS.muted }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs text-white/55">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 bg-white/[0.04] border-white/[0.06] text-white" />
    </div>
  );
}

function Kpi({ label, value, accent, icon: Icon, highlight }: { label: string; value: string; accent: string; icon?: React.ComponentType<{ className?: string }>; highlight?: boolean }) {
  return (
    <div
      className="rounded-2xl p-4 transition"
      style={{
        background: highlight ? "linear-gradient(135deg, rgba(132,185,143,0.12), rgba(68,93,163,0.08))" : "rgba(255,255,255,0.03)",
        border: `1px solid ${highlight ? "rgba(132,185,143,0.3)" : COLORS.line}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</div>
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className="mt-2 text-lg font-semibold" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="text-sm font-medium mt-0.5" style={{ color: accent ?? "#fff" }}>{value}</div>
    </div>
  );
}

function semColor(c: "verde" | "amarillo" | "rojo") {
  return c === "verde" ? "#84B98F" : c === "amarillo" ? "#D97706" : "#EF4444";
}
function semBg(c: "verde" | "amarillo" | "rojo") {
  return c === "verde" ? "rgba(132,185,143,0.1)" : c === "amarillo" ? "rgba(217,119,6,0.1)" : "rgba(239,68,68,0.1)";
}
function semBorder(c: "verde" | "amarillo" | "rojo") {
  return c === "verde" ? "rgba(132,185,143,0.3)" : c === "amarillo" ? "rgba(217,119,6,0.3)" : "rgba(239,68,68,0.3)";
}
