"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Google sign-in, app-wide. Reads stay open regardless of auth state (see
// supabase-schema.sql) — this only identifies who's asking, so the rest of
// the app can personalize the home screen and gate scoring/editing to the
// two players actually tied to a trip.

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
      // Supabase's own URL-fragment parsing has already run by the time this
      // resolves — scrub any leftover query/hash (tokens, or a stale
      // error=bad_oauth_state from an interrupted attempt) so it doesn't sit
      // exposed in the address bar/history, and so a retry can't pick it up
      // and compound onto it.
      if (window.location.search || window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    // Build a clean target from origin + pathname only — window.location.href
    // can carry a stale ?error=...#access_token=... from an interrupted prior
    // attempt, which would otherwise get echoed straight back as the return
    // address and pile new tokens on top of the old ones.
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
