import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import StudentDashboard from "./pages/StudentDashboard";
import CanteenMenu from "./pages/CanteenMenu";
import CategoryMenu from "./pages/CategoryMenu";
import CartPage from "./pages/CartPage";
import OrderHistory from "./pages/OrderHistory";
import VendorDashboard from "./pages/VendorDashboard";
import VendorRegistration from "./pages/VendorRegistration";
import MenuManagement from "./pages/MenuManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />

          {/* Student Routes */}
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/canteen/:id" element={<CanteenMenu />} />
          <Route
            path="/student/canteen/:id/category/:categoryId"
            element={<CategoryMenu />}
          />
          <Route path="/student/canteen/:id/cart" element={<CartPage />} />
          <Route path="/student/orders" element={<OrderHistory />} />

          {/* Vendor Routes */}
          <Route path="/vendor" element={<VendorDashboard />} />
          <Route path="/vendor/register" element={<VendorRegistration />} />
          <Route path="/vendor/menu" element={<MenuManagement />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
