import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "./components/ThemeProvider";
import { OrgProvider } from "./hooks/useOrg";
import AppLayout from "./components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import Orders from "./pages/Orders";
import Purchases from "./pages/Purchases";
import Finance from "./pages/Finance";
import Reconciliation from "./pages/Reconciliation";
import Platforms from "./pages/Platforms";
import EventDetail from "./pages/EventDetail";
import Team from "./pages/Team";
import Cashflow from "./pages/Cashflow";
import ResetPassword from "./pages/ResetPassword";
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
              <Route path="/events" element={<Events />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/platforms" element={<Platforms />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/cashflow" element={<Cashflow />} />
              <Route path="/health" element={<Reconciliation />} />
              <Route path="/team" element={<Team />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
