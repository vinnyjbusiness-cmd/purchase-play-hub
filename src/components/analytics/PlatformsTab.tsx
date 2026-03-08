import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, TrendingUp, CalendarDays, DollarSign, Package, Percent } from "lucide-react";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import type { AnalyticsOrder, AnalyticsPlatform } from "@/pages/Analytics";
import type { MinimalEvent } from "@/lib/eventDedup";

interface Props {
  platforms: AnalyticsPlatform[];
  orders: AnalyticsOrder[];
  events: MinimalEvent[];
  groupedIds: Record<string, string[]>;
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

export default function PlatformsTab({ platforms, orders, events, groupedIds }: Props) {
  const [activeTab, setActiveTab] = useState(platforms.length > 0 ? platforms[0].id : "");

  const eventMap = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const idMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const ev of events) {
      const ids = groupedIds[ev.id] || [ev.id];
      ids.forEach(id => { m[id] = ev.id; });
    }
    return m;
  }, [events, groupedIds]);

  if (platforms.length === 0) {
    return <div className="mt-4 text-muted-foreground text-center py-12">No platforms configured</div>;
  }

  return (
    <div className="space-y-6 mt-4">
      <p className="text-muted-foreground text-sm">{platforms.length} platform{platforms.length !== 1 ? "s" : ""} configured</p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {platforms.map(p => <TabsTrigger key={p.id} value={p.id} className="text-sm">{p.name}</TabsTrigger>)}
        </TabsList>

        {platforms.map(platform => {
          const platOrders = orders.filter(o => o.platform_id === platform.id && o.status !== "cancelled" && o.status !== "refunded");
          const allPlatOrders = orders.filter(o => o.platform_id === platform.id);
          const totalRevenue = platOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
          const totalFees = platOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
          const totalNet = platOrders.reduce((s, o) => s + Number(o.net_received || (o.sale_price - o.fees) || 0), 0);
          const totalQty = platOrders.reduce((s, o) => s + o.quantity, 0);
          const unpaidCount = platOrders.filter(o => !o.payment_received).length;
          const unpaidAmount = platOrders.filter(o => !o.payment_received).reduce((s, o) => s + Number(o.net_received || 0), 0);
          const avgTicketPrice = totalQty > 0 ? totalRevenue / totalQty : 0;

          const eventGroups: Record<string, typeof platOrders> = {};
          platOrders.forEach(o => {
            const canonId = idMap[o.event_id] || o.event_id;
            if (!eventGroups[canonId]) eventGroups[canonId] = [];
            eventGroups[canonId].push(o);
          });

          const eventBreakdown = Object.entries(eventGroups).map(([canonId, evOrders]) => {
            const ev = eventMap.get(canonId);
            const rev = evOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
            const net = evOrders.reduce((s, o) => s + Number(o.net_received || (o.sale_price - o.fees) || 0), 0);
            const fees = evOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
            const qty = evOrders.reduce((s, o) => s + o.quantity, 0);
            const margin = rev > 0 ? ((net / rev) * 100).toFixed(1) : "—";
            return { eventId: canonId, teams: ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown", eventDate: ev?.event_date || "", orderCount: evOrders.length, qty, revenue: rev, fees, net, margin };
          }).sort((a, b) => (b.eventDate > a.eventDate ? 1 : -1));

          const statusCounts: Record<string, number> = {};
          allPlatOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

          return (
            <TabsContent key={platform.id} value={platform.id} className="space-y-6 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Orders", icon: ShoppingCart, value: platOrders.length, sub: `${totalQty} tickets` },
                  { label: "Revenue", icon: DollarSign, value: fmt(totalRevenue) },
                  { label: "Fees", icon: Percent, value: fmt(totalFees), color: "text-destructive" },
                  { label: "Net Received", icon: TrendingUp, value: fmt(totalNet), color: "text-success" },
                  { label: "Avg Ticket Price", icon: Package, value: fmt(avgTicketPrice) },
                  { label: "Owed to You", icon: Package, value: fmt(unpaidAmount), sub: `${unpaidCount} unpaid`, color: unpaidAmount > 0 ? "text-warning" : "text-success" },
                ].map(card => (
                  <Card key={card.label}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <card.icon className="h-3.5 w-3.5" /> {card.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${card.color || ""}`}>{card.value}</p>
                      {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <Badge key={status} variant="secondary" className="text-xs">{status}: {count}</Badge>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Performance by Event</h3>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Tickets</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Fees</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventBreakdown.map(eb => (
                        <TableRow key={eb.eventId}>
                          <TableCell className="font-medium text-sm">{eb.teams}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{eb.eventDate ? format(new Date(eb.eventDate), "dd MMM yy") : "—"}</TableCell>
                          <TableCell className="text-right">{eb.orderCount}</TableCell>
                          <TableCell className="text-right">{eb.qty}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(eb.revenue)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmt(eb.fees)}</TableCell>
                          <TableCell className="text-right font-medium text-success">{fmt(eb.net)}</TableCell>
                          <TableCell className="text-right text-sm">{eb.margin}%</TableCell>
                        </TableRow>
                      ))}
                      {eventBreakdown.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No orders on this platform</TableCell></TableRow>
                      )}
                      {eventBreakdown.length > 0 && (
                        <TableRow className="bg-muted/30 font-semibold border-t-2">
                          <TableCell colSpan={2}>Total</TableCell>
                          <TableCell className="text-right">{platOrders.length}</TableCell>
                          <TableCell className="text-right">{totalQty}</TableCell>
                          <TableCell className="text-right">{fmt(totalRevenue)}</TableCell>
                          <TableCell className="text-right">{fmt(totalFees)}</TableCell>
                          <TableCell className="text-right text-success">{fmt(totalNet)}</TableCell>
                          <TableCell className="text-right">{totalRevenue > 0 ? ((totalNet / totalRevenue) * 100).toFixed(1) : "—"}%</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Recent Orders</h3>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead className="text-right">Sale</TableHead>
                        <TableHead className="text-right">Fees</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allPlatOrders.slice(0, 20).map(o => {
                        const canonId = idMap[o.event_id] || o.event_id;
                        const ev = eventMap.get(canonId);
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium text-sm">{o.order_ref || o.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm">{ev ? `${ev.home_team} vs ${ev.away_team}` : "—"}</TableCell>
                            <TableCell className="text-right text-sm">{fmt(Number(o.sale_price))}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{fmt(Number(o.fees))}</TableCell>
                            <TableCell className="text-right text-sm">{fmt(Number(o.net_received || 0))}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{o.status}</Badge></TableCell>
                            <TableCell>
                              <Badge variant={o.payment_received ? "default" : "outline"} className={`text-xs ${o.payment_received ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                                {o.payment_received ? "Paid" : "Unpaid"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{format(new Date(o.order_date), "dd MMM yy")}</TableCell>
                          </TableRow>
                        );
                      })}
                      {allPlatOrders.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No orders yet</TableCell></TableRow>
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
