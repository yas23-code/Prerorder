import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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

type Canteen = {
  id: string;
  name: string;
  location: string;
  vendor_id: string;
  image_url: string | null;
  created_at: string;
};

const MenuManagement = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [canteen, setCanteen] = useState<Canteen | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // keep category_id in state shape, but we won't rely on it for new items
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    is_available: true,
    category_id: "",
    category_name: "",
  });

  // item image upload state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // category image upload state (new)
  const [categoryFile, setCategoryFile] = useState<File | null>(null);
  const [categoryPreview, setCategoryPreview] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || userRole !== "vendor")) {
      navigate("/auth");
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && userRole === "vendor") {
      fetchCanteenAndMenu();
    }
  }, [user, userRole]);

  // preview for item file
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // preview for category file
  useEffect(() => {
    if (!categoryFile) {
      setCategoryPreview(null);
      return;
    }
    const url = URL.createObjectURL(categoryFile);
    setCategoryPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [categoryFile]);

  const fetchCanteenAndMenu = async () => {
    if (!user) return;

    try {
      const { data: canteenData, error: canteenError } = await supabase
        .from("canteens")
        .select("*")
        .eq("vendor_id", user.id)
        .limit(1)
        .single();

      if (canteenError) throw canteenError;
      setCanteen(canteenData);

      let fetchedCategories: Category[] = [];
      try {
        const { data: categoryData, error: categoryError } = await supabase
          .from("categories")
          .select("id, name, image_url")
          .eq("canteen_id", canteenData.id)
          .order("sort_order", { ascending: true });
        if (categoryError) throw categoryError;
        fetchedCategories = categoryData || [];
      } catch {
        fetchedCategories = [];
      }
      setCategories(fetchedCategories);

      const { data: menuData, error: menuError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("canteen_id", canteenData.id)
        .order("created_at", { ascending: false });

      if (menuError) throw menuError;
      setMenuItems(menuData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load menu items");
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const maybe = err as { message?: unknown };
      if (typeof maybe.message === "string") return maybe.message;
    }
    return fallback;
  };

  const uploadFileAndGetPublicUrl = async (f: File) => {
    try {
      const timestamped = `${Date.now()}_${f.name.replace(/\s+/g, "_")}`;
      const path = `items/${timestamped}`;
      setUploading(true);
      const { error } = await supabase.storage.from("item-images").upload(path, f);
      if (error) throw error;
      // get public url
      const { data: publicData, error: publicErr } = await supabase.storage
        .from("item-images")
        .getPublicUrl(path);
      if (publicErr) throw publicErr;
      const publicUrl =
        (publicData as any)?.publicUrl ||
        (publicData as any)?.publicURL ||
        (publicData as any)?.public_url ||
        "";
      return publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload image");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadCategoryImage = async (f: File) => {
    try {
      const timestamped = `cat_${Date.now()}_${f.name.replace(/\s+/g, "_")}`;
      const path = `categories/${timestamped}`;
      setUploading(true);
      const { error } = await supabase.storage.from("category-images").upload(path, f);
      if (error) throw error;
      const { data: publicData, error: publicErr } = await supabase.storage
        .from("category-images")
        .getPublicUrl(path);
      if (publicErr) throw publicErr;
      const publicUrl =
        (publicData as any)?.publicUrl ||
        (publicData as any)?.publicURL ||
        (publicData as any)?.public_url ||
        "";
      return publicUrl;
    } catch (err) {
      console.error("Category upload error:", err);
      toast.error("Failed to upload category image");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canteen || !user) return;

    try {
      // resolve category id
      let categoryId: string | null = null;

      if (formData.category_name.trim()) {
        const typed = formData.category_name.trim();

        try {
          const { data: existing, error: existingError } = await supabase
            .from("categories")
            .select("id, image_url")
            .eq("canteen_id", canteen.id)
            .eq("name", typed)
            .maybeSingle();

          if (existingError) throw existingError;

          if (existing?.id) {
            categoryId = existing.id;
          } else {
            // if a category image file selected, upload first and include image_url
            let uploadedCategoryImage: string | null = null;
            if (categoryFile) {
              uploadedCategoryImage = await uploadCategoryImage(categoryFile);
            }

            const { data: created, error: createErr } = await supabase
              .from("categories")
              .insert({
                name: typed,
                canteen_id: canteen.id,
                vendor_id: user.id,
                sort_order: categories.length,
                image_url: uploadedCategoryImage,
              })
              .select("id, image_url")
              .single();

            if (createErr) throw createErr;
            categoryId = created?.id ?? null;

            // refresh categories list to include newly created category and image
            fetchCanteenAndMenu();
          }
        } catch (catErr) {
          console.error("Error resolving category:", catErr);
          categoryId = null;
        }
      }

      // upload item image if selected
      let image_url: string | null = editingItem?.image_url ?? null;
      if (file) {
        const uploadedUrl = await uploadFileAndGetPublicUrl(file);
        if (uploadedUrl) image_url = uploadedUrl;
      }

      const itemData: any = {
        canteen_id: canteen.id,
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        is_available: formData.is_available,
        category_id: categoryId,
        image_url,
      };

      if (editingItem) {
        // Update
        const { error } = await supabase
          .from("menu_items")
          .update(itemData)
          .eq("id", editingItem.id);

        if (error) {
          const msg = getErrorMessage(error, "");
          if (msg.toLowerCase().includes("category_id")) {
            const { error: fallbackError } = await supabase
              .from("menu_items")
              .update({
                canteen_id: itemData.canteen_id,
                name: itemData.name,
                description: itemData.description,
                price: itemData.price,
                is_available: itemData.is_available,
                image_url: itemData.image_url,
              })
              .eq("id", editingItem.id);
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }
        toast.success("Menu item updated!");
      } else {
        // Insert
        const { error } = await supabase.from("menu_items").insert(itemData);

        if (error) {
          const msg = getErrorMessage(error, "");
          if (msg.toLowerCase().includes("category_id")) {
            const { error: fallbackError } = await supabase
              .from("menu_items")
              .insert({
                canteen_id: itemData.canteen_id,
                name: itemData.name,
                description: itemData.description,
                price: itemData.price,
                is_available: itemData.is_available,
                image_url: itemData.image_url,
              });
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }
        toast.success("Menu item added!");
      }

      // reset the form & file state
      setFormData({
        name: "",
        description: "",
        price: "",
        is_available: true,
        category_name: "",
        category_id: "",
      });
      setFile(null);
      setPreviewUrl(null);
      setCategoryFile(null);
      setCategoryPreview(null);
      setIsEditing(false);
      setEditingItem(null);
      fetchCanteenAndMenu();
    } catch (error) {
      console.error("Error saving menu item:", error);
      const message = getErrorMessage(error, "Failed to save menu item");
      toast.error(message);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      is_available: item.is_available,
      category_name: categories.find((c) => c.id === item.category_id)?.name || "",
      category_id: item.category_id ?? "",
    });
    // set preview to existing image if present
    if (item.image_url) {
      setPreviewUrl(item.image_url);
    } else {
      setPreviewUrl(null);
    }
    setFile(null);
    setCategoryFile(null);
    setCategoryPreview(null);
    setIsEditing(true);
  };

  const handleDelete = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      toast.success("Menu item deleted!");
      fetchCanteenAndMenu();
    } catch (error) {
      console.error("Error deleting menu item:", error);
      const message = getErrorMessage(error, "Failed to delete menu item");
      toast.error(message);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingItem(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      is_available: true,
      category_name: "",
      category_id: "",
    });
    setFile(null);
    setPreviewUrl(null);
    setCategoryFile(null);
    setCategoryPreview(null);
  };

  const createCategory = async (name: string) => {
    if (!canteen || !user) return;
    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({
          name,
          canteen_id: canteen.id,
          vendor_id: user.id,
          sort_order: categories.length,
        })
        .select("id, image_url")
        .single();
      if (error) throw error;
      toast.success("Category created");
      fetchCanteenAndMenu();
      return data?.id ?? null;
    } catch (error) {
      console.error("Error creating category:", error);
      const message = getErrorMessage(error, "Failed to create category");
      toast.error(message);
      return null;
    }
  };

  const ensureDefaultCategories = async () => {
    if (!canteen || !user) return;
    const defaults = [
      "Snacks",
      "Maggie",
      "Burgers",
      "Sandwiches",
      "Chinese",
      "Just Foodie",
      "Paranthae",
    ];
    try {
      const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
      const toCreate = defaults.filter((d) => !existingNames.has(d.toLowerCase()));
      if (toCreate.length === 0) {
        toast.success("Default categories already exist");
        return;
      }
      const rows = toCreate.map((name, idx) => ({
        name,
        canteen_id: canteen.id,
        vendor_id: user.id,
        sort_order: idx,
      }));
      const { error } = await supabase.from("categories").insert(rows);
      if (error) throw error;
      toast.success("Default categories added");
      fetchCanteenAndMenu();
    } catch (error) {
      console.error("Error adding default categories:", error);
      const message = getErrorMessage(error, "Failed to add default categories");
      toast.error(message);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate("/vendor")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Menu Management</h1>
          <div className="w-[100px]"></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? "Edit" : "Add"} Menu Item</CardTitle>
              <CardDescription>
                {isEditing ? "Update the menu item details" : "Add a new item to your menu"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Write category name (creates if new)"
                      value={formData.category_name}
                      onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                    />
                    <Button type="button" variant="outline" onClick={ensureDefaultCategories}>
                      Add Default
                    </Button>
                  </div>

                  {/* Category image upload */}
                  <div className="mt-2">
                    <Label>Category Image (optional)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setCategoryFile(e.target.files?.[0] ?? null)}
                      />
                      {categoryPreview && (
                        <img
                          src={categoryPreview}
                          alt="category preview"
                          className="w-20 h-20 object-cover rounded-md border"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>

                {/* Image upload for item */}
                <div className="space-y-2">
                  <Label>Item Image (optional)</Label>
                  <div className="flex items-center gap-4">
                    <input
                      id="item-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setFile(f);
                      }}
                    />
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="preview"
                        className="w-24 h-24 object-cover rounded-md border"
                      />
                    )}
                    {uploading && <div className="text-sm">Uploading...</div>}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="available">Available</Label>
                  <Switch
                    id="available"
                    checked={formData.is_available}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_available: checked })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={uploading}>
                    <Plus className="h-4 w-4 mr-2" />
                    {isEditing ? "Update" : "Add"} Item
                  </Button>
                  {isEditing && (
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
                <CardDescription>Your current categories</CardDescription>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <p className="text-muted-foreground">No categories yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const count = menuItems.filter((mi) => mi.category_id === cat.id).length;
                      return (
                        <Badge key={cat.id} variant="secondary" className="flex items-center gap-2">
                          {cat.image_url ? (
                            <img src={cat.image_url} alt={cat.name} className="w-6 h-6 rounded-full object-cover" />
                          ) : null}
                          <span>{cat.name}</span>
                          {count > 0 ? <span> ({count})</span> : null}
                        </Badge>
                      );
                    })}
                    {menuItems.some((mi) => !mi.category_id) && (
                      <Badge variant="secondary">
                        Other ({menuItems.filter((mi) => !mi.category_id).length})
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <h2 className="text-xl font-semibold">Current Menu Items</h2>
            {menuItems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No menu items yet. Add your first item!
                </CardContent>
              </Card>
            ) : (
              menuItems.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <CardDescription>₹{item.price.toFixed(2)}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="w-full h-40 object-cover rounded-md mb-2" />
                    )}
                    {item.description && (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    )}
                    <p className="text-xs mt-2">
                      Status: {item.is_available ? "Available" : "Unavailable"}
                    </p>
                    {item.category_id && (
                      <p className="text-xs mt-1">
                        Category: {categories.find((c) => c.id === item.category_id)?.name || "-"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MenuManagement;
