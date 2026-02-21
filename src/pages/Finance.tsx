import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowUpRight, ArrowDownLeft, CalendarDays, TrendingUp, TrendingDown, ChevronRight, Ticket, Package, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CLUBS } from "@/lib/seatingSections";
import FilterSelect from "@/components/FilterSelect";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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

interface LedgerEntry {
  id: string;
  transaction_type: string;
  description: string;
  amount: number;
  currency: string;
  amount_gbp: number;
  transaction_date: string;
  event_id: string | null;
  platform_id: string | null;
  supplier_id: string | null;
}

const typeColor: Record<string, string> = {
  sale: "bg-success/10 text-success border-success/20",
  purchase: "bg-primary/10 text-primary border-primary/20",
  fee: "bg-warning/10 text-warning border-warning/20",
  refund: "bg-destructive/10 text-destructive border-destructive/20",
  payout: "bg-primary/10 text-primary border-primary/20",
  supplier_payment: "bg-muted text-muted-foreground",
  adjustment: "bg-muted text-muted-foreground",
};

function matchesClub(event: EventInfo, clubValue: string): boolean {
  if (clubValue === "all") return true;
  const clubLabel = CLUBS.find(c => c.value === clubValue)?.label.toLowerCase() || "";
  if (clubValue === "world-cup") return event.competition.toLowerCase().includes("world cup");
  return (
    event.home_team.toLowerCase().includes(clubLabel) ||
    event.away_team.toLowerCase().includes(clubLabel)
  );
}

export default function Finance() {
  const { club } = useParams<{ club?: string }>();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("transactions_ledger").select("*").order("transaction_date", { ascending: false }),
      supabase.from("purchases").select("id,supplier_order_id,quantity,unit_cost,total_cost,total_cost_gbp,currency,purchase_date,supplier_paid,notes,category,section,event_id,supplier_id"),
      supabase.from("orders").select("id,order_ref,sale_price,fees,net_received,quantity,order_date,payment_received,status,event_id,platform_id,category"),
      supabase.from("events").select("id,match_code,home_team,away_team,event_date,competition"),
      supabase.from("suppliers").select("id,name"),
      supabase.from("platforms").select("id,name"),
    ]).then(([ledger, purch, ord, ev, sup, plat]) => {
      setEntries(ledger.data || []);
      setPurchases(purch.data || []);
      setOrders(ord.data || []);
      setEvents(ev.data || []);
      setSuppliers(sup.data || []);
      setPlatforms(plat.data || []);
    });
  }, []);

  const eventMap = useMemo(() => Object.fromEntries(events.map(e => [e.id, e])), [events]);
  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);

  // Filter events by club param
  const clubEventIds = useMemo(() => {
    if (!club) return null;
    return new Set(events.filter(e => matchesClub(e, club)).map(e => e.id));
  }, [events, club]);

  const filterByClub = <T extends { event_id: string }>(items: T[]): T[] => {
    if (!clubEventIds) return items;
    return items.filter(i => clubEventIds.has(i.event_id));
  };

  const eventLabel = (id: string) => {
    const ev = eventMap[id];
    return ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown";
  };

  const getSupplierDetail = (notes: string | null) => {
    if (!notes) return null;
    const nameMatch = notes.match(/Name:\s*([^|]+)/);
    const websiteMatch = notes.match(/Website:\s*([^|]+)/);
    return nameMatch ? nameMatch[1].trim() : websiteMatch ? websiteMatch[1].trim() : null;
  };

  // Filtered data
  const allPurchasesFiltered = filterByClub(purchases);
  const allOrdersFiltered = filterByClub(orders);
  const unpaidPurchases = allPurchasesFiltered.filter(p => !p.supplier_paid);
  const paidPurchases = allPurchasesFiltered.filter(p => p.supplier_paid);
  const unpaidOrders = allOrdersFiltered.filter(o => !o.payment_received && o.status !== "cancelled" && o.status !== "refunded");
  const paidOrders = allOrdersFiltered.filter(o => o.payment_received);

  const totalIOwe = unpaidPurchases.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
  const totalOwedToMe = unpaidOrders.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);

  // Per-event P&L cards
  const eventPL = useMemo(() => {
    const relevantEvents = club ? events.filter(e => matchesClub(e, club)) : events;
    // Only events that have orders
    const eventIdsWithOrders = new Set(allOrdersFiltered.map(o => o.event_id));
    return relevantEvents
      .filter(ev => eventIdsWithOrders.has(ev.id))
      .map(ev => {
        const evOrders = orders.filter(o => o.event_id === ev.id);
        const evPurchases = purchases.filter(p => p.event_id === ev.id);
        const revenue = evOrders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
        const fees = evOrders.reduce((s, o) => s + Number(o.fees || 0), 0);
        const costs = evPurchases.reduce((s, p) => s + Number(p.total_cost || 0), 0);
        const soldQty = evOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);
        const boughtQty = evPurchases.reduce((s, p) => s + Number(p.quantity || 0), 0);
        const unpaidCost = evPurchases.filter(p => !p.supplier_paid).reduce((s, p) => s + Number(p.total_cost || 0), 0);
        const unpaidRevenue = evOrders.filter(o => !o.payment_received).reduce((s, o) => s + Number(o.sale_price || 0) - Number(o.fees || 0), 0);
        return {
          ...ev,
          revenue, fees, costs, profit: revenue - costs - fees,
          soldQty, boughtQty, unpaidCost, unpaidRevenue,
          ordersCount: evOrders.length,
          purchasesCount: evPurchases.length,
        };
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [events, orders, purchases, club, allOrdersFiltered]);

  const totalRevenue = eventPL.reduce((s, e) => s + e.revenue, 0);
  const totalCosts = eventPL.reduce((s, e) => s + e.costs, 0);
  const totalFees = eventPL.reduce((s, e) => s + e.fees, 0);
  const totalProfit = totalRevenue - totalCosts - totalFees;
  const totalSold = eventPL.reduce((s, e) => s + e.soldQty, 0);

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

  // Ledger
  const filteredLedger = entries.filter((e) => {
    if (clubEventIds && e.event_id && !clubEventIds.has(e.event_id)) return false;
    if (filterType !== "all" && e.transaction_type !== filterType) return false;
    if (filterCurrency !== "all" && e.currency !== filterCurrency) return false;
    if (search) return e.description.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const totalIn = filteredLedger.filter((e) => e.amount_gbp > 0).reduce((s, e) => s + e.amount_gbp, 0);
  const totalOut = filteredLedger.filter((e) => e.amount_gbp < 0).reduce((s, e) => s + e.amount_gbp, 0);

  const clubTitle = club
    ? CLUBS.find(c => c.value === club)?.label || club.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "All Clubs";

  // I Owe by game
  const iOweByGame = useMemo(() => {
    const map: Record<string, Purchase[]> = {};
    unpaidPurchases.forEach(p => {
      if (!map[p.event_id]) map[p.event_id] = [];
      map[p.event_id].push(p);
    });
    return map;
  }, [unpaidPurchases]);

  const owedToMeByGame = useMemo(() => {
    const map: Record<string, Order[]> = {};
    unpaidOrders.forEach(o => {
      if (!map[o.event_id]) map[o.event_id] = [];
      map[o.event_id].push(o);
    });
    return map;
  }, [unpaidOrders]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{clubTitle} — Finance</h1>
        <p className="text-muted-foreground text-sm">
          {eventPL.length} event{eventPL.length !== 1 ? "s" : ""} · {totalSold} tickets sold · Profit: <span className={totalProfit >= 0 ? "text-success" : "text-destructive"}>£{totalProfit.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
        </p>
      </div>

      {/* Club filter buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={!club ? "default" : "outline"}
          size="sm"
          onClick={() => navigate("/finance")}
          className="text-xs"
        >
          All Clubs
        </Button>
        {CLUBS.map(c => (
          <Button
            key={c.value}
            variant={club === c.value ? "default" : "outline"}
            size="sm"
            onClick={() => navigate(`/finance/${c.value}`)}
            className="text-xs"
          >
            {c.label}
          </Button>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <p className="text-lg font-bold">£{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Costs</p>
          <p className="text-lg font-bold">£{totalCosts.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">I Owe</p>
          <p className="text-lg font-bold text-destructive">£{totalIOwe.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Owed to Me</p>
          <p className="text-lg font-bold text-success">£{totalOwedToMe.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Net Profit</p>
          <p className={`text-lg font-bold ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
            £{totalProfit.toLocaleString("en-GB", { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Events P&L</TabsTrigger>
          <TabsTrigger value="i-owe">
            I Owe {unpaidPurchases.length > 0 && <Badge variant="destructive" className="ml-2 text-xs">{unpaidPurchases.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="owed-to-me">
            Owed to Me {unpaidOrders.length > 0 && <Badge className="ml-2 text-xs bg-success text-success-foreground">{unpaidOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        {/* === EVENTS P&L TAB === */}
        <TabsContent value="events" className="space-y-3">
          {eventPL.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">No events with orders found</div>
          ) : (
            eventPL.map(ev => {
              const isExpanded = expandedEvent === ev.id;
              const evOrders = orders.filter(o => o.event_id === ev.id);
              const evPurchases = purchases.filter(p => p.event_id === ev.id);
              return (
                <div key={ev.id} className="rounded-lg border bg-card overflow-hidden">
                  {/* Event header — clickable */}
                  <button
                    onClick={() => setExpandedEvent(isExpanded ? null : ev.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <CalendarDays className="h-4 w-4" />
                        {format(new Date(ev.event_date), "dd MMM yyyy")}
                      </div>
                      <div>
                        <p className="font-semibold">{ev.home_team} vs {ev.away_team}</p>
                        <p className="text-xs text-muted-foreground">{ev.match_code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground"><Ticket className="inline h-3.5 w-3.5 mr-1" />{ev.soldQty}/{ev.boughtQty}</span>
                          <span className="text-muted-foreground">Rev: £{ev.revenue.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</span>
                          <span className={`font-semibold ${ev.profit >= 0 ? "text-success" : "text-destructive"}`}>
                            {ev.profit >= 0 ? <TrendingUp className="inline h-3.5 w-3.5 mr-1" /> : <TrendingDown className="inline h-3.5 w-3.5 mr-1" />}
                            £{ev.profit.toLocaleString("en-GB", { minimumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t p-4 space-y-4 bg-muted/10">
                      {/* Mini KPIs */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        <div className="rounded-md border bg-card p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Revenue</p>
                          <p className="text-sm font-bold">£{ev.revenue.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
                        </div>
                        <div className="rounded-md border bg-card p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Costs</p>
                          <p className="text-sm font-bold">£{ev.costs.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
                        </div>
                        <div className="rounded-md border bg-card p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Fees</p>
                          <p className="text-sm font-bold">£{ev.fees.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
                        </div>
                        <div className="rounded-md border bg-card p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Net Profit</p>
                          <p className={`text-sm font-bold ${ev.profit >= 0 ? "text-success" : "text-destructive"}`}>£{ev.profit.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
                        </div>
                        <div className="rounded-md border bg-card p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Unpaid Cost</p>
                          <p className="text-sm font-bold text-destructive">£{ev.unpaidCost.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
                        </div>
                        <div className="rounded-md border bg-card p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">Pending Income</p>
                          <p className="text-sm font-bold text-success">£{ev.unpaidRevenue.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</p>
                        </div>
                      </div>

                      {/* Sales table */}
                      {evOrders.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Sales ({evOrders.length})</p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Order Ref</TableHead>
                                <TableHead>Platform</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead className="text-right">Sale Price</TableHead>
                                <TableHead className="text-right">Fees</TableHead>
                                <TableHead className="text-right">Net</TableHead>
                                <TableHead className="text-center">Received</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {evOrders.map(o => (
                                <TableRow key={o.id}>
                                  <TableCell className="font-medium">{o.order_ref || "—"}</TableCell>
                                  <TableCell>{o.platform_id ? platformMap[o.platform_id]?.name || "—" : "—"}</TableCell>
                                  <TableCell>{o.category}</TableCell>
                                  <TableCell>{o.quantity}</TableCell>
                                  <TableCell className="text-right">£{Number(o.sale_price).toFixed(2)}</TableCell>
                                  <TableCell className="text-right">£{Number(o.fees).toFixed(2)}</TableCell>
                                  <TableCell className="text-right font-medium">£{(o.net_received || Number(o.sale_price) - Number(o.fees)).toFixed(2)}</TableCell>
                                  <TableCell className="text-center">
                                    <Switch checked={o.payment_received} onCheckedChange={() => togglePaymentReceived(o.id, o.payment_received)} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* Purchases table */}
                      {evPurchases.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Package className="h-3 w-3" /> Purchases ({evPurchases.length})</p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead className="text-right">Cost (GBP)</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-center">Paid</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {evPurchases.map(p => (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium">{supplierMap[p.supplier_id]?.name || "Unknown"}</TableCell>
                                  <TableCell>{p.category}</TableCell>
                                  <TableCell>{p.quantity}</TableCell>
                                  <TableCell className="text-right font-medium">£{(p.total_cost_gbp || (p.quantity * p.unit_cost)).toFixed(2)}</TableCell>
                                  <TableCell className="text-muted-foreground">{format(new Date(p.purchase_date), "dd MMM yy")}</TableCell>
                                  <TableCell className="text-center">
                                    <Switch checked={p.supplier_paid} onCheckedChange={() => toggleSupplierPaid(p.id, p.supplier_paid)} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        {/* === I OWE TAB === */}
        <TabsContent value="i-owe" className="space-y-4">
          {Object.keys(iOweByGame).length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">All suppliers have been paid!</div>
          ) : (
            Object.entries(iOweByGame).map(([eventId, items]) => {
              const gameTotal = items.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
              return (
                <div key={eventId} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <div>
                      <p className="font-semibold">{eventLabel(eventId)}</p>
                      <p className="text-xs text-muted-foreground">{eventMap[eventId] ? format(new Date(eventMap[eventId].event_date), "dd MMM yyyy") : ""}</p>
                    </div>
                    <p className="font-bold text-destructive">£{gameTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead className="text-right">Cost (GBP)</TableHead>
                        <TableHead>Date Bought</TableHead>
                        <TableHead className="text-center">Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{supplierMap[p.supplier_id]?.name || "Unknown"}</TableCell>
                          <TableCell className="text-sm">{getSupplierDetail(p.notes) || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{p.supplier_order_id || "—"}</TableCell>
                          <TableCell>{p.category}</TableCell>
                          <TableCell>{p.quantity}</TableCell>
                          <TableCell className="text-right font-medium">£{(p.total_cost_gbp || (p.quantity * p.unit_cost)).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-muted-foreground">{format(new Date(p.purchase_date), "dd MMM yy")}</TableCell>
                          <TableCell className="text-center">
                            <Switch checked={p.supplier_paid} onCheckedChange={() => toggleSupplierPaid(p.id, p.supplier_paid)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })
          )}
          {paidPurchases.length > 0 && (
            <details className="rounded-lg border bg-card">
              <summary className="p-4 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                View {paidPurchases.length} paid purchase{paidPurchases.length !== 1 ? "s" : ""}
              </summary>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Game</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Cost (GBP)</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidPurchases.map(p => (
                    <TableRow key={p.id} className="opacity-60">
                      <TableCell>{eventLabel(p.event_id)}</TableCell>
                      <TableCell>{supplierMap[p.supplier_id]?.name || "Unknown"}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                      <TableCell className="text-right">£{(p.total_cost_gbp || (p.quantity * p.unit_cost)).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(p.purchase_date), "dd MMM yy")}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={p.supplier_paid} onCheckedChange={() => toggleSupplierPaid(p.id, p.supplier_paid)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </details>
          )}
        </TabsContent>

        {/* === OWED TO ME TAB === */}
        <TabsContent value="owed-to-me" className="space-y-4">
          {Object.keys(owedToMeByGame).length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">All payments received!</div>
          ) : (
            Object.entries(owedToMeByGame).map(([eventId, items]) => {
              const gameTotal = items.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
              return (
                <div key={eventId} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <div>
                      <p className="font-semibold">{eventLabel(eventId)}</p>
                      <p className="text-xs text-muted-foreground">{eventMap[eventId] ? format(new Date(eventMap[eventId].event_date), "dd MMM yyyy") : ""}</p>
                    </div>
                    <p className="font-bold text-success">£{gameTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order Ref</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead className="text-right">Net (GBP)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sale Date</TableHead>
                        <TableHead className="text-center">Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(o => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.order_ref || "—"}</TableCell>
                          <TableCell>{o.platform_id ? platformMap[o.platform_id]?.name || "Unknown" : "—"}</TableCell>
                          <TableCell>{o.category}</TableCell>
                          <TableCell>{o.quantity}</TableCell>
                          <TableCell className="text-right font-medium">£{(o.net_received || o.sale_price - o.fees).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell><Badge variant="outline" className={typeColor["sale"]}>{o.status}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{format(new Date(o.order_date), "dd MMM yy")}</TableCell>
                          <TableCell className="text-center">
                            <Switch checked={o.payment_received} onCheckedChange={() => togglePaymentReceived(o.id, o.payment_received)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })
          )}
          {paidOrders.length > 0 && (
            <details className="rounded-lg border bg-card">
              <summary className="p-4 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                View {paidOrders.length} received payment{paidOrders.length !== 1 ? "s" : ""}
              </summary>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Game</TableHead>
                    <TableHead>Order Ref</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Net (GBP)</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidOrders.map(o => (
                    <TableRow key={o.id} className="opacity-60">
                      <TableCell>{eventLabel(o.event_id)}</TableCell>
                      <TableCell>{o.order_ref || "—"}</TableCell>
                      <TableCell>{o.platform_id ? platformMap[o.platform_id]?.name || "Unknown" : "—"}</TableCell>
                      <TableCell className="text-right">£{(o.net_received || o.sale_price - o.fees).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(o.order_date), "dd MMM yy")}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={o.payment_received} onCheckedChange={() => togglePaymentReceived(o.id, o.payment_received)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </details>
          )}
        </TabsContent>

        {/* === LEDGER TAB === */}
        <TabsContent value="ledger" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
            </div>
            <FilterSelect label="Type" value={filterType} onValueChange={setFilterType} options={[
              { value: "sale", label: "Sale" }, { value: "purchase", label: "Purchase" },
              { value: "fee", label: "Fee" }, { value: "refund", label: "Refund" },
              { value: "payout", label: "Payout" }, { value: "supplier_payment", label: "Supplier Payment" },
              { value: "adjustment", label: "Adjustment" },
            ]} />
            <FilterSelect label="Currency" value={filterCurrency} onValueChange={setFilterCurrency} options={[
              { value: "GBP", label: "GBP" }, { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" },
            ]} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Money In</p>
              <p className="text-xl font-bold text-success">£{totalIn.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Money Out</p>
              <p className="text-xl font-bold text-destructive">£{Math.abs(totalOut).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Net</p>
              <p className={`text-xl font-bold ${totalIn + totalOut >= 0 ? "text-success" : "text-destructive"}`}>
                £{(totalIn + totalOut).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Amount (GBP)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLedger.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground">{format(new Date(e.transaction_date), "dd MMM yy")}</TableCell>
                    <TableCell><Badge variant="outline" className={typeColor[e.transaction_type] || ""}>{e.transaction_type}</Badge></TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-right">{e.currency === "GBP" ? "£" : e.currency === "USD" ? "$" : "€"}{Number(e.amount).toFixed(2)}</TableCell>
                    <TableCell>{e.currency}</TableCell>
                    <TableCell className={`text-right font-medium ${e.amount_gbp >= 0 ? "text-success" : "text-destructive"}`}>£{Number(e.amount_gbp).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {filteredLedger.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No transactions found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
