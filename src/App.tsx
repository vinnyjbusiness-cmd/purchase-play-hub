import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "./components/ThemeProvider";
import { OrgProvider, useOrg } from "./hooks/useOrg";
import { FinancePinGate } from "./components/FinancePinGate";
import AppLayout from "./components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import Orders from "./pages/Orders";
import Purchases from "./pages/Purchases";
import Finance from "./pages/Finance";
import Balance from "./pages/Balance";
import Analytics from "./pages/Analytics";
import Reconciliation from "./pages/Reconciliation";
import Platforms from "./pages/Platforms";
import EventDetail from "./pages/EventDetail";
import Team from "./pages/Team";
import Cashflow from "./pages/Cashflow";
import ResetPassword from "./pages/ResetPassword";
import ActivityLog from "./pages/ActivityLog";
import Wallet from "./pages/Wallet";
import TodoList from "./pages/TodoList";
import EventTimeline from "./pages/EventTimeline";
import InvoiceGenerator from "./pages/InvoiceGenerator";
import InventoryPage from "./pages/Inventory";
import Communications from "./pages/Communications";
import WarRoom from "./pages/WarRoom";
import WorldCup from "./pages/WorldCup";
import SuppliersPage from "./pages/Suppliers";
import MembersPage from "./pages/Members";
import TemplatesPage from "./pages/Templates";
import IJKAccountPage from "./pages/IJKAccount";
import SpreadsheetTemplatesPage from "./pages/SpreadsheetTemplates";
import PasswordVault from "./pages/PasswordVault";
import ListingsManager from "./pages/ListingsManager";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/** Blocks viewers from accessing admin-only routes */
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { userRole, loading } = useOrg();
  if (loading) return null;
  if (userRole !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Wraps pages that need PIN protection */
function PinProtected({ children }: { children: React.ReactNode }) {
  return (
    <AdminOnly>
      <FinancePinGate>{children}</FinancePinGate>
    </AdminOnly>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              element={
                <AuthGate>
                  <OrgProvider>
                    <AppLayout />
                  </OrgProvider>
                </AuthGate>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/events" element={<AdminOnly><Events /></AdminOnly>} />
              <Route path="/events/:id" element={<AdminOnly><EventDetail /></AdminOnly>} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/platforms" element={<AdminOnly><Platforms /></AdminOnly>} />
              <Route path="/finance" element={<PinProtected><Finance /></PinProtected>} />
              <Route path="/analytics" element={<PinProtected><Analytics /></PinProtected>} />
              <Route path="/balance" element={<PinProtected><Balance /></PinProtected>} />
              <Route path="/cashflow" element={<PinProtected><Cashflow /></PinProtected>} />
              <Route path="/health" element={<AdminOnly><Reconciliation /></AdminOnly>} />
              <Route path="/team" element={<AdminOnly><Team /></AdminOnly>} />
              <Route path="/team/communications" element={<AdminOnly><Communications /></AdminOnly>} />
              <Route path="/activity" element={<AdminOnly><ActivityLog /></AdminOnly>} />
              <Route path="/wallet" element={<PinProtected><Wallet /></PinProtected>} />
              <Route path="/todos" element={<TodoList />} />
              <Route path="/timeline" element={<AdminOnly><EventTimeline /></AdminOnly>} />
              <Route path="/invoices" element={<PinProtected><InvoiceGenerator /></PinProtected>} />
              <Route path="/suppliers" element={<AdminOnly><SuppliersPage /></AdminOnly>} />
              <Route path="/members" element={<AdminOnly><MembersPage /></AdminOnly>} />
              <Route path="/templates" element={<AdminOnly><TemplatesPage /></AdminOnly>} />
              <Route path="/ijk-account" element={<AdminOnly><IJKAccountPage /></AdminOnly>} />
              <Route path="/spreadsheet-templates" element={<AdminOnly><SpreadsheetTemplatesPage /></AdminOnly>} />
              <Route path="/warroom" element={<AdminOnly><WarRoom /></AdminOnly>} />
              <Route path="/world-cup" element={<AdminOnly><WorldCup /></AdminOnly>} />
              <Route path="/vault-passwords" element={<AdminOnly><PasswordVault /></AdminOnly>} />
              <Route path="/listings" element={<AdminOnly><ListingsManager /></AdminOnly>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
