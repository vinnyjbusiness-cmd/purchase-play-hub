import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { CalendarDays, Package, ShoppingCart, CheckCircle2, Clock } from "lucide-react";
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

interface EventInfo { id: string; match_code: string; home_team: string; away_team: string; event_date: string; competition: string; }
interface SupplierInfo { id: string; name: string; }
interface PlatformInfo { id: string; name: string; }

function matchesClub(event: EventInfo, clubValue: string): boolean {
  if (clubValue === "all") return true;
  const clubLabel = CLUBS.find(c => c.value === clubValue)?.label.toLowerCase() || "";
  if (clubValue === "world-cup") return event.competition.toLowerCase().includes("world cup");
  return (
    event.home_team.toLowerCase().includes(clubLabel) ||
    event.away_team.toLowerCase().includes(clubLabel)
  );
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

export default function Finance() {
  const { club } = useParams<{ club?: string }>();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("purchases").select("id,supplier_order_id,quantity,unit_cost,total_cost,total_cost_gbp,currency,purchase_date,supplier_paid,notes,category,section,event_id,supplier_id"),
      supabase.from("orders").select("id,order_ref,sale_price,fees,net_received,quantity,order_date,payment_received,status,event_id,platform_id,category"),
      supabase.from("events").select("id,match_code,home_team,away_team,event_date,competition"),
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

  // Filter events by club
  const { unique: dedupedEvents, groupedIds } = useMemo(() => deduplicateEvents(events), [events]);

  const clubEvents = useMemo(() => {
    const filtered = club ? dedupedEvents.filter(e => matchesClub(e, club)) : dedupedEvents;
    const eventIdsWithData = new Set([
      ...orders.map(o => o.event_id),
      ...purchases.map(p => p.event_id),
    ]);
    return filtered
      .filter(ev => {
        const allIds = groupedIds[ev.id] || [ev.id];
        return allIds.some(id => eventIdsWithData.has(id));
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [dedupedEvents, groupedIds, orders, purchases, club]);

  // Totals for header
  const clubEventIds = useMemo(() => {
    const ids = new Set<string>();
    clubEvents.forEach(e => (groupedIds[e.id] || [e.id]).forEach(id => ids.add(id)));
    return ids;
  }, [clubEvents, groupedIds]);
  const clubPurchases = useMemo(() => purchases.filter(p => clubEventIds.has(p.event_id)), [purchases, clubEventIds]);
  const clubOrders = useMemo(() => orders.filter(o => clubEventIds.has(o.event_id)), [orders, clubEventIds]);

  const totalIOwe = clubPurchases.filter(p => !p.supplier_paid).reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
  const totalOwedToMe = clubOrders.filter(o => !o.payment_received && o.status !== "cancelled" && o.status !== "refunded").reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);

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

  const clubTitle = club
    ? CLUBS.find(c => c.value === club)?.label || club.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "All Clubs";

  // Selected event data
  const selEvent = clubEvents.find(e => e.id === selectedEvent);
  const selEventIds = useMemo(() => selectedEvent ? new Set(groupedIds[selectedEvent] || [selectedEvent]) : new Set<string>(), [selectedEvent, groupedIds]);
  const selPurchases = useMemo(() => selectedEvent ? purchases.filter(p => selEventIds.has(p.event_id)) : [], [purchases, selEventIds, selectedEvent]);
  const selOrders = useMemo(() => selectedEvent ? orders.filter(o => selEventIds.has(o.event_id)) : [], [orders, selEventIds, selectedEvent]);

  // Helper: parse supplier/website name from notes
  const getSupplierDisplayName = (p: Purchase): string => {
    const supplier = supplierMap[p.supplier_id];
    const supplierType = supplier?.name?.toLowerCase() || "";
    if (supplierType === "trade" && p.notes) {
      const nameMatch = p.notes.match(/Name:\s*([^|]+)/);
      if (nameMatch) return nameMatch[1].trim();
    }
    if (supplierType === "websites" && p.notes) {
      const webMatch = p.notes.match(/Website:\s*([^|]+)/);
      if (webMatch) return webMatch[1].trim();
    }
    return supplier?.name || "Unknown";
  };

  // Group purchases by actual supplier/website name (from notes)
  const purchasesBySupplier = useMemo(() => {
    const map: Record<string, Purchase[]> = {};
    selPurchases.forEach(p => {
      const key = getSupplierDisplayName(p);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [selPurchases, supplierMap]);

  // Group orders by platform
  const ordersByPlatform = useMemo(() => {
    const map: Record<string, Order[]> = {};
    selOrders.forEach(o => {
      const key = o.platform_id || "direct";
      if (!map[key]) map[key] = [];
      map[key].push(o);
    });
    return map;
  }, [selOrders]);

  const selTotalIOwe = selPurchases.filter(p => !p.supplier_paid).reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
  const selTotalOwedToMe = selOrders.filter(o => !o.payment_received && o.status !== "cancelled" && o.status !== "refunded").reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
  const selTotalPurchases = selPurchases.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
  const selTotalSales = selOrders.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">{clubTitle} — Finance</h1>
      </div>

      {/* Event buttons */}
      <div className="px-6 py-3 border-b border-border shrink-0">
        <div className="flex flex-wrap gap-2">
          {clubEvents.map(ev => {
            const isSelected = selectedEvent === ev.id;
            const allIds = groupedIds[ev.id] || [ev.id];
            const evPurchasesUnpaid = purchases.filter(p => allIds.includes(p.event_id) && !p.supplier_paid);
            const evOrdersUnpaid = orders.filter(o => allIds.includes(o.event_id) && !o.payment_received && o.status !== "cancelled" && o.status !== "refunded");
            const hasUnpaid = evPurchasesUnpaid.length > 0 || evOrdersUnpaid.length > 0;
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedEvent(isSelected ? null : ev.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-card-foreground border-border hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{ev.home_team} vs {ev.away_team}</span>
                <span className="text-xs opacity-70">{format(new Date(ev.event_date), "dd MMM")}</span>
                {hasUnpaid && <span className="h-2 w-2 rounded-full bg-warning shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary panel */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!selectedEvent ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select an event above to view the money summary
          </div>
        ) : (
          <div className="space-y-4">
            {/* Event title */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{selEvent?.home_team} vs {selEvent?.away_team}</h2>
                <p className="text-xs text-muted-foreground">{selEvent && format(new Date(selEvent.event_date), "dd MMMM yyyy")} · {selEvent?.match_code}</p>
              </div>
            </div>

            {/* Quick totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Purchases</p>
                <p className="text-lg font-bold">{fmt(selTotalPurchases)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Sales</p>
                <p className="text-lg font-bold">{fmt(selTotalSales)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">I Owe (Unpaid)</p>
                <p className="text-lg font-bold text-destructive">{fmt(selTotalIOwe)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Owed to Me</p>
                <p className="text-lg font-bold text-success">{fmt(selTotalOwedToMe)}</p>
              </div>
            </div>

            {/* Suppliers — I Owe */}
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" /> Purchases — What I Owe
                </h3>
              </div>
              {Object.keys(purchasesBySupplier).length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">No purchases for this event</div>
              ) : (
                <div className="divide-y divide-border">
                  {Object.entries(purchasesBySupplier).map(([displayName, items]) => {
                    const totalQty = items.reduce((s, p) => s + p.quantity, 0);
                    const totalCost = items.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
                    const unpaidCost = items.filter(p => !p.supplier_paid).reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
                    const allPaid = items.every(p => p.supplier_paid);
                    return (
                      <div key={displayName} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">{displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              {items.length} purchase{items.length !== 1 ? "s" : ""} · {totalQty} tickets · Total: {fmt(totalCost)}
                            </p>
                          </div>
                          <div className="text-right">
                            {allPaid ? (
                              <span className="flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> All Paid</span>
                            ) : (
                              <span className="text-sm font-bold text-destructive">Owe: {fmt(unpaidCost)}</span>
                            )}
                          </div>
                        </div>
                        {/* Individual purchase lines */}
                        <div className="space-y-1.5">
                          {items.map(p => (
                            <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">{p.quantity}x {p.category}</span>
                                <span>{fmt(p.total_cost_gbp || (p.quantity * p.unit_cost))}</span>
                                <span className="text-muted-foreground">{format(new Date(p.purchase_date), "dd MMM yy")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cn("text-xs", p.supplier_paid ? "text-success" : "text-destructive")}>
                                  {p.supplier_paid ? "Paid" : "Unpaid"}
                                </span>
                                <Switch
                                  checked={p.supplier_paid}
                                  onCheckedChange={() => toggleSupplierPaid(p.id, p.supplier_paid)}
                                  className="scale-75"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Platforms — Owed to Me */}
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Sales — Owed to Me
                </h3>
              </div>
              {Object.keys(ordersByPlatform).length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">No sales for this event</div>
              ) : (
                <div className="divide-y divide-border">
                  {Object.entries(ordersByPlatform).map(([platformId, items]) => {
                    const platformName = platformId === "direct" ? "Direct Sale" : (platformMap[platformId]?.name || "Unknown");
                    const totalQty = items.reduce((s, o) => s + o.quantity, 0);
                    const totalNet = items.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
                    const unpaidNet = items.filter(o => !o.payment_received && o.status !== "cancelled" && o.status !== "refunded").reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
                    const allReceived = items.every(o => o.payment_received || o.status === "cancelled" || o.status === "refunded");
                    return (
                      <div key={platformId} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">{platformName}</p>
                            <p className="text-xs text-muted-foreground">
                              Sold {totalQty} ticket{totalQty !== 1 ? "s" : ""} · Total: {fmt(totalNet)}
                            </p>
                          </div>
                          <div className="text-right">
                            {allReceived ? (
                              <span className="flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> All Received</span>
                            ) : (
                              <span className="text-sm font-bold text-success">Owed: {fmt(unpaidNet)}</span>
                            )}
                          </div>
                        </div>
                        {/* Individual order lines */}
                        <div className="space-y-1.5">
                          {items.map(o => (
                            <div key={o.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">{o.quantity}x {o.category}</span>
                                <span>{fmt(o.net_received || o.sale_price - o.fees)}</span>
                                {o.order_ref && <span className="text-muted-foreground">Ref: {o.order_ref}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cn("text-xs", o.payment_received ? "text-success" : "text-warning")}>
                                  {o.payment_received ? "Received" : "Pending"}
                                </span>
                                <Switch
                                  checked={o.payment_received}
                                  onCheckedChange={() => togglePaymentReceived(o.id, o.payment_received)}
                                  className="scale-75"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
