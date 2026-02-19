import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingCart,
  Package,
  Wallet,
  HeartPulse,
  Globe,
  Sun,
  Moon,
  LogOut,
  Ticket,
  Users,
  Banknote,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/events", icon: CalendarDays, label: "Events" },
  { to: "/orders", icon: ShoppingCart, label: "Orders" },
  { to: "/purchases", icon: Package, label: "Purchases" },
  { to: "/platforms", icon: Globe, label: "Platforms" },
  { to: "/finance", icon: Wallet, label: "Finance" },
  { to: "/cashflow", icon: Banknote, label: "Cashflow" },
  { to: "/health", icon: HeartPulse, label: "Health" },
  { to: "/team", icon: Users, label: "Team" },
];

export default function AppSidebar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <aside className="flex h-screen w-[240px] flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <Ticket className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">
          VJX Ticket Ops
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
