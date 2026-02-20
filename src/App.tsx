import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Backtest from "./pages/Backtest";
import Marketplace from "./pages/Marketplace";
import SmartSignals from "./pages/SmartSignals";
import TradeJournal from "./pages/TradeJournal";
import NotFound from "./pages/NotFound";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminStrategies from "./pages/admin/AdminStrategies";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminDatabase from "./pages/admin/AdminDatabase";
import AdminTrades from "./pages/admin/AdminTrades";

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
          <Route path="/chat" element={<Chat />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/backtest" element={<Backtest />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/signals" element={<SmartSignals />} />
          <Route path="/journal" element={<TradeJournal />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="strategies" element={<AdminStrategies />} />
            <Route path="trades" element={<AdminTrades />} />
            <Route path="database" element={<AdminDatabase />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
