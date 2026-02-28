import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import MobileBottomNav from "./MobileBottomNav";
import GlobalSearch from "./GlobalSearch";
import { useAuditTracker } from "@/hooks/useAuditTracker";

export default function AppLayout() {
  useAuditTracker();
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: hidden on mobile, icon rail on tablet, full on desktop */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b border-border bg-background px-4 md:px-6 py-2.5 shrink-0">
          <div className="flex-1 max-w-md md:max-w-md">
            <GlobalSearch />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
}
