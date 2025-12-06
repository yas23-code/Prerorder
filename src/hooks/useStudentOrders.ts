import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useStudentOrders = (studentId: string) => {
  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel("student-orders")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          if (payload.new?.status === "ready") {
            toast.success("🍱 Your food is ready!");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);
};
