import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, ArrowDownLeft, ArrowUpRight, Banknote } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, addDays, isToday, getDay } from "date-fns";

interface OrderWithPayout {
  id: string;
  order_ref: string | null;
  sale_price: number;
  fees: number;
  net_received: number | null;
  quantity: number;
  status: string;
  payment_received: boolean;
  event_id: string;
  platform_id: string | null;
  order_date: string;
  event_date: string | null;
  platform_name: string | null;
  payout_days: number;
  estimated_payout_date: Date;
  event_label: string;
}

interface PurchaseDue {
  id: string;
  supplier_name: string;
  contact_name: string | null;
  total_cost: number;
  total_cost_gbp: number | null;
  quantity: number;
  event_date: string;
  purchase_date: string;
  supplier_paid: boolean;
  event_label: string;
  due_date: Date;
}

const fmt = (v: number) => v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Cashflow() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [orders, setOrders] = useState<OrderWithPayout[]>([]);
  const [purchasesDue, setPurchasesDue] = useState<PurchaseDue[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    async function load() {
      const [ordersRes, eventsRes, platformsRes, purchasesRes, suppliersRes] = await Promise.all([
        supabase.from("orders").select("id,order_ref,sale_price,fees,net_received,quantity,status,payment_received,event_id,platform_id,order_date"),
        supabase.from("events").select("id,match_code,home_team,away_team,event_date"),
        supabase.from("platforms").select("id,name,payout_days"),
        supabase.from("purchases").select("id,supplier_id,total_cost,total_cost_gbp,quantity,purchase_date,supplier_paid,event_id"),
        supabase.from("suppliers").select("id,name,contact_name"),
      ]);

      const evMap = Object.fromEntries((eventsRes.data || []).map(e => [e.id, e]));
      const platMap = Object.fromEntries((platformsRes.data || []).map(p => [p.id, p]));
      const supMap = Object.fromEntries((suppliersRes.data || []).map(s => [s.id, s]));

      // Build payout estimates: event_date + platform payout_days
      const enrichedOrders: OrderWithPayout[] = (ordersRes.data || [])
        .filter(o => o.status !== "cancelled" && o.status !== "refunded")
        .map(o => {
          const ev = evMap[o.event_id];
          const plat = o.platform_id ? platMap[o.platform_id] : null;
          const payoutDays = (plat as any)?.payout_days ?? 7;
          const eventDate = ev?.event_date ? new Date(ev.event_date) : new Date(o.order_date);
          const estimatedPayout = addDays(eventDate, payoutDays);

          return {
            ...o,
            event_date: ev?.event_date || null,
            platform_name: plat?.name || "Direct",
            payout_days: payoutDays,
            estimated_payout_date: estimatedPayout,
            event_label: ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown",
          };
        });

      // Build purchase due dates: event_date - 2 days (need to pay supplier before event)
      const enrichedPurchases: PurchaseDue[] = (purchasesRes.data || [])
        .filter(p => !p.supplier_paid)
        .map(p => {
          const ev = evMap[p.event_id];
          const sup = supMap[p.supplier_id];
          const eventDate = ev?.event_date ? new Date(ev.event_date) : new Date(p.purchase_date);
          const dueDate = addDays(eventDate, -2); // Pay 2 days before event

          return {
            ...p,
            supplier_name: sup?.name || "Unknown",
            contact_name: sup?.contact_name || null,
            event_date: ev?.event_date || p.purchase_date,
            event_label: ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown",
            due_date: dueDate,
            total_cost_gbp: p.total_cost_gbp,
          };
        });

      setOrders(enrichedOrders);
      setPurchasesDue(enrichedPurchases);
    }
    load();
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start to Monday
  const startDow = getDay(monthStart); // 0=Sun
  const mondayOffset = startDow === 0 ? 6 : startDow - 1;
  const paddedStart = Array.from({ length: mondayOffset }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - mondayOffset + i);
    return d;
  });
  const allDays = [...paddedStart, ...daysInMonth];
  // Pad end to fill last week
  const remaining = 7 - (allDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(monthEnd);
      d.setDate(d.getDate() + i);
      allDays.push(d);
    }
  }

  // Map payouts/expenses by date string
  const payoutsByDate = useMemo(() => {
    const map: Record<string, OrderWithPayout[]> = {};
    orders.forEach(o => {
      const key = format(o.estimated_payout_date, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(o);
    });
    return map;
  }, [orders]);

  const expensesByDate = useMemo(() => {
    const map: Record<string, PurchaseDue[]> = {};
    purchasesDue.forEach(p => {
      const key = format(p.due_date, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [purchasesDue]);

  // Monthly totals
  const monthPayouts = orders
    .filter(o => o.estimated_payout_date >= monthStart && o.estimated_payout_date <= monthEnd)
    .reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);

  const monthExpenses = purchasesDue
    .filter(p => p.due_date >= monthStart && p.due_date <= monthEnd)
    .reduce((s, p) => s + (p.total_cost_gbp || Number(p.total_cost)), 0);

  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedPayouts = selectedKey ? payoutsByDate[selectedKey] || [] : [];
  const selectedExpenses = selectedKey ? expensesByDate[selectedKey] || [] : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cashflow Calendar</h1>
        <p className="text-muted-foreground text-sm">Estimated payout dates based on event dates + platform payout terms</p>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownLeft className="h-4 w-4 text-success" />
            <p className="text-sm text-muted-foreground">Expected In</p>
          </div>
          <p className="text-xl font-bold text-success font-mono">£{fmt(monthPayouts)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="h-4 w-4 text-destructive" />
            <p className="text-sm text-muted-foreground">Due Out</p>
          </div>
          <p className="text-xl font-bold text-destructive font-mono">£{fmt(monthExpenses)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">Net Flow</p>
          </div>
          <p className={`text-xl font-bold font-mono ${monthPayouts - monthExpenses >= 0 ? "text-success" : "text-destructive"}`}>
            £{fmt(monthPayouts - monthExpenses)}
          </p>
        </div>
      </div>

      {/* Calendar nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b bg-muted/30">
              {d}
            </div>
          ))}
          {allDays.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const dayPayouts = payoutsByDate[key] || [];
            const dayExpenses = expensesByDate[key] || [];
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const dayPayoutTotal = dayPayouts.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
            const dayExpenseTotal = dayExpenses.reduce((s, p) => s + (p.total_cost_gbp || Number(p.total_cost)), 0);
            const hasData = dayPayouts.length > 0 || dayExpenses.length > 0;

            return (
              <div
                key={i}
                onClick={() => hasData && setSelectedDate(day)}
                className={`min-h-[80px] border-b border-r p-1.5 transition-colors ${
                  !isCurrentMonth ? "opacity-30" : ""
                } ${hasData ? "cursor-pointer hover:bg-muted/50" : ""} ${
                  isSelected ? "bg-primary/5 ring-1 ring-primary/30" : ""
                } ${isToday(day) ? "bg-accent/50" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-mono ${isToday(day) ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </span>
                </div>
                {dayPayouts.length > 0 && (
                  <div className="rounded px-1 py-0.5 mb-0.5 bg-success/10 border border-success/20">
                    <p className="text-[9px] font-bold text-success font-mono truncate">+£{fmt(dayPayoutTotal)}</p>
                    <p className="text-[8px] text-success/70">{dayPayouts.length} payout{dayPayouts.length > 1 ? "s" : ""}</p>
                  </div>
                )}
                {dayExpenses.length > 0 && (
                  <div className="rounded px-1 py-0.5 bg-destructive/10 border border-destructive/20">
                    <p className="text-[9px] font-bold text-destructive font-mono truncate">-£{fmt(dayExpenseTotal)}</p>
                    <p className="text-[8px] text-destructive/70">{dayExpenses.length} due</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (selectedPayouts.length > 0 || selectedExpenses.length > 0) && (
        <Card>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{format(selectedDate, "EEEE, d MMMM yyyy")}</span>
          </div>
          <CardContent className="space-y-4">
            {selectedPayouts.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-success mb-2 flex items-center gap-1">
                  <ArrowDownLeft className="h-3 w-3" /> Expected Payouts
                </p>
                <div className="space-y-2">
                  {selectedPayouts.map(o => (
                    <div key={o.id} className="flex items-center justify-between rounded-md bg-success/5 border border-success/10 p-2.5">
                      <div>
                        <p className="text-sm font-medium">{o.event_label}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.platform_name} · Order #{o.order_ref || "—"} · {o.quantity} ticket{o.quantity > 1 ? "s" : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Event: {o.event_date ? format(new Date(o.event_date), "dd MMM") : "—"} + {o.payout_days} days
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-success">+£{fmt(o.net_received || o.sale_price - o.fees)}</p>
                        {o.payment_received && <Badge className="text-[9px] bg-success/20 text-success border-0">Received</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedExpenses.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-destructive mb-2 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" /> Supplier Payments Due
                </p>
                <div className="space-y-2">
                  {selectedExpenses.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-md bg-destructive/5 border border-destructive/10 p-2.5">
                      <div>
                        <p className="text-sm font-medium">{p.supplier_name}{p.contact_name ? ` · ${p.contact_name}` : ""}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.event_label} · {p.quantity} ticket{p.quantity > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="font-mono font-bold text-destructive">-£{fmt(p.total_cost_gbp || Number(p.total_cost))}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-success/20 border border-success/30" /> Expected payout (event date + platform days)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-destructive/20 border border-destructive/30" /> Supplier payment due (2 days before event)
        </span>
      </div>
    </div>
  );
}
