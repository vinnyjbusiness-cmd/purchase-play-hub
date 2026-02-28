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
  const [selectedClub, setSelectedClub] = useState<string>("all");

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

  // Filter CLUBS to only those with matching events
  const activeClubs = useMemo(() => {
    return CLUBS.filter(club => {
      const clubLabel = club.label.toLowerCase().split(" (")[0];
      return events.some(e => {
        if (club.value === "world-cup") {
          return e.competition.toLowerCase().includes("world cup");
        }
        return e.home_team.toLowerCase().includes(clubLabel) || e.away_team.toLowerCase().includes(clubLabel);
      });
    });
  }, [events]);
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

  // Filter data based on selected club
  const filteredData = useMemo(() => {
    if (selectedClub === "all") {
      return {
        purchases: purchases,
        orders: orders.filter(o => o.status !== "cancelled" && o.status !== "refunded"),
        events: dedupedEvents,
      };
    }
    const club = CLUBS.find(c => c.value === selectedClub);
    const clubLabel = club ? club.label.toLowerCase().split(" (")[0] : selectedClub;
    const matchingEvents = dedupedEvents.filter(e => {
      if (selectedClub === "world-cup") return e.competition.toLowerCase().includes("world cup");
      return e.home_team.toLowerCase().includes(clubLabel) || e.away_team.toLowerCase().includes(clubLabel);
    });
    const matchingEventIds = new Set<string>();
    matchingEvents.forEach(e => (groupedIds[e.id] || [e.id]).forEach(id => matchingEventIds.add(id)));
    return {
      purchases: purchases.filter(p => matchingEventIds.has(p.event_id)),
      orders: orders.filter(o => matchingEventIds.has(o.event_id) && o.status !== "cancelled" && o.status !== "refunded"),
      events: matchingEvents,
    };
  }, [selectedClub, purchases, orders, dedupedEvents, groupedIds]);

  const totalRevenue = filteredData.orders.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
  const totalCost = filteredData.purchases.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
  const totalProfit = totalRevenue - totalCost;

  // Per-event breakdown
  const eventBreakdown = useMemo(() => {
    return filteredData.events
      .map(ev => {
        const allIds = groupedIds[ev.id] || [ev.id];
        const evPurchases = filteredData.purchases.filter(p => allIds.includes(p.event_id));
        const evOrders = filteredData.orders.filter(o => allIds.includes(o.event_id));
        const cost = evPurchases.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
        const revenue = evOrders.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
        const ticketsBought = evPurchases.reduce((s, p) => s + p.quantity, 0);
        const ticketsSold = evOrders.reduce((s, o) => s + o.quantity, 0);
        return { ev, evPurchases, evOrders, cost, revenue, profit: revenue - cost, ticketsBought, ticketsSold };
      })
      .filter(e => e.cost > 0 || e.revenue > 0)
      .sort((a, b) => new Date(a.ev.event_date).getTime() - new Date(b.ev.event_date).getTime());
  }, [filteredData, groupedIds]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Sticky club filter bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4 overflow-x-auto scrollbar-hide shrink-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setSelectedClub("all")}
          className={cn(
            "text-sm font-medium whitespace-nowrap transition-colors",
            selectedClub === "all" ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {activeClubs.map(club => (
          <button
            key={club.value}
            onClick={() => setSelectedClub(club.value === selectedClub ? "all" : club.value)}
            className={cn(
              "text-sm font-medium whitespace-nowrap transition-colors",
              selectedClub === club.value ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {club.label.split(" (")[0]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
            <p className="text-muted-foreground text-sm">
              Financial overview{selectedClub !== "all" ? ` — ${selectedClub.replace(/\b\w/g, c => c.toUpperCase())}` : " across all clubs"}
            </p>
          </div>

          {/* Global summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          {/* Per-event breakdown */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Per-Event Breakdown</h2>

            {eventBreakdown.length === 0 ? (
              <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground text-sm">
                No financial data yet — add purchases and orders to get started.
              </div>
            ) : (
              eventBreakdown.map(({ ev, evPurchases, evOrders, cost, revenue, profit, ticketsBought, ticketsSold }) => (
                <div key={ev.id} className="rounded-xl border bg-card overflow-hidden">
                  {/* Event header */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-5 py-3 bg-muted/40 border-b border-border gap-2">
                    <div>
                      <p className="font-bold">{ev.home_team} vs {ev.away_team}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ev.event_date), "EEE dd MMM yyyy, HH:mm")}
                        {ev.venue && ` · ${ev.venue}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 text-right flex-wrap">
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
      </div>
    </div>
  );
}
