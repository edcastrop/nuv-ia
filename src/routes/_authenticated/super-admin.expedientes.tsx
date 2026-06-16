import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { PageLayout, ExecutiveHero, NSelect } from "@/components/nuvia";
import { supabase } from "@/integrations/supabase/client";
import { CASO_ESTADOS, CASO_ESTADO_BY_KEY, labelEstado, type CasoEstado } from "@/lib/casoEstados";
import { useUserRole } from "@/hooks/useUserRole";
import { BANCOS_DISPONIBLES } from "@/lib/apoderados";

export const Route = createFileRoute("/_authenticated/super-admin/expedientes")({
  component: SuperAdminExpedientes,
  head: () => ({ meta: [{ title: "Expedientes globales · Super Admin" }] }),
});

interface Row {
  id: string;
  asesor_id: string;
  cliente_nombre: string;
  cedula: string | null;
  banco: string | null;
  producto: string | null;
  estado: string;
  estado_caso: CasoEstado | null;
  honorarios_final: number | null;
  fecha_simulacion: string;
  created_at: string;
  cliente_data: { ciudad?: string } | null;
  aprobado_data: { fechaAprobacion?: string } | null;
}

function SuperAdminExpedientes() {
  const { isSuperAdmin, loading: rolesLoading } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const [fLic, setFLic] = useState("");
  const [fBanco, setFBanco] = useState("");
  const [fEstado, setFEstado] = useState<CasoEstado | "">("");
  const [fProducto, setFProducto] = useState("");
  const [fCiudad, setFCiudad] = useState("");
  const [fFechaDesde, setFFechaDesde] = useState("");
  const [fHonMin, setFHonMin] = useState("");
  const [fHonMax, setFHonMax] = useState("");

  useEffect(() => {
    if (rolesLoading || !isSuperAdmin) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("expedientes")
        .select("id, asesor_id, cliente_nombre, cedula, banco, producto, estado, estado_caso, honorarios_final, fecha_simulacion, created_at, cliente_data, aprobado_data" as never)
        .order("updated_at", { ascending: false });
      const list = (data ?? []) as unknown as Row[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.asesor_id)));
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
        const m = new Map<string, string>();
        (profs ?? []).forEach((p) => m.set(p.id, p.nombre || p.email || "—"));
        setNombres(m);
      }
      setLoading(false);
    })();
  }, [rolesLoading, isSuperAdmin]);

  const productos = useMemo(() => Array.from(new Set(rows.map((r) => r.producto).filter(Boolean))) as string[], [rows]);
  const ciudades = useMemo(() => Array.from(new Set(rows.map((r) => r.cliente_data?.ciudad).filter(Boolean))) as string[], [rows]);
  const licenciados = useMemo(() => Array.from(nombres.entries()).map(([id, n]) => ({ id, nombre: n })), [nombres]);

  const filtrados = rows.filter((r) => {
    if (fLic && r.asesor_id !== fLic) return false;
    if (fBanco && r.banco !== fBanco) return false;
    if (fEstado && r.estado_caso !== fEstado) return false;
    if (fProducto && r.producto !== fProducto) return false;
    if (fCiudad && r.cliente_data?.ciudad !== fCiudad) return false;
    if (fFechaDesde && new Date(r.created_at) < new Date(fFechaDesde)) return false;
    const hon = Number(r.honorarios_final) || 0;
    if (fHonMin && hon < Number(fHonMin)) return false;
    if (fHonMax && hon > Number(fHonMax)) return false;
    return true;
  });

  const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  if (rolesLoading || loading) {
    return (
      <PageLayout>
        <div className="p-12 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      </PageLayout>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/inicio" />;

  const cardCls = "rounded-2xl p-5";
  const cardStyle = { background: "var(--nuvia-bg-card)", border: "1px solid var(--nuvia-border)" } as const;

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <FolderOpen size={12} />, label: "Vista global", tone: "blue" }}
        title="Expedientes globales"
        description={`${filtrados.length} de ${rows.length} expedientes`}
        meta={
          <Link to="/super-admin" className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--nuvia-accent-blue)" }}>
            <ArrowLeft size={12} /> Super Admin
          </Link>
        }
      />

      <section className={cardCls} style={cardStyle}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <NSelect
            value={fLic}
            onValueChange={setFLic}
            options={[{ value: "", label: "Todos los licenciados" }, ...licenciados.map((l) => ({ value: l.id, label: l.nombre }))]}
          />
          <NSelect
            value={fBanco}
            onValueChange={setFBanco}
            options={[{ value: "", label: "Todos los bancos" }, ...BANCOS_DISPONIBLES.map((b) => ({ value: b, label: b }))]}
          />
          <NSelect
            value={fEstado}
            onValueChange={(v) => setFEstado(v as CasoEstado | "")}
            options={[{ value: "", label: "Todos los estados" }, ...CASO_ESTADOS.map((e) => ({ value: e.key, label: e.label }))]}
          />
          <NSelect
            value={fProducto}
            onValueChange={setFProducto}
            options={[{ value: "", label: "Todos los productos" }, ...productos.map((p) => ({ value: p, label: p }))]}
          />
          <NSelect
            value={fCiudad}
            onValueChange={setFCiudad}
            options={[{ value: "", label: "Todas las ciudades" }, ...ciudades.map((c) => ({ value: c, label: c }))]}
          />
          <input type="date" value={fFechaDesde} onChange={(e) => setFFechaDesde(e.target.value)} className="nuvia-input nuvia-input-sm" />
          <input type="number" value={fHonMin} onChange={(e) => setFHonMin(e.target.value)} placeholder="Honorarios mín." className="nuvia-input nuvia-input-sm" />
          <input type="number" value={fHonMax} onChange={(e) => setFHonMax(e.target.value)} placeholder="Honorarios máx." className="nuvia-input nuvia-input-sm" />
        </div>
      </section>

      <section className={cardCls} style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.14em]">
                <th className="text-left py-2 font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Cliente</th>
                <th className="text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Analista F. Comercial</th>
                <th className="text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Banco</th>
                <th className="text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Estado del caso</th>
                <th className="text-right font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Honorarios</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const def = r.estado_caso ? CASO_ESTADO_BY_KEY[r.estado_caso] : null;
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                    <td className="py-2.5">
                      <div className="font-medium" style={{ color: "var(--nuvia-text-primary)" }}>{r.cliente_nombre}</div>
                      <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>{r.cedula ?? "—"}</div>
                    </td>
                    <td className="py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{nombres.get(r.asesor_id) ?? "—"}</td>
                    <td className="py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>{r.banco ?? "—"}</td>
                    <td className="py-2.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={def ? { background: def.bg, color: def.color } : { background: "rgba(255,255,255,0.06)", color: "var(--nuvia-text-secondary)" }}
                      >
                        {labelEstado(r.estado_caso)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right" style={{ color: "var(--nuvia-text-primary)" }}>{fmt(Number(r.honorarios_final) || 0)}</td>
                    <td className="py-2.5 text-right">
                      <Link
                        to="/casos/$id"
                        params={{ id: r.id }}
                        className="text-[11px] hover:underline"
                        style={{ color: "var(--nuvia-accent-blue)" }}
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </PageLayout>
  );
}
