import { useEffect, useState } from "react";
import { Users, CheckCircle2, Trophy, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Curso } from "@/lib/academia";

const sb = supabase as unknown as { from: (t: string) => any };

interface Fila {
  user_id: string;
  nombre: string;
  email: string;
  lecciones_completadas: number;
  evaluaciones_aprobadas: number;
  promedio: number;
  certificado: boolean;
}

interface Totales {
  total_lecciones: number;
  total_evals: number;
}

export function SeguimientoPanel({ cursos }: { cursos: Curso[] }) {
  const cursosActivos = cursos.filter((c) => c.activo);
  const [cursoId, setCursoId] = useState<string>(cursosActivos[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [tot, setTot] = useState<Totales>({ total_lecciones: 0, total_evals: 0 });

  useEffect(() => {
    if (!cursoId) return;
    (async () => {
      setLoading(true);
      // totales del curso
      const { data: modulos } = await sb.from("academia_modulos").select("id").eq("curso_id", cursoId).eq("activo", true);
      const modIds = ((modulos as { id: string }[]) ?? []).map((m) => m.id);
      const totLecRes = modIds.length ? await sb.from("academia_lecciones").select("id", { count: "exact", head: true }).in("modulo_id", modIds).eq("activo", true) : { count: 0 };
      const totEvalRes = modIds.length ? await sb.from("academia_evaluaciones").select("id", { count: "exact", head: true }).in("modulo_id", modIds).eq("activo", true) : { count: 0 };
      const total_lecciones = totLecRes.count ?? 0;
      const total_evals = totEvalRes.count ?? 0;
      setTot({ total_lecciones, total_evals });

      // recolectar lecciones y evaluaciones del curso
      const { data: lecs } = modIds.length ? await sb.from("academia_lecciones").select("id").in("modulo_id", modIds).eq("activo", true) : { data: [] };
      const lecIds = ((lecs as { id: string }[]) ?? []).map((l) => l.id);
      const { data: evs } = modIds.length ? await sb.from("academia_evaluaciones").select("id").in("modulo_id", modIds).eq("activo", true) : { data: [] };
      const evIds = ((evs as { id: string }[]) ?? []).map((e) => e.id);

      // progreso e intentos de todos los usuarios
      const { data: prog } = lecIds.length ? await sb.from("academia_progreso_lecciones").select("user_id,leccion_id").in("leccion_id", lecIds).eq("completada", true) : { data: [] };
      const { data: intentos } = evIds.length ? await sb.from("academia_intentos").select("user_id,evaluacion_id,porcentaje,aprobado").in("evaluacion_id", evIds) : { data: [] };
      const { data: certs } = await sb.from("academia_certificaciones").select("user_id").eq("curso_id", cursoId);

      const userIds = new Set<string>();
      ((prog as { user_id: string }[]) ?? []).forEach((p) => userIds.add(p.user_id));
      ((intentos as { user_id: string }[]) ?? []).forEach((i) => userIds.add(i.user_id));
      const uidArr = Array.from(userIds);
      const { data: profs } = uidArr.length ? await sb.from("profiles").select("id,nombre,email").in("id", uidArr) : { data: [] };
      const profMap = new Map(((profs as { id: string; nombre: string; email: string }[]) ?? []).map((p) => [p.id, p]));
      const certSet = new Set(((certs as { user_id: string }[]) ?? []).map((c) => c.user_id));

      const out: Fila[] = uidArr.map((uid) => {
        const lecComp = ((prog as { user_id: string; leccion_id: string }[]) ?? []).filter((p) => p.user_id === uid).length;
        const myInt = ((intentos as { user_id: string; evaluacion_id: string; porcentaje: number; aprobado: boolean }[]) ?? []).filter((i) => i.user_id === uid);
        const apr = new Set(myInt.filter((i) => i.aprobado).map((i) => i.evaluacion_id));
        const prom = myInt.length ? Math.round(myInt.reduce((a, x) => a + Number(x.porcentaje), 0) / myInt.length) : 0;
        const p = profMap.get(uid);
        return {
          user_id: uid,
          nombre: p?.nombre ?? "—",
          email: p?.email ?? "",
          lecciones_completadas: lecComp,
          evaluaciones_aprobadas: apr.size,
          promedio: prom,
          certificado: certSet.has(uid),
        };
      }).sort((a, b) => b.lecciones_completadas - a.lecciones_completadas);

      setFilas(out);
      setLoading(false);
    })();
  }, [cursoId]);

  const inscritos = filas.length;
  const certificados = filas.filter((f) => f.certificado).length;
  const promGral = filas.length ? Math.round(filas.reduce((a, f) => a + f.promedio, 0) / filas.length) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-[#242424]/55">Curso</span>
        <select value={cursoId} onChange={(e) => setCursoId(e.target.value)} className="rounded border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs">
          {cursosActivos.map((c) => <option key={c.id} value={c.id}>{c.titulo} · {c.rol_destino}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card icon={Users} label="Inscritos activos" value={inscritos} />
        <Card icon={CheckCircle2} label={`Lecciones (total ${tot.total_lecciones})`} value={tot.total_lecciones} />
        <Card icon={Trophy} label="Certificados emitidos" value={certificados} />
        <Card icon={Percent} label="Promedio general" value={`${promGral}%`} />
      </div>

      <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-[#F7F9FB] text-[10px] uppercase text-[#242424]/55">
            <tr>
              <th className="text-left px-3 py-2">Usuario</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-right px-3 py-2">Lecciones</th>
              <th className="text-right px-3 py-2">Evals</th>
              <th className="text-right px-3 py-2">Promedio</th>
              <th className="text-center px-3 py-2">Cert.</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-[#242424]/50">Cargando…</td></tr>}
            {!loading && filas.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-[#242424]/50">Sin actividad aún.</td></tr>}
            {filas.map((f) => (
              <tr key={f.user_id} className="border-t border-[#E3E7EE]">
                <td className="px-3 py-2 font-medium text-[#0A1226]">{f.nombre}</td>
                <td className="px-3 py-2 text-[#242424]/65">{f.email}</td>
                <td className="px-3 py-2 text-right">{f.lecciones_completadas}/{tot.total_lecciones}</td>
                <td className="px-3 py-2 text-right">{f.evaluaciones_aprobadas}/{tot.total_evals}</td>
                <td className="px-3 py-2 text-right">{f.promedio}%</td>
                <td className="px-3 py-2 text-center">{f.certificado ? <span className="text-[#1F7A45]">✓</span> : <span className="text-[#242424]/30">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#242424]/55">
        <Icon size={12} /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-[#0A1226]">{value}</div>
    </div>
  );
}
