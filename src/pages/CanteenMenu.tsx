import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingCart, Plus, QrCode, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

type Category = {
  id: string;
  name: string;
  image_url?: string | null;
};

type CartItem = MenuItem & { quantity: number };

const CanteenMenu = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  type Canteen = {
    id: string;
    name: string;
    location: string;
    vendor_id: string;
    image_url: string | null;
  };

  const [canteen, setCanteen] = useState<Canteen | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [showPickupDialog, setShowPickupDialog] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
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

  // -----------------------------
  // CATEGORY IMAGE LOGIC (A)
  // -----------------------------
  const getCategoryImage = (category: Category): string => {
    // 1️⃣ Category uploaded image
    if (category.image_url) return category.image_url;

    // 2️⃣ First item image inside this category
    const firstItem = menuItems.find((item) => item.category_id === category.id);
    if (firstItem?.image_url) return firstItem.image_url;

    // 3️⃣ Canteen image
    if (canteen?.image_url) return canteen.image_url;

    // 4️⃣ Default placeholder
    return "/placeholder.svg";
  };

  const getCanteenImage = () => {
    return canteen?.image_url || "/placeholder.svg";
  };

  const categoriesWithItems = categories.filter((c) =>
    menuItems.some((mi) => mi.category_id === c.id)
  );

  // -----------------------------
  // FETCH DATA
  // -----------------------------
  useEffect(() => {
    if (id) fetchCanteenAndMenu();
  }, [id]);

  const fetchCanteenAndMenu = async () => {
    try {
      const { data: canteenData } = await supabase
        .from("canteens")
        .select("*")
        .eq("id", id)
        .single();

      setCanteen(canteenData);

      const { data: categoryData } = await supabase
        .from("categories")
        .select("id, name, image_url")
        .eq("canteen_id", canteenData.id)
        .order("sort_order", { ascending: true });

      setCategories(categoryData || []);
      setSelectedCategory("all");

      const { data: menuData } = await supabase
        .from("menu_items")
        .select("*")
        .eq("canteen_id", id)
        .eq("is_available", true)
        .order("name");

      setMenuItems(menuData || []);
    } catch {
      toast.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // CART LOGIC
  // -----------------------------
  const cartKey = `canteen_cart_${id}`;

  useEffect(() => {
    const saved = localStorage.getItem(cartKey);
    if (saved) setCart(JSON.parse(saved));
  }, [cartKey]);

  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === item.id);
      if (found) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success("Item added");
  };

  const isJuiceItem = (item: MenuItem) => {
    const cat = categories.find((c) => c.id === item.category_id);
    return isJuiceCategoryName(cat?.name || "");
  };

  const handleAddClick = (item: MenuItem) => {
    if (isJuiceItem(item)) {
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

  const totalAmount = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // -----------------------------
  // PLACE ORDER
  // -----------------------------
  const placeOrder = async () => {
    if (!user || cart.length === 0) return;

    setPlacing(true);
    try {
      const { data: orderData } = await supabase
        .from("orders")
        .insert({
          student_id: user.id,
          canteen_id: id,
          total_amount: totalAmount,
          status: "pending",
        })
        .select()
        .single();

      const items = cart.map((i) => ({
        order_id: orderData.id,
        menu_item_id: i.id,
        quantity: i.quantity,
        price: i.price,
      }));

      await supabase.from("order_items").insert(items);

      setPickupCode(orderData.pickup_code);
      setShowPickupDialog(true);
      setCart([]);
      localStorage.removeItem(cartKey);

      toast.success("Order placed!");
    } catch (error) {
      toast.error("Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* HEADER */}
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate("/student")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          <div>
            <h1 className="text-3xl font-bold">{canteen?.name}</h1>
            <p className="text-muted-foreground">{canteen?.location}</p>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate(`/student/canteen/${id}/cart`)}
            className="relative"
          >
            <ShoppingCart className="h-7 w-7" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* BODY */}
      <main className="container mx-auto px-4 py-8">
        {/* Search */}
        <h2 className="text-2xl font-bold mb-4">What are you craving?</h2>
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Search items..."
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            className="rounded-full h-11 px-5"
          />
          <Button className="h-11 px-6 rounded-full">Search</Button>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-6 mb-6">
          {/* ALL category */}
          <Link to={`/student/canteen/${id}`} className="flex flex-col items-center">
            <div
              className={cn(
                "w-24 h-24 rounded-full ring-1 ring-primary bg-white shadow-sm overflow-hidden",
                selectedCategory === "all" && "ring-2 ring-primary bg-[#FFECB3] shadow-lg"
              )}
            >
              <img
                src={getCanteenImage()}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-sm font-medium mt-2">All</span>
          </Link>

          {/* Real categories */}
          {categoriesWithItems.map((cat) => (
            <Link
              key={cat.id}
              to={`/student/canteen/${id}/category/${cat.id}`}
              className="flex flex-col items-center"
            >
              <div
                className={cn(
                  "w-24 h-24 rounded-full ring-1 ring-primary bg-white shadow-sm overflow-hidden",
                  selectedCategory === cat.id && "ring-2 ring-primary bg-[#FFECB3] shadow-lg"
                )}
              >
                <img
                  src={getCategoryImage(cat)}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-sm font-medium mt-2">{cat.name}</span>
            </Link>
          ))}
        </div>

        {/* MENU LIST */}
        {menuItems
          .filter((i) =>
            selectedCategory === "all" ? true : i.category_id === selectedCategory
          )
          .filter((i) =>
            menuSearch.length === 0
              ? true
              : i.name.toLowerCase().includes(menuSearch.toLowerCase())
          )
          .map((item, idx) => (
            <Card key={item.id} className="mb-4 hover:shadow-md">
              <div className="flex gap-4 p-4">
                {/* IMAGE */}
                <div className="relative w-28 h-20 rounded-xl overflow-hidden">
                  <img
                    src={item.image_url || getCanteenImage()}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-orange-500 text-white">
                      {idx % 2 === 0 ? "Popular" : "Bestseller"}
                    </Badge>
                  </div>
                </div>

                {/* TEXT */}
                <div className="flex-1">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-lg font-semibold">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 text-primary" />
                      <span>{(4.5 + (idx % 4) * 0.1).toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-xl font-bold text-accent">
                      ₹{item.price.toFixed(2)}
                    </span>
                    <Button onClick={() => handleAddClick(item)} size="sm" className="rounded-full">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
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

      {/* PICKUP DIALOG */}
      <Dialog open={showPickupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><QrCode className="h-5 w-5 inline mr-2" /> Order Placed!</DialogTitle>
            <DialogDescription>Show this pickup code to vendor</DialogDescription>
          </DialogHeader>

          <div className="text-center py-4">
            <div className="text-5xl font-bold">{pickupCode}</div>
          </div>

          <Button onClick={() => navigate("/student")}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CanteenMenu;
