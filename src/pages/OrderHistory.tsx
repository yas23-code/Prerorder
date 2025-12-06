import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Order = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  pickup_code: string;
  canteens: {
    name: string;
    location: string;
  };
  order_items: {
    quantity: number;
    menu_items: {
      name: string;
    };
  }[];
};

const OrderHistory = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [canteenFilter, setCanteenFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || userRole !== "student")) {
      navigate("/auth");
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && userRole === "student") {
      fetchOrders();
      fetchCanteens();
    }
  }, [user, userRole]);

  useEffect(() => {
    applyFilters();
  }, [orders, statusFilter, canteenFilter, dateFilter]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          canteens (
            name,
            location
          ),
          order_items (
            quantity,
            menu_items (name)
          )
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
      setFilteredOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load order history");
    } finally {
      setLoading(false);
    }
  };

  const fetchCanteens = async () => {
    try {
      const { data, error } = await supabase
        .from("canteens")
        .select("id, name");

      if (error) throw error;
      setCanteens(data || []);
    } catch (error) {
      console.error("Error fetching canteens:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...orders];

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    if (canteenFilter !== "all") {
      filtered = filtered.filter((order) => {
        const orderCanteenId = orders.find((o) => o.id === order.id);
        return orderCanteenId;
      });
    }

    if (dateFilter) {
      filtered = filtered.filter((order) => {
        const orderDate = format(new Date(order.created_at), "yyyy-MM-dd");
        return orderDate === dateFilter;
      });
    }

    setFilteredOrders(filtered);
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setCanteenFilter("all");
    setDateFilter("");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="animate-pulse text-lg">Loading order history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="container mx-auto max-w-5xl py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/student")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-4xl font-bold mb-2">Order History</h1>
          <p className="text-muted-foreground">View and filter your past orders</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter orders by status, canteen, or date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Canteen</Label>
                <Select value={canteenFilter} onValueChange={setCanteenFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All canteens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Canteens</SelectItem>
                    {canteens.map((canteen) => (
                      <SelectItem key={canteen.id} value={canteen.id}>
                        {canteen.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={resetFilters}>
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {orders.length === 0
                  ? "No orders found. Start ordering from your favorite canteens!"
                  : "No orders match your filters. Try adjusting the filters above."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold">
                          {order.canteens.name}
                        </h3>
                        <Badge
                          variant={
                            order.status === "ready" ? "default" : "secondary"
                          }
                        >
                          {order.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {order.canteens.location}
                      </div>

                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {format(new Date(order.created_at), "PPP p")}
                      </div>

                      <div className="mt-3">
                        <p className="text-sm font-medium mb-1">Items:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {order.order_items.map((item, idx) => (
                            <li key={idx}>
                              {item.quantity}x {item.menu_items.name}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {(order.status === "pending" || order.status === "ready") && order.pickup_code && (
                        <div className="mt-3 bg-primary/10 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Pickup Code</p>
                          <p className="text-2xl font-bold font-mono text-primary">
                            {order.pickup_code}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="text-2xl font-bold text-primary">
                        ₹{order.total_amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
