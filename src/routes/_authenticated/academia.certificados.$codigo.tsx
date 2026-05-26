import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, ArrowLeft, Printer } from "lucide-react";
import { getCertificacionByCodigo, type Certificacion } from "@/lib/academia";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/academia/certificados/$codigo")({
  component: CertificadoView,
  head: () => ({ meta: [{ title: "Certificado · Academia NUVEX" }] }),
});

function CertificadoView() {
  const { codigo } = useParams({ from: "/_authenticated/academia/certificados/$codigo" });
  const [cert, setCert] = useState<Certificacion | null>(null);
  const [cursoTitulo, setCursoTitulo] = useState<string>("");
  const [nombre, setNombre] = useState<string>("—");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const c = await getCertificacionByCodigo(codigo);
      setCert(c);
      if (c) {
        const sb = supabase as unknown as { from: (t: string) => any };
        const [{ data: curso }, { data: profile }] = await Promise.all([
          sb.from("academia_cursos").select("titulo").eq("id", c.curso_id).maybeSingle(),
          sb.from("profiles").select("nombre,email").eq("id", c.user_id).maybeSingle(),
        ]);
        if (curso) setCursoTitulo((curso as { titulo: string }).titulo);
        if (profile) setNombre((profile as { nombre?: string; email?: string }).nombre || (profile as { email?: string }).email || "—");
      }
      setLoading(false);
    })();
  }, [codigo]);

  if (loading) return <div className="p-12 text-center text-sm text-white/60" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>Cargando…</div>;
  if (!cert) return <div className="p-12 text-center text-sm text-white/70" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>Certificado no encontrado.</div>;

  return (
    <div className="relative min-h-[calc(100vh-92px)] p-8" style={{ background: "#050816" }}>
      <div className="mx-auto max-w-[1000px] space-y-5">
        <div className="flex items-center justify-between print:hidden">
          <Link to="/academia" className="inline-flex items-center gap-2 text-[12px] text-white/60 hover:text-white">
            <ArrowLeft size={14} /> Volver a la academia
          </Link>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[12px] font-semibold text-white hover:bg-white/15">
            <Printer size={13} /> Imprimir
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[28px] bg-white p-12 text-[#0A1226] shadow-2xl" style={{ border: "12px double #C9A84C" }}>
          <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full opacity-20" style={{ background: "#445DA3" }} />
          <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full opacity-20" style={{ background: "#84B98F" }} />

          <div className="relative text-center space-y-6">
            <Award size={56} style={{ color: "#C9A84C" }} className="mx-auto" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#445DA3]">Certificado interno NUVEX</div>
            <div className="text-[13px] uppercase tracking-wider text-[#0A1226]/60">Se otorga a</div>
            <h1 className="text-4xl font-semibold tracking-tight">{nombre}</h1>
            <div className="text-[13px] uppercase tracking-wider text-[#0A1226]/60">por haber completado y aprobado</div>
            <h2 className="text-2xl font-semibold" style={{ color: "#445DA3" }}>{cursoTitulo}</h2>
            <div className="text-[13px] text-[#0A1226]/70">con una nota final de <strong>{cert.nota_final}%</strong></div>

            <div className="pt-8 grid grid-cols-3 gap-6 text-[11px] uppercase tracking-wider text-[#0A1226]/60">
              <div>
                <div className="font-semibold text-[#0A1226]">{new Date(cert.emitida_at).toLocaleDateString()}</div>
                <div className="mt-1">Fecha emisión</div>
              </div>
              <div>
                <div className="font-semibold text-[#0A1226]">{cert.codigo}</div>
                <div className="mt-1">Código</div>
              </div>
              <div>
                <div className="font-semibold text-[#0A1226]">NUVEX · Finanzas Inteligentes</div>
                <div className="mt-1">Emitido por</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
