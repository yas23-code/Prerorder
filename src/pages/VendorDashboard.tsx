import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  UtensilsCrossed,
  LogOut,
  CheckCircle2,
  Clock,
  Plus,
  Package,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

type Order = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  pickup_code: string;
  profiles: {
    name: string;
  };
  order_items: {
    quantity: number;
    menu_items: {
      name: string;
    };
  }[];
};

const VendorDashboard = () => {
  const { user, userRole, signOut, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [canteen, setCanteen] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.justRegistered;

  // --- Redirect non-vendors ---
  useEffect(() => {
    if (!authLoading && (!user || userRole !== "vendor")) {
      navigate("/auth");
    }
  }, [user, userRole, authLoading]);

  // --- Ensure Vendor Has Canteen ---
  useEffect(() => {
    const checkCanteen = async () => {
      if (justRegistered) return;

      if (user && userRole === "vendor") {
        const { data } = await supabase
          .from("canteens")
          .select("id")
          .eq("vendor_id", user.id)
          .maybeSingle();

        if (!data) navigate("/vendor/register");
      }
    };
    checkCanteen();
  }, [user, userRole]);

  // --- Fetch Orders + Realtime Subscription ---
  useEffect(() => {
    if (user && userRole === "vendor") {
      fetchCanteenAndOrders();
    }
  }, [user, userRole]);

  useEffect(() => {
    if (canteen?.id) {
      const cleanup = subscribeToOrders();
      return cleanup;
    }
  }, [canteen]);

  const fetchCanteenAndOrders = async () => {
    if (!user) return;

    try {
      const { data: canteenData } = await supabase
        .from("canteens")
        .select("*")
        .eq("vendor_id", user.id)
        .single();

      setCanteen(canteenData);

      const { data: ordersData } = await supabase
        .from("orders")
        .select(
          `
            *,
            order_items (
                quantity,
                menu_items (name)
            )
          `
        )
        .eq("canteen_id", canteenData.id)
        .order("created_at", { ascending: false });

      const studentIds = [
        ...new Set(ordersData.map((o: any) => o.student_id)),
      ];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", studentIds);

      const profilesMap = new Map(
        profilesData?.map((p) => [p.id, p]) || []
      );

      const withProfiles = ordersData.map((o: any) => ({
        ...o,
        profiles: profilesMap.get(o.student_id) || { name: "Unknown" },
      }));

      setOrders(withProfiles);
    } catch (error) {
      console.error("Error loading vendor dashboard:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // --- REALTIME: Vendor Receives New Orders Instantly ---
  // --- REALTIME: Vendor Receives New Orders Instantly ---
const subscribeToOrders = () => {
  if (!canteen?.id) return;

  const channel = supabase
    .channel(`vendor-orders-${canteen.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",                    // FIX: listen for INSERT + UPDATE
        schema: "public",
        table: "orders",
        filter: `canteen_id=eq.${canteen.id}`, // FIX: ensures only this vendor’s orders
      },
      (payload) => {
        const eventType = payload.eventType;

        // --- NEW ORDER ---
        if (eventType === "INSERT") {
          toast.success("🛒 New order received!");
        }

        // --- ORDER STATUS CHANGED ---
        if (eventType === "UPDATE") {
          const oldStatus = payload.old.status;
          const newStatus = payload.new.status;

          // From ready → completed OR pending → ready
          if (oldStatus !== newStatus) {
            toast.info(`Order #${payload.new.pickup_code} updated → ${newStatus}`);
          }
        }

        // Refresh list
        fetchCanteenAndOrders();
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};


  // --- Mark Ready ---
  const markOrderReady = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    try {
      await supabase
        .from("orders")
        .update({ status: "ready" })
        .eq("id", orderId);

      toast.success("Order marked as ready!");
      fetchCanteenAndOrders();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // --- Mark Completed ---
  const markOrderCompleted = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    try {
      await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", orderId);

      toast.success("Order completed!");
      fetchCanteenAndOrders();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filterOrders = (list: Order[]) =>
    !searchTerm
      ? list
      : list.filter((o) =>
          o.pickup_code
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
        );

  const pending = filterOrders(orders.filter((o) => o.status === "pending"));
  const ready = filterOrders(orders.filter((o) => o.status === "ready"));
  const completed = filterOrders(
    orders.filter((o) => o.status === "completed")
  );

  if (loading || authLoading)
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* HEADER */}
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-6 w-6 text-accent" />
              <h1 className="text-2xl font-bold">{canteen.name}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {canteen.location}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => navigate("/vendor/menu")}>
              <Plus className="h-4 w-4 mr-2" />
              Manage Menu
            </Button>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by pickup code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending">
              <Clock className="h-4 w-4 mr-2" /> Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="ready">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Ready ({ready.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              <Package className="h-4 w-4 mr-2" /> Completed ({completed.length})
            </TabsTrigger>
          </TabsList>

          {/* PENDING ORDERS */}
          <TabsContent value="pending">
            {pending.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  No pending orders
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pending.map((o) => (
                  <Card key={o.id}>
                    <CardHeader>
                      <div className="flex justify-between">
                        <CardTitle>
                          {o.profiles.name}{" "}
                          <span className="text-sm font-mono text-primary">
                            #{o.pickup_code}
                          </span>
                        </CardTitle>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                      <CardDescription>₹{o.total_amount}</CardDescription>
                    </CardHeader>

                    <CardContent>
                      {o.order_items.map((i, idx) => (
                        <p key={idx}>
                          {i.quantity}× {i.menu_items.name}
                        </p>
                      ))}

                      <Button
                        className="w-full mt-4"
                        onClick={() => markOrderReady(o.id)}
                        disabled={updatingOrderId === o.id}
                      >
                        Mark Ready
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* READY ORDERS */}
          <TabsContent value="ready">
            {ready.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  No ready orders
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ready.map((o) => (
                  <Card key={o.id}>
                    <CardHeader>
                      <div className="flex justify-between">
                        <CardTitle>
                          {o.profiles.name}{" "}
                          <span className="text-sm font-mono text-primary">
                            #{o.pickup_code}
                          </span>
                        </CardTitle>
                        <Badge className="bg-green-600 text-white">
                          Ready
                        </Badge>
                      </div>
                      <CardDescription>₹{o.total_amount}</CardDescription>
                    </CardHeader>

                    <CardContent>
                      {o.order_items.map((i, idx) => (
                        <p key={idx}>
                          {i.quantity}× {i.menu_items.name}
                        </p>
                      ))}

                      <Button
                        className="w-full mt-4"
                        onClick={() => markOrderCompleted(o.id)}
                        disabled={updatingOrderId === o.id}
                      >
                        Mark Completed
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* COMPLETED ORDERS */}
          <TabsContent value="completed">
            {completed.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  No completed orders
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completed.map((o) => (
                  <Card key={o.id}>
                    <CardHeader>
                      <div className="flex justify-between">
                        <CardTitle>{o.profiles.name}</CardTitle>
                        <Badge className="bg-green-600 text-white">
                          Completed
                        </Badge>
                      </div>
                      <CardDescription>₹{o.total_amount}</CardDescription>
                    </CardHeader>

                    <CardContent>
                      {o.order_items.map((i, idx) => (
                        <p key={idx}>
                          {i.quantity}× {i.menu_items.name}
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default VendorDashboard;
