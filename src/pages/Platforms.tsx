import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, TrendingUp, TrendingDown, CalendarDays, DollarSign, Package } from "lucide-react";
import { format } from "date-fns";

interface Platform {
  id: string;
  name: string;
  fee_type: string | null;
  fee_value: number | null;
}

interface OrderRow {
  id: string;
  order_ref: string | null;
  sale_price: number;
  fees: number;
  net_received: number | null;
  status: string;
  delivery_status: string | null;
  order_date: string;
  quantity: number;
  payment_received: boolean;
  event_id: string;
  platform_id: string | null;
}

interface EventRow {
  id: string;
  match_code: string;
  home_team: string;
  away_team: string;
  event_date: string;
}

export default function Platforms() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    async function load() {
      const [platRes, ordersRes, eventsRes] = await Promise.all([
        supabase.from("platforms").select("id, name, fee_type, fee_value").order("name"),
        supabase.from("orders").select("id, order_ref, sale_price, fees, net_received, status, delivery_status, order_date, quantity, payment_received, event_id, platform_id"),
        supabase.from("events").select("id, match_code, home_team, away_team, event_date"),
      ]);
      const plats = platRes.data || [];
      setPlatforms(plats);
      setOrders(ordersRes.data || []);
      setEvents(eventsRes.data || []);
      if (plats.length > 0 && !activeTab) setActiveTab(plats[0].id);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Platforms</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (platforms.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Platforms</h1>
        <p className="text-muted-foreground">No platforms found. Add platforms from the Orders page.</p>
      </div>
    );
  }

  const eventMap = new Map(events.map((e) => [e.id, e]));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platforms</h1>
        <p className="text-muted-foreground">{platforms.length} platform{platforms.length !== 1 ? "s" : ""} configured</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {platforms.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className="text-sm">
              {p.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {platforms.map((platform) => {
          const platOrders = orders.filter((o) => o.platform_id === platform.id);
          const totalRevenue = platOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
          const totalFees = platOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
          const totalNet = platOrders.reduce((s, o) => s + Number(o.net_received || 0), 0);
          const totalQty = platOrders.reduce((s, o) => s + o.quantity, 0);
          const unpaidCount = platOrders.filter((o) => !o.payment_received).length;
          const unpaidAmount = platOrders.filter((o) => !o.payment_received).reduce((s, o) => s + Number(o.net_received || 0), 0);

          // Group by event
          const eventIds = [...new Set(platOrders.map((o) => o.event_id))];
          const eventBreakdown = eventIds.map((eid) => {
            const ev = eventMap.get(eid);
            const evOrders = platOrders.filter((o) => o.event_id === eid);
            const rev = evOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
            const net = evOrders.reduce((s, o) => s + Number(o.net_received || 0), 0);
            const fees = evOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
            return {
              eventId: eid,
              matchCode: ev?.match_code || "Unknown",
              teams: ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown",
              eventDate: ev?.event_date || "",
              orderCount: evOrders.length,
              qty: evOrders.reduce((s, o) => s + o.quantity, 0),
              revenue: rev,
              fees,
              net,
            };
          }).sort((a, b) => (b.eventDate > a.eventDate ? 1 : -1));

          // Status breakdown
          const statusCounts: Record<string, number> = {};
          platOrders.forEach((o) => {
            statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
          });

          return (
            <TabsContent key={platform.id} value={platform.id} className="space-y-6 mt-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5" /> Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{platOrders.length}</p>
                    <p className="text-xs text-muted-foreground">{totalQty} tickets</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" /> Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">£{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">Fees: £{totalFees.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" /> Net Received
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">£{totalNet.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" /> Owed to You
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-bold ${unpaidAmount > 0 ? "text-warning" : "text-success"}`}>
                      £{unpaidAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{unpaidCount} unpaid order{unpaidCount !== 1 ? "s" : ""}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Status breakdown */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <Badge key={status} variant="secondary" className="text-xs">
                    {status}: {count}
                  </Badge>
                ))}
              </div>

              {/* Events breakdown table */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> By Event
                </h3>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Fees</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventBreakdown.map((eb) => (
                        <TableRow key={eb.eventId}>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{eb.matchCode}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{eb.teams}</TableCell>
                          <TableCell className="text-right">{eb.orderCount}</TableCell>
                          <TableCell className="text-right">{eb.qty}</TableCell>
                          <TableCell className="text-right font-medium">£{eb.revenue.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">£{eb.fees.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">£{eb.net.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {eventBreakdown.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders on this platform</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Recent orders */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Recent Orders
                </h3>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead className="text-right">Sale</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {platOrders.slice(0, 20).map((o) => {
                        const ev = eventMap.get(o.event_id);
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium text-sm">{o.order_ref || o.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm">{ev?.match_code || "—"}</TableCell>
                            <TableCell className="text-right text-sm">£{Number(o.sale_price).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-sm">£{Number(o.net_received || 0).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{o.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={o.payment_received ? "default" : "outline"} className={`text-xs ${o.payment_received ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                                {o.payment_received ? "Paid" : "Unpaid"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{format(new Date(o.order_date), "dd MMM yy")}</TableCell>
                          </TableRow>
                        );
                      })}
                      {platOrders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders yet</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
