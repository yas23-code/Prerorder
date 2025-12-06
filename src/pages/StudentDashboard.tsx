import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UtensilsCrossed,
  MapPin,
  LogOut,
  Bell,
  BellOff,
  History,
  Star,
  ChevronRight,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  requestNotificationPermission,
  showOrderReadyNotification,
} from "@/utils/notifications";

type Canteen = {
  id: string;
  name: string;
  location: string;
  image_url: string | null;
};

type Order = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  pickup_code: string;
  canteens: {
    name: string;
  };
};

const StudentDashboard = () => {
  const { user, userRole, signOut, loading: authLoading } = useAuth();
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  // --- Redirect non-students ---
  useEffect(() => {
    if (!authLoading && (!user || userRole !== "student")) {
      navigate("/auth");
    }
  }, [user, userRole, authLoading]);

  // --- Check notification permission ---
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  // --- Initial Fetch ---
  useEffect(() => {
    if (user && userRole === "student") {
      fetchCanteens();
      fetchOrders();
    }
  }, [user, userRole]);

  // --- Realtime Subscription ---
  useEffect(() => {
    if (user) {
      const cleanup = subscribeToOrderUpdates();
      return cleanup;
    }
  }, [user, notificationsEnabled]);

  // --- Fetch Canteens ---
  const fetchCanteens = async () => {
    try {
      const { data } = await supabase
        .from("canteens")
        .select("*")
        .order("name");

      setCanteens(data || []);
    } finally {
      setLoading(false);
    }
  };

  // --- Fetch Orders ---
  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, canteens(name)")
      .eq("student_id", user!.id)
      .order("created_at", { ascending: false });

    setOrders(data || []);
  };

  // --- REALTIME: Student gets notified when order becomes READY ---
const subscribeToOrderUpdates = () => {
  if (!user) return;

  const channel = supabase
    .channel(`student-orders-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `student_id=eq.${user.id}`, // IMPORTANT FIX
      },
      async (payload) => {
        const prevStatus = payload.old.status;
        const newStatus = payload.new.status;

        // Notify only when order becomes READY
        if (prevStatus !== "ready" && newStatus === "ready") {
          console.log("🔔 Order ready:", payload.new);

          // Fetch canteen name for notification
          const { data: canteen } = await supabase
            .from("canteens")
            .select("name")
            .eq("id", payload.new.canteen_id)
            .single();

          // Toast popup
          toast.success("🍱 Your order is ready!");

          // Browser notification
          if (notificationsEnabled && canteen) {
            showOrderReadyNotification({
              canteenName: canteen.name,
              totalAmount: payload.new.total_amount,
            });
          }

          // Refresh UI
          fetchOrders();
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};


  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);

      if (granted) toast.success("Notifications enabled!");
      else toast.error("Permission denied.");
    } else {
      toast.info("Disable notifications from browser settings.");
    }
  };

  if (loading || authLoading)
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // --- UI ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* HEADER */}
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-accent" />
            <h1 className="text-2xl font-bold">CanteenGo</h1>
          </div>

          <div className="flex gap-2">
            <Button
              variant={notificationsEnabled ? "default" : "outline"}
              size="sm"
              onClick={handleNotificationToggle}
            >
              {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Button>

            <Button variant="outline" size="sm" onClick={() => navigate("/student/orders")}>
              <History className="h-4 w-4 mr-2" /> Orders
            </Button>

            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Search */}
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Search canteen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-full h-12 px-5 shadow-sm"
          />
          <Button className="h-12 px-6 rounded-full">Search</Button>
        </div>

        {/* CANTEENS LIST */}
        <div className="space-y-4">
          {canteens
            .filter((c) =>
              c.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((c, idx) => (
              <Link key={c.id} to={`/student/canteen/${c.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex gap-4 p-4">
                    {/* Canteen image */}
                    <div className="relative w-56 h-36 rounded-xl overflow-hidden">
                      {c.image_url ? (
                        <img src={c.image_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <UtensilsCrossed className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}

                      <div className="absolute top-2 left-2">
                        <Badge className="bg-orange-500 text-white">Popular</Badge>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold">{c.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-4 w-4" /> {c.location}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-primary" />
                          <span className="font-medium">4.7</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          <span className="font-medium">Open</span>
                        </div>

                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>10–15 min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
