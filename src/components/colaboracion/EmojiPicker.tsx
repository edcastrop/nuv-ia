import { useEffect, useRef, useState } from "react";

const CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Sonrisas",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕"],
  },
  {
    label: "Gestos",
    emojis: ["👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤝","👏","🙌","🙏","💪","🦾","👀","👁️","👄","🧠","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"],
  },
  {
    label: "Objetos",
    emojis: ["✅","☑️","✔️","❌","⭕","❗","❓","‼️","⚠️","🔔","🔕","📌","📍","📎","🖇️","📏","📐","✂️","🗃️","🗂️","📂","📁","📅","📆","🗓️","📊","📈","📉","📋","📝","✏️","🖊️","🖋️","🔍","🔎","💡","🔦","💻","🖥️","⌨️","🖱️","📱","📞","☎️","📧","📨","📩","💬","💭","🗯️","💰","💵","💳","🧾","🏦","🏢","🏠","⏰","⏳","⌛","🎯","🚀","⭐","🌟","✨","🔥","💯"],
  },
];

interface Props {
  onPick: (emoji: string) => void;
  align?: "left" | "right";
}

export function EmojiPickerPopover({ onPick, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border p-2 transition hover:bg-white/[0.06]"
        style={{ borderColor: "var(--nuvia-border)", background: "rgba(255,255,255,0.03)" }}
        title="Insertar emoji"
      >
        <span className="text-base leading-none">😊</span>
      </button>
      {open && (
        <div
          className={`absolute bottom-12 ${align === "right" ? "right-0" : "left-0"} z-50 w-[300px] border rounded-xl shadow-lg overflow-hidden`}
          style={{ background: "var(--nuvia-bg-tertiary)", borderColor: "var(--nuvia-border)", boxShadow: "var(--nuvia-shadow-md)" }}
        >
          <div className="flex border-b" style={{ borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-secondary)" }}>
            {CATEGORIES.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setCat(i)}
                className="flex-1 px-2 py-2 text-[11px] font-medium border-b-2"
                style={cat === i
                  ? { color: "var(--nuvia-accent-green)", borderColor: "var(--nuvia-accent-green)", background: "rgba(255,255,255,0.05)" }
                  : { color: "var(--nuvia-text-secondary)", borderColor: "transparent" }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="max-h-[220px] overflow-y-auto p-2 grid grid-cols-8 gap-1">
            {CATEGORIES[cat].emojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { onPick(e); }}
                className="text-xl rounded p-1 leading-none transition hover:bg-white/[0.06]"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
