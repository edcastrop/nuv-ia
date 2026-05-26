import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initialsOf } from "@/lib/profile";

const AZUL = "#445DA3";
const VERDE = "#84B98F";

const SIZE_MAP = {
  xs: { w: 24, font: 9 },
  sm: { w: 32, font: 11 },
  md: { w: 40, font: 13 },
  lg: { w: 56, font: 18 },
  xl: { w: 96, font: 28 },
} as const;

type Size = keyof typeof SIZE_MAP;

interface Props {
  userId?: string | null;
  url?: string | null;
  name?: string | null;
  email?: string | null;
  size?: Size;
  ring?: boolean;
  className?: string;
}

// Light cache so multiple bubbles don't refetch
const cache = new Map<string, { url: string | null; name: string | null; email: string | null }>();

export function UserAvatar({ userId, url, name, email, size = "md", ring = false, className = "" }: Props) {
  const [resolved, setResolved] = useState<{ url: string | null; name: string | null; email: string | null }>(
    { url: url ?? null, name: name ?? null, email: email ?? null },
  );

  useEffect(() => {
    if (url !== undefined || !userId) return;
    if (cache.has(userId)) {
      setResolved(cache.get(userId)!);
      return;
    }
    let cancel = false;
    supabase
      .from("profiles" as never)
      .select("avatar_url,nombre,email")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel || !data) return;
        const d = data as unknown as { avatar_url: string | null; nombre: string | null; email: string | null };
        const v = { url: d.avatar_url, name: d.nombre, email: d.email };
        cache.set(userId, v);
        setResolved(v);
      });
    return () => { cancel = true; };
  }, [userId, url]);

  const dim = SIZE_MAP[size];
  const initials = initialsOf(resolved.name ?? name, resolved.email ?? email);
  const finalUrl = url !== undefined ? url : resolved.url;

  const baseStyle: React.CSSProperties = {
    width: dim.w,
    height: dim.w,
    fontSize: dim.font,
    ...(ring
      ? {
          backgroundImage: `linear-gradient(#0A1226, #0A1226), linear-gradient(135deg, ${AZUL}, ${VERDE})`,
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          border: "2px solid transparent",
        }
      : { background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }),
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden text-white font-bold shrink-0 ${className}`}
      style={baseStyle}
    >
      {finalUrl ? (
        <img src={finalUrl} alt={resolved.name ?? name ?? "avatar"} className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

export function clearAvatarCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}
