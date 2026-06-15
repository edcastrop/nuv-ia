import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface State {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

function readCachedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { currentSession?: Session; session?: Session } | Session;
      const session = "access_token" in parsed ? parsed : (parsed.currentSession ?? parsed.session);
      if (session?.access_token && session.user) return session;
    }
  } catch {
    return null;
  }
  return null;
}

export function useAuth(): State {
  const [state, setState] = useState<State>(() => {
    const cached = readCachedSession();
    return { session: cached, user: cached?.user ?? null, loading: !cached };
  });

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      setState({ session, user: session?.user ?? null, loading: false });
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setState({ session: data.session, user: data.session?.user ?? null, loading: false });
      })
      .catch(() => {
        if (!active) return;
        setState({ session: null, user: null, loading: false });
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
