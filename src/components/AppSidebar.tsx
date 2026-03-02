import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, ShoppingCart, Package, Wallet, Boxes, Scale,
  HeartPulse, Globe, Sun, Moon, LogOut, Users, Banknote, BarChart3, ClipboardList,
  Wallet as WalletIcon, ListTodo, CalendarClock, FileText, Siren, Truck,
  Contact, Handshake, ChevronLeft, ChevronRight, KeyRound, ChevronDown, Settings2,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { useTeamMember } from "@/hooks/useTeamMember";
import { PERMISSION_PAGES } from "@/lib/permissions";
import ChangePasswordDialog from "./ChangePasswordDialog";
import { ChangePinDialog } from "./FinancePinGate";
import SidebarCustomisePanel from "./SidebarCustomisePanel";
import { useSidebarConfig } from "@/hooks/useSidebarConfig";
import { useState, useMemo } from "react";

// Items that go into collapsible "Finance" dropdown
const FINANCE_ITEMS = [
  { to: "/balance", icon: Scale, label: "Balances" },
  { to: "/wallet", icon: WalletIcon, label: "Wallet" },
  { to: "/cashflow", icon: Banknote, label: "Cashflow" },
  { to: "/invoices", icon: FileText, label: "Invoices" },
  { to: "/ijk-account", icon: Handshake, label: "IJK Account" },
];

// Items that go into collapsible "Admin" dropdown
const ADMIN_ITEMS = [
  { to: "/health", icon: HeartPulse, label: "Health" },
  { to: "/team", icon: Users, label: "Team" },
  { to: "/todos", icon: ListTodo, label: "To-Do List" },
  { to: "/activity", icon: ClipboardList, label: "Activity Log" },
  { to: "/vault-passwords", icon: KeyRound, label: "Password Vault" },
];

// All paths that are inside dropdowns (for hiding from main list)
const DROPDOWN_PATHS = new Set([
  ...FINANCE_ITEMS.map(i => i.to),
  ...ADMIN_ITEMS.map(i => i.to),
]);

// Removed pages: Platforms (moved to Analytics), Communications, Spreadsheets, IJK standalone
const REMOVED_PATHS = new Set([
  "/platforms",
  "/team/communications",
  "/spreadsheet-templates",
]);

export default function AppSidebar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { userRole } = useOrg();
  const { isTeamMember, teamMember } = useTeamMember();
  const isAdmin = userRole === "admin";
  const [collapsed, setCollapsed] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const { config, saveConfig, resetConfig } = useSidebarConfig();

  // Auto-expand dropdowns if current route is inside them
  useState(() => {
    const path = location.pathname;
    if (FINANCE_ITEMS.some(i => path.startsWith(i.to))) setFinanceOpen(true);
    if (ADMIN_ITEMS.some(i => path.startsWith(i.to))) setAdminOpen(true);
  });

  const hasPageAccess = (path: string): boolean => {
    if (!isTeamMember || !teamMember) return true;
    const page = PERMISSION_PAGES.find((p) => p.path === path);
    if (!page) return true;
    return !!teamMember.permissions[page.key];
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("vjx_finance_unlocked");
    await supabase.auth.signOut();
  };

  // Main nav items (top section, not in dropdowns)
  const mainNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/warroom", icon: Siren, label: "War Room" },
    { to: "/world-cup", icon: Globe, label: "World Cup 2026" },
    { to: "/events", icon: CalendarDays, label: "Events" },
    { to: "/orders", icon: ShoppingCart, label: "Orders" },
    { to: "/listings", icon: Globe, label: "Listings" },
    { to: "/finance", icon: Wallet, label: "Finance" },
  ];

  const secondaryNavItems = [
    { to: "/suppliers", icon: Truck, label: "Contacts" },
    { to: "/members", icon: Contact, label: "Members" },
    { to: "/purchases", icon: Package, label: "Purchases" },
    { to: "/inventory", icon: Boxes, label: "Inventory" },
    { to: "/timeline", icon: CalendarClock, label: "Event Timeline" },
    { to: "/analytics", icon: BarChart3, label: "Analytics" },
    { to: "/templates", icon: FileText, label: "Templates" },
  ];

  // Filter out removed pages and dropdown pages from secondary
  const filteredSecondary = secondaryNavItems.filter(
    i => !REMOVED_PATHS.has(i.to) && !DROPDOWN_PATHS.has(i.to)
  );

  // All customisable items for the panel
  const allCustomisableItems = useMemo(() => {
    const items = [
      ...mainNavItems.filter(i => i.to !== "/"), // Dashboard always visible
      ...filteredSecondary,
      ...FINANCE_ITEMS,
      ...ADMIN_ITEMS,
    ];
    return items.map(i => ({ path: i.to, label: i.label }));
  }, []);

  // Check if an item is hidden by user config
  const isHiddenByConfig = (path: string): boolean => {
    if (!config || config.length === 0) return false;
    const item = config.find(c => c.path === path);
    return item ? !item.visible : false;
  };

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const renderNavLink = (item: { to: string; icon: any; label: string }) => {
    if (!hasPageAccess(item.to)) return null;
    if (isHiddenByConfig(item.to)) return null;
    const active = isActive(item.to);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        title={item.label}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-2",
          active
            ? "bg-sidebar-accent text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    );
  };

  const renderDropdown = (
    label: string,
    icon: any,
    items: typeof FINANCE_ITEMS,
    isOpen: boolean,
    toggle: () => void,
  ) => {
    const Icon = icon;
    const hasActiveChild = items.some(i => isActive(i.to));
    const visibleItems = items.filter(i => hasPageAccess(i.to) && !isHiddenByConfig(i.to));
    if (visibleItems.length === 0) return null;

    return (
      <div>
        <button
          onClick={toggle}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            collapsed && "justify-center px-2",
            hasActiveChild
              ? "text-sidebar-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{label}</span>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </>
          )}
        </button>
        {isOpen && !collapsed && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
            {visibleItems.map(item => {
              const active = isActive(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Viewer nav (non-admin)
  const viewerNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  ];
  const viewerBottomItems = [
    { to: "/orders", icon: ShoppingCart, label: "Orders" },
    { to: "/purchases", icon: Package, label: "Purchases" },
    { to: "/inventory", icon: Boxes, label: "Inventory" },
    { to: "/todos", icon: ListTodo, label: "To-Do List" },
  ];

  return (
    <>
      <aside className={cn(
        "flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-16" : "w-[240px]",
        "lg:w-[240px]"
      )}>
        <div className={cn("flex items-center border-b border-sidebar-border", collapsed ? "justify-center px-2 py-5" : "px-5 py-5")}>
          <span className="text-xl font-extrabold tracking-tight text-sidebar-primary-foreground">
            {collapsed ? "V" : "VJX"}
          </span>
        </div>

        <nav className="flex-1 px-2 lg:px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {isAdmin ? (
            <>
              {mainNavItems.filter(i => !REMOVED_PATHS.has(i.to)).map(renderNavLink)}
              
              {/* Finance dropdown */}
              {renderDropdown("Finance Hub", Banknote, FINANCE_ITEMS, financeOpen, () => setFinanceOpen(!financeOpen))}
              
              {/* Secondary items */}
              {filteredSecondary.map(renderNavLink)}
              
              {/* Admin dropdown */}
              {renderDropdown("Admin", Settings2, ADMIN_ITEMS, adminOpen, () => setAdminOpen(!adminOpen))}
            </>
          ) : (
            <>
              {viewerNavItems.map(renderNavLink)}
              {hasPageAccess("/orders") && renderNavLink({ to: "/orders", icon: ShoppingCart, label: "Orders" })}
              {viewerBottomItems.filter(i => i.to !== "/orders").filter(i => hasPageAccess(i.to)).map(renderNavLink)}
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border px-2 lg:px-3 py-3 space-y-1">
          {/* Customise nav button */}
          {isAdmin && (
            <button
              onClick={() => setCustomiseOpen(true)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                collapsed && "justify-center px-2"
              )}
            >
              <Settings2 className="h-4 w-4" />
              {!collapsed && "Customise"}
            </button>
          )}
          {/* Collapse toggle - only on tablet */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors lg:hidden"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
          <button
            onClick={toggleTheme}
            className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors", collapsed && "justify-center px-2")}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {!collapsed && (theme === "light" ? "Dark Mode" : "Light Mode")}
          </button>
          {!collapsed && <ChangePasswordDialog />}
          {!collapsed && isAdmin && <ChangePinDialog />}
          <button
            onClick={handleLogout}
            className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors", collapsed && "justify-center px-2")}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Customise Navigation Panel */}
      <SidebarCustomisePanel
        open={customiseOpen}
        onClose={() => setCustomiseOpen(false)}
        allItems={allCustomisableItems}
        config={config}
        onSave={saveConfig}
        onReset={resetConfig}
      />
    </>
  );
}
