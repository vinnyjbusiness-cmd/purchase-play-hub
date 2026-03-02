import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, isWithinInterval, subYears } from "date-fns";
import type { AnalyticsOrder, AnalyticsPurchase } from "@/pages/Analytics";
import type { MinimalEvent } from "@/lib/eventDedup";

interface Props {
  events: MinimalEvent[];
  orders: AnalyticsOrder[];
  purchases: AnalyticsPurchase[];
  groupedIds: Record<string, string[]>;
}

type Preset = "this-week" | "this-month" | "last-month" | "this-year" | "all-time" | "custom";

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ReportsTab({ events, orders, purchases, groupedIds }: Props) {
  const [preset, setPreset] = useState<Preset>("all-time");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "this-week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "this-month": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month": { const prev = subMonths(now, 1); return { start: startOfMonth(prev), end: endOfMonth(prev) }; }
      case "this-year": return { start: startOfYear(now), end: endOfYear(now) };
      case "all-time": return { start: subYears(now, 10), end: now };
      case "custom": return { start: customFrom ? new Date(customFrom) : subYears(now, 10), end: customTo ? new Date(customTo) : now };
    }
  }, [preset, customFrom, customTo]);

  const idToCanon = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [canonId, ids] of Object.entries(groupedIds)) {
      ids.forEach(id => { m[id] = canonId; });
    }
    return m;
  }, [groupedIds]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status === "cancelled" || o.status === "refunded") return false;
      return isWithinInterval(new Date(o.order_date), { start: dateRange.start, end: dateRange.end });
    });
  }, [orders, dateRange]);

  const filteredPurchases = useMemo(() => {
    // Filter purchases based on their event dates falling within the range
    const eventDates = new Map(events.map(e => [e.id, e.event_date]));
    return purchases.filter(p => {
      const canonId = idToCanon[p.event_id] || p.event_id;
      const evDate = eventDates.get(canonId);
      if (!evDate) return true; // include if no date
      return isWithinInterval(new Date(evDate), { start: dateRange.start, end: dateRange.end });
    });
  }, [purchases, events, dateRange, idToCanon]);

  const totalRevenue = filteredOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
  const totalFees = filteredOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
  const totalCosts = filteredPurchases.reduce((s, p) => s + Number(p.total_cost || p.quantity * p.unit_cost || 0), 0);
  const totalProfit = totalRevenue - totalCosts - totalFees;
  const ticketsSold = filteredOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);

  // Unique events in period
  const eventIdsInPeriod = new Set(filteredOrders.map(o => idToCanon[o.event_id] || o.event_id));
  const eventCount = eventIdsInPeriod.size;

  // Best performing event
  const eventProfits = useMemo(() => {
    const map = new Map<string, { name: string; profit: number }>();
    filteredOrders.forEach(o => {
      const canonId = idToCanon[o.event_id] || o.event_id;
      const ev = events.find(e => e.id === canonId);
      const name = ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown";
      const existing = map.get(canonId) || { name, profit: 0 };
      existing.profit += Number(o.sale_price || 0) - Number(o.fees || 0);
      map.set(canonId, existing);
    });
    // Subtract costs
    filteredPurchases.forEach(p => {
      const canonId = idToCanon[p.event_id] || p.event_id;
      const existing = map.get(canonId);
      if (existing) existing.profit -= Number(p.total_cost || p.quantity * p.unit_cost || 0);
    });
    return [...map.values()].sort((a, b) => b.profit - a.profit);
  }, [filteredOrders, filteredPurchases, events, idToCanon]);

  const bestEvent = eventProfits[0];

  // Monthly breakdown
  const monthlyBreakdown = useMemo(() => {
    const months: { month: string; revenue: number; costs: number; fees: number; profit: number; tickets: number }[] = [];
    const startYear = dateRange.start.getFullYear();
    const endYear = dateRange.end.getFullYear();

    for (let y = startYear; y <= endYear; y++) {
      for (let m = 0; m < 12; m++) {
        const ms = startOfMonth(new Date(y, m, 1));
        const me = endOfMonth(new Date(y, m, 1));
        if (ms > dateRange.end || me < dateRange.start) continue;

        const mOrders = filteredOrders.filter(o => {
          const d = new Date(o.order_date);
          return d >= ms && d <= me;
        });

        if (mOrders.length === 0) continue;

        const rev = mOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
        const fees = mOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
        const tickets = mOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);

        months.push({
          month: `${MONTHS[m]} ${y}`,
          revenue: rev,
          costs: 0, // costs are per-event not per-month easily
          fees,
          profit: rev - fees,
          tickets,
        });
      }
    }
    return months;
  }, [filteredOrders, dateRange]);

  // CSV export
  const exportCSV = () => {
    const headers = ["Month", "Revenue", "Fees", "Profit", "Tickets Sold"];
    const rows = monthlyBreakdown.map(m => [m.month, m.revenue.toFixed(2), m.fees.toFixed(2), m.profit.toFixed(2), m.tickets]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vjx-report-${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const presets: { key: Preset; label: string }[] = [
    { key: "this-week", label: "This Week" },
    { key: "this-month", label: "This Month" },
    { key: "last-month", label: "Last Month" },
    { key: "this-year", label: "This Year" },
    { key: "all-time", label: "All Time" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-6 mt-4">
      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex rounded-md border overflow-hidden">
          {presets.map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${preset === p.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-36 text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
        )}
        <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Revenue", value: fmt(totalRevenue) },
          { label: "Costs", value: fmt(totalCosts) },
          { label: "Net Profit", value: fmt(totalProfit), color: totalProfit >= 0 ? "text-success" : "text-destructive" },
          { label: "Events", value: eventCount },
          { label: "Tickets Sold", value: ticketsSold },
          { label: "Best Event", value: bestEvent?.name || "—", small: true },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg border bg-card p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className={`${kpi.small ? "text-sm" : "text-xl"} font-bold ${kpi.color || ""}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly breakdown table */}
      {monthlyBreakdown.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyBreakdown.map(m => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium">{m.month}</TableCell>
                  <TableCell className="text-right">{fmt(m.revenue)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt(m.fees)}</TableCell>
                  <TableCell className={`text-right font-semibold ${m.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(m.profit)}</TableCell>
                  <TableCell className="text-right">{m.tickets}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-semibold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(totalRevenue)}</TableCell>
                <TableCell className="text-right">{fmt(totalFees)}</TableCell>
                <TableCell className={`text-right ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(totalProfit)}</TableCell>
                <TableCell className="text-right">{ticketsSold}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No data for selected period</div>
      )}
    </div>
  );
}
