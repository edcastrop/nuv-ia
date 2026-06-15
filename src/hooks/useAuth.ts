import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface State {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useAuth(): State {
  const [state, setState] = useState<State>({ session: null, user: null, loading: true });

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      setState({ session, user: session?.user ?? null, loading: false });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    }).catch(() => {
      if (!active) return;
      setState({ session: null, user: null, loading: false });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
