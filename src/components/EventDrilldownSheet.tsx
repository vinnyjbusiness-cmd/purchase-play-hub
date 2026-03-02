import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, CalendarDays, ShoppingCart, DollarSign } from "lucide-react";
import type { AnalyticsOrder, AnalyticsPurchase } from "@/pages/Analytics";

interface DrilldownEvent {
  id: string;
  home_team: string;
  away_team: string;
  event_date: string;
  competition: string;
  venue?: string | null;
  city?: string | null;
  match_code?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: DrilldownEvent | null;
  orders: AnalyticsOrder[];
  purchases: AnalyticsPurchase[];
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

export default function EventDrilldownSheet({ open, onOpenChange, event, orders, purchases }: Props) {
  const activeOrders = useMemo(() => orders.filter(o => o.status !== "cancelled" && o.status !== "refunded"), [orders]);

  const { revenue, fees, costs, profit, margin, soldQty, boughtQty, sellThrough } = useMemo(() => {
    const rev = activeOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
    const f = activeOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
    const c = purchases.reduce((s, p) => s + Number(p.total_cost || p.quantity * p.unit_cost || 0), 0);
    const p = rev - c - f;
    const m = rev > 0 ? ((p / rev) * 100).toFixed(1) : "0.0";
    const sold = activeOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);
    const bought = purchases.reduce((s, pp) => s + Number(pp.quantity || 0), 0);
    const st = bought > 0 ? Math.min(100, (sold / bought) * 100) : 0;
    return { revenue: rev, fees: f, costs: c, profit: p, margin: m, soldQty: sold, boughtQty: bought, sellThrough: st };
  }, [activeOrders, purchases]);

  const dailySales = useMemo(() => {
    if (!event) return [];
    const eventDate = new Date(event.event_date);
    const days: { date: string; tickets: number; revenue: number }[] = [];
    for (let i = 0; i <= 30; i++) {
      const d = subDays(eventDate, 30 - i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayOrders = activeOrders.filter(o => o.order_date.substring(0, 10) === dateStr);
      days.push({
        date: format(d, "dd MMM"),
        tickets: dayOrders.reduce((s, o) => s + Number(o.quantity || 0), 0),
        revenue: dayOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0),
      });
    }
    return days.filter(d => d.tickets > 0 || days.some(dd => dd.tickets > 0));
  }, [activeOrders, event]);

  const platformBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    activeOrders.forEach(o => {
      const pid = o.platform_id || "direct";
      const existing = map.get(pid) || { count: 0, revenue: 0 };
      existing.count += Number(o.quantity || 0);
      existing.revenue += Number(o.sale_price || 0);
      map.set(pid, existing);
    });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [activeOrders]);

  const timeline = useMemo(() => {
    return [...activeOrders]
      .sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime())
      .slice(-10)
      .map(o => ({
        date: format(new Date(o.order_date), "dd MMM HH:mm"),
        ref: o.order_ref || o.id.slice(0, 8),
        qty: o.quantity,
        price: Number(o.sale_price),
      }));
  }, [activeOrders]);

  if (!event) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{event.home_team} vs {event.away_team}</SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-xs">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(new Date(event.event_date), "dd MMM yyyy, HH:mm")}
            {event.venue && ` · ${event.venue}`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="flex items-center gap-3">
            <Badge className={`text-sm px-3 py-1 ${profit >= 0 ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`} variant="outline">
              {profit >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
              {profit >= 0 ? "+" : ""}{fmt(profit)}
            </Badge>
            <span className="text-xs text-muted-foreground">{margin}% margin</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Revenue", value: fmt(revenue), icon: ShoppingCart },
              { label: "Costs", value: fmt(costs), icon: DollarSign },
              { label: "Fees", value: fmt(fees), icon: DollarSign },
              { label: "Net Profit", value: fmt(profit), icon: profit >= 0 ? TrendingUp : TrendingDown, color: profit >= 0 ? "text-success" : "text-destructive" },
            ].map(item => (
              <div key={item.label} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><item.icon className="h-3 w-3" /> {item.label}</div>
                <p className={`text-lg font-bold ${item.color || ""}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sell-through rate</span>
              <span className="font-semibold">{soldQty}/{boughtQty} ({sellThrough.toFixed(0)}%)</span>
            </div>
            <Progress value={sellThrough} className="h-2" />
          </div>

          {dailySales.length > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <h4 className="text-sm font-semibold mb-2">Tickets Sold Per Day</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dailySales} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="tickets" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {platformBreakdown.length > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <h4 className="text-sm font-semibold mb-2">Platform Breakdown</h4>
              <div className="space-y-2">
                {platformBreakdown.map(([pid, data]) => (
                  <div key={pid} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{pid === "direct" ? "Direct / Other" : pid.slice(0, 8)}</span>
                    <div className="flex items-center gap-3">
                      <span>{data.count} tickets</span>
                      <span className="font-semibold">{fmt(data.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {timeline.length > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <h4 className="text-sm font-semibold mb-2">Recent Sales Activity</h4>
              <div className="space-y-1.5">
                {timeline.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t.date}</span>
                    <span>{t.ref} · {t.qty} tickets</span>
                    <span className="font-semibold">{fmt(t.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
