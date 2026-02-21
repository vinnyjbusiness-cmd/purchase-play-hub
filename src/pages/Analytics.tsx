import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth, startOfQuarter, endOfQuarter, isSameQuarter } from "date-fns";
import { CLUBS } from "@/lib/seatingSections";

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

type ViewMode = "monthly" | "quarterly";

export default function Analytics() {
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [clubFilter, setClubFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [offset, setOffset] = useState(0); // 0 = current period

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

  const selectedDate = addMonths(new Date(), viewMode === "monthly" ? offset : offset * 3);

  const periodLabel = viewMode === "monthly"
    ? format(selectedDate, "MMMM yyyy")
    : `Q${Math.ceil((selectedDate.getMonth() + 1) / 3)} ${format(selectedDate, "yyyy")}`;

  const isInPeriod = (dateStr: string) => {
    const d = new Date(dateStr);
    if (viewMode === "monthly") return isSameMonth(d, selectedDate);
    return isSameQuarter(d, selectedDate);
  };

  // Build per-game data for this period
  const periodGames = useMemo(() => {
    const filteredEvents = events.filter(ev => {
      if (clubFilter !== "all" && !matchesClub(ev, clubFilter)) return false;
      return isInPeriod(ev.event_date);
    });

    return filteredEvents.map(ev => {
      const evOrders = orders.filter(o => o.event_id === ev.id && o.status !== "cancelled" && o.status !== "refunded");
      const evPurchases = purchases.filter(p => p.event_id === ev.id);
      const revenue = evOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
      const fees = evOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
      const costs = evPurchases.reduce((s, p) => s + Number(p.total_cost || p.quantity * p.unit_cost || 0), 0);
      const soldQty = evOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);
      const boughtQty = evPurchases.reduce((s, p) => s + Number(p.quantity || 0), 0);
      return { ...ev, revenue, fees, costs, profit: revenue - costs - fees, soldQty, boughtQty };
    }).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [events, orders, purchases, clubFilter, selectedDate, viewMode]);

  const totals = useMemo(() => ({
    revenue: periodGames.reduce((s, g) => s + g.revenue, 0),
    costs: periodGames.reduce((s, g) => s + g.costs, 0),
    fees: periodGames.reduce((s, g) => s + g.fees, 0),
    profit: periodGames.reduce((s, g) => s + g.profit, 0),
    sold: periodGames.reduce((s, g) => s + g.soldQty, 0),
    bought: periodGames.reduce((s, g) => s + g.boughtQty, 0),
    games: periodGames.length,
  }), [periodGames]);

  // Margin %
  const margin = totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : "0.0";
  const avgPerGame = totals.games > 0 ? totals.profit / totals.games : 0;
  const avgTicketProfit = totals.sold > 0 ? totals.profit / totals.sold : 0;

  return (
    <div className="p-6 space-y-6">
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

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-md border overflow-hidden">
          <button
            onClick={() => { setViewMode("monthly"); setOffset(0); }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "monthly" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => { setViewMode("quarterly"); setOffset(0); }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "quarterly" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            Quarterly
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOffset(o => o - 1)}>← Prev</Button>
        <h2 className="text-lg font-semibold min-w-[160px] text-center">{periodLabel}</h2>
        <Button variant="outline" size="sm" onClick={() => setOffset(o => o + 1)}>Next →</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Games</p>
          <p className="text-xl font-bold">{totals.games}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
          <p className="text-xl font-bold">£{totals.revenue.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Costs</p>
          <p className="text-xl font-bold">£{totals.costs.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tickets Sold</p>
          <p className="text-xl font-bold">{totals.sold}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Profit</p>
          <p className={`text-xl font-bold ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>
            £{totals.profit.toLocaleString("en-GB", { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Margin</p>
          <p className={`text-xl font-bold ${Number(margin) >= 0 ? "text-success" : "text-destructive"}`}>{margin}%</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg / Ticket</p>
          <p className={`text-xl font-bold ${avgTicketProfit >= 0 ? "text-success" : "text-destructive"}`}>
            £{avgTicketProfit.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Per-game breakdown table */}
      {periodGames.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          No games found for {periodLabel}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Match</TableHead>
                <TableHead className="text-center">Bought</TableHead>
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
                return (
                  <TableRow key={g.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(new Date(g.event_date), "dd MMM")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{g.home_team} vs {g.away_team}</TableCell>
                    <TableCell className="text-center">{g.boughtQty}</TableCell>
                    <TableCell className="text-center">{g.soldQty}</TableCell>
                    <TableCell className="text-right">£{g.revenue.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">£{g.costs.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right">£{g.fees.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</TableCell>
                    <TableCell className={`text-right font-semibold ${g.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {g.profit >= 0 ? <TrendingUp className="inline h-3 w-3 mr-1" /> : <TrendingDown className="inline h-3 w-3 mr-1" />}
                      £{g.profit.toLocaleString("en-GB", { minimumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${Number(gMargin) >= 0 ? "text-success" : "text-destructive"}`}>
                      {gMargin}%
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals */}
              <TableRow className="bg-muted/30 font-semibold border-t-2">
                <TableCell colSpan={2}>Total — {periodLabel}</TableCell>
                <TableCell className="text-center">{totals.bought}</TableCell>
                <TableCell className="text-center">{totals.sold}</TableCell>
                <TableCell className="text-right">£{totals.revenue.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</TableCell>
                <TableCell className="text-right">£{totals.costs.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</TableCell>
                <TableCell className="text-right">£{totals.fees.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</TableCell>
                <TableCell className={`text-right ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>
                  £{totals.profit.toLocaleString("en-GB", { minimumFractionDigits: 0 })}
                </TableCell>
                <TableCell className={`text-right ${Number(margin) >= 0 ? "text-success" : "text-destructive"}`}>{margin}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Avg per game stat */}
      {totals.games > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">Avg Profit per Game</p>
            <p className={`text-2xl font-bold ${avgPerGame >= 0 ? "text-success" : "text-destructive"}`}>
              £{avgPerGame.toFixed(0)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">Avg Revenue per Game</p>
            <p className="text-2xl font-bold">£{(totals.revenue / totals.games).toFixed(0)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground">Avg Tickets Sold per Game</p>
            <p className="text-2xl font-bold">{(totals.sold / totals.games).toFixed(1)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
