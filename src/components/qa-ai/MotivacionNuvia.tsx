import { useEffect, useMemo, useState } from "react";
import { Sparkles, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mensaje personalizado de NUVIA al analista.
 * - Lo saluda por su primer nombre.
 * - Cada render elige aleatoriamente una analogía histórica distinta (rotación
 *   por auditoría usando el id como semilla para variar entre dictámenes).
 * - Nunca usa "refinanciación" ni "reestructuración" — solo "optimización".
 */

type Cita = {
  protagonista: string;
  hito: string;
  analogia: string;
  cierre: string;
};

const CITAS: Cita[] = [
  {
    protagonista: "Steve Jobs",
    hito: "presentó el primer iPhone tras meses revisando cada detalle hasta el último píxel",
    analogia: "Tú estás haciendo lo mismo: cada cifra que validas hoy es un píxel del crédito que entregarás impecable mañana.",
    cierre: "Cierra este caso como si fuera la keynote de tu carrera.",
  },
  {
    protagonista: "Marie Curie",
    hito: "aisló el radio destilando toneladas de mineral, una y otra vez, hasta que la matemática le dio la razón",
    analogia: "Tu trabajo con este extracto es igual: depurar el ruido hasta encontrar la verdad financiera del cliente.",
    cierre: "No bajes el ritmo. La precisión que aplicas hoy cambia la vida de una familia.",
  },
  {
    protagonista: "Nelson Mandela",
    hito: "negoció el fin del apartheid sentándose a leer cada cláusula antes de firmar la paz",
    analogia: "Tú haces lo mismo cuando lees el extracto línea por línea antes de proponer la optimización del crédito.",
    cierre: "Cierra este dictamen con la calma de quien sabe que está construyendo justicia financiera.",
  },
  {
    protagonista: "Leonardo da Vinci",
    hito: "tardaba años en cada obra porque medía la luz, la anatomía y la matemática antes de pintar",
    analogia: "Tu auditoría tiene esa misma paciencia: cada validación es un trazo que sostiene el resultado final.",
    cierre: "No entregues nada hasta que cuadre — el Mona Lisa de los analistas eres tú.",
  },
  {
    protagonista: "Ada Lovelace",
    hito: "escribió el primer algoritmo de la historia antes de que existiera la computadora que lo ejecutara",
    analogia: "Tú haces lo mismo con NUVIA: traduces números crudos en lógica que el banco aún no había visto.",
    cierre: "Cierra este caso como quien escribe la próxima línea de código del sector financiero.",
  },
  {
    protagonista: "Roger Federer",
    hito: "entrenaba cada golpe miles de veces para que el día del partido todo pareciera natural",
    analogia: "Tu repetición disciplinada en cada dictamen es lo que hace que la optimización del crédito salga limpia al primer intento.",
    cierre: "Saca este match como un Grand Slam. Saque, derecha, dictamen.",
  },
  {
    protagonista: "Walt Disney",
    hito: "imaginó Disneyland cuando todos le decían que era imposible, y la construyó hasta el último ladrillo",
    analogia: "Tú construyes el futuro del cliente cuando validas las proyecciones que el banco le entregará.",
    cierre: "Termina este caso con la magia de quien sabe que el cierre cuenta una historia.",
  },
  {
    protagonista: "Frida Kahlo",
    hito: "pintó su realidad con tal honestidad que cambió la forma en la que el mundo entendió el arte",
    analogia: "Tu dictamen tiene esa misma honestidad: muestras al cliente la realidad numérica sin maquillaje.",
    cierre: "Firma este dictamen como Frida firmaba sus obras: con verdad y sin miedo.",
  },
  {
    protagonista: "Gabriel García Márquez",
    hito: "reescribía cada párrafo decenas de veces hasta que el ritmo le sonara perfecto",
    analogia: "Tú haces lo mismo cuando recompruebas cada cifra antes de cerrar — el realismo mágico también vive en los números.",
    cierre: "Cierra este informe como quien termina un capítulo de Cien Años de Soledad.",
  },
  {
    protagonista: "Elon Musk en SpaceX",
    hito: "lanzó el Falcon Heavy después de tres fracasos públicos, sin parpadear",
    analogia: "Cada iteración tuya sobre este extracto es el mismo combustible: la próxima auditoría vuela más alto.",
    cierre: "Cierra este caso como un cohete reutilizable: limpio, preciso, listo para el siguiente.",
  },
  {
    protagonista: "Simón Bolívar",
    hito: "cruzó los Andes con tropas exhaustas porque sabía que del otro lado había libertad",
    analogia: "Tu cierre de este dictamen también es un cruce: del otro lado está la tranquilidad financiera del cliente.",
    cierre: "Avanza. La cordillera ya está atrás.",
  },
  {
    protagonista: "Lionel Messi",
    hito: "levantó la Copa del Mundo después de años de paciencia y partidos que parecían perdidos",
    analogia: "Tu disciplina en cada caso es la misma — el cierre maestro siempre llega cuando insistes con técnica.",
    cierre: "Cierra este dictamen como un penal en la final: con la cabeza fría y la firma segura.",
  },
];

function pickCita(seed: string): Cita {
  // Mezcla seed + minuto actual para variar entre recargas y entre auditorías.
  let h = 0;
  const k = `${seed}|${Math.floor(Date.now() / 60000)}`;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return CITAS[h % CITAS.length]!;
}

function primerNombre(full?: string | null, email?: string | null): string {
  const base = (full ?? "").trim().split(/\s+/)[0];
  if (base) return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  const local = (email ?? "").split("@")[0]?.split(/[.\-_]/)[0];
  if (local) return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
  return "Analista";
}

export function MotivacionNuvia({ seed }: { seed: string }) {
  const [nombre, setNombre] = useState<string>("Analista");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancel) return;
        const { data: prof } = await supabase
          .from("profiles" as never)
          .select("nombre")
          .eq("id", user.id)
          .maybeSingle();
        const n = (prof as { nombre?: string } | null)?.nombre ?? user.user_metadata?.full_name ?? null;
        if (!cancel) setNombre(primerNombre(n, user.email));
      } catch { /* noop */ }
    })();
    return () => { cancel = true; };
  }, []);

  const cita = useMemo(() => pickCita(seed), [seed]);

  return (
    <section
      className="relative overflow-hidden rounded-[var(--nuvia-radius-lg)] p-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(68,93,163,0.22) 0%, var(--nuvia-bg-tertiary) 55%, rgba(132,185,143,0.20) 100%)",
        border: "1px solid var(--nuvia-border)",
        color: "var(--nuvia-text-primary)",
        boxShadow: "0 18px 40px -24px rgba(68,93,163,0.55)",
      }}
    >
      {/* Glow aurora */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(132,185,143,0.55), transparent 60%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(68,93,163,0.55), transparent 60%)" }}
      />

      <div className="relative flex items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "rgba(132,185,143,0.18)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-accent-green)",
          }}
        >
          <Sparkles size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--nuvia-text-muted)" }}
          >
            NUVIA · Mensaje para el cierre
          </div>
          <p className="mt-1 text-[15px] leading-snug">
            <span className="font-semibold">{nombre}</span>, recuerda esto antes de cerrar:
          </p>

          <div
            className="mt-3 rounded-lg p-3"
            style={{
              background: "rgba(0,0,0,0.18)",
              border: "1px solid var(--nuvia-border)",
            }}
          >
            <div className="flex gap-2">
              <Quote size={14} className="shrink-0 mt-0.5" style={{ color: "var(--nuvia-accent-green)" }} />
              <div className="text-[13.5px] leading-relaxed" style={{ color: "var(--nuvia-text-primary)" }}>
                <p>
                  <strong>{cita.protagonista}</strong> {cita.hito}.
                </p>
                <p className="mt-1.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                  {cita.analogia}
                </p>
                <p
                  className="mt-2 font-semibold"
                  style={{
                    background: "linear-gradient(135deg, var(--nuvia-accent), var(--nuvia-accent-green))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {nombre}, {cita.cierre.charAt(0).toLowerCase() + cita.cierre.slice(1)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
