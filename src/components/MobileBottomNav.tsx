import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Wallet, Scale, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useOrg } from "@/hooks/useOrg";
import {
  CalendarDays, Package, Boxes, HeartPulse, Globe, Users, Banknote, BarChart3,
  ClipboardList, ListTodo, CalendarClock, FileText, Mail, Siren, Truck, Contact,
  MessageSquareText, FileSpreadsheet, Handshake, Sun, Moon, LogOut,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { supabase } from "@/integrations/supabase/client";

const mainTabs = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/orders", icon: ShoppingCart, label: "Orders" },
  { to: "/finance", icon: Wallet, label: "Finance" },
  { to: "/wallet", icon: Wallet, label: "Wallet" },
  { to: "/balance", icon: Scale, label: "Balances" },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { userRole } = useOrg();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = userRole === "admin";

  const moreItems = isAdmin
    ? [
        { to: "/warroom", icon: Siren, label: "War Room" },
        { to: "/world-cup", icon: Globe, label: "World Cup" },
        { to: "/events", icon: CalendarDays, label: "Events" },
        { to: "/suppliers", icon: Truck, label: "Contacts" },
        { to: "/ijk-account", icon: Handshake, label: "IJK Account" },
        { to: "/members", icon: Contact, label: "Members" },
        { to: "/purchases", icon: Package, label: "Purchases" },
        { to: "/inventory", icon: Boxes, label: "Inventory" },
        { to: "/timeline", icon: CalendarClock, label: "Timeline" },
        { to: "/platforms", icon: Globe, label: "Platforms" },
        { to: "/analytics", icon: BarChart3, label: "Analytics" },
        { to: "/cashflow", icon: Banknote, label: "Cashflow" },
        { to: "/invoices", icon: FileText, label: "Invoices" },
        { to: "/health", icon: HeartPulse, label: "Health" },
        { to: "/todos", icon: ListTodo, label: "To-Do" },
        { to: "/team", icon: Users, label: "Team" },
        { to: "/team/communications", icon: Mail, label: "Comms" },
        { to: "/templates", icon: MessageSquareText, label: "Templates" },
        { to: "/spreadsheet-templates", icon: FileSpreadsheet, label: "Sheets" },
        { to: "/activity", icon: ClipboardList, label: "Activity" },
      ]
    : [
        { to: "/purchases", icon: Package, label: "Purchases" },
        { to: "/inventory", icon: Boxes, label: "Inventory" },
        { to: "/todos", icon: ListTodo, label: "To-Do" },
      ];

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const isMoreActive = moreItems.some((item) => isActive(item.to));

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm flex flex-col md:hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <span className="text-lg font-bold">Menu</span>
            <button
              onClick={() => setMoreOpen(false)}
              className="h-11 w-11 flex items-center justify-center rounded-lg bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-24">
            <div className="grid grid-cols-3 gap-3">
              {moreItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl p-4 text-center transition-colors min-h-[76px]",
                    isActive(item.to)
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>
            <div className="mt-6 space-y-2">
              <button
                onClick={() => { toggleTheme(); setMoreOpen(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium bg-muted/50 text-foreground"
              >
                {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </button>
              <button
                onClick={async () => { sessionStorage.removeItem("vjx_finance_unlocked"); await supabase.auth.signOut(); }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium bg-muted/50 text-destructive"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm md:hidden safe-area-bottom">
        <div className="flex items-stretch justify-around">
          {mainTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[56px] transition-colors",
                isActive(tab.to)
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 min-h-[56px] transition-colors",
              isMoreActive || moreOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
