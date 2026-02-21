import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, CalendarDays, TrendingUp, TrendingDown, Package, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

interface EventWithPL {
  id: string;
  match_code: string;
  competition: string;
  home_team: string;
  away_team: string;
  event_date: string;
  venue: string | null;
  city: string | null;
  revenue: number;
  costs: number;
  fees: number;
  profit: number;
  totalInventory: number;
  soldCount: number;
  availableCount: number;
}

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventWithPL[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [eventsRes, ordersRes, purchasesRes, inventoryRes] = await Promise.all([
        supabase.from("events").select("*").order("event_date", { ascending: true }),
        supabase.from("orders").select("event_id, sale_price, fees, status"),
        supabase.from("purchases").select("event_id, total_cost"),
        supabase.from("inventory").select("event_id, status"),
      ]);

      const rawEvents = eventsRes.data || [];
      const orders = ordersRes.data || [];
      const purchases = purchasesRes.data || [];
      const inventory = inventoryRes.data || [];

      // Filter out past events and deduplicate by match_code
      const now = new Date();
      const futureEvents = rawEvents.filter((ev) => new Date(ev.event_date) >= now);
      const seen = new Set<string>();
      const uniqueEvents = futureEvents.filter((ev) => {
        if (seen.has(ev.match_code)) return false;
        seen.add(ev.match_code);
        return true;
      });

      const enriched: EventWithPL[] = uniqueEvents.map((ev) => {
        const evOrders = orders.filter((o) => o.event_id === ev.id);
        const evPurchases = purchases.filter((p) => p.event_id === ev.id);
        const evInventory = inventory.filter((i) => i.event_id === ev.id);

        const revenue = evOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
        const fees = evOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
        const costs = evPurchases.reduce((s, p) => s + Number(p.total_cost || 0), 0);

        return {
          ...ev,
          revenue,
          costs,
          fees,
          profit: revenue - costs - fees,
          totalInventory: evInventory.length,
          soldCount: evInventory.filter((i) => i.status === "sold").length,
          availableCount: evInventory.filter((i) => i.status === "available").length,
        };
      });

      setEvents(enriched);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = events.filter(
    (e) =>
      e.match_code.toLowerCase().includes(search.toLowerCase()) ||
      e.home_team.toLowerCase().includes(search.toLowerCase()) ||
      e.away_team.toLowerCase().includes(search.toLowerCase()) ||
      e.competition.toLowerCase().includes(search.toLowerCase())
  );

  const totalProfit = filtered.reduce((s, e) => s + e.profit, 0);
  const totalRevenue = filtered.reduce((s, e) => s + e.revenue, 0);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Events</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            {filtered.length} events · Revenue: £{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })} · Profit: <span className={totalProfit >= 0 ? "text-success" : "text-destructive"}>£{totalProfit.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((event) => (
          <Card key={event.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/events/${event.id}`)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">{event.match_code}</Badge>
                <Badge
                  variant="outline"
                  className={event.profit >= 0 ? "bg-success/10 text-success border-success/20 text-xs" : "bg-destructive/10 text-destructive border-destructive/20 text-xs"}
                >
                  {event.profit >= 0 ? "+" : ""}£{event.profit.toFixed(2)}
                </Badge>
              </div>
              <CardTitle className="text-base mt-2">
                {event.home_team} vs {event.away_team}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(new Date(event.event_date), "dd MMM yyyy, HH:mm")}
                </div>
                {event.venue && <p className="text-xs">{event.venue}{event.city ? `, ${event.city}` : ""}</p>}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <ShoppingCart className="h-3 w-3" /> Revenue
                  </div>
                  <p className="text-sm font-semibold">£{event.revenue.toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" /> Costs
                  </div>
                  <p className="text-sm font-semibold">£{event.costs.toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    {event.profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} Profit
                  </div>
                  <p className={`text-sm font-semibold ${event.profit >= 0 ? "text-success" : "text-destructive"}`}>
                    £{event.profit.toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>{event.totalInventory} tickets total</span>
                <span className="text-success">{event.soldCount} sold</span>
                <span>{event.availableCount} available</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-12">No events found</p>
        )}
      </div>
    </div>
  );
}
