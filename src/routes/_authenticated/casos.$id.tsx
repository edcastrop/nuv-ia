import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import { getExpediente, updateEstado, deleteExpediente, ESTADOS, type Expediente, type EstadoExpediente } from "@/lib/expedientes";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import { EstadoBadge } from "@/components/nuvex/EstadoBadge";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { DocumentosLegales } from "@/components/expediente-maestro/DocumentosLegales";
import { expedienteToMaestroLike } from "@/lib/expedienteMaestro";

export const Route = createFileRoute("/_authenticated/casos/$id")({
  component: CasoDetail,
  head: () => ({ meta: [{ title: "Expediente · NUVEX" }] }),
});

function CasoDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [exp, setExp] = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    getExpediente(id)
      .then(setExp)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [id]);

  // IMPORTANTE: declarar todos los hooks antes de cualquier return condicional
  // para evitar "Rendered more hooks than during the previous render".
  const maestroLike = useMemo(
    () => (exp ? expedienteToMaestroLike(exp) : null),
    [exp],
  );

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando expediente…</div>;
  if (err || !exp) return <div className="p-12 text-center text-sm text-[#B42318]">{err || "No encontrado"}</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#242424]/55">Expediente</div>
            <h1 className="text-2xl font-semibold text-[#242424]">{exp.cliente_nombre}</h1>
            <div className="mt-1 text-sm text-[#242424]/70">
              {exp.cedula && <>CC {exp.cedula} · </>}
              {exp.banco && <>{exp.banco} · </>}
              {exp.numero_credito && <>Crédito {exp.numero_credito} · </>}
              Modo <span className="uppercase font-semibold">{exp.modo}</span> · Simulado {exp.fecha_simulacion}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <EstadoBadge estado={exp.estado} />
            <select
              value={exp.estado}
              onChange={async (e) => {
                const nuevo = e.target.value as EstadoExpediente;
                try {
                  await updateEstado(exp.id, nuevo);
                  reload();
                } catch (err) {
                  alert((err as Error).message);
                }
              }}
              className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium bg-white"
            >
              {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Link to="/casos" className="text-[11px] text-[#445DA3] hover:underline">← Volver a casos</Link>
          </div>
        </div>
      </Card>

      {exp.modo === "pesos" ? (
        <PesosSimulator initialExpediente={exp} onSaved={reload} />
      ) : (
        <UVRSimulator initialExpediente={exp} onSaved={reload} />
      )}

      {maestroLike && (
        <ErrorBoundary fallback={<Card><div className="text-sm text-[#B42318]">No se pudo cargar esta sección.</div></Card>}>
          <DocumentosLegales expediente={maestroLike} />
        </ErrorBoundary>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#242424]/70">¿Eliminar este expediente?</div>
          <button
            onClick={async () => {
              if (!confirm("¿Eliminar definitivamente este expediente?")) return;
              try {
                await deleteExpediente(exp.id);
                navigate({ to: "/casos" });
              } catch (e) {
                alert((e as Error).message);
              }
            }}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: "#F5C2C2", color: "#B42318", backgroundColor: "#FDECEC" }}
          >
            Eliminar
          </button>
        </div>
      </Card>
    </div>
  );
}
