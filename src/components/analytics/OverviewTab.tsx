import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, TrendingUp, TrendingDown, X, BarChart3, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, startOfQuarter, endOfQuarter, subYears } from "date-fns";
import { CLUBS } from "@/lib/seatingSections";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import type { AnalyticsOrder, AnalyticsPurchase, AnalyticsPlatform } from "@/pages/Analytics";
import type { MinimalEvent } from "@/lib/eventDedup";

interface Props {
  events: MinimalEvent[];
  orders: AnalyticsOrder[];
  purchases: AnalyticsPurchase[];
  groupedIds: Record<string, string[]>;
  platforms: AnalyticsPlatform[];
}

const CLUB_FILTERS = [{ value: "all", label: "All Clubs" }, ...CLUBS];

const CLUB_COLORS: Record<string, string> = {
  liverpool: "hsl(0, 80%, 50%)",
  arsenal: "hsl(0, 70%, 45%)",
  chelsea: "hsl(220, 70%, 50%)",
  "man-united": "hsl(0, 75%, 45%)",
  "man-city": "hsl(200, 70%, 55%)",
  tottenham: "hsl(240, 20%, 30%)",
  "west-ham": "hsl(340, 55%, 40%)",
  everton: "hsl(220, 60%, 45%)",
  "aston-villa": "hsl(340, 50%, 35%)",
  newcastle: "hsl(0, 0%, 20%)",
  "world-cup": "hsl(45, 90%, 50%)",
};

const PLATFORM_COLORS: Record<string, string> = {
  footballticketnet: "hsl(220, 70%, 55%)",
  livefootball: "hsl(142, 60%, 40%)",
  fanpass: "hsl(280, 60%, 55%)",
  tixstock: "hsl(35, 90%, 55%)",
  trade: "hsl(160, 50%, 45%)",
};

function matchesClub(event: MinimalEvent, clubValue: string): boolean {
  if (clubValue === "all") return true;
  const clubLabel = CLUBS.find(c => c.value === clubValue)?.label.toLowerCase() || "";
  if (clubValue === "world-cup") return (event.competition || "").toLowerCase().includes("world cup");
  return event.home_team.toLowerCase().includes(clubLabel) || event.away_team.toLowerCase().includes(clubLabel);
}

function getClubForEvent(event: MinimalEvent): string | null {
  for (const club of CLUBS) {
    if (matchesClub(event, club.value)) return club.value;
  }
  return null;
}

type RangePreset = "this-month" | "last-month" | "this-quarter" | "last-quarter" | "all-time" | "custom";

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;

export default function OverviewTab({ events, orders, purchases, groupedIds, platforms }: Props) {
  const [clubFilter, setClubFilter] = useState("all");
  const [rangePreset, setRangePreset] = useState<RangePreset>("all-time");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [compareEventIds, setCompareEventIds] = useState<string[]>([]);

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

  const isInRange = (dateStr: string) => isWithinInterval(new Date(dateStr), { start: dateRange.start, end: dateRange.end });

  const periodGames = useMemo(() => {
    const filtered = events.filter(ev => {
      if (clubFilter !== "all" && !matchesClub(ev, clubFilter)) return false;
      if (rangePreset === "all-time") return true;
      return isInRange(ev.event_date);
    });
    return filtered.map(ev => {
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
  }, [events, orders, purchases, clubFilter, dateRange, groupedIds, rangePreset]);

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

  // Platform breakdown
  const platformBreakdown = useMemo(() => {
    const relevantEventIds = new Set(periodGames.flatMap(g => groupedIds[g.id] || [g.id]));
    const relevantOrders = orders.filter(o => relevantEventIds.has(o.event_id) && o.status !== "cancelled" && o.status !== "refunded");

    const platformMap = new Map<string, { name: string; tickets: number; revenue: number; profit: number; color: string }>();

    for (const o of relevantOrders) {
      const plat = platforms.find(p => p.id === o.platform_id);
      const platName = plat?.name || "Unassigned";
      const key = o.platform_id || "unassigned";

      if (!platformMap.has(key)) {
        const colorKey = platName.toLowerCase().replace(/\s+/g, "");
        platformMap.set(key, {
          name: platName,
          tickets: 0,
          revenue: 0,
          profit: 0,
          color: PLATFORM_COLORS[colorKey] || "hsl(var(--muted-foreground))",
        });
      }
      const entry = platformMap.get(key)!;
      entry.tickets += Number(o.quantity || 0);
      entry.revenue += Number(o.sale_price || 0);
      entry.profit += Number(o.sale_price || 0) - Number(o.fees || 0);
    }

    return Array.from(platformMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [periodGames, orders, platforms, groupedIds]);

  const maxPlatformRevenue = platformBreakdown.length > 0 ? platformBreakdown[0].revenue : 1;
  const totalPlatformRevenue = platformBreakdown.reduce((s, p) => s + p.revenue, 0);

  // Club breakdown
  const clubBreakdown = useMemo(() => {
    const clubMap = new Map<string, { value: string; label: string; events: number; tickets: number; revenue: number; costs: number; profit: number; color: string }>();

    for (const g of periodGames) {
      const clubVal = getClubForEvent(g);
      if (!clubVal) continue;
      const club = CLUBS.find(c => c.value === clubVal);
      if (!club) continue;

      if (!clubMap.has(clubVal)) {
        clubMap.set(clubVal, {
          value: clubVal,
          label: club.label,
          events: 0,
          tickets: 0,
          revenue: 0,
          costs: 0,
          profit: 0,
          color: CLUB_COLORS[clubVal] || "hsl(var(--primary))",
        });
      }
      const entry = clubMap.get(clubVal)!;
      entry.events += 1;
      entry.tickets += g.soldQty;
      entry.revenue += g.revenue;
      entry.costs += g.costs + g.fees;
      entry.profit += g.profit;
    }

    return Array.from(clubMap.values()).sort((a, b) => b.profit - a.profit);
  }, [periodGames]);

  const maxClubProfit = clubBreakdown.length > 0 ? Math.max(...clubBreakdown.map(c => Math.abs(c.profit)), 1) : 1;

  const compareGames = periodGames.filter(g => compareEventIds.includes(g.id));
  const isComparing = compareGames.length >= 2;
  const toggleCompare = (eventId: string) => {
    setCompareEventIds(prev => prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]);
  };

  const presets: { key: RangePreset; label: string }[] = [
    { key: "all-time", label: "All Time" }, { key: "this-month", label: "This Month" },
    { key: "last-month", label: "Last Month" }, { key: "this-quarter", label: "This Quarter" },
    { key: "last-quarter", label: "Last Quarter" }, { key: "custom", label: "Custom" },
  ];

  // For club-specific view: show per-event breakdown when a club is selected
  const showClubComparison = clubFilter === "all";

  return (
    <div className="space-y-6 mt-4">
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
            <button key={p.key} onClick={() => setRangePreset(p.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${rangePreset === p.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
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
        {[
          { label: "Revenue", value: fmt(totals.revenue) },
          { label: "Tickets Sold", value: totals.sold },
          { label: "Avg Ticket Price", value: fmt(avgTicketPrice) },
          { label: "Net Profit", value: fmt(totals.profit), color: totals.profit >= 0 ? "text-success" : "text-destructive" },
          { label: "Margin", value: `${margin}%`, color: Number(margin) >= 0 ? "text-success" : "text-destructive" },
          { label: "Profit / Ticket", value: fmt(avgTicketProfit), color: avgTicketProfit >= 0 ? "text-success" : "text-destructive" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg border bg-card p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color || ""}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Platform Breakdown + Club Profit — Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Breakdown — Pie Chart + Table */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Platform Breakdown</h3>
          </div>
          {platformBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No platform data — assign platforms to orders to see breakdown
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={platformBreakdown}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                    fontSize={10}
                  >
                    {platformBreakdown.map((p, i) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => fmt(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-center">Tickets</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformBreakdown.map(p => {
                    const pct = totalPlatformRevenue > 0 ? (p.revenue / totalPlatformRevenue) * 100 : 0;
                    return (
                      <TableRow key={p.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            <span className="text-sm font-medium">{p.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{p.tickets}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(p.revenue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{pct.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/30 font-semibold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{platformBreakdown.reduce((s, p) => s + p.tickets, 0)}</TableCell>
                    <TableCell className="text-right">{fmt(totalPlatformRevenue)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
          )}
        </div>

        {/* Club Profit — Bar Chart + Table */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              {showClubComparison ? "Profit by Club" : `${CLUBS.find(c => c.value === clubFilter)?.label || "Club"} — Event Breakdown`}
            </h3>
          </div>
          {showClubComparison ? (
            clubBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No club data available</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={clubBreakdown} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `£${v}`} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={120} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => fmt(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(220, 70%, 55%)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="costs" name="Costs" fill="hsl(0, 62%, 50%)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}>
                      {clubBreakdown.map((c) => (
                        <Cell key={c.value} fill={c.profit >= 0 ? "hsl(142, 60%, 40%)" : "hsl(0, 62%, 50%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Club</TableHead>
                      <TableHead className="text-center">Events</TableHead>
                      <TableHead className="text-center">Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Costs</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clubBreakdown.map(c => {
                      const clubMargin = c.revenue > 0 ? ((c.profit / c.revenue) * 100).toFixed(1) : "0.0";
                      return (
                        <TableRow key={c.value}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                              <span className="text-sm font-medium">{c.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{c.events}</TableCell>
                          <TableCell className="text-center">{c.tickets}</TableCell>
                          <TableCell className="text-right">{fmt(c.revenue)}</TableCell>
                          <TableCell className="text-right">{fmt(c.costs)}</TableCell>
                          <TableCell className={`text-right font-bold ${c.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(c.profit)}</TableCell>
                          <TableCell className={`text-right ${Number(clubMargin) >= 0 ? "text-success" : "text-destructive"}`}>{clubMargin}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )
          ) : (
            // Per-event breakdown for selected club
            periodGames.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No events for this club</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={periodGames.map(g => ({
                    name: `${g.home_team.split(" ").pop()} v ${g.away_team.split(" ").pop()}`,
                    Revenue: g.revenue, Costs: g.costs + g.fees, Profit: g.profit,
                  }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
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
                <div className="space-y-2">
                  {periodGames.map(g => {
                    const gMargin = g.revenue > 0 ? ((g.profit / g.revenue) * 100).toFixed(1) : "—";
                    return (
                      <div key={g.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-border/50 bg-muted/20">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{g.home_team} vs {g.away_team}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(g.event_date), "dd MMM")} · {g.soldQty} sold</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${g.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(g.profit)}</p>
                          <p className="text-xs text-muted-foreground">{gMargin}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}
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
          {compareEventIds.length >= 2 && <Badge variant="default" className="text-xs">Side-by-side below ↓</Badge>}
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
                {compareGames.map(g => <TableHead key={g.id} className="text-center">{g.home_team} vs {g.away_team}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {([
                { label: "Revenue", key: "revenue" as const },
                { label: "Costs", key: "costs" as const },
                { label: "Profit", key: "profit" as const },
                { label: "Tickets Sold", key: "soldQty" as const },
                { label: "Tickets Bought", key: "boughtQty" as const },
              ]).map(row => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  {compareGames.map(g => (
                    <TableCell key={g.id} className={`text-center font-semibold ${row.key === "profit" ? (g[row.key] >= 0 ? "text-success" : "text-destructive") : ""}`}>
                      {row.key === "soldQty" || row.key === "boughtQty" ? g[row.key] : fmt(g[row.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Compare Selected button */}
      {compareEventIds.length >= 2 && !isComparing && null}

      {/* Per-game table */}
      {periodGames.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No games found for selected filters</div>
      ) : (
        <div className="rounded-lg border">
          {compareEventIds.length >= 2 && (
            <div className="px-4 pt-3">
              <Button size="sm" variant="default" className="text-xs" onClick={() => {}}>
                Compare Selected ({compareEventIds.length})
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">Compare</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Match</TableHead>
                <TableHead className="text-center">Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Costs</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodGames.map(g => {
                const gMargin = g.revenue > 0 ? ((g.profit / g.revenue) * 100).toFixed(1) : "—";
                const isSelected = compareEventIds.includes(g.id);
                const isLoss = g.profit < 0;
                const isEmpty = g.soldQty === 0 && g.revenue === 0 && g.costs === 0;
                return (
                  <TableRow
                    key={g.id}
                    className={`
                      ${isSelected ? "bg-primary/5" : ""}
                      ${isLoss && !isEmpty ? "bg-destructive/5" : ""}
                      ${isEmpty ? "opacity-50" : ""}
                    `}
                  >
                    <TableCell>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleCompare(g.id)} className="h-3.5 w-3.5 rounded border-border" />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(g.event_date), "dd MMM")}</div>
                    </TableCell>
                    <TableCell className="font-medium">{g.home_team} vs {g.away_team}</TableCell>
                    <TableCell className="text-center">{g.soldQty}</TableCell>
                    <TableCell className="text-right">{fmt(g.revenue)}</TableCell>
                    <TableCell className="text-right">{fmt(g.costs)}</TableCell>
                    <TableCell className={`text-right font-semibold ${g.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {g.profit >= 0 ? <TrendingUp className="inline h-3 w-3 mr-1" /> : <TrendingDown className="inline h-3 w-3 mr-1" />}
                      {fmt(g.profit)}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${Number(gMargin) >= 0 ? "text-success" : "text-destructive"}`}>{gMargin}%</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/30 font-semibold border-t-2">
                <TableCell />
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-center">{totals.sold}</TableCell>
                <TableCell className="text-right">{fmt(totals.revenue)}</TableCell>
                <TableCell className="text-right">{fmt(totals.costs)}</TableCell>
                <TableCell className={`text-right ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmt(totals.profit)}</TableCell>
                <TableCell className={`text-right ${Number(margin) >= 0 ? "text-success" : "text-destructive"}`}>{margin}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
