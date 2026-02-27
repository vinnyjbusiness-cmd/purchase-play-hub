import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingCart,
  Package,
  Wallet,
  Boxes,
  Scale,
  HeartPulse,
  Globe,
  Sun,
  Moon,
  LogOut,
  Users,
  Banknote,
  BarChart3,
  ClipboardList,
  Wallet as WalletIcon,
  ListTodo,
  CalendarClock,
  FileText,
  Mail,
  Siren,
  Truck,
  Contact,
  MessageSquareText,
  FileSpreadsheet,
  Handshake,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import ChangePasswordDialog from "./ChangePasswordDialog";
import { ChangePinDialog } from "./FinancePinGate";

export default function AppSidebar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { userRole } = useOrg();
  const isAdmin = userRole === "admin";

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


  const viewerNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  ];

  const adminNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/warroom", icon: Siren, label: "War Room" },
    { to: "/events", icon: CalendarDays, label: "Events" },
    { to: "/orders", icon: ShoppingCart, label: "Orders" },
    { to: "/finance", icon: Wallet, label: "Finance" },
  ];

  const adminBottomItems = [
    { to: "/suppliers", icon: Truck, label: "Contacts" },
    { to: "/ijk-account", icon: Handshake, label: "IJK Account" },
    { to: "/members", icon: Contact, label: "Members" },
    { to: "/purchases", icon: Package, label: "Purchases" },
    { to: "/inventory", icon: Boxes, label: "Inventory" },
    { to: "/timeline", icon: CalendarClock, label: "Event Timeline" },
    { to: "/balance", icon: Scale, label: "Balances" },
    { to: "/wallet", icon: WalletIcon, label: "Wallet" },
    { to: "/platforms", icon: Globe, label: "Platforms" },
    { to: "/analytics", icon: BarChart3, label: "Analytics" },
    { to: "/cashflow", icon: Banknote, label: "Cashflow" },
    { to: "/invoices", icon: FileText, label: "Invoices" },
    { to: "/health", icon: HeartPulse, label: "Health" },
    { to: "/todos", icon: ListTodo, label: "To-Do List" },
    { to: "/team", icon: Users, label: "Team" },
    { to: "/team/communications", icon: Mail, label: "Communications" },
    { to: "/templates", icon: MessageSquareText, label: "Templates" },
    { to: "/spreadsheet-templates", icon: FileSpreadsheet, label: "Spreadsheets" },
    { to: "/activity", icon: ClipboardList, label: "Activity Log" },
  ];

  const viewerBottomItems = [
    { to: "/purchases", icon: Package, label: "Purchases" },
    { to: "/inventory", icon: Boxes, label: "Inventory" },
    { to: "/todos", icon: ListTodo, label: "To-Do List" },
  ];

  return (
    <aside className="flex h-screen w-[240px] flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center px-5 py-5 border-b border-sidebar-border">
        <span className="text-xl font-extrabold tracking-tight text-sidebar-primary-foreground">
          VJX
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {(isAdmin ? adminNavItems : viewerNavItems).map(renderNavLink)}

        {!isAdmin && renderNavLink({ to: "/orders", icon: ShoppingCart, label: "Orders" })}

        {(isAdmin ? adminBottomItems : viewerBottomItems).map(renderNavLink)}
      </nav>

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
