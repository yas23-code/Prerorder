import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

export type UserRole = "student" | "vendor" | null;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch Role from DB
  const fetchRole = async (id: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", id)
      .maybeSingle();

    const role = (data?.role as UserRole) ?? null;
    setUserRole(role);
    return role;
  };

  // Listen to auth state (refresh / reopen / reload)
  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 2000);
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        const u = session?.user ?? null;
        setUser(u);

        if (u) await fetchRole(u.id);
        else setUserRole(null);
      }
    );

    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setSession(data.session);

      if (u) await fetchRole(u.id);
      setLoading(false);
      clearTimeout(fallback);
    });

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  // SIGN UP (Stores role inside DB)
  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: "student" | "vendor"
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role,
        });
        setUserRole(role);
      }

      toast.success("Account created!");
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    }
  };

  // SIGN IN (Fetch role immediately)
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (data.user) {
        await fetchRole(data.user.id); // <-- Fetch role after login
      }

      toast.success("Signed in!");
      return true;
    } catch (err: any) {
      toast.error(err.message || "Login failed");
      return false;
    }
  };

  // LOGOUT
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    navigate("/auth");
  };

  return {
    user,
    session,
    userRole,
    loading,
    signUp,
    signIn,
    signOut,
  };
};
