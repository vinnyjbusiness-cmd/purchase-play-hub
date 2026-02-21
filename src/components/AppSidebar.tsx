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
  Users,
  Banknote,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import ChangePasswordDialog from "./ChangePasswordDialog";
import { ChangePinDialog } from "./FinancePinGate";

const orderSubItems = [
  { to: "/orders", label: "All Orders" },
  { to: "/orders/arsenal", label: "Arsenal" },
  { to: "/orders/manchester-united", label: "Manchester United" },
  { to: "/orders/liverpool", label: "Liverpool" },
  { to: "/orders/world-cup", label: "World Cup" },
];


export default function AppSidebar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { userRole } = useOrg();
  const isAdmin = userRole === "admin";
  const isOrdersActive = location.pathname.startsWith("/orders");
  const isFinanceActive = location.pathname.startsWith("/finance");
  const [ordersOpen, setOrdersOpen] = useState(isOrdersActive);

  const handleLogout = async () => {
    sessionStorage.removeItem("vjx_finance_unlocked");
    await supabase.auth.signOut();
  };

  const renderNavLink = (item: { to: string; icon: any; label: string }) => {
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
  };

  const renderCollapsible = (
    label: string,
    Icon: any,
    isActive: boolean,
    isOpen: boolean,
    setOpen: (v: boolean) => void,
    subItems: { to: string; label: string }[]
  ) => (
    <div>
      <button
        onClick={() => setOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <span className="flex items-center gap-3">
          <Icon className="h-4 w-4" />
          {label}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
          {subItems.map((sub) => {
            const active = location.pathname === sub.to;
            return (
              <NavLink
                key={sub.to}
                to={sub.to}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {sub.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );

  // Viewer nav: Dashboard, Orders, Purchases only
  const viewerNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  ];

  // Admin nav
  const adminNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/events", icon: CalendarDays, label: "Events" },
  ];

  const adminBottomItems = [
    { to: "/purchases", icon: Package, label: "Purchases" },
    { to: "/platforms", icon: Globe, label: "Platforms" },
    { to: "/finance", icon: Wallet, label: "Finance" },
    { to: "/analytics", icon: BarChart3, label: "Analytics" },
    { to: "/cashflow", icon: Banknote, label: "Cashflow" },
    { to: "/health", icon: HeartPulse, label: "Health" },
    { to: "/team", icon: Users, label: "Team" },
  ];

  const viewerBottomItems = [
    { to: "/purchases", icon: Package, label: "Purchases" },
  ];

  return (
    <aside className="flex h-screen w-[240px] flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center px-5 py-5 border-b border-sidebar-border">
        <span className="text-xl font-extrabold tracking-tight text-sidebar-primary-foreground">
          VJX
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {(isAdmin ? adminNavItems : viewerNavItems).map(renderNavLink)}

        {/* Orders — always visible */}
        {renderCollapsible("Orders", ShoppingCart, isOrdersActive, ordersOpen, setOrdersOpen, orderSubItems)}

        {(isAdmin ? adminBottomItems : viewerBottomItems).map(renderNavLink)}

        {(isAdmin ? adminBottomItems : viewerBottomItems).map(renderNavLink)}
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
        <ChangePasswordDialog />
        {isAdmin && <ChangePinDialog />}
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
