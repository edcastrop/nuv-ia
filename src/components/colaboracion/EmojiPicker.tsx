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
        className="rounded-lg border border-[#E3E7EE] p-2 hover:bg-[#F7F9FB]"
        title="Insertar emoji"
      >
        <span className="text-base leading-none">😊</span>
      </button>
      {open && (
        <div
          className={`absolute bottom-12 ${align === "right" ? "right-0" : "left-0"} z-50 w-[300px] bg-white border border-[#E3E7EE] rounded-xl shadow-lg overflow-hidden`}
        >
          <div className="flex border-b border-[#E3E7EE] bg-[#F7F9FB]">
            {CATEGORIES.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setCat(i)}
                className={`flex-1 px-2 py-2 text-[11px] font-medium ${cat === i ? "text-[#445DA3] border-b-2 border-[#445DA3] bg-white" : "text-[#242424]/60"}`}
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
                className="text-xl hover:bg-[#F2F5FB] rounded p-1 leading-none"
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
