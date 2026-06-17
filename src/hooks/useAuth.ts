import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface State {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

let lastKnownState: State | null = null;

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
    if (cached) {
      lastKnownState = { session: cached, user: cached.user, loading: false };
      return lastKnownState;
    }
    return lastKnownState ?? { session: null, user: null, loading: true };
  });

  useEffect(() => {
    let active = true;
    const safeSetState = (next: State) => {
      lastKnownState = next;
      setState(next);
    };
    const timeout = window.setTimeout(() => {
      if (!active) return;
      const cached = readCachedSession() ?? lastKnownState?.session ?? null;
      safeSetState({ session: cached, user: cached?.user ?? null, loading: false });
    }, 2500);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session) {
        safeSetState({ session, user: session.user, loading: false });
        return;
      }
      const cached = event === "SIGNED_OUT" ? null : readCachedSession();
      safeSetState({ session: cached, user: cached?.user ?? null, loading: false });
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const session = data.session ?? readCachedSession();
        safeSetState({ session, user: session?.user ?? null, loading: false });
      })
      .catch(() => {
        if (!active) return;
        const cached = readCachedSession();
        safeSetState({ session: cached, user: cached?.user ?? null, loading: false });
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
