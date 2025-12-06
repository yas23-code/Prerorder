import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2, QrCode } from "lucide-react";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  category_id?: string | null;
};

type CartItem = MenuItem & { quantity: number };

const CartPage = () => {
  const params = useParams();
  const canteenId = params.id || "";  // FIX HERE
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [placing, setPlacing] = useState(false);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [showPickupDialog, setShowPickupDialog] = useState(false);

  const cartKey = `canteen_cart_${canteenId}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(cartKey);
      if (stored) setCart(JSON.parse(stored));
    } catch {}
  }, [cartKey]);

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {}
  }, [cart, cartKey]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  const clearItemFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // ==========================
  // PLACE ORDER (FINAL WORKING VERSION)
  // ==========================
  const placeOrder = async () => {
    if (!user) {
      console.error("No user found.");
      return;
    }

    if (!canteenId) {
      console.error("Invalid canteenId");
      return;
    }

    if (cart.length === 0) {
      console.error("Cart empty");
      return;
    }

    setPlacing(true);

    try {
      console.log("Creating order in Supabase...");

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          student_id: user.id,
          canteen_id: canteenId,   // FIXED (no String())
          total_amount: totalAmount,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order error:", orderError);
        throw orderError;
      }

      console.log("Order created:", orderData);

      const itemsPayload = cart.map((item) => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemErr } = await supabase
        .from("order_items")
        .insert(itemsPayload);

      if (itemErr) {
        console.error("Order items error:", itemErr);
        throw itemErr;
      }

      // PICKUP CODE (works because database trigger is fixed)
      setPickupCode(orderData.pickup_code);
      setShowPickupDialog(true);

      localStorage.removeItem(cartKey);
      setCart([]);

      console.log("Order success, pickup code →", orderData.pickup_code);

      supabase.channel("vendor-orders").send({
        type: "broadcast",
        event: "new-order",
        payload: { canteen_id: canteenId },
      });

    } catch (err) {
      console.error("Place Order FAILED:", err);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(`/student/canteen/${canteenId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <ShoppingCart className="h-7 w-7" />
          <span className="text-2xl font-bold">Your Cart</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Your Cart</CardTitle>
          </CardHeader>

          <CardContent>
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground">Cart is empty</p>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ₹{item.price} × {item.quantity}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" onClick={() => removeFromCart(item.id)}>
                        <Minus />
                      </Button>
                      <span>{item.quantity}</span>
                      <Button size="icon" variant="outline" onClick={() => addToCart(item)}>
                        <Plus />
                      </Button>
                      <Button size="icon" variant="destructive" onClick={() => clearItemFromCart(item.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator />
                <div className="flex justify-between mt-4 text-lg font-bold">
                  <span>Total</span>
                  <span>₹{totalAmount}</span>
                </div>

                <Button className="w-full mt-4" disabled={placing} onClick={placeOrder}>
                  {placing ? "Placing Order..." : "Place Order"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {showPickupDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[380px]">
            <div className="flex gap-2 items-center mb-3">
              <QrCode className="h-5 w-5" />
              <span className="font-semibold">Order Placed Successfully!</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Use this pickup code to collect your food:
            </p>
            <p className="text-5xl font-bold text-primary text-center">{pickupCode}</p>

            <Button className="w-full mt-4"
              onClick={() => {
                setShowPickupDialog(false);
                navigate(`/student/canteen/${canteenId}`);
              }}>
              Got it!
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
