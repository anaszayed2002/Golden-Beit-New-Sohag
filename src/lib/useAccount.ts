"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabase";
import type { Profile } from "./types";

type State = { loading: boolean; user: User | null; profile: Profile | null };

export function useAccount() {
  const [state, setState] = useState<State>({ loading: true, user: null, profile: null });

  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;
    const load = async (user: User | null) => {
      if (!user) {
        if (alive) setState({ loading: false, user: null, profile: null });
        return;
      }
      const { data } = await sb.from("profiles").select("id,full_name,phone,role").eq("id", user.id).maybeSingle();
      if (alive) setState({ loading: false, user, profile: (data as Profile) ?? null });
    };
    sb.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    // Supabase warns against awaiting its own calls inside this callback, so defer.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session?.user ?? null), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
