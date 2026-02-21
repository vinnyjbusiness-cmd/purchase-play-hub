import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ShoppingCart,
  ArrowRight,
  Send,
  AlertTriangle,
  Zap,
  Package,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EventInfo { id: string; match_code: string; home_team: string; away_team: string; event_date: string; }
interface OrderInfo { id: string; order_ref: string | null; status: string; delivery_status: string | null; event_id: string; quantity: number; sale_price: number; order_date: string; platform_id: string | null; }
interface PlatformInfo { id: string; name: string; }

export default function Dashboard() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("VJX");
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [todaySales, setTodaySales] = useState({ count: 0, tickets: 0 });
  const [awaitingDelivery, setAwaitingDelivery] = useState<OrderInfo[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventInfo[]>([]);
  const [openOrders, setOpenOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [profileRes, eventsRes, ordersRes, platformsRes] = await Promise.all([
        supabase.from("profiles").select("display_name").limit(1).single(),
        supabase.from("events").select("id,match_code,home_team,away_team,event_date").order("event_date"),
        supabase.from("orders").select("id,order_ref,status,delivery_status,event_id,quantity,sale_price,order_date,platform_id"),
        supabase.from("platforms").select("id,name"),
      ]);

      if (profileRes.data?.display_name) setDisplayName(profileRes.data.display_name);

      const allEvents = eventsRes.data || [];
      const allOrders = ordersRes.data || [];
      const allPlatforms = platformsRes.data || [];

      setEvents(allEvents);
      setOrders(allOrders);
      setPlatforms(allPlatforms);

      const todayStr = format(new Date(), "yyyy-MM-dd");
      const todayOrders = allOrders.filter(o => o.order_date.startsWith(todayStr));
      setTodaySales({
        count: todayOrders.length,
        tickets: todayOrders.reduce((s, o) => s + o.quantity, 0),
      });

      const awaiting = allOrders.filter(o =>
        (o.status === "pending" || o.status === "fulfilled") &&
        o.delivery_status !== "delivered"
      );
      setAwaitingDelivery(awaiting);

      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setUpcomingEvents(allEvents.filter(e => {
        const d = new Date(e.event_date);
        return d >= now && d <= sevenDays;
      }));

      setOpenOrders(allOrders.filter(o => o.status === "pending" || o.status === "fulfilled").length);
      setLoading(false);
    }
    load();
  }, []);

  const platformMap = Object.fromEntries(platforms.map(p => [p.id, p]));
  const eventMap = Object.fromEntries(events.map(e => [e.id, e]));

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Combine upcoming events with their fulfillment data, sorted by date ascending
  const upcomingWithFulfillment = upcomingEvents
    .map(ev => {
      const eventOrders = orders.filter(o => o.event_id === ev.id);
      const unfulfilled = eventOrders.filter(o => o.delivery_status !== "delivered");
      const daysUntil = Math.ceil((new Date(ev.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return { ...ev, eventOrders, unfulfilled, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // Delivery queue - orders needing delivery for next 7 days events only
  const next7dEventIds = new Set(upcomingEvents.map(e => e.id));
  const deliveryQueue = awaitingDelivery
    .filter(o => next7dEventIds.has(o.event_id))
    .sort((a, b) => {
      const evA = eventMap[a.event_id];
      const evB = eventMap[b.event_id];
      if (evA && evB) return new Date(evA.event_date).getTime() - new Date(evB.event_date).getTime();
      return 0;
    });

  return (
    <div className="p-6 space-y-6">
      {/* Welcome header */}
      <div className="rounded-xl border bg-gradient-to-r from-primary/5 via-primary/3 to-transparent p-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold tracking-tight">{greeting()}, {displayName}</h1>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
            </span>
            <span className="text-xs text-success font-semibold tracking-wide">LIVE</span>
          </span>
        </div>
        <p className="text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          <span className="text-sm font-medium">{format(new Date(), "EEEE, d MMMM yyyy")}</span>
          <span className="text-muted-foreground/50">•</span>
          <span className="font-mono text-sm">{format(new Date(), "HH:mm")}</span>
        </p>
      </div>

      {/* KPI strip - 3 items */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Open Orders",
            value: `${openOrders}`,
            icon: ShoppingCart,
            color: openOrders > 0 ? "text-warning" : "text-success",
            bg: openOrders > 0 ? "bg-warning/5 border-warning/20" : "bg-success/5 border-success/20",
          },
          {
            label: "Awaiting Delivery",
            value: `${awaitingDelivery.length}`,
            icon: Send,
            color: awaitingDelivery.length > 0 ? "text-warning" : "text-success",
            bg: awaitingDelivery.length > 0 ? "bg-warning/5 border-warning/20" : "bg-success/5 border-success/20",
          },
          {
            label: "Upcoming Events",
            value: `${upcomingEvents.length}`,
            icon: CalendarDays,
            color: "text-primary",
            bg: "bg-primary/5 border-primary/20",
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-lg border p-3 ${kpi.bg} transition-colors`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{kpi.label}</span>
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
            </div>
            <p className={`font-mono text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Today's Activity + Delivery Queue side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's Sales */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-sm">Today's Activity</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{format(new Date(), "dd MMM yyyy")}</span>
          </div>
          <CardContent className="pt-2">
            {todaySales.count > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted/50 p-3 text-center">
                  <p className="font-mono text-2xl font-bold">{todaySales.count}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">New Sales</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-center">
                  <p className="font-mono text-2xl font-bold">{todaySales.tickets}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Tickets</p>
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground font-mono">NO NEW SALES TODAY</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Queue - Next 7 Days */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-warning/10">
                <Package className="h-4 w-4 text-warning" />
              </div>
              <span className="font-semibold text-sm">Delivery Queue — Next 7 Days</span>
            </div>
            {deliveryQueue.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">
                <CircleDot className="h-3 w-3" /> Action Required
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20">
                Clear
              </span>
            )}
          </div>
          <CardContent className="pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <p className="font-mono text-2xl font-bold">{deliveryQueue.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Orders</p>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <p className="font-mono text-2xl font-bold">{deliveryQueue.reduce((s, o) => s + o.quantity, 0)}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Tickets</p>
              </div>
            </div>
            {deliveryQueue.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center font-mono">ALL DELIVERIES COMPLETE</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Fixtures & Fulfillment — combined */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Next 7 Days — Fixtures & Fulfillment</span>
            <span className="font-mono text-[10px] text-muted-foreground ml-1">({upcomingWithFulfillment.length} events)</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/events")} className="text-xs gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <CardContent className="p-0">
          {upcomingWithFulfillment.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground font-mono">NO FIXTURES IN NEXT 7 DAYS</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px] uppercase tracking-wider">
                    <TableHead className="text-[10px]">Match</TableHead>
                    <TableHead className="text-[10px]">Code</TableHead>
                    <TableHead className="text-[10px]">Kickoff</TableHead>
                    <TableHead className="text-[10px]">Countdown</TableHead>
                    <TableHead className="text-[10px]">Total Orders</TableHead>
                    <TableHead className="text-[10px]">Delivery Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingWithFulfillment.map(ev => (
                    <TableRow key={ev.id} className="cursor-pointer hover:bg-muted/50 font-mono text-xs" onClick={() => navigate(`/events/${ev.id}`)}>
                      <TableCell className="font-sans font-semibold">{ev.home_team} vs {ev.away_team}</TableCell>
                      <TableCell className="text-muted-foreground">{ev.match_code}</TableCell>
                      <TableCell>{format(new Date(ev.event_date), "EEE dd MMM, HH:mm")}</TableCell>
                      <TableCell>
                        <span className={`font-bold ${ev.daysUntil <= 1 ? "text-destructive" : ev.daysUntil <= 3 ? "text-warning" : "text-muted-foreground"}`}>
                          {ev.daysUntil <= 0 ? "TODAY" : `${ev.daysUntil}d`}
                        </span>
                      </TableCell>
                      <TableCell className="font-bold">{ev.eventOrders.length}</TableCell>
                      <TableCell>
                        {ev.unfulfilled.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-warning/10 text-warning">
                            <AlertTriangle className="h-3 w-3" />{ev.unfulfilled.length} pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-success/10 text-success">
                            ✓ clear
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
