import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, getDaysInMonth, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import type { AnalyticsOrder, AnalyticsPurchase } from "@/pages/Analytics";
import type { MinimalEvent } from "@/lib/eventDedup";

interface Props {
  events: MinimalEvent[];
  orders: AnalyticsOrder[];
  purchases: AnalyticsPurchase[];
  groupedIds: Record<string, string[]>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;

function getProfitColor(profit: number, maxProfit: number, maxLoss: number): string {
  if (profit === 0) return "hsl(var(--muted))";
  if (profit > 0) {
    const intensity = Math.min(1, profit / (maxProfit || 1));
    const l = 45 - intensity * 20; // darker green for more profit
    return `hsl(142, 60%, ${l}%)`;
  }
  const intensity = Math.min(1, Math.abs(profit) / (maxLoss || 1));
  const l = 50 - intensity * 15;
  return `hsl(0, 62%, ${l}%)`;
}

export default function HeatmapTab({ events, orders, purchases, groupedIds }: Props) {
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const allYears = new Set<number>();
    events.forEach(ev => allYears.add(new Date(ev.event_date).getFullYear()));
    orders.forEach(o => allYears.add(new Date(o.order_date).getFullYear()));
    if (allYears.size === 0) allYears.add(currentYear);
    return [...allYears].sort((a, b) => b - a);
  }, [events, orders, currentYear]);

  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const year = parseInt(selectedYear);

  // Build daily profit map from orders
  const dailyData = useMemo(() => {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 0, 1));

    // Map event_ids for dedup
    const idToCanon: Record<string, string> = {};
    for (const [canonId, ids] of Object.entries(groupedIds)) {
      ids.forEach(id => { idToCanon[id] = canonId; });
    }

    const dailyMap: Record<string, { profit: number; events: string[]; revenue: number; costs: number }> = {};

    // Revenue from orders by order_date
    orders.forEach(o => {
      if (o.status === "cancelled" || o.status === "refunded") return;
      const d = new Date(o.order_date);
      if (!isWithinInterval(d, { start: yearStart, end: yearEnd })) return;
      const key = format(d, "yyyy-MM-dd");
      if (!dailyMap[key]) dailyMap[key] = { profit: 0, events: [], revenue: 0, costs: 0 };
      dailyMap[key].revenue += Number(o.sale_price || 0) - Number(o.fees || 0);
      dailyMap[key].profit += Number(o.sale_price || 0) - Number(o.fees || 0);

      const canonId = idToCanon[o.event_id] || o.event_id;
      const ev = events.find(e => e.id === canonId);
      if (ev) {
        const label = `${ev.home_team} vs ${ev.away_team}`;
        if (!dailyMap[key].events.includes(label)) dailyMap[key].events.push(label);
      }
    });

    return dailyMap;
  }, [orders, events, groupedIds, year]);

  const { maxProfit, maxLoss } = useMemo(() => {
    let maxP = 0, maxL = 0;
    Object.values(dailyData).forEach(d => {
      if (d.profit > maxP) maxP = d.profit;
      if (d.profit < maxL) maxL = Math.abs(d.profit);
    });
    return { maxProfit: maxP, maxLoss: maxL };
  }, [dailyData]);

  // Monthly summary
  const monthlyData = useMemo(() => {
    return MONTHS.map((name, i) => {
      let total = 0;
      const daysInMonth = getDaysInMonth(new Date(year, i, 1));
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${year}-${String(i + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (dailyData[key]) total += dailyData[key].profit;
      }
      return { name, profit: total };
    });
  }, [dailyData, year]);

  const bestMonth = monthlyData.reduce((best, m) => m.profit > best.profit ? m : best, { name: "-", profit: -Infinity });
  const worstMonth = monthlyData.reduce((worst, m) => m.profit < worst.profit ? m : worst, { name: "-", profit: Infinity });
  const annualProfit = monthlyData.reduce((s, m) => s + m.profit, 0);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; profit: number; events: string[] } | null>(null);

  return (
    <div className="space-y-6 mt-4">
      {/* Year selector + stats */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-4 text-sm">
          <span>Best: <strong className="text-success">{bestMonth.name} ({fmt(bestMonth.profit)})</strong></span>
          <span>Worst: <strong className="text-destructive">{worstMonth.name} ({fmt(worstMonth.profit)})</strong></span>
          <span>Annual: <strong className={annualProfit >= 0 ? "text-success" : "text-destructive"}>{fmt(annualProfit)}</strong></span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="rounded-lg border bg-card p-4 overflow-x-auto relative">
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: `40px repeat(12, 1fr)` }}>
          {/* Header row */}
          <div />
          {MONTHS.map(m => (
            <div key={m} className="text-[10px] text-muted-foreground text-center font-medium py-1">{m}</div>
          ))}

          {/* Day rows */}
          {Array.from({ length: 31 }, (_, day) => (
            <>
              <div key={`label-${day}`} className="text-[10px] text-muted-foreground text-right pr-2 flex items-center justify-end">{day + 1}</div>
              {MONTHS.map((_, month) => {
                const daysInMonth = getDaysInMonth(new Date(year, month, 1));
                if (day + 1 > daysInMonth) {
                  return <div key={`${month}-${day}`} className="h-4 rounded-sm" />;
                }
                const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`;
                const data = dailyData[dateKey];
                const profit = data?.profit || 0;
                const hasData = !!data;

                return (
                  <div
                    key={`${month}-${day}`}
                    className="h-4 rounded-sm cursor-pointer transition-transform hover:scale-125 hover:z-10"
                    style={{ backgroundColor: hasData ? getProfitColor(profit, maxProfit, maxLoss) : "hsl(var(--muted) / 0.3)" }}
                    onMouseEnter={(e) => {
                      if (hasData) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ x: rect.left, y: rect.top - 60, date: dateKey, profit, events: data?.events || [] });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div className="fixed z-50 bg-popover text-popover-foreground border rounded-lg shadow-lg p-2 text-xs max-w-xs pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y }}>
            <p className="font-semibold">{format(new Date(tooltip.date), "dd MMM yyyy")}</p>
            <p className={tooltip.profit >= 0 ? "text-success" : "text-destructive"}>{fmt(tooltip.profit)}</p>
            {tooltip.events.length > 0 && (
              <p className="text-muted-foreground mt-0.5">{tooltip.events.join(", ")}</p>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <span>Loss</span>
          <div className="flex gap-[1px]">
            {[0.2, 0.4, 0.6, 0.8, 1].map(i => (
              <div key={`loss-${i}`} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(0, 62%, ${50 - i * 15}%)` }} />
            ))}
          </div>
          <span className="mx-1">|</span>
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--muted) / 0.3)" }} />
          <span>No data</span>
          <span className="mx-1">|</span>
          <div className="flex gap-[1px]">
            {[0.2, 0.4, 0.6, 0.8, 1].map(i => (
              <div key={`profit-${i}`} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(142, 60%, ${45 - i * 20}%)` }} />
            ))}
          </div>
          <span>Profit</span>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Monthly Profit Summary</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `£${v}`} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(value: number) => fmt(value)} />
            <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}
              // @ts-ignore
              shape={(props: any) => {
                const fill = props.profit >= 0 ? "hsl(142, 60%, 40%)" : "hsl(0, 62%, 50%)";
                return <rect {...props} fill={fill} />;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
