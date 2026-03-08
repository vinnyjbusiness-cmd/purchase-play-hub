import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Package, ShoppingCart, TrendingUp, Percent, Ticket,
  Users, ChevronRight, DollarSign, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CLUBS } from "@/lib/seatingSections";
import { cn } from "@/lib/utils";
import { deduplicateEvents } from "@/lib/eventDedup";

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
  buyer_name: string | null;
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
  block: string | null;
}

interface EventInfo {
  id: string; match_code: string; home_team: string; away_team: string;
  event_date: string; competition: string; venue?: string | null;
}
interface SupplierInfo { id: string; name: string; }
interface PlatformInfo { id: string; name: string; }

function matchesClub(event: EventInfo, clubValue: string): boolean {
  if (clubValue !== "world-cup" && event.competition.toLowerCase().includes("world cup")) return false;
  if (clubValue === "all") return true;
  const clubLabel = CLUBS.find(c => c.value === clubValue)?.label.toLowerCase() || "";
  if (clubValue === "world-cup") return event.competition.toLowerCase().includes("world cup");
  return (
    event.home_team.toLowerCase().includes(clubLabel.split(" (")[0].toLowerCase()) ||
    event.away_team.toLowerCase().includes(clubLabel.split(" (")[0].toLowerCase())
  );
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

export default function Finance() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [selectedClub, setSelectedClub] = useState<string>("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("purchases").select("id,supplier_order_id,quantity,unit_cost,total_cost,total_cost_gbp,currency,purchase_date,supplier_paid,notes,category,section,event_id,supplier_id"),
      supabase.from("orders").select("id,order_ref,buyer_name,sale_price,fees,net_received,quantity,order_date,payment_received,status,event_id,platform_id,category,block"),
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

  const activeClubs = useMemo(() => {
    return CLUBS.filter(club => {
      const clubLabel = club.label.toLowerCase().split(" (")[0];
      return events.some(e => {
        if (club.value === "world-cup") return e.competition.toLowerCase().includes("world cup");
        return e.home_team.toLowerCase().includes(clubLabel) || e.away_team.toLowerCase().includes(clubLabel);
      });
    });
  }, [events]);

  const filteredData = useMemo(() => {
    if (selectedClub === "all") {
      return {
        purchases,
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

  // ── SELECTED EVENT DETAIL VIEW ──
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return eventBreakdown.find(e => e.ev.id === selectedEventId) || null;
  }, [selectedEventId, eventBreakdown]);

  if (selectedEvent) {
    const { ev, evPurchases, evOrders, cost, revenue, profit, ticketsBought, ticketsSold } = selectedEvent;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const unpaidCost = evPurchases.filter(p => !p.supplier_paid).reduce((s, p) => s + (p.total_cost_gbp || p.quantity * p.unit_cost), 0);
    const pendingRevenue = evOrders.filter(o => !o.payment_received).reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
    const totalFees = evOrders.reduce((s, o) => s + o.fees, 0);
    const grossRevenue = evOrders.reduce((s, o) => s + o.sale_price * o.quantity, 0);

    // Group purchases by supplier
    const purchasesBySupplier = new Map<string, Purchase[]>();
    evPurchases.forEach(p => {
      const key = p.supplier_id;
      if (!purchasesBySupplier.has(key)) purchasesBySupplier.set(key, []);
      purchasesBySupplier.get(key)!.push(p);
    });
    const supplierGroups = [...purchasesBySupplier.entries()]
      .map(([suppId, pList]) => ({
        name: supplierMap[suppId]?.name || "Unknown",
        purchases: pList,
        totalQty: pList.reduce((s, p) => s + p.quantity, 0),
        totalCost: pList.reduce((s, p) => s + (p.total_cost_gbp || p.quantity * p.unit_cost), 0),
        allPaid: pList.every(p => p.supplier_paid),
        paidCount: pList.filter(p => p.supplier_paid).length,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Group sales by platform
    const salesByPlatform = new Map<string, Order[]>();
    evOrders.forEach(o => {
      const key = o.platform_id || "direct";
      if (!salesByPlatform.has(key)) salesByPlatform.set(key, []);
      salesByPlatform.get(key)!.push(o);
    });
    const platformGroups = [...salesByPlatform.entries()]
      .map(([platId, oList]) => ({
        name: platId === "direct" ? "Direct / WhatsApp" : (platformMap[platId]?.name || "Unknown"),
        orders: oList,
        totalQty: oList.reduce((s, o) => s + o.quantity, 0),
        totalRevenue: oList.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0),
        grossRevenue: oList.reduce((s, o) => s + o.sale_price * o.quantity, 0),
        totalFees: oList.reduce((s, o) => s + o.fees, 0),
        receivedCount: oList.filter(o => o.payment_received).length,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return (
      <div className="flex flex-col h-full animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 md:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedEventId(null)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate">{ev.home_team} vs {ev.away_team}</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(ev.event_date), "EEEE dd MMMM yyyy, HH:mm")}{ev.venue && ` · ${ev.venue}`}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* ── TOP-LEVEL P&L SUMMARY ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Gross Sales</p>
              <p className="text-xl font-bold font-mono">{fmt(grossRevenue)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{ticketsSold} ticket{ticketsSold !== 1 ? "s" : ""} sold</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Platform Fees</p>
              <p className="text-xl font-bold font-mono text-warning">{fmt(totalFees)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Net: {fmt(revenue)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Costs</p>
              <p className="text-xl font-bold font-mono text-destructive">{fmt(cost)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{ticketsBought} ticket{ticketsBought !== 1 ? "s" : ""} bought</p>
            </div>
            <div className={cn("rounded-xl border p-4", profit >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20")}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Net Profit</p>
              <p className={cn("text-xl font-bold font-mono", profit >= 0 ? "text-success" : "text-destructive")}>
                {profit >= 0 ? "" : "-"}{fmt(Math.abs(profit))}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{margin.toFixed(1)}% margin</p>
            </div>
          </div>

          {/* ── CASHFLOW ALERTS ── */}
          {(unpaidCost > 0 || pendingRevenue > 0) && (
            <div className="flex flex-wrap gap-3">
              {unpaidCost > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-destructive">Unpaid to suppliers</p>
                    <p className="text-sm font-bold font-mono text-destructive">{fmt(unpaidCost)}</p>
                  </div>
                </div>
              )}
              {pendingRevenue > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 px-4 py-2.5">
                  <DollarSign className="h-4 w-4 text-warning shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-warning">Awaiting payment</p>
                    <p className="text-sm font-bold font-mono text-warning">{fmt(pendingRevenue)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PURCHASES BY SUPPLIER ── */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" /> Purchases — {ticketsBought} tickets · {fmt(cost)}
            </h2>
            {supplierGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchases for this event.</p>
            ) : (
              <div className="space-y-3">
                {supplierGroups.map(sg => (
                  <div key={sg.name} className="rounded-xl border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{sg.name}</span>
                        <Badge variant="outline" className="text-[10px]">{sg.totalQty} ticket{sg.totalQty !== 1 ? "s" : ""}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm">{fmt(sg.totalCost)}</span>
                        {sg.allPaid ? (
                          <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> All Paid
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
                            {sg.paidCount}/{sg.purchases.length} Paid
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="divide-y">
                      {sg.purchases.map(p => {
                        const pCost = p.total_cost_gbp || (p.quantity * p.unit_cost);
                        return (
                          <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-xs bg-muted rounded px-1.5 py-0.5">{p.quantity}x</span>
                              <span>{p.category}</span>
                              {p.section && <span className="text-muted-foreground text-xs">· {p.section}</span>}
                              {p.currency !== "GBP" && (
                                <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">{p.currency}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-medium">{fmt(pCost)}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={cn("text-[10px] font-medium", p.supplier_paid ? "text-success" : "text-destructive")}>
                                  {p.supplier_paid ? "Paid" : "Unpaid"}
                                </span>
                                <Switch
                                  checked={p.supplier_paid}
                                  onCheckedChange={() => toggleSupplierPaid(p.id, p.supplier_paid)}
                                  className="scale-75"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SALES BY PLATFORM ── */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Sales — {ticketsSold} tickets · {fmt(revenue)} net
            </h2>
            {platformGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales for this event.</p>
            ) : (
              <div className="space-y-3">
                {platformGroups.map(pg => (
                  <div key={pg.name} className="rounded-xl border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{pg.name}</span>
                        <Badge variant="outline" className="text-[10px]">{pg.totalQty} ticket{pg.totalQty !== 1 ? "s" : ""}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {pg.totalFees > 0 && (
                          <span className="text-[10px] text-muted-foreground">Fees: {fmt(pg.totalFees)}</span>
                        )}
                        <span className="font-mono font-bold text-sm">{fmt(pg.totalRevenue)}</span>
                        <Badge className={cn("text-[10px]",
                          pg.receivedCount === pg.orders.length
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-warning/10 text-warning border-warning/20"
                        )}>
                          {pg.receivedCount === pg.orders.length
                            ? <><CheckCircle2 className="h-3 w-3 mr-1" /> All Received</>
                            : `${pg.receivedCount}/${pg.orders.length} Received`
                          }
                        </Badge>
                      </div>
                    </div>
                    <div className="divide-y">
                      {pg.orders.map(o => {
                        const net = o.net_received || o.sale_price - o.fees;
                        return (
                          <div key={o.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-xs bg-muted rounded px-1.5 py-0.5">{o.quantity}x</span>
                              <span>{o.category}</span>
                              {o.block && <span className="text-muted-foreground text-xs">· {o.block}</span>}
                              {o.buyer_name && <span className="text-muted-foreground text-xs">({o.buyer_name})</span>}
                              {o.order_ref && <span className="text-muted-foreground text-[10px] font-mono">#{o.order_ref}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              {o.fees > 0 && <span className="text-[10px] text-muted-foreground">-{fmt(o.fees)} fees</span>}
                              <span className="font-mono font-medium">{fmt(net)}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={cn("text-[10px] font-medium", o.payment_received ? "text-success" : "text-warning")}>
                                  {o.payment_received ? "Received" : "Pending"}
                                </span>
                                <Switch
                                  checked={o.payment_received}
                                  onCheckedChange={() => togglePaymentReceived(o.id, o.payment_received)}
                                  className="scale-75"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── P&L WATERFALL ── */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">P&L Breakdown</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span>Gross Sales Revenue</span>
                <span className="font-mono font-bold">{fmt(grossRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-warning">
                <span>– Platform Fees</span>
                <span className="font-mono font-bold">-{fmt(totalFees)}</span>
              </div>
              <div className="border-t pt-2 flex items-center justify-between text-sm font-semibold">
                <span>Net Revenue</span>
                <span className="font-mono text-success">{fmt(revenue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-destructive">
                <span>– Purchase Costs</span>
                <span className="font-mono font-bold">-{fmt(cost)}</span>
              </div>
              <div className={cn("border-t pt-2 flex items-center justify-between text-base font-bold",
                profit >= 0 ? "text-success" : "text-destructive"
              )}>
                <span>Net Profit</span>
                <span className="font-mono">{profit >= 0 ? "" : "-"}{fmt(Math.abs(profit))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── EVENT LIST VIEW ──
  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Sticky club filter bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4 overflow-x-auto scrollbar-hide shrink-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setSelectedClub("all")}
          className={cn("text-sm font-medium whitespace-nowrap transition-colors",
            selectedClub === "all" ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {activeClubs.map(club => (
          <button
            key={club.value}
            onClick={() => setSelectedClub(club.value === selectedClub ? "all" : club.value)}
            className={cn("text-sm font-medium whitespace-nowrap transition-colors",
              selectedClub === club.value ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {club.label.split(" (")[0]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
            <p className="text-muted-foreground text-sm">
              Select an event to see its full financial breakdown
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

          {/* Event list */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Events</h2>
            {eventBreakdown.length === 0 ? (
              <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground text-sm">
                No financial data yet — add purchases and orders to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {eventBreakdown.map(({ ev, cost, revenue, profit, ticketsBought, ticketsSold }) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className="w-full text-left rounded-xl border bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{ev.home_team} vs {ev.away_team}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(ev.event_date), "EEE dd MMM yyyy, HH:mm")}
                          {ev.venue && ` · ${ev.venue}`}
                        </p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">
                            <Ticket className="h-3 w-3 inline mr-0.5" />
                            {ticketsBought} bought · {ticketsSold} sold
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</p>
                          <p className="text-sm font-bold font-mono text-success">{fmt(revenue)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Costs</p>
                          <p className="text-sm font-bold font-mono text-destructive">{fmt(cost)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p>
                          <p className={cn("text-sm font-bold font-mono", profit >= 0 ? "text-success" : "text-destructive")}>
                            {profit >= 0 ? "" : "-"}{fmt(Math.abs(profit))}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
