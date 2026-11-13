import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/lib/ledger-client";

export type AuthState = {
  user: User | null;
  displayName: string;
  role: string | null;
  disabled: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  displayName: "",
  role: null,
  disabled: false,
  loading: true,
});

export function AuthProvider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        if (event === "SIGNED_OUT") {
          void queryClient.cancelQueries().then(() => queryClient.clear());
        } else {
          void queryClient.invalidateQueries();
        }
        void router.invalidate();
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  useEffect(() => {
    let active = true;
    setDisplayName("");
    setRole(null);
    setDisabled(false);
    if (!user) return;

    void Promise.all([
      supabase.from("ledger_profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase.from("ledger_user_roles").select("role").eq("user_id", user.id),
      supabase.from("ledger_account_status").select("disabled").eq("user_id", user.id).maybeSingle(),
    ]).then(([profile, roles, status]) => {
      if (!active) return;
      setDisplayName(profile.data?.display_name ?? "");
      setRole(roles.data?.some((item) => item.role === "admin") ? "admin" : "user");
      setDisabled(status.data?.disabled ?? false);
    });

    return () => {
      active = false;
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, displayName, role, disabled, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}