import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CalendarDays, Package, ShoppingCart, CheckCircle2, TrendingUp, Percent, Ticket } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CLUBS } from "@/lib/seatingSections";
import { cn } from "@/lib/utils";
import { deduplicateEvents } from "@/lib/eventDedup";
import LogoAvatar from "@/components/LogoAvatar";

interface Purchase {
  id: string;
  supplier_order_id: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number | null;
  total_cost_gbp: number | null;
  currency: string;
  purchase_date: string;
  supplier_paid: boolean;
  notes: string | null;
  category: string;
  section: string | null;
  event_id: string;
  supplier_id: string;
}

interface Order {
  id: string;
  order_ref: string | null;
  sale_price: number;
  fees: number;
  net_received: number | null;
  quantity: number;
  order_date: string;
  payment_received: boolean;
  status: string;
  event_id: string;
  platform_id: string | null;
  category: string;
}

interface EventInfo { id: string; match_code: string; home_team: string; away_team: string; event_date: string; competition: string; venue?: string | null; }
interface SupplierInfo { id: string; name: string; }
interface PlatformInfo { id: string; name: string; }

function matchesClub(event: EventInfo, clubValue: string): boolean {
  if (clubValue === "all") return true;
  const clubLabel = CLUBS.find(c => c.value === clubValue)?.label.toLowerCase() || "";
  if (clubValue === "world-cup") return event.competition.toLowerCase().includes("world cup");
  return (
    event.home_team.toLowerCase().includes(clubLabel.split(" (")[0].toLowerCase()) ||
    event.away_team.toLowerCase().includes(clubLabel.split(" (")[0].toLowerCase())
  );
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

// Club card gradient/icon configs
const CLUB_STYLES: Record<string, { gradient: string; accent: string }> = {
  liverpool: { gradient: "from-red-600 to-red-800", accent: "text-red-400" },
  arsenal: { gradient: "from-red-500 to-red-700", accent: "text-red-400" },
  "manchester-united": { gradient: "from-red-700 to-red-900", accent: "text-red-500" },
  "world-cup": { gradient: "from-emerald-600 to-emerald-800", accent: "text-emerald-400" },
};

export default function Finance() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("purchases").select("id,supplier_order_id,quantity,unit_cost,total_cost,total_cost_gbp,currency,purchase_date,supplier_paid,notes,category,section,event_id,supplier_id"),
      supabase.from("orders").select("id,order_ref,sale_price,fees,net_received,quantity,order_date,payment_received,status,event_id,platform_id,category"),
      supabase.from("events").select("id,match_code,home_team,away_team,event_date,competition,venue"),
      supabase.from("suppliers").select("id,name"),
      supabase.from("platforms").select("id,name"),
    ]).then(([purch, ord, ev, sup, plat]) => {
      setPurchases(purch.data || []);
      setOrders(ord.data || []);
      setEvents(ev.data || []);
      setSuppliers(sup.data || []);
      setPlatforms(plat.data || []);
    });
  }, []);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);
  const { unique: dedupedEvents, groupedIds } = useMemo(() => deduplicateEvents(events), [events]);

  // Compute per-club aggregates
  const clubData = useMemo(() => {
    return CLUBS.map(club => {
      const clubEvents = dedupedEvents.filter(e => matchesClub(e, club.value));
      const clubEventIds = new Set<string>();
      clubEvents.forEach(e => (groupedIds[e.id] || [e.id]).forEach(id => clubEventIds.add(id)));

      const clubPurchases = purchases.filter(p => clubEventIds.has(p.event_id));
      const clubOrders = orders.filter(o => clubEventIds.has(o.event_id) && o.status !== "cancelled" && o.status !== "refunded");

      const totalCost = clubPurchases.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
      const totalRevenue = clubOrders.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
      const profit = totalRevenue - totalCost;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      const ticketsSold = clubOrders.reduce((s, o) => s + o.quantity, 0);
      const ticketsBought = clubPurchases.reduce((s, p) => s + p.quantity, 0);
      const eventCount = clubEvents.filter(ev => {
        const allIds = groupedIds[ev.id] || [ev.id];
        return allIds.some(id => purchases.some(p => p.event_id === id) || orders.some(o => o.event_id === id));
      }).length;

      return {
        ...club,
        totalRevenue,
        totalCost,
        profit,
        margin,
        ticketsSold,
        ticketsBought,
        eventCount,
        events: clubEvents,
        purchases: clubPurchases,
        orders: clubOrders,
      };
    }).filter(c => c.eventCount > 0);
  }, [dedupedEvents, groupedIds, purchases, orders]);

  // Toggle handlers
  const toggleSupplierPaid = async (purchaseId: string, currentVal: boolean) => {
    const { error } = await supabase.from("purchases").update({ supplier_paid: !currentVal }).eq("id", purchaseId);
    if (error) { toast.error("Failed to update"); return; }
    setPurchases(prev => prev.map(p => p.id === purchaseId ? { ...p, supplier_paid: !currentVal } : p));
    toast.success(!currentVal ? "Marked as paid" : "Marked as unpaid");
  };

  const togglePaymentReceived = async (orderId: string, currentVal: boolean) => {
    const { error } = await supabase.from("orders").update({ payment_received: !currentVal }).eq("id", orderId);
    if (error) { toast.error("Failed to update"); return; }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_received: !currentVal } : o));
    toast.success(!currentVal ? "Marked as received" : "Marked as pending");
  };

  // DETAIL VIEW — selected club
  const activeClub = clubData.find(c => c.value === selectedClub);

  if (activeClub) {
    // Per-event breakdown
    const eventBreakdown = activeClub.events
      .map(ev => {
        const allIds = groupedIds[ev.id] || [ev.id];
        const evPurchases = activeClub.purchases.filter(p => allIds.includes(p.event_id));
        const evOrders = activeClub.orders.filter(o => allIds.includes(o.event_id));
        const cost = evPurchases.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
        const revenue = evOrders.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
        const ticketsBought = evPurchases.reduce((s, p) => s + p.quantity, 0);
        const ticketsSold = evOrders.reduce((s, o) => s + o.quantity, 0);
        return { ev, evPurchases, evOrders, cost, revenue, profit: revenue - cost, ticketsBought, ticketsSold };
      })
      .filter(e => e.cost > 0 || e.revenue > 0)
      .sort((a, b) => new Date(a.ev.event_date).getTime() - new Date(b.ev.event_date).getTime());

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <button onClick={() => setSelectedClub(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Finance
          </button>
          <h1 className="text-2xl font-bold tracking-tight">{activeClub.label} — Finance</h1>
        </div>

        {/* Summary cards */}
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 border-b border-border shrink-0">
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</p>
            <p className="text-lg font-bold text-success">{fmt(activeClub.totalRevenue)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Costs</p>
            <p className="text-lg font-bold text-destructive">{fmt(activeClub.totalCost)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p>
            <p className={cn("text-lg font-bold", activeClub.profit >= 0 ? "text-success" : "text-destructive")}>
              {activeClub.profit >= 0 ? "" : "-"}{fmt(Math.abs(activeClub.profit))}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margin</p>
            <p className="text-lg font-bold">{activeClub.margin.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bought</p>
            <p className="text-lg font-bold font-mono">{activeClub.ticketsBought}</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sold</p>
            <p className="text-lg font-bold font-mono">{activeClub.ticketsSold}</p>
          </div>
        </div>

        {/* Per-event breakdown */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Per-Event Breakdown</h2>

          {eventBreakdown.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No financial data for this club</div>
          ) : (
            eventBreakdown.map(({ ev, evPurchases, evOrders, cost, revenue, profit, ticketsBought, ticketsSold }) => (
              <div key={ev.id} className="rounded-xl border bg-card overflow-hidden">
                {/* Event header */}
                <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-border">
                  <div>
                    <p className="font-bold">{ev.home_team} vs {ev.away_team}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ev.event_date), "EEE dd MMM yyyy, HH:mm")}
                      {ev.venue && ` · ${ev.venue}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</p>
                      <p className="text-sm font-bold text-success">{fmt(revenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Costs</p>
                      <p className="text-sm font-bold text-destructive">{fmt(cost)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p>
                      <p className={cn("text-sm font-bold", profit >= 0 ? "text-success" : "text-destructive")}>
                        {profit >= 0 ? "" : "-"}{fmt(Math.abs(profit))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                  {/* Purchases */}
                  <div className="p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" /> Purchases ({ticketsBought} tickets)
                    </h4>
                    {evPurchases.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None</p>
                    ) : (
                      <div className="space-y-1.5">
                        {evPurchases.map(p => {
                          const supplierName = supplierMap[p.supplier_id]?.name || "Unknown";
                          const pCost = p.total_cost_gbp || (p.quantity * p.unit_cost);
                          return (
                            <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span>{p.quantity}x {p.category}</span>
                                <span className="text-muted-foreground">({supplierName})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium">{fmt(pCost)}</span>
                                <span className={cn("text-[10px]", p.supplier_paid ? "text-success" : "text-destructive")}>
                                  {p.supplier_paid ? "Paid" : "Unpaid"}
                                </span>
                                <Switch
                                  checked={p.supplier_paid}
                                  onCheckedChange={() => toggleSupplierPaid(p.id, p.supplier_paid)}
                                  className="scale-75"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Sales */}
                  <div className="p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5" /> Sales ({ticketsSold} tickets)
                    </h4>
                    {evOrders.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None</p>
                    ) : (
                      <div className="space-y-1.5">
                        {evOrders.map(o => {
                          const net = o.net_received || o.sale_price - o.fees;
                          const platName = o.platform_id ? (platformMap[o.platform_id]?.name || "Unknown") : "Direct";
                          return (
                            <div key={o.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span>{o.quantity}x {o.category}</span>
                                <span className="text-muted-foreground">({platName})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium">{fmt(net)}</span>
                                <span className={cn("text-[10px]", o.payment_received ? "text-success" : "text-warning")}>
                                  {o.payment_received ? "Received" : "Pending"}
                                </span>
                                <Switch
                                  checked={o.payment_received}
                                  onCheckedChange={() => togglePaymentReceived(o.id, o.payment_received)}
                                  className="scale-75"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ─── OVERVIEW: Club Cards ───
  const totalRevenue = clubData.reduce((s, c) => s + c.totalRevenue, 0);
  const totalCost = clubData.reduce((s, c) => s + c.totalCost, 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground text-sm">
          Financial overview across all clubs and competitions
        </p>
      </div>

      {/* Global summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5 text-center">
          <TrendingUp className="h-5 w-5 mx-auto mb-2 text-success" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p>
          <p className="text-xl font-bold text-success">{fmt(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 text-center">
          <Package className="h-5 w-5 mx-auto mb-2 text-destructive" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Costs</p>
          <p className="text-xl font-bold text-destructive">{fmt(totalCost)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 text-center">
          <Percent className="h-5 w-5 mx-auto mb-2 text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Profit</p>
          <p className={cn("text-xl font-bold", totalProfit >= 0 ? "text-success" : "text-destructive")}>
            {totalProfit >= 0 ? "" : "-"}{fmt(Math.abs(totalProfit))}
          </p>
        </div>
      </div>

      {/* Club cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {clubData.map(club => {
          const style = CLUB_STYLES[club.value] || { gradient: "from-primary to-primary/80", accent: "text-primary" };
          return (
            <div
              key={club.value}
              onClick={() => setSelectedClub(club.value)}
              className="group relative rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
            >
              {/* Gradient background */}
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", style.gradient)} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

              <div className="relative p-6 text-white">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">{club.label}</h3>
                    <p className="text-xs text-white/70">{club.eventCount} event{club.eventCount !== 1 ? "s" : ""}</p>
                  </div>
                  <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                    {club.margin >= 0 ? "+" : ""}{club.margin.toFixed(0)}% margin
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Revenue</p>
                    <p className="text-base font-bold">{fmt(club.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Costs</p>
                    <p className="text-base font-bold">{fmt(club.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Profit</p>
                    <p className={cn("text-base font-bold", club.profit >= 0 ? "text-emerald-300" : "text-red-300")}>
                      {club.profit >= 0 ? "" : "-"}{fmt(Math.abs(club.profit))}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-white/60">
                  <span className="flex items-center gap-1"><Ticket className="h-3 w-3" /> {club.ticketsBought} bought · {club.ticketsSold} sold</span>
                  <span className="group-hover:text-white transition-colors">View details →</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {clubData.length === 0 && (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          No financial data yet — add purchases and orders to get started.
        </div>
      )}
    </div>
  );
}
