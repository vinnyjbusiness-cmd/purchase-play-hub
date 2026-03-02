import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, CalendarDays, Flame, Layers, FileText } from "lucide-react";
import { deduplicateEvents } from "@/lib/eventDedup";
import OverviewTab from "@/components/analytics/OverviewTab";
import EventsTab from "@/components/analytics/EventsTab";
import HeatmapTab from "@/components/analytics/HeatmapTab";
import PlatformsTab from "@/components/analytics/PlatformsTab";
import ReportsTab from "@/components/analytics/ReportsTab";

export interface AnalyticsEvent {
  id: string;
  match_code: string;
  home_team: string;
  away_team: string;
  event_date: string;
  competition: string;
  venue: string | null;
  city: string | null;
}

export interface AnalyticsOrder {
  id: string;
  sale_price: number;
  fees: number;
  quantity: number;
  order_date: string;
  event_id: string;
  status: string;
  platform_id: string | null;
  net_received: number | null;
  order_ref: string | null;
  payment_received: boolean;
  delivery_status: string | null;
}

export interface AnalyticsPurchase {
  id: string;
  total_cost: number | null;
  quantity: number;
  unit_cost: number;
  event_id: string;
}

export interface AnalyticsPlatform {
  id: string;
  name: string;
  fee_type: string | null;
  fee_value: number | null;
}

const TAB_KEYS = ["overview", "events", "heatmap", "platforms", "reports"] as const;
type TabKey = typeof TAB_KEYS[number];

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const activeTab = tabParam && TAB_KEYS.includes(tabParam) ? tabParam : "overview";

  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [orders, setOrders] = useState<AnalyticsOrder[]>([]);
  const [purchases, setPurchases] = useState<AnalyticsPurchase[]>([]);
  const [platforms, setPlatforms] = useState<AnalyticsPlatform[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("events").select("id,match_code,home_team,away_team,event_date,competition,venue,city"),
      supabase.from("orders").select("id,sale_price,fees,quantity,order_date,event_id,status,platform_id,net_received,order_ref,payment_received,delivery_status"),
      supabase.from("purchases").select("id,total_cost,quantity,unit_cost,event_id"),
      supabase.from("platforms").select("id,name,fee_type,fee_value").order("name"),
    ]).then(([ev, ord, purch, plat]) => {
      setEvents(ev.data || []);
      setOrders(ord.data || []);
      setPurchases(purch.data || []);
      setPlatforms((plat.data || []).map(p => ({ ...p, name: p.name === "WhatsApp" ? "Trade" : p.name })));
      setLoading(false);
    });
  }, []);

  const { unique: dedupEvents, groupedIds } = useMemo(() => deduplicateEvents(events), [events]);

  const handleTabChange = (value: string) => {
    if (value === "overview") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", value);
    }
    setSearchParams(searchParams, { replace: true });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Analytics
        </h1>
        <p className="text-muted-foreground text-sm">Performance hub — overview, events, heatmap, platforms & reports</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-sm gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="events" className="text-sm gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> Events
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="text-sm gap-1.5">
            <Flame className="h-3.5 w-3.5" /> Heatmap
          </TabsTrigger>
          <TabsTrigger value="platforms" className="text-sm gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Platforms
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-sm gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab events={dedupEvents} orders={orders} purchases={purchases} groupedIds={groupedIds} />
        </TabsContent>
        <TabsContent value="events">
          <EventsTab events={events} orders={orders} purchases={purchases} />
        </TabsContent>
        <TabsContent value="heatmap">
          <HeatmapTab events={dedupEvents} orders={orders} purchases={purchases} groupedIds={groupedIds} />
        </TabsContent>
        <TabsContent value="platforms">
          <PlatformsTab platforms={platforms} orders={orders} events={dedupEvents} groupedIds={groupedIds} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab events={dedupEvents} orders={orders} purchases={purchases} groupedIds={groupedIds} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
