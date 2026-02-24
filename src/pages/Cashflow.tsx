import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Calendar, ArrowDownLeft, ArrowUpRight,
  Banknote, Clock, TrendingUp, AlertTriangle,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  isSameDay, addDays, isToday, getDay, differenceInDays, isBefore, isAfter,
  startOfDay, endOfWeek, startOfWeek, isWithinInterval, isMonday,
} from "date-fns";
import {
  calculatePayoutDate, getPlatformRule, PLATFORM_COLORS,
  type PlatformPayoutRule,
} from "@/lib/payoutSchedule";

/* ── types ── */
interface OrderPayout {
  id: string;
  order_ref: string | null;
  sale_price: number;
  fees: number;
  net_received: number | null;
  quantity: number;
  status: string;
  payment_received: boolean;
  event_id: string;
  platform_name: string | null;
  platform_rule: PlatformPayoutRule;
  event_date: string | null;
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
  supplier_paid: boolean;
  event_label: string;
  due_date: Date;
}

const fmt = (v: number) =>
  v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Cashflow() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [orders, setOrders] = useState<OrderPayout[]>([]);
  const [purchases, setPurchases] = useState<PurchaseDue[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  /* ── data load ── */
  useEffect(() => {
    async function load() {
      const [ordersRes, eventsRes, platformsRes, purchasesRes, suppliersRes] =
        await Promise.all([
          supabase.from("orders").select("id,order_ref,sale_price,fees,net_received,quantity,status,payment_received,event_id,platform_id,order_date"),
          supabase.from("events").select("id,home_team,away_team,event_date"),
          supabase.from("platforms").select("id,name,payout_days"),
          supabase.from("purchases").select("id,supplier_id,total_cost,total_cost_gbp,quantity,purchase_date,supplier_paid,event_id"),
          supabase.from("suppliers").select("id,name,contact_name"),
        ]);

      const evMap = Object.fromEntries((eventsRes.data || []).map(e => [e.id, e]));
      const platMap = Object.fromEntries((platformsRes.data || []).map(p => [p.id, p]));
      const supMap = Object.fromEntries((suppliersRes.data || []).map(s => [s.id, s]));

      const enriched: OrderPayout[] = (ordersRes.data || [])
        .filter(o => o.status !== "cancelled" && o.status !== "refunded")
        .map(o => {
          const ev = evMap[o.event_id];
          const plat = o.platform_id ? platMap[o.platform_id] : null;
          const platformName = plat?.name || null;
          const rule = getPlatformRule(platformName);
          const eventDate = ev?.event_date ? new Date(ev.event_date) : new Date(o.order_date);
          const estimatedPayout = calculatePayoutDate(eventDate, rule);

          return {
            ...o,
            event_date: ev?.event_date || null,
            platform_name: platformName,
            platform_rule: rule,
            estimated_payout_date: estimatedPayout,
            event_label: ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown",
          };
        });

      const enrichedPurchases: PurchaseDue[] = (purchasesRes.data || [])
        .filter(p => !p.supplier_paid)
        .map(p => {
          const ev = evMap[p.event_id];
          const sup = supMap[p.supplier_id];
          const eventDate = ev?.event_date ? new Date(ev.event_date) : new Date(p.purchase_date);
          return {
            ...p,
            supplier_name: sup?.name || "Unknown",
            contact_name: sup?.contact_name || null,
            event_date: ev?.event_date || p.purchase_date,
            event_label: ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown",
            due_date: addDays(eventDate, -2),
            total_cost_gbp: p.total_cost_gbp,
          };
        });

      setOrders(enriched);
      setPurchases(enrichedPurchases);
    }
    load();
  }, []);

  /* ── calendar grid ── */
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);
  const mondayOffset = startDow === 0 ? 6 : startDow - 1;
  const paddedStart = Array.from({ length: mondayOffset }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - mondayOffset + i);
    return d;
  });
  const allDays = [...paddedStart, ...daysInMonth];
  const remaining = 7 - (allDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(monthEnd);
      d.setDate(d.getDate() + i);
      allDays.push(d);
    }
  }

  /* ── index by date ── */
  const payoutsByDate = useMemo(() => {
    const map: Record<string, OrderPayout[]> = {};
    orders.forEach(o => {
      const key = format(o.estimated_payout_date, "yyyy-MM-dd");
      (map[key] ??= []).push(o);
    });
    return map;
  }, [orders]);

  const expensesByDate = useMemo(() => {
    const map: Record<string, PurchaseDue[]> = {};
    purchases.forEach(p => {
      const key = format(p.due_date, "yyyy-MM-dd");
      (map[key] ??= []).push(p);
    });
    return map;
  }, [purchases]);

  /* ── summary calculations ── */
  const today = startOfDay(new Date());
  const next7 = addDays(today, 7);

  const netAmount = (o: OrderPayout) => o.net_received ?? o.sale_price - o.fees;

  const monthPayouts = orders
    .filter(o => o.estimated_payout_date >= monthStart && o.estimated_payout_date <= monthEnd)
    .reduce((s, o) => s + netAmount(o), 0);

  const monthExpenses = purchases
    .filter(p => p.due_date >= monthStart && p.due_date <= monthEnd)
    .reduce((s, p) => s + (p.total_cost_gbp || Number(p.total_cost)), 0);

  const next7Payouts = orders
    .filter(o => o.estimated_payout_date >= today && o.estimated_payout_date <= next7)
    .reduce((s, o) => s + netAmount(o), 0);

  /* ── This Week summary ── */
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const thisWeekPayouts = useMemo(() => {
    const byPlatform: Record<string, { name: string; amount: number; date: Date | null; rule: PlatformPayoutRule }> = {};
    orders.filter(o =>
      !o.payment_received &&
      isWithinInterval(o.estimated_payout_date, { start: weekStart, end: weekEnd })
    ).forEach(o => {
      const key = o.platform_rule;
      if (!byPlatform[key]) {
        const c = PLATFORM_COLORS[key];
        byPlatform[key] = { name: c.label, amount: 0, date: null, rule: key };
      }
      byPlatform[key].amount += netAmount(o);
      if (!byPlatform[key].date || o.estimated_payout_date < byPlatform[key].date!) {
        byPlatform[key].date = o.estimated_payout_date;
      }
    });
    return Object.values(byPlatform);
  }, [orders, weekStart, weekEnd]);

  const thisWeekTotal = thisWeekPayouts.reduce((s, p) => s + p.amount, 0);

  /* ── next payout per platform ── */
  const TRACKED_PLATFORMS: PlatformPayoutRule[] = ["tixstock", "footballticketnet", "fanpass"];

  const nextPayoutPerPlatform = useMemo(() => {
    const result: Record<PlatformPayoutRule, { date: Date | null; amount: number; count: number }> = {
      tixstock: { date: null, amount: 0, count: 0 },
      footballticketnet: { date: null, amount: 0, count: 0 },
      fanpass: { date: null, amount: 0, count: 0 },
      default: { date: null, amount: 0, count: 0 },
    };

    const upcoming = orders
      .filter(o => !o.payment_received && o.estimated_payout_date >= today)
      .sort((a, b) => a.estimated_payout_date.getTime() - b.estimated_payout_date.getTime());

    for (const rule of [...TRACKED_PLATFORMS, "default" as PlatformPayoutRule]) {
      const platformOrders = upcoming.filter(o => o.platform_rule === rule);
      if (platformOrders.length === 0) continue;
      const nextDate = platformOrders[0].estimated_payout_date;
      const sameDay = platformOrders.filter(o => isSameDay(o.estimated_payout_date, nextDate));
      result[rule] = {
        date: nextDate,
        amount: sameDay.reduce((s, o) => s + netAmount(o), 0),
        count: sameDay.length,
      };
    }
    return result;
  }, [orders, today]);

  /* ── selected day detail ── */
  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedPayouts = selectedKey ? payoutsByDate[selectedKey] || [] : [];
  const selectedExpenses = selectedKey ? expensesByDate[selectedKey] || [] : [];

  const selectedByPlatform = useMemo(() => {
    const map: Record<PlatformPayoutRule, OrderPayout[]> = {
      tixstock: [], footballticketnet: [], fanpass: [], default: [],
    };
    selectedPayouts.forEach(o => map[o.platform_rule].push(o));
    return map;
  }, [selectedPayouts]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cashflow Calendar</h1>
        <p className="text-muted-foreground text-sm">Platform-specific payout schedules & supplier payment deadlines</p>
      </div>

      {/* ── This Week Summary Panel ── */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-primary uppercase tracking-wider">This Week — {format(weekStart, "d MMM")} to {format(weekEnd, "d MMM")}</h2>
          <Badge variant="secondary" className="ml-auto text-xs font-mono">
            £{fmt(thisWeekTotal)} incoming
          </Badge>
        </div>
        {thisWeekPayouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payouts scheduled this week</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {thisWeekPayouts.map(p => {
              const c = PLATFORM_COLORS[p.rule];
              return (
                <div key={p.rule} className={`rounded-lg p-3 ${c.bg} border ${c.border}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                    <span className={`text-xs font-bold uppercase ${c.text}`}>{p.name}</span>
                  </div>
                  <p className={`text-lg font-bold font-mono ${c.text}`}>£{fmt(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.date ? format(p.date, "EEEE d MMM") : "—"}
                  </p>
                  {p.rule === "fanpass" && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Ensure bank details are updated</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Top summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label={`${format(currentMonth, "MMMM")} Est. In`}
          value={`£${fmt(monthPayouts)}`} className="text-success" />
        <SummaryCard icon={<ArrowUpRight className="h-4 w-4" />} label={`${format(currentMonth, "MMMM")} Due Out`}
          value={`£${fmt(monthExpenses)}`} className="text-destructive" />
        <SummaryCard icon={<Banknote className="h-4 w-4" />} label="Net Flow"
          value={`£${fmt(monthPayouts - monthExpenses)}`}
          className={monthPayouts - monthExpenses >= 0 ? "text-success" : "text-destructive"} />
        <SummaryCard icon={<Clock className="h-4 w-4" />} label="Next 7 Days In"
          value={`£${fmt(next7Payouts)}`} className="text-primary" />
      </div>

      {/* ── Next payout per platform ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TRACKED_PLATFORMS.map(rule => {
          const info = nextPayoutPerPlatform[rule];
          const colors = PLATFORM_COLORS[rule];
          return (
            <div key={rule} className={`rounded-lg border p-3 ${colors.bg} ${colors.border}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                  {colors.label}
                </span>
              </div>
              {info.date ? (
                <>
                  <p className={`text-lg font-bold font-mono ${colors.text}`}>£{fmt(info.amount)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(info.date, "EEEE d MMM")} · {info.count} order{info.count > 1 ? "s" : ""}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No upcoming payouts</p>
              )}
              {rule === "footballticketnet" && (
                <p className="text-[10px] text-muted-foreground mt-1 italic">Pays out every Monday</p>
              )}
              {rule === "fanpass" && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Bank details need updating</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Calendar nav ── */}
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

      {/* ── Calendar grid ── */}
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
            const hasData = dayPayouts.length > 0 || dayExpenses.length > 0;

            // FTN Monday recurring marker
            const isFTNMonday = isMonday(day) && isCurrentMonth;

            const byPlatform: Partial<Record<PlatformPayoutRule, number>> = {};
            dayPayouts.forEach(o => {
              byPlatform[o.platform_rule] = (byPlatform[o.platform_rule] || 0) + netAmount(o);
            });
            const dayExpenseTotal = dayExpenses.reduce((s, p) => s + (p.total_cost_gbp || Number(p.total_cost)), 0);

            return (
              <div
                key={i}
                onClick={() => (hasData || isFTNMonday) && setSelectedDate(day)}
                className={`min-h-[90px] border-b border-r p-1.5 transition-colors ${
                  !isCurrentMonth ? "opacity-30" : ""
                } ${hasData || isFTNMonday ? "cursor-pointer hover:bg-muted/50" : ""} ${
                  isSelected ? "bg-primary/5 ring-1 ring-primary/30" : ""
                } ${isToday(day) ? "bg-accent/50" : ""}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-mono ${isToday(day) ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </span>
                  {isFTNMonday && !byPlatform.footballticketnet && (
                    <span className="text-[7px] font-bold text-amber-400 bg-amber-500/10 rounded px-1">FTN</span>
                  )}
                </div>
                {(Object.entries(byPlatform) as [PlatformPayoutRule, number][]).map(([rule, total]) => {
                  const c = PLATFORM_COLORS[rule];
                  return (
                    <div key={rule} className={`rounded px-1 py-0.5 mb-0.5 ${c.bg} border ${c.border}`}>
                      <p className={`text-[9px] font-bold font-mono truncate ${c.text}`}>+£{fmt(total)}</p>
                      <p className={`text-[7px] ${c.text} opacity-70`}>{c.label}</p>
                    </div>
                  );
                })}
                {dayExpenses.length > 0 && (
                  <div className="rounded px-1 py-0.5 bg-destructive/10 border border-destructive/20">
                    <p className="text-[9px] font-bold text-destructive font-mono truncate">-£{fmt(dayExpenseTotal)}</p>
                    <p className="text-[7px] text-destructive/70">{dayExpenses.length} due</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Selected day detail ── */}
      {selectedDate && (selectedPayouts.length > 0 || selectedExpenses.length > 0) && (
        <Card>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{format(selectedDate, "EEEE, d MMMM yyyy")}</span>
          </div>
          <CardContent className="space-y-4">
            {(Object.entries(selectedByPlatform) as [PlatformPayoutRule, OrderPayout[]][])
              .filter(([, arr]) => arr.length > 0)
              .map(([rule, arr]) => {
                const c = PLATFORM_COLORS[rule];
                const total = arr.reduce((s, o) => s + netAmount(o), 0);
                return (
                  <div key={rule}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 ${c.text}`}>
                        <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                        {c.label} Payouts
                      </p>
                      <Badge className={`${c.bg} ${c.text} border-0 font-mono text-xs`}>
                        £{fmt(total)}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {arr.map(o => (
                        <div key={o.id} className={`flex items-center justify-between rounded-md p-2.5 ${c.bg} border ${c.border}`}>
                          <div>
                            <p className="text-sm font-medium">{o.event_label}</p>
                            <p className="text-xs text-muted-foreground">
                              Order #{o.order_ref || "—"} · {o.quantity} ticket{o.quantity > 1 ? "s" : ""}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Event: {o.event_date ? format(new Date(o.event_date), "EEE dd MMM") : "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-mono font-bold ${c.text}`}>+£{fmt(netAmount(o))}</p>
                            {o.payment_received && (
                              <Badge className="text-[9px] bg-success/20 text-success border-0">Received</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            {selectedExpenses.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-destructive mb-2 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" /> Supplier Payments Due
                </p>
                <div className="space-y-1.5">
                  {selectedExpenses.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-md bg-destructive/5 border border-destructive/10 p-2.5">
                      <div>
                        <p className="text-sm font-medium">{p.supplier_name}{p.contact_name ? ` · ${p.contact_name}` : ""}</p>
                        <p className="text-xs text-muted-foreground">{p.event_label} · {p.quantity} ticket{p.quantity > 1 ? "s" : ""}</p>
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

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {TRACKED_PLATFORMS.map(rule => {
          const c = PLATFORM_COLORS[rule];
          return (
            <span key={rule} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${c.dot}`} /> {c.label}
              {rule === "footballticketnet" && <span className="italic">(Mondays)</span>}
            </span>
          );
        })}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-destructive/40" /> Supplier due
        </span>
      </div>
    </div>
  );
}

/* ── Small summary card ── */
function SummaryCard({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={className}>{icon}</span>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
      <p className={`text-lg font-bold font-mono ${className}`}>{value}</p>
    </div>
  );
}
