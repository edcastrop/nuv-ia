import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getMaestro, upsertMaestro, deleteMaestro,
  emptyCliente, emptyCotitular, emptyCredito, emptyFresh,
  emptyAsesor, emptyLicenciado, emptyApoderado,
  type ExpedienteMaestro,
} from "@/lib/expedienteMaestro";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { MaestroEditor } from "@/components/expediente-maestro/MaestroEditor";
import { DocumentosLegales } from "@/components/expediente-maestro/DocumentosLegales";

export const Route = createFileRoute("/_authenticated/expediente-maestro/$id")({
  component: MaestroDetail,
  head: () => ({ meta: [{ title: "Expediente Maestro · NUVEX" }] }),
});

function MaestroDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [exp, setExp] = useState<ExpedienteMaestro | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [cliente, setCliente] = useState(emptyCliente());
  const [cotitular, setCotitular] = useState(emptyCotitular());
  const [credito, setCredito] = useState(emptyCredito());
  const [fresh, setFresh] = useState(emptyFresh());
  const [asesor, setAsesor] = useState(emptyAsesor());
  const [licenciado, setLicenciado] = useState(emptyLicenciado());
  const [apoderado, setApoderado] = useState(emptyApoderado());

  useEffect(() => {
    setLoading(true);
    getMaestro(id)
      .then((e) => {
        setExp(e);
        setCliente({ ...emptyCliente(), ...(e.cliente || {}) });
        setCotitular({ ...emptyCotitular(), ...(e.cotitular || {}) });
        setCredito({ ...emptyCredito(), ...(e.credito || {}) });
        setFresh({ ...emptyFresh(), ...(e.fresh || {}) });
        setAsesor({ ...emptyAsesor(), ...(e.asesor || {}) });
        setLicenciado({ ...emptyLicenciado(), ...(e.licenciado || {}) });
        setApoderado({ ...emptyApoderado(), ...(e.apoderado || {}) });
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const guardar = async () => {
    setSaving(true); setMsg(null);
    try {
      const saved = await upsertMaestro({ id, cliente, cotitular, credito, fresh, asesor, licenciado, apoderado });
      setExp(saved);
      setMsg("Expediente guardado");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando expediente…</div>;
  if (err || !exp) return <div className="p-12 text-center text-sm text-[#B42318]">{err || "No encontrado"}</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>Expediente Maestro</div>
            <h1 className="text-2xl font-semibold text-[#242424]">{cliente.nombre || "Sin nombre"}</h1>
            <div className="mt-1 text-sm text-[#242424]/70">
              {cliente.cedula && <>CC {cliente.cedula} · </>}
              {credito.banco && <>{credito.banco} · </>}
              Actualizado {new Date(exp.updated_at).toLocaleString("es-CO")}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-xs text-[#242424]/70">{msg}</span>}
            <button
              onClick={guardar}
              disabled={saving}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-50"
              style={{ backgroundColor: NUVEX.azul }}
            >
              {saving ? "Guardando…" : "Guardar todo"}
            </button>
            <Link to="/expediente-maestro" className="text-[11px] text-[#445DA3] hover:underline">← Volver</Link>
          </div>
        </div>
      </Card>

      <MaestroEditor
        cliente={cliente} cotitular={cotitular} credito={credito} fresh={fresh}
        asesor={asesor} licenciado={licenciado} apoderado={apoderado}
        onCliente={setCliente} onCotitular={setCotitular} onCredito={setCredito}
        onFresh={setFresh} onAsesor={setAsesor} onLicenciado={setLicenciado} onApoderado={setApoderado}
      />

      <DocumentosLegales
        expediente={exp}
        liveOverride={{ cliente, cotitular, credito, fresh, asesor, licenciado, apoderado }}
      />



      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#242424]/70">¿Eliminar este expediente maestro?</div>
          <button
            onClick={async () => {
              if (!confirm("¿Eliminar definitivamente?")) return;
              try { await deleteMaestro(id); navigate({ to: "/expediente-maestro" }); }
              catch (e) { alert((e as Error).message); }
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
