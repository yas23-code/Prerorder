import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

type MenuItem = {
  name: string;
  price: string;
};

const VendorRegistration = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [canteenName, setCanteenName] = useState("");
  const [canteenLocation, setCanteenLocation] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { name: "", price: "" },
  ]);
  const [loading, setLoading] = useState(false);

  // ⭐ NEW STATE for canteen image
  const [canteenImage, setCanteenImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Redirect non-vendors
  useEffect(() => {
    if (!authLoading) {
      if (!user) navigate("/auth");
      else if (userRole === "student") navigate("/student");
    }
  }, [user, userRole, authLoading, navigate]);

  const addMenuItem = () => {
    setMenuItems([...menuItems, { name: "", price: "" }]);
  };

  const removeMenuItem = (index: number) => {
    if (menuItems.length > 1)
      setMenuItems(menuItems.filter((_, i) => i !== index));
  };

  const updateMenuItem = (
    index: number,
    field: "name" | "price",
    value: string
  ) => {
    const updated = [...menuItems];
    updated[index][field] = value;
    setMenuItems(updated);
  };

  // ⭐ Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCanteenImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // ⭐ Upload image to Supabase
  const uploadCanteenImage = async (canteenId: string) => {
    if (!canteenImage) return null;

    const fileExt = canteenImage.name.split(".").pop();
    const filePath = `${canteenId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("canteen-images")
      .upload(filePath, canteenImage, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      toast.error("Image upload failed");
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("canteen-images")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return toast.error("You must be logged in");

    if (!canteenName.trim() || !canteenLocation.trim())
      return toast.error("Please fill all details");

    if (menuItems.every((i) => !i.name.trim() || !i.price.trim()))
      return toast.error("Add at least one valid menu item");

    setLoading(true);

    try {
      // 1️⃣ Create Canteen
      const { data: canteenData, error: canteenError } = await supabase
        .from("canteens")
        .insert({
          name: canteenName,
          location: canteenLocation,
          vendor_id: user.id,
        })
        .select()
        .single();

      if (canteenError) throw canteenError;

      // 2️⃣ Upload image if selected
      let imageUrl: string | null = null;
      if (canteenImage) {
        imageUrl = await uploadCanteenImage(canteenData.id);

        await supabase
          .from("canteens")
          .update({ image_url: imageUrl })
          .eq("id", canteenData.id);
      }

      // 3️⃣ Add menu items
      const itemsToInsert = menuItems
        .filter((i) => i.name && i.price)
        .map((i) => ({
          canteen_id: canteenData.id,
          name: i.name,
          price: parseFloat(i.price),
        }));

      const { error: itemError } = await supabase
        .from("menu_items")
        .insert(itemsToInsert);

      if (itemError) throw itemError;

      toast.success("Canteen registered successfully!");
      navigate("/vendor", { state: { justRegistered: true } });
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <UtensilsCrossed className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl">Register Your Canteen</CardTitle>
            <CardDescription>
              Add your canteen’s details and upload an image
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Canteen name */}
              <div className="space-y-2">
                <Label>Canteen Name</Label>
                <Input
                  value={canteenName}
                  onChange={(e) => setCanteenName(e.target.value)}
                />
              </div>

              {/* Canteen Location */}
              <div className="space-y-2">
                <Label>Canteen Location</Label>
                <Input
                  value={canteenLocation}
                  onChange={(e) => setCanteenLocation(e.target.value)}
                />
              </div>

              {/* ⭐ IMAGE UPLOAD */}
              <div className="space-y-2">
                <Label>Upload Canteen Image</Label>
                <Input type="file" accept="image/*" onChange={handleImageChange} />

                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-40 h-40 rounded-xl object-cover mt-2 border"
                  />
                )}
              </div>

              {/* MENU */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Menu Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMenuItem}>
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </div>

                {menuItems.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Item name"
                      value={item.name}
                      onChange={(e) => updateMenuItem(i, "name", e.target.value)}
                    />
                    <Input
                      className="w-32"
                      placeholder="Price"
                      type="number"
                      value={item.price}
                      onChange={(e) => updateMenuItem(i, "price", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMenuItem(i)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* SUBMIT */}
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Registering..." : "Register Canteen"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorRegistration;
