import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingCart, Plus, QrCode, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  category_id?: string | null;
  image_url?: string | null;
};

type CartItem = MenuItem & { quantity: number };

const CategoryMenu = () => {
  const { id, categoryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  type Canteen = {
    id: string;
    name: string;
    location: string;
    vendor_id: string;
    image_url: string | null;
    created_at: string;
  };
  const [canteen, setCanteen] = useState<Canteen | null>(null);
  const [categoryName, setCategoryName] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [showPickupDialog, setShowPickupDialog] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<string>("");
  const [priceError, setPriceError] = useState<string>("");

  const isJuiceCategoryName = (name: string) => {
    const n = name.trim().toLowerCase().replace(/[_\s-]+/g, " ");
    return n.includes("juice") || n.includes("shake") || [
      "indian juice & shakes",
      "juices",
      "juice shakes",
      "juice_shakes",
    ].includes(n);
  };

  const getCanteenImageSrc = () => {
    const name = canteen?.name?.toLowerCase() || "";
    if (name.includes("tea man")) return "/Tea.jpeg";
    return canteen?.image_url || "";
  };

  useEffect(() => {
    if (id && categoryId) {
      fetchData();
    }
  }, [id, categoryId]);

  const cartKey = `canteen_cart_${id ?? "unknown"}`;
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

  const fetchData = async () => {
    try {
      const { data: canteenData } = await supabase
        .from("canteens")
        .select("*")
        .eq("id", id)
        .single();
      setCanteen(canteenData || null);

      const { data: catData } = await supabase
        .from("categories")
        .select("name")
        .eq("id", categoryId)
        .single();
      setCategoryName(catData?.name || "Category");

      const { data: menuData } = await supabase
        .from("menu_items")
        .select("*")
        .eq("canteen_id", id)
        .eq("category_id", categoryId)
        .eq("is_available", true)
        .order("name");
      setMenuItems(menuData || []);
    } catch (error) {
      console.error("Error fetching category menu:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success("Item added to cart");
  };

  const handleAddClick = (item: MenuItem) => {
    if (isJuiceCategoryName(categoryName)) {
      setPendingItem(item);
      setSelectedPrice("");
      setPriceError("");
      setShowAddSheet(true);
      return;
    }
    addToCart(item);
  };

  const confirmAddWithPrice = () => {
    if (!selectedPrice) {
      setPriceError("Please select a price");
      return;
    }
    if (!pendingItem) return;
    const priceNum = parseFloat(selectedPrice);
    const itemWithPrice = { ...pendingItem, price: priceNum };
    addToCart(itemWithPrice);
    setShowAddSheet(false);
    setPendingItem(null);
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i));
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  const clearItemFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = async () => {
    if (!user || cart.length === 0) return;

    setPlacing(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          student_id: user.id,
          canteen_id: id,
          total_amount: totalAmount,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      setPickupCode(orderData.pickup_code);
      setShowPickupDialog(true);
      setCart([]);
      try { localStorage.removeItem(cartKey); } catch {}
    } catch (error) {
      console.error("Error placing order:", error);
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(`/student/canteen/${id}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{canteen?.name}</h1>
              <p className="text-muted-foreground">{categoryName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="relative"
              onClick={() => navigate(`/student/canteen/${id}/cart`)}
            >
              <ShoppingCart className="h-7 w-7 sm:h-8 sm:w-8" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-1 gap-8">
          <div className="lg:col-span-2">
            <div className="flex gap-2 mb-6">
              <Input
                placeholder="Search items..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="rounded-full h-11 px-5"
              />
              <Button className="h-11 px-6 rounded-full">Search</Button>
            </div>

            {menuItems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No items in this category</CardContent>
              </Card>
            ) : (
              <div className="space-y-4 overflow-x-hidden">
                {menuItems
                  .filter((mi) =>
                    menuSearch.trim() === ""
                      ? true
                      : mi.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
                        (mi.description || "").toLowerCase().includes(menuSearch.toLowerCase())
                  )
                  .map((item, idx) => (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-7 p-4 sm:p-7">
                        <div className="relative w-full h-40 sm:w-48 sm:h-32 rounded-3xl overflow-hidden flex-shrink-0">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : getCanteenImageSrc() ? (
                            <img src={getCanteenImageSrc()} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-muted" />
                          )}
                          <div className="absolute top-2 left-2">
                            {idx % 2 === 0 ? (
                              <Badge className="bg-orange-500 text-white">Popular</Badge>
                            ) : (
                              <Badge className="bg-orange-600 text-white">Bestseller</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 w-full min-w-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xl font-semibold break-words">{item.name}</p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground break-words">{item.description}</p>
                              )}
                              <p className="text-sm text-muted-foreground">{canteen?.name}</p>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="h-4 w-4 text-primary" />
                              <span className="font-medium">{(4.6 + (idx % 4) * 0.1).toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="mt-3 flex justify-between items-center">
                            <span className="text-2xl font-bold text-accent">₹{item.price.toFixed(2)}</span>
                            <Button onClick={() => handleAddClick(item)} className="rounded-full px-5" size="sm">
                              <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            )}
          </div>

          
        </div>
      </main>

      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl border-t bg-white shadow-md">
          <SheetHeader>
            <SheetTitle>Select Price</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium" htmlFor="price-select">Select Price</label>
              <Select value={selectedPrice} onValueChange={(v) => { setSelectedPrice(v); setPriceError(""); }} aria-label="Select price">
                <SelectTrigger id="price-select" className="mt-1 rounded-lg border bg-white text-sm">
                  <SelectValue placeholder="Choose price" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">₹30</SelectItem>
                  <SelectItem value="40">₹40</SelectItem>
                  <SelectItem value="50">₹50</SelectItem>
                </SelectContent>
              </Select>
              {priceError && (
                <div className="mt-1 text-xs text-red-600">{priceError}</div>
              )}
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="flex justify-between text-sm">
                <div className="font-medium">{pendingItem?.name || "Item"}</div>
                <div className="font-semibold">{selectedPrice ? `₹${selectedPrice}` : "₹--"}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-lg" onClick={confirmAddWithPrice} aria-label="Add to cart">
                Add to Cart
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={showPickupDialog}
        onOpenChange={(open) => {
          setShowPickupDialog(open);
          if (!open) navigate(`/student/canteen/${id}`);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Order Placed Successfully!
            </DialogTitle>
            <DialogDescription>Save your pickup code to collect your order</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="text-sm text-muted-foreground">Your Pickup Code:</div>
            <div className="text-6xl font-bold tracking-wider text-primary">{pickupCode}</div>
            <div className="text-sm text-muted-foreground text-center">Show this code to the vendor when collecting your order</div>
          </div>
          <Button
            onClick={() => {
              setShowPickupDialog(false);
              navigate(`/student/canteen/${id}`);
            }}
          >
            Got it!
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoryMenu;
