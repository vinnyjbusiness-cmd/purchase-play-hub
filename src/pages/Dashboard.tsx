import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  Send,
  AlertTriangle,
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
  const [todaySales, setTodaySales] = useState({ count: 0, tickets: 0, revenue: 0 });
  const [awaitingDelivery, setAwaitingDelivery] = useState<OrderInfo[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventInfo[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [openOrders, setOpenOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [profileRes, eventsRes, ordersRes, platformsRes, purchasesRes] = await Promise.all([
        supabase.from("profiles").select("display_name").limit(1).single(),
        supabase.from("events").select("id,match_code,home_team,away_team,event_date").order("event_date"),
        supabase.from("orders").select("id,order_ref,status,delivery_status,event_id,quantity,sale_price,order_date,platform_id"),
        supabase.from("platforms").select("id,name"),
        supabase.from("purchases").select("total_cost_gbp,total_cost,quantity,unit_cost"),
      ]);

      if (profileRes.data?.display_name) setDisplayName(profileRes.data.display_name);

      const allEvents = eventsRes.data || [];
      const allOrders = ordersRes.data || [];
      const allPlatforms = platformsRes.data || [];
      const allPurchases = purchasesRes.data || [];

      setEvents(allEvents);
      setOrders(allOrders);
      setPlatforms(allPlatforms);

      // Today's sales
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const todayOrders = allOrders.filter(o => o.order_date.startsWith(todayStr));
      setTodaySales({
        count: todayOrders.length,
        tickets: todayOrders.reduce((s, o) => s + o.quantity, 0),
        revenue: todayOrders.reduce((s, o) => s + Number(o.sale_price), 0),
      });

      // Awaiting delivery (pending/fulfilled, not delivered)
      const awaiting = allOrders.filter(o =>
        (o.status === "pending" || o.status === "fulfilled") &&
        o.delivery_status !== "delivered"
      );
      setAwaitingDelivery(awaiting);

      // Upcoming events (next 7 days)
      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcoming = allEvents.filter(e => {
        const d = new Date(e.event_date);
        return d >= now && d <= sevenDays;
      });
      setUpcomingEvents(upcoming);

      // Totals
      setTotalRevenue(allOrders.reduce((s, o) => s + Number(o.sale_price), 0));
      setTotalCost(allPurchases.reduce((s, p) => s + (Number(p.total_cost_gbp) || Number(p.total_cost) || (p.quantity * Number(p.unit_cost))), 0));
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

  const profit = totalRevenue - totalCost;

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting()}, {displayName}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
        </div>
      </div>

      {/* Top row: Today's Sales + Awaiting Delivery */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Sales Today</CardTitle>
            <Badge variant="outline" className="text-xs">Today</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold">{todaySales.count}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{todaySales.tickets}</p>
                <p className="text-xs text-muted-foreground">Tickets</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-success">£{todaySales.revenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
            </div>
            {todaySales.count === 0 && (
              <p className="text-sm text-muted-foreground mt-3 text-center">No sales today</p>
            )}
          </CardContent>
        </Card>

        {/* Awaiting Delivery */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Awaiting Delivery</CardTitle>
            <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
              {awaitingDelivery.length} pending
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold">{awaitingDelivery.length}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{awaitingDelivery.reduce((s, o) => s + o.quantity, 0)}</p>
                <p className="text-xs text-muted-foreground">Tickets</p>
              </div>
            </div>
            {awaitingDelivery.length === 0 && (
              <p className="text-sm text-muted-foreground mt-3 text-center">All deliveries complete</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">£{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            {profit >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${profit >= 0 ? "text-success" : "text-destructive"}`}>
              £{profit.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Events (Next 7d)</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{upcomingEvents.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders needing fulfillment */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Orders Needing Fulfillment
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/orders")} className="text-xs">
            View all <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {awaitingDelivery.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">All orders fulfilled! 🎉</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {awaitingDelivery.slice(0, 8).map(o => {
                  const ev = eventMap[o.event_id];
                  return (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/orders")}>
                      <TableCell className="font-medium">{o.order_ref || "—"}</TableCell>
                      <TableCell>{ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown"}</TableCell>
                      <TableCell>{o.platform_id ? platformMap[o.platform_id]?.name || "—" : "—"}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">{o.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{o.delivery_status || "pending"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Games in Next 7 Days
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/events")} className="text-xs">
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingEvents.map(ev => {
                  const eventOrders = orders.filter(o => o.event_id === ev.id);
                  const unfulfilled = eventOrders.filter(o => o.delivery_status !== "delivered");
                  return (
                    <TableRow key={ev.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/events/${ev.id}`)}>
                      <TableCell className="font-medium">{ev.home_team} vs {ev.away_team}</TableCell>
                      <TableCell className="text-muted-foreground">{ev.match_code}</TableCell>
                      <TableCell>{format(new Date(ev.event_date), "EEE dd MMM, HH:mm")}</TableCell>
                      <TableCell>
                        {unfulfilled.length > 0 ? (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" />{unfulfilled.length} to fill
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">All done</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
