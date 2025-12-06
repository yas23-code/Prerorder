import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const processOAuth = async () => {
      try {
        // 1) Supabase exchanges the Google "code" for a session automatically
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);
          navigate("/auth");
          return;
        }

        const session = data.session;

        if (!session?.user) {
          console.log("No user session found.");
          navigate("/auth");
          return;
        }

        const userId = session.user.id;

        // 2) Check IF role exists
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        let role = roleRow?.role;

        // 3) If Google user logs in FIRST time → Assign default "student"
        if (!role) {
          const { data: newRole } = await supabase
            .from("user_roles")
            .insert({
              user_id: userId,
              role: "student",
            })
            .select()
            .single();

          role = newRole?.role ?? "student";
        }

        // 4) Redirect properly
        if (role === "vendor") navigate("/vendor", { replace: true });
        else navigate("/student", { replace: true });
      } catch (err) {
        console.error("OAuth callback error:", err);
        navigate("/auth");
      }
    };

    processOAuth();
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "200px" }}>
      <h2>Loading...</h2>
    </div>
  );
}
