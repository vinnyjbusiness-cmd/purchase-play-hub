import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, TrendingUp, TrendingDown, BarChart3, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, startOfQuarter, endOfQuarter, subYears } from "date-fns";
import { CLUBS } from "@/lib/seatingSections";
import { deduplicateEvents } from "@/lib/eventDedup";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from "recharts";

interface EventInfo { id: string; match_code: string; home_team: string; away_team: string; event_date: string; competition: string; }
interface Order { id: string; sale_price: number; fees: number; quantity: number; order_date: string; event_id: string; status: string; }
interface Purchase { id: string; total_cost: number | null; quantity: number; unit_cost: number; event_id: string; }

const CLUB_FILTERS = [
  { value: "all", label: "All Clubs" },
  ...CLUBS,
];

function matchesClub(event: EventInfo, clubValue: string): boolean {
  if (clubValue === "all") return true;
  const clubLabel = CLUBS.find(c => c.value === clubValue)?.label.toLowerCase() || "";
  if (clubValue === "world-cup") return event.competition.toLowerCase().includes("world cup");
  return event.home_team.toLowerCase().includes(clubLabel) || event.away_team.toLowerCase().includes(clubLabel);
}

type RangePreset = "this-month" | "last-month" | "this-quarter" | "last-quarter" | "all-time" | "custom";

const CHART_COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(142, 60%, 40%)",
  "hsl(0, 62%, 50%)",
  "hsl(38, 80%, 50%)",
  "hsl(280, 60%, 50%)",
  "hsl(190, 70%, 45%)",
];

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;

export default function Analytics() {
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [clubFilter, setClubFilter] = useState("all");
  const [rangePreset, setRangePreset] = useState<RangePreset>("all-time");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [compareEventIds, setCompareEventIds] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("events").select("id,match_code,home_team,away_team,event_date,competition"),
      supabase.from("orders").select("id,sale_price,fees,quantity,order_date,event_id,status"),
      supabase.from("purchases").select("id,total_cost,quantity,unit_cost,event_id"),
    ]).then(([ev, ord, purch]) => {
      setEvents(ev.data || []);
      setOrders(ord.data || []);
      setPurchases(purch.data || []);
    });
  }, []);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (rangePreset) {
      case "this-month": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month": { const prev = subMonths(now, 1); return { start: startOfMonth(prev), end: endOfMonth(prev) }; }
      case "this-quarter": return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "last-quarter": { const prev = subMonths(now, 3); return { start: startOfQuarter(prev), end: endOfQuarter(prev) }; }
      case "all-time": return { start: subYears(now, 5), end: now };
      case "custom": {
        if (customFrom && customTo) return { start: parseISO(customFrom), end: parseISO(customTo) };
        return { start: subYears(now, 5), end: now };
      }
    }
  }, [rangePreset, customFrom, customTo]);

  const isInRange = (dateStr: string) => {
    const d = new Date(dateStr);
    return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
  };

  const { unique: dedupEvents, groupedIds } = useMemo(() => deduplicateEvents(events), [events]);

  // Per-game data
  const periodGames = useMemo(() => {
    const filteredEvents = dedupEvents.filter(ev => {
      if (clubFilter !== "all" && !matchesClub(ev, clubFilter)) return false;
      // For all-time, include all events; otherwise filter by date
      if (rangePreset === "all-time") return true;
      return isInRange(ev.event_date);
    });

    return filteredEvents.map(ev => {
      const allIds = groupedIds[ev.id] || [ev.id];
      const evOrders = orders.filter(o => allIds.includes(o.event_id) && o.status !== "cancelled" && o.status !== "refunded");
      const evPurchases = purchases.filter(p => allIds.includes(p.event_id));
      const revenue = evOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
      const fees = evOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
      const costs = evPurchases.reduce((s, p) => s + Number(p.total_cost || p.quantity * p.unit_cost || 0), 0);
      const soldQty = evOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);
      const boughtQty = evPurchases.reduce((s, p) => s + Number(p.quantity || 0), 0);
      return { ...ev, revenue, fees, costs, profit: revenue - costs - fees, soldQty, boughtQty };
    }).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [dedupEvents, orders, purchases, clubFilter, dateRange, groupedIds, rangePreset]);

  const totals = useMemo(() => ({
    revenue: periodGames.reduce((s, g) => s + g.revenue, 0),
    costs: periodGames.reduce((s, g) => s + g.costs, 0),
    fees: periodGames.reduce((s, g) => s + g.fees, 0),
    profit: periodGames.reduce((s, g) => s + g.profit, 0),
    sold: periodGames.reduce((s, g) => s + g.soldQty, 0),
    bought: periodGames.reduce((s, g) => s + g.boughtQty, 0),
    games: periodGames.length,
  }), [periodGames]);

  const margin = totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : "0.0";
  const avgTicketPrice = totals.sold > 0 ? totals.revenue / totals.sold : 0;
  const avgTicketProfit = totals.sold > 0 ? totals.profit / totals.sold : 0;

  // Compare mode
  const compareGames = periodGames.filter(g => compareEventIds.includes(g.id));
  const isComparing = compareGames.length >= 2;

  const toggleCompare = (eventId: string) => {
    setCompareEventIds(prev =>
      prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]
    );
  };

  // Chart data
  const barChartData = periodGames.map(g => ({
    name: `${g.home_team.split(" ").pop()} v ${g.away_team.split(" ").pop()}`,
    Revenue: g.revenue,
    Costs: g.costs,
    Profit: g.profit,
  }));

  const cumulativeData = periodGames.reduce<{ name: string; profit: number }[]>((acc, g) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].profit : 0;
    acc.push({ name: format(new Date(g.event_date), "dd MMM"), profit: prev + g.profit });
    return acc;
  }, []);

  const presets: { key: RangePreset; label: string }[] = [
    { key: "all-time", label: "All Time" },
    { key: "this-month", label: "This Month" },
    { key: "last-month", label: "Last Month" },
    { key: "this-quarter", label: "This Quarter" },
    { key: "last-quarter", label: "Last Quarter" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Analytics
        </h1>
        <p className="text-muted-foreground text-sm">Performance breakdown by time period</p>
      </div>

      {/* Club filter */}
      <div className="flex flex-wrap items-center gap-2">
        {CLUB_FILTERS.map(c => (
          <Button key={c.value} variant={clubFilter === c.value ? "default" : "outline"} size="sm" onClick={() => setClubFilter(c.value)} className="text-xs">
            {c.label}
          </Button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex rounded-md border overflow-hidden">
          {presets.map(p => (
            <button
              key={p.key}
              onClick={() => setRangePreset(p.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${rangePreset === p.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {rangePreset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-36 text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
          <p className="text-xl font-bold">{fmt(totals.revenue)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tickets Sold</p>
          <p className="text-xl font-bold">{totals.sold}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Ticket Price</p>
          <p className="text-xl font-bold">{fmt(avgTicketPrice)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Profit</p>
          <p className={`text-xl font-bold ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(totals.profit)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Margin</p>
          <p className={`text-xl font-bold ${Number(margin) >= 0 ? "text-success" : "text-destructive"}`}>{margin}%</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Profit / Ticket</p>
          <p className={`text-xl font-bold ${avgTicketProfit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(avgTicketProfit)}</p>
        </div>
      </div>

      {/* Compare chips */}
      {compareEventIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Comparing:</span>
          {compareEventIds.map(id => {
            const g = periodGames.find(g => g.id === id);
            return (
              <Badge key={id} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => toggleCompare(id)}>
                {g ? `${g.home_team} vs ${g.away_team}` : id.slice(0, 8)}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {compareEventIds.length >= 2 && (
            <Badge variant="default" className="text-xs">Side-by-side below ↓</Badge>
          )}
        </div>
      )}

      {/* Charts */}
      {periodGames.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Revenue vs Costs per Game</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `£${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => fmt(value)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Revenue" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Costs" fill="hsl(0, 62%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="hsl(142, 60%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Cumulative Profit</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={cumulativeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `£${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => fmt(value)}
                />
                <Line type="monotone" dataKey="profit" stroke="hsl(220, 70%, 55%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Comparison table */}
      {isComparing && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Event Comparison</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                {compareGames.map(g => (
                  <TableHead key={g.id} className="text-center">{g.home_team} vs {g.away_team}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: "Revenue", key: "revenue" as const },
                { label: "Costs", key: "costs" as const },
                { label: "Fees", key: "fees" as const },
                { label: "Profit", key: "profit" as const },
                { label: "Tickets Sold", key: "soldQty" as const },
                { label: "Tickets Bought", key: "boughtQty" as const },
              ].map(row => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  {compareGames.map(g => (
                    <TableCell key={g.id} className={`text-center font-semibold ${row.key === "profit" ? (g[row.key] >= 0 ? "text-success" : "text-destructive") : ""}`}>
                      {row.key === "soldQty" || row.key === "boughtQty" ? g[row.key] : fmt(g[row.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Margin</TableCell>
                {compareGames.map(g => {
                  const m = g.revenue > 0 ? ((g.profit / g.revenue) * 100).toFixed(1) : "0.0";
                  return <TableCell key={g.id} className={`text-center font-semibold ${Number(m) >= 0 ? "text-success" : "text-destructive"}`}>{m}%</TableCell>;
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Per-game breakdown table */}
      {periodGames.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          No games found for selected filters
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">Compare</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Match</TableHead>
                <TableHead className="text-center">Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Costs</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodGames.map(g => {
                const gMargin = g.revenue > 0 ? ((g.profit / g.revenue) * 100).toFixed(1) : "—";
                const isSelected = compareEventIds.includes(g.id);
                return (
                  <TableRow key={g.id} className={isSelected ? "bg-primary/5" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCompare(g.id)}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(new Date(g.event_date), "dd MMM")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{g.home_team} vs {g.away_team}</TableCell>
                    <TableCell className="text-center">{g.soldQty}</TableCell>
                    <TableCell className="text-right">{fmt(g.revenue)}</TableCell>
                    <TableCell className="text-right">{fmt(g.costs)}</TableCell>
                    <TableCell className="text-right">{fmt(g.fees)}</TableCell>
                    <TableCell className={`text-right font-semibold ${g.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {g.profit >= 0 ? <TrendingUp className="inline h-3 w-3 mr-1" /> : <TrendingDown className="inline h-3 w-3 mr-1" />}
                      {fmt(g.profit)}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${Number(gMargin) >= 0 ? "text-success" : "text-destructive"}`}>
                      {gMargin}%
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/30 font-semibold border-t-2">
                <TableCell />
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-center">{totals.sold}</TableCell>
                <TableCell className="text-right">{fmt(totals.revenue)}</TableCell>
                <TableCell className="text-right">{fmt(totals.costs)}</TableCell>
                <TableCell className="text-right">{fmt(totals.fees)}</TableCell>
                <TableCell className={`text-right ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>
                  {fmt(totals.profit)}
                </TableCell>
                <TableCell className={`text-right ${Number(margin) >= 0 ? "text-success" : "text-destructive"}`}>{margin}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
