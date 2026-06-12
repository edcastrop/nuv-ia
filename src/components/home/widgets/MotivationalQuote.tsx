import { useEffect, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

interface Quote {
  text: string;
  author: string;
  category: "estoico" | "ventas" | "legado";
}

const QUOTES: Quote[] = [
  // Estoicos
  { text: "No es lo que te sucede, sino cómo reaccionas ante ello lo que importa.", author: "Epicteto", category: "estoico" },
  { text: "Tienes poder sobre tu mente, no sobre los acontecimientos externos. Date cuenta de esto, y encontrarás la fuerza.", author: "Marco Aurelio", category: "estoico" },
  { text: "El obstáculo en el camino se convierte en el camino. Dentro de cada obstáculo hay una oportunidad.", author: "Marco Aurelio", category: "estoico" },
  { text: "La dificultad fortalece la mente, como el trabajo al cuerpo.", author: "Séneca", category: "estoico" },
  { text: "Mientras esperamos vivir, la vida pasa.", author: "Séneca", category: "estoico" },
  { text: "Primero di lo que serás; luego haz lo que tengas que hacer.", author: "Epicteto", category: "estoico" },
  { text: "El hombre que ha gastado su vida en pequeñas cosas se vuelve incapaz de las grandes.", author: "Séneca", category: "estoico" },
  // Leyendas en ventas
  { text: "Las ventas son contingentes a la actitud del vendedor, no a la actitud del prospecto.", author: "W. Clement Stone", category: "ventas" },
  { text: "Los grandes vendedores son relacionadores que genuinamente se interesan en resolver problemas.", author: "Jeffrey Gitomer", category: "ventas" },
  { text: "La gente no compra por razones lógicas. Compran por razones emocionales.", author: "Zig Ziglar", category: "ventas" },
  { text: "Deja de venderles y empieza a ayudarles.", author: "Zig Ziglar", category: "ventas" },
  { text: "Tu actitud, no tu aptitud, determinará tu altitud.", author: "Zig Ziglar", category: "ventas" },
  { text: "El éxito en ventas se trata de ayudar a otros a obtener lo que quieren.", author: "Brian Tracy", category: "ventas" },
  { text: "Acércate a cada cliente con la idea de ayudarle a resolver un problema o lograr un objetivo, no de vender un producto.", author: "Brian Tracy", category: "ventas" },
  // Legados
  { text: "La única forma de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs — Apple", category: "legado" },
  { text: "Si no estás dispuesto a arriesgarte por lo ordinario, tendrás que conformarte con lo ordinario.", author: "Jim Rohn", category: "legado" },
  { text: "Tu marca es lo que la gente dice de ti cuando no estás en la habitación.", author: "Jeff Bezos — Amazon", category: "legado" },
  { text: "Si no construyes tu sueño, alguien te contratará para construir el suyo.", author: "Tony Gaskins", category: "legado" },
  { text: "La excelencia no es un acto, sino un hábito.", author: "Aristóteles", category: "legado" },
  { text: "Innovar es lo que distingue a un líder de un seguidor.", author: "Steve Jobs — Apple", category: "legado" },
  { text: "Construye una empresa que tus clientes amen y tus competidores teman.", author: "Howard Schultz — Starbucks", category: "legado" },
  { text: "El cliente más insatisfecho es tu mejor fuente de aprendizaje.", author: "Bill Gates — Microsoft", category: "legado" },
];

const CATEGORY_LABEL: Record<Quote["category"], string> = {
  estoico: "Filosofía estoica",
  ventas: "Leyenda en ventas",
  legado: "Legado empresarial",
};

function pickQuote(): Quote {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

export function MotivationalQuote() {
  const [quote, setQuote] = useState<Quote>(() => pickQuote());

  useEffect(() => {
    const id = setInterval(() => setQuote(pickQuote()), 22000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      className="relative overflow-hidden rounded-[var(--nuvia-radius-xl)] px-6 py-5 md:px-7 md:py-6 animate-fade-in"
      style={{
        background:
          "linear-gradient(135deg, rgba(132,185,143,0.08) 0%, rgba(68,93,163,0.10) 100%)",
        border: "1px solid rgba(238,245,255,0.10)",
        backdropFilter: "blur(28px) saturate(150%)",
        WebkitBackdropFilter: "blur(28px) saturate(150%)",
        boxShadow: "0 12px 40px -18px rgba(0,0,0,0.55)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(238,245,255,0.35), transparent)" }}
      />
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 grid h-10 w-10 place-items-center rounded-xl"
          style={{
            background: "rgba(132,185,143,0.14)",
            border: "1px solid color-mix(in oklab, var(--nuvia-accent-green) 24%, transparent)",
            color: "var(--nuvia-accent-green)",
          }}
        >
          <Sparkles size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: "var(--nuvia-text-muted)" }}
          >
            {CATEGORY_LABEL[quote.category]}
          </div>
          <p
            key={quote.text}
            className="mt-1.5 text-[15px] md:text-[16px] leading-relaxed animate-fade-in"
            style={{ color: "var(--nuvia-text-primary)", fontStyle: "italic" }}
          >
            “{quote.text}”
          </p>
          <div
            className="mt-2 text-[12px] font-medium"
            style={{ color: "var(--nuvia-text-secondary)" }}
          >
            — {quote.author}
          </div>
        </div>
        <button
          onClick={() => setQuote(pickQuote())}
          className="shrink-0 grid h-8 w-8 place-items-center rounded-lg transition-all hover:scale-105"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-muted)",
          }}
          title="Otra frase"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </section>
  );
}
