import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Award, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Curso } from "@/lib/academia";

const sb = supabase as unknown as { from: (t: string) => any };

interface Cert {
  id: string;
  user_id: string;
  curso_id: string;
  nota_final: number;
  codigo: string;
  emitida_at: string;
  nombre?: string;
  email?: string;
}

export function CertificadosPanel({ cursos }: { cursos: Curso[] }) {
  const [cursoId, setCursoId] = useState<string>("");
  const [filas, setFilas] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = sb.from("academia_certificaciones").select("*").order("emitida_at", { ascending: false });
      if (cursoId) q = q.eq("curso_id", cursoId);
      const { data } = await q;
      const certs = (data as Cert[]) ?? [];
      const uids = Array.from(new Set(certs.map((c) => c.user_id)));
      const { data: profs } = uids.length ? await sb.from("profiles").select("id,nombre,email").in("id", uids) : { data: [] };
      const m = new Map(((profs as { id: string; nombre: string; email: string }[]) ?? []).map((p) => [p.id, p]));
      setFilas(certs.map((c) => ({ ...c, nombre: m.get(c.user_id)?.nombre ?? "—", email: m.get(c.user_id)?.email ?? "" })));
      setLoading(false);
    })();
  }, [cursoId]);

  const cursoMap = new Map(cursos.map((c) => [c.id, c.titulo]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-[#242424]/55">Curso</span>
        <select value={cursoId} onChange={(e) => setCursoId(e.target.value)} className="rounded border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs">
          <option value="">Todos</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-[#242424]/55">{filas.length} certificados</span>
      </div>

      <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-[#F7F9FB] text-[10px] uppercase text-[#242424]/55">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Usuario</th>
              <th className="text-left px-3 py-2">Curso</th>
              <th className="text-right px-3 py-2">Nota</th>
              <th className="text-left px-3 py-2">Emitido</th>
              <th className="text-center px-3 py-2">Ver</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-[#242424]/50">Cargando…</td></tr>}
            {!loading && filas.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-[#242424]/50">Aún no se ha emitido ningún certificado.</td></tr>}
            {filas.map((c) => (
              <tr key={c.id} className="border-t border-[#E3E7EE]">
                <td className="px-3 py-2 font-mono text-[11px] text-[#445DA3]"><Award size={11} className="inline mr-1" />{c.codigo}</td>
                <td className="px-3 py-2"><div className="font-medium text-[#0A1226]">{c.nombre}</div><div className="text-[10px] text-[#242424]/55">{c.email}</div></td>
                <td className="px-3 py-2">{cursoMap.get(c.curso_id) ?? "—"}</td>
                <td className="px-3 py-2 text-right font-semibold">{c.nota_final}%</td>
                <td className="px-3 py-2 text-[#242424]/65">{new Date(c.emitida_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-center">
                  <Link to="/academia/certificados/$codigo" params={{ codigo: c.codigo }} className="inline-flex items-center gap-1 text-[#445DA3]"><ExternalLink size={11} /></Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
