-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'vendor');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create canteens table
CREATE TABLE public.canteens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  canteen_id UUID NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canteen_id UUID NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create order_items table (for many-to-many relationship)
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own role"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Canteens policies
CREATE POLICY "Everyone can view canteens"
  ON public.canteens FOR SELECT
  USING (true);

CREATE POLICY "Vendors can create canteens"
  ON public.canteens FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'vendor') AND auth.uid() = vendor_id);

CREATE POLICY "Vendors can update own canteens"
  ON public.canteens FOR UPDATE
  USING (auth.uid() = vendor_id);

CREATE POLICY "Vendors can delete own canteens"
  ON public.canteens FOR DELETE
  USING (auth.uid() = vendor_id);

-- Menu items policies
CREATE POLICY "Everyone can view available menu items"
  ON public.menu_items FOR SELECT
  USING (true);

CREATE POLICY "Vendors can create menu items for own canteens"
  ON public.menu_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.canteens
      WHERE id = menu_items.canteen_id AND vendor_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update menu items for own canteens"
  ON public.menu_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.canteens
      WHERE id = menu_items.canteen_id AND vendor_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can delete menu items for own canteens"
  ON public.menu_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.canteens
      WHERE id = menu_items.canteen_id AND vendor_id = auth.uid()
    )
  );

-- Orders policies
CREATE POLICY "Students can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Vendors can view orders for own canteens"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.canteens
      WHERE id = orders.canteen_id AND vendor_id = auth.uid()
    )
  );

CREATE POLICY "Students can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'));

CREATE POLICY "Vendors can update orders for own canteens"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.canteens
      WHERE id = orders.canteen_id AND vendor_id = auth.uid()
    )
  );

-- Order items policies
CREATE POLICY "Users can view order items for own orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id 
      AND (student_id = auth.uid() OR canteen_id IN (
        SELECT id FROM public.canteens WHERE vendor_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Students can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id AND student_id = auth.uid()
    )
  );

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;