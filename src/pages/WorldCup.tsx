import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search, Download, Zap, CheckCircle2, Trash2, Pencil, Smartphone, Copy, Check,
  Package, ShoppingCart, TrendingUp, Percent, Ticket, Plus, ChevronDown, ChevronRight,
  Users, User, Apple,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, subHours } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getEventKey, deduplicateEvents } from "@/lib/eventDedup";
import { formatEventTitle, getMatchBadge } from "@/lib/eventDisplay";
import FilterSelect from "@/components/FilterSelect";
import AddOrderDialog from "@/components/AddOrderDialog";
import OrderDetailSheet from "@/components/OrderDetailSheet";
import AssignPurchaseDialog from "@/components/AssignPurchaseDialog";
import EditOrderDialog from "@/components/EditOrderDialog";
import AddInventoryDialog from "@/components/AddInventoryDialog";
import InventoryDetailSheet from "@/components/InventoryDetailSheet";

// ── Shared types ──
interface EventInfo {
  id: string; match_code: string; home_team: string; away_team: string;
  event_date: string; competition: string; venue?: string | null;
}

interface Order {
  id: string; order_ref: string | null; buyer_ref: string | null;
  buyer_name: string | null; buyer_phone: string | null; buyer_email: string | null;
  category: string; quantity: number; sale_price: number; fees: number;
  net_received: number; status: string; delivery_type: string;
  delivery_status: string | null; device_type: string | null;
  contacted: boolean; notes: string | null; order_date: string;
  currency: string; event_id: string; platform_id: string | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string; venue: string | null } | null;
  platforms: { name: string } | null;
  payment_received?: boolean;
}

interface Purchase {
  id: string; supplier_order_id: string | null; quantity: number;
  unit_cost: number; total_cost: number | null; total_cost_gbp: number | null;
  currency: string; purchase_date: string; supplier_paid: boolean;
  notes: string | null; category: string; section: string | null;
  event_id: string; supplier_id: string;
}

interface InventoryItem {
  id: string; category: string; section: string | null; block: string | null;
  row_name: string | null; seat: string | null; face_value: number | null;
  ticket_name: string | null; supporter_id: string | null;
  first_name: string | null; last_name: string | null;
  email: string | null; password: string | null;
  iphone_pass_link: string | null; android_pass_link: string | null;
  pk_pass_url: string | null; source: string | null; status: string;
  created_at: string; event_id: string; purchase_id: string | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string; venue: string | null } | null;
}

interface SupplierInfo { id: string; name: string; }
interface PlatformInfo { id: string; name: string; }
interface AssignmentInfo { linked_count: number; supplier_contact_name: string | null; }
interface OrderLine { inventory_id: string; order_id: string; }

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

const deliveryColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  awaiting_delivery: "bg-primary/10 text-primary border-primary/20",
  sent: "bg-primary/10 text-primary border-primary/20",
  delivered: "bg-success/10 text-success border-success/20",
  completed: "bg-success/10 text-success border-success/20",
};

const statusColor: Record<string, string> = {
  available: "bg-success/10 text-success border-success/20",
  reserved: "bg-warning/10 text-warning border-warning/20",
  sold: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const phoneToFlag = (phone: string | null): string | null => {
  if (!phone) return null;
  const clean = phone.replace(/\s/g, "");
  const prefixMap: Record<string, string> = {
    "+44": "🇬🇧", "+1": "🇺🇸", "+353": "🇮🇪", "+33": "🇫🇷", "+49": "🇩🇪",
    "+34": "🇪🇸", "+39": "🇮🇹", "+31": "🇳🇱", "+32": "🇧🇪", "+351": "🇵🇹",
    "+41": "🇨🇭", "+46": "🇸🇪", "+47": "🇳🇴", "+45": "🇩🇰", "+48": "🇵🇱",
    "+43": "🇦🇹", "+30": "🇬🇷", "+90": "🇹🇷", "+55": "🇧🇷", "+52": "🇲🇽",
    "+54": "🇦🇷", "+57": "🇨🇴", "+61": "🇦🇺", "+64": "🇳🇿", "+91": "🇮🇳",
    "+86": "🇨🇳", "+81": "🇯🇵", "+82": "🇰🇷", "+966": "🇸🇦", "+971": "🇦🇪",
    "+234": "🇳🇬", "+27": "🇿🇦", "+20": "🇪🇬", "+212": "🇲🇦", "+7": "🇷🇺",
  };
  for (const prefix of Object.keys(prefixMap).sort((a, b) => b.length - a.length)) {
    if (clean.startsWith(prefix)) return prefixMap[prefix];
  }
  return null;
};

const CopyText = ({ text, className = "" }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied!"); setTimeout(() => setCopied(false), 1500); }}
      className={`group inline-flex items-center gap-1 hover:text-foreground transition-colors ${className}`} title="Click to copy">
      <span className="truncate">{text}</span>
      {copied ? <Check className="h-3 w-3 text-success shrink-0" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />}
    </button>
  );
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-0.5 rounded hover:bg-muted/60 transition-colors" title="Copy">
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

function groupByQuantity(items: InventoryItem[]) {
  const groups: Map<string, InventoryItem[]> = new Map();
  items.forEach(item => {
    const key = item.purchase_id ? `purchase_${item.purchase_id}` : `seat_${item.event_id}_${[item.section || item.category || "", item.block || "", item.row_name || ""].join("|")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return Array.from(groups.entries()).map(([key, items]) => ({
    key, items: items.sort((a, b) => (a.seat || "").localeCompare(b.seat || "", undefined, { numeric: true })), qty: items.length,
  }));
}

// ── Main Component ──
export default function WorldCup() {
  const [tab, setTab] = useState("orders");
  const [countryFilter, setCountryFilter] = useState("all");

  // Data
  const [wcEvents, setWcEvents] = useState<EventInfo[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [assignments, setAssignments] = useState<Record<string, AssignmentInfo>>({});

  // UI state
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const [showAddInv, setShowAddInv] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    // 1. Fetch WC events
    const { data: evData } = await supabase
      .from("events")
      .select("id,match_code,home_team,away_team,event_date,competition,venue")
      .ilike("competition", "%world cup%");
    const wcEvs = (evData || []) as EventInfo[];
    setWcEvents(wcEvs);
    const wcIds = wcEvs.map(e => e.id);
    if (wcIds.length === 0) {
      setOrders([]); setPurchases([]); setInventory([]); setOrderLines([]); setAssignments({});
      return;
    }

    // 2. Fetch scoped data in parallel
    const [ordRes, purchRes, invRes, olRes, supRes, platRes] = await Promise.all([
      supabase.from("orders").select("*, events(match_code,home_team,away_team,event_date,venue), platforms(name)").in("event_id", wcIds).order("order_date", { ascending: false }),
      supabase.from("purchases").select("id,supplier_order_id,quantity,unit_cost,total_cost,total_cost_gbp,currency,purchase_date,supplier_paid,notes,category,section,event_id,supplier_id").in("event_id", wcIds),
      supabase.from("inventory").select("*, events(match_code,home_team,away_team,event_date,venue)").in("event_id", wcIds).order("created_at", { ascending: false }),
      supabase.from("order_lines").select("inventory_id,order_id"),
      supabase.from("suppliers").select("id,name"),
      supabase.from("platforms").select("id,name"),
    ]);
    const loadedOrders = (ordRes.data as any) || [];
    setOrders(loadedOrders);
    setPurchases(purchRes.data || []);
    setInventory((invRes.data as any) || []);
    setSuppliers(supRes.data || []);
    setPlatforms(platRes.data || []);

    // Filter order_lines to only WC orders
    const wcOrderIds = new Set(loadedOrders.map((o: Order) => o.id));
    const filteredOL = (olRes.data || []).filter((ol: OrderLine) => wcOrderIds.has(ol.order_id));
    setOrderLines(filteredOL);

    // Build assignments
    if (filteredOL.length > 0) {
      const invIds = filteredOL.map((ol: OrderLine) => ol.inventory_id);
      const { data: invInfo } = await supabase.from("inventory").select("id,purchase_id").in("id", invIds);
      const purchaseIds = [...new Set((invInfo || []).map(i => i.purchase_id).filter(Boolean))];
      const { data: purchInfo } = purchaseIds.length > 0
        ? await supabase.from("purchases").select("id, suppliers(name,contact_name)").in("id", purchaseIds)
        : { data: [] };
      const purchaseMap = new Map((purchInfo || []).map((p: any) => [p.id, p]));
      const invMap = new Map((invInfo || []).map(i => [i.id, i]));
      const assignMap: Record<string, AssignmentInfo> = {};
      for (const ol of filteredOL) {
        if (!assignMap[ol.order_id]) assignMap[ol.order_id] = { linked_count: 0, supplier_contact_name: null };
        assignMap[ol.order_id].linked_count++;
        if (!assignMap[ol.order_id].supplier_contact_name) {
          const inv = invMap.get(ol.inventory_id);
          if (inv) {
            const purchase = purchaseMap.get(inv.purchase_id) as any;
            if (purchase?.suppliers?.contact_name) assignMap[ol.order_id].supplier_contact_name = purchase.suppliers.contact_name;
            else if (purchase?.suppliers?.name) assignMap[ol.order_id].supplier_contact_name = purchase.suppliers.name;
          }
        }
      }
      setAssignments(assignMap);
    } else {
      setAssignments({});
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Country filter bar
  const countries = useMemo(() => {
    const set = new Set<string>();
    wcEvents.forEach(e => { set.add(e.home_team); set.add(e.away_team); });
    // Remove generic placeholders
    const filtered = [...set].filter(t => !["TBC", "TBA", "Winner", "Runner"].some(x => t.includes(x)));
    return filtered.sort();
  }, [wcEvents]);

  // Filter events by country
  const filteredEventIds = useMemo(() => {
    if (countryFilter === "all") return new Set(wcEvents.map(e => e.id));
    return new Set(wcEvents.filter(e =>
      e.home_team.toLowerCase() === countryFilter || e.away_team.toLowerCase() === countryFilter
    ).map(e => e.id));
  }, [wcEvents, countryFilter]);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);
  const assignedInvSet = useMemo(() => new Set(orderLines.map(ol => ol.inventory_id)), [orderLines]);

  // ── ORDERS TAB ──
  const filteredOrders = useMemo(() => orders.filter(o => {
    if (!filteredEventIds.has(o.event_id)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (o.order_ref || "").toLowerCase().includes(q) || (o.buyer_name || "").toLowerCase().includes(q) ||
        (o.buyer_email || "").toLowerCase().includes(q) || (o.buyer_phone || "").toLowerCase().includes(q) ||
        (o.events?.home_team || "").toLowerCase().includes(q) || (o.events?.away_team || "").toLowerCase().includes(q) ||
        (o.platforms?.name || "").toLowerCase().includes(q);
    }
    return true;
  }), [orders, filteredEventIds, search]);

  const groupedOrders = useMemo(() => {
    const map = new Map<string, { event: Order["events"]; eventIds: string[]; orders: Order[] }>();
    filteredOrders.forEach(o => {
      const ev = o.events;
      if (!ev) return;
      const key = getEventKey(ev.home_team, ev.away_team, ev.event_date);
      if (!map.has(key)) map.set(key, { event: ev, eventIds: [o.event_id], orders: [] });
      else { const g = map.get(key)!; if (!g.eventIds.includes(o.event_id)) g.eventIds.push(o.event_id); }
      map.get(key)!.orders.push(o);
    });
    return [...map.values()].sort((a, b) => (a.event?.event_date || "").localeCompare(b.event?.event_date || ""));
  }, [filteredOrders]);

  const isFullyAssigned = (order: Order) => { const info = assignments[order.id]; return info && info.linked_count >= order.quantity; };

  const updateField = useCallback(async (orderId: string, field: string, value: any) => {
    await supabase.from("orders").update({ [field]: value }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
  }, []);

  const getDeadline = (eventDate: string | undefined) => eventDate ? subHours(new Date(eventDate), 48) : null;
  const getDeadlineStatus = (eventDate: string | undefined) => {
    const deadline = getDeadline(eventDate);
    if (!deadline) return { label: "—", color: "" };
    const diff = deadline.getTime() - Date.now();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (diff < 0) return { label: "OVERDUE", color: "text-destructive font-bold" };
    if (days === 0) return { label: `${hours}h left`, color: "text-destructive font-bold" };
    if (days <= 3) return { label: `${days}d ${hours}h`, color: "text-warning font-semibold" };
    return { label: `${days}d`, color: "text-muted-foreground" };
  };

  // ── FINANCE TAB ──
  const { unique: dedupedEvents, groupedIds } = useMemo(() => deduplicateEvents(wcEvents), [wcEvents]);

  const financeData = useMemo(() => {
    const evs = countryFilter === "all" ? dedupedEvents : dedupedEvents.filter(e =>
      e.home_team.toLowerCase() === countryFilter || e.away_team.toLowerCase() === countryFilter
    );
    const eventIdSet = new Set<string>();
    evs.forEach(e => (groupedIds[e.id] || [e.id]).forEach(id => eventIdSet.add(id)));
    const fp = purchases.filter(p => eventIdSet.has(p.event_id));
    const fo = orders.filter(o => eventIdSet.has(o.event_id) && o.status !== "cancelled" && o.status !== "refunded");
    return { events: evs, purchases: fp, orders: fo };
  }, [countryFilter, dedupedEvents, groupedIds, purchases, orders]);

  const totalRevenue = financeData.orders.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
  const totalCost = financeData.purchases.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
  const totalProfit = totalRevenue - totalCost;

  const eventBreakdown = useMemo(() => {
    return financeData.events.map(ev => {
      const allIds = groupedIds[ev.id] || [ev.id];
      const evP = financeData.purchases.filter(p => allIds.includes(p.event_id));
      const evO = financeData.orders.filter(o => allIds.includes(o.event_id));
      const cost = evP.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
      const revenue = evO.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
      return { ev, evPurchases: evP, evOrders: evO, cost, revenue, profit: revenue - cost,
        ticketsBought: evP.reduce((s, p) => s + p.quantity, 0), ticketsSold: evO.reduce((s, o) => s + o.quantity, 0) };
    }).filter(e => e.cost > 0 || e.revenue > 0).sort((a, b) => new Date(a.ev.event_date).getTime() - new Date(b.ev.event_date).getTime());
  }, [financeData, groupedIds]);

  const toggleSupplierPaid = async (id: string, val: boolean) => {
    await supabase.from("purchases").update({ supplier_paid: !val }).eq("id", id);
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, supplier_paid: !val } : p));
    toast.success(!val ? "Marked as paid" : "Marked as unpaid");
  };
  const togglePaymentReceived = async (id: string, val: boolean) => {
    await supabase.from("orders").update({ payment_received: !val }).eq("id", id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, payment_received: !val } : o));
    toast.success(!val ? "Marked as received" : "Marked as pending");
  };

  // ── INVENTORY TAB ──
  const filteredInv = useMemo(() => inventory.filter(i => {
    if (!filteredEventIds.has(i.event_id)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (i.category || "").toLowerCase().includes(q) || (i.section || "").toLowerCase().includes(q) ||
        (i.first_name || "").toLowerCase().includes(q) || (i.last_name || "").toLowerCase().includes(q) ||
        (i.email || "").toLowerCase().includes(q) || (i.events?.home_team || "").toLowerCase().includes(q) ||
        (i.events?.away_team || "").toLowerCase().includes(q);
    }
    return true;
  }), [inventory, filteredEventIds, search]);

  const groupedInv = useMemo(() => {
    const map: Record<string, { event: InventoryItem["events"]; eventId: string; items: InventoryItem[] }> = {};
    filteredInv.forEach(i => {
      if (!map[i.event_id]) map[i.event_id] = { event: i.events, eventId: i.event_id, items: [] };
      map[i.event_id].items.push(i);
    });
    return Object.values(map).sort((a, b) => (a.event?.event_date || "").localeCompare(b.event?.event_date || ""));
  }, [filteredInv]);

  const toggleItemExpanded = (id: string) => setExpandedItems(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Sticky header: tabs + country filter */}
      <div className="sticky top-0 z-10 bg-background border-b border-border shrink-0">
        <div className="px-6 pt-4 pb-2">
          <h1 className="text-2xl font-bold tracking-tight">World Cup 2026</h1>
          <p className="text-muted-foreground text-sm mb-3">Dedicated view for all World Cup fixtures</p>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="orders"><ShoppingCart className="h-3.5 w-3.5 mr-1.5" />Orders</TabsTrigger>
              <TabsTrigger value="finance"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Finance</TabsTrigger>
              <TabsTrigger value="inventory"><Ticket className="h-3.5 w-3.5 mr-1.5" />Inventory</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {/* Country filter bar */}
        <div className="px-6 py-2 flex items-center gap-4 overflow-x-auto border-t border-border">
          <button onClick={() => setCountryFilter("all")}
            className={cn("text-sm font-medium whitespace-nowrap transition-colors", countryFilter === "all" ? "text-emerald-500" : "text-muted-foreground hover:text-foreground")}>
            All
          </button>
          {countries.map(c => (
            <button key={c} onClick={() => setCountryFilter(c.toLowerCase() === countryFilter ? "all" : c.toLowerCase())}
              className={cn("text-sm font-medium whitespace-nowrap transition-colors", countryFilter === c.toLowerCase() ? "text-emerald-500" : "text-muted-foreground hover:text-foreground")}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "orders" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""} across {groupedOrders.length} game{groupedOrders.length !== 1 ? "s" : ""}</p>
              <AddOrderDialog onCreated={load} />
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>

            <div className="space-y-5">
              {groupedOrders.length === 0 && <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No World Cup orders found</div>}
              {groupedOrders.map(group => {
                const deadline = getDeadline(group.event?.event_date);
                const deadlineStatus = getDeadlineStatus(group.event?.event_date);
                const totalQty = group.orders.reduce((s, o) => s + o.quantity, 0);
                const assignedCount = group.orders.filter(o => isFullyAssigned(o)).length;
                return (
                  <div key={group.eventIds[0]} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/40">
                      <div>
                        <p className="font-bold text-base">{group.event ? formatEventTitle(group.event.home_team, group.event.away_team, group.event.match_code) : "Unknown"}{group.event?.venue && <span className="text-muted-foreground font-normal text-sm ml-2">— {group.event.venue}</span>}</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{group.event?.event_date ? format(new Date(group.event.event_date), "EEE dd MMM yyyy, HH:mm") : ""}</p>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deadline</p><p className={`text-sm font-mono ${deadlineStatus.color}`}>{deadline ? format(deadline, "dd MMM HH:mm") : "—"}</p></div>
                        <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Orders</p><p className="text-sm font-mono font-bold">{group.orders.length}</p></div>
                        <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tickets</p><p className="text-sm font-mono font-bold">{totalQty}</p></div>
                        {assignedCount > 0 && <Badge variant="outline" className="text-[10px] font-bold uppercase bg-success/10 text-success border-success/20">{assignedCount} assigned</Badge>}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] uppercase tracking-wider w-[90px]">Order #</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider">Platform</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider text-center w-[40px]">🏳️</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider">Customer</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider">Phone</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider">Email</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider w-[50px]">Cat</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider text-center w-[40px]">Qty</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider text-right w-[70px]">Sale</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider text-center w-[70px]">Delivered</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider w-[80px]">Status</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider w-[100px]">Assigned From</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider w-[60px]">Assign</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.orders.map(o => {
                            const flag = phoneToFlag(o.buyer_phone);
                            const assigned = isFullyAssigned(o);
                            const assignInfo = assignments[o.id];
                            return (
                              <TableRow key={o.id} className={`cursor-pointer text-xs h-10 transition-colors ${o.delivery_status === "delivered" || o.delivery_status === "completed" ? "bg-success/10 hover:bg-success/20 border-l-2 border-l-success" : assigned ? "bg-success/5 hover:bg-success/10 border-l-2 border-l-success/50" : "hover:bg-muted/40"}`}
                                onClick={() => setSelectedOrderId(o.id)}>
                                <TableCell className="font-mono font-bold text-xs py-2">{o.order_ref ? <CopyText text={o.order_ref} className="font-mono font-bold text-foreground text-xs" /> : "—"}</TableCell>
                                <TableCell className="py-2">
                                  {(() => {
                                    const assignInfo = assignments[o.id];
                                    const contactName = assignInfo?.supplier_contact_name;
                                    const platformName = o.platforms?.name || "NA";
                                    if (contactName) {
                                      return (
                                        <div>
                                          <span className="font-medium text-foreground text-xs">{contactName}</span>
                                          <span className="block text-[10px] text-muted-foreground">{platformName}</span>
                                        </div>
                                      );
                                    }
                                    return <span className="text-muted-foreground">{platformName}</span>;
                                  })()}
                                </TableCell>
                                <TableCell className="text-center text-base py-2">{flag || "NA"}</TableCell>
                                <TableCell className="py-2"><span className="font-medium">{o.buyer_name || "NA"}</span></TableCell>
                                <TableCell className="py-2">{o.buyer_phone ? <CopyText text={o.buyer_phone} className="text-muted-foreground text-xs" /> : <span className="text-muted-foreground/40 text-xs">NA</span>}</TableCell>
                                <TableCell className="py-2">{o.buyer_email ? <CopyText text={o.buyer_email} className="text-muted-foreground text-xs max-w-[140px]" /> : <span className="text-muted-foreground/40 text-xs">NA</span>}</TableCell>
                                <TableCell className="py-2 text-muted-foreground">{o.category || "NA"}</TableCell>
                                <TableCell className="text-center font-mono font-bold py-2">{o.quantity}</TableCell>
                                <TableCell className="text-right font-mono py-2">£{Number(o.sale_price).toFixed(0)}</TableCell>
                                <TableCell className="text-center py-2">
                                  <Checkbox checked={o.delivery_status === "delivered" || o.delivery_status === "completed"}
                                    onCheckedChange={checked => updateField(o.id, "delivery_status", checked ? "delivered" : "pending")}
                                    onClick={e => e.stopPropagation()} className="h-5 w-5 data-[state=checked]:bg-success data-[state=checked]:border-success" />
                                </TableCell>
                                <TableCell className="py-2">
                                  {o.delivery_status === "delivered" || o.delivery_status === "completed"
                                    ? <Badge variant="outline" className="text-[10px] py-0 bg-success/10 text-success border-success/20 font-bold">DELIVERED</Badge>
                                    : <Badge variant="outline" className="text-[10px] py-0 bg-warning/10 text-warning border-warning/20 font-bold">OUTSTANDING</Badge>}
                                </TableCell>
                                <TableCell className="py-2">
                                  {assigned ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="h-3 w-3" />{assignInfo?.supplier_contact_name || "Assigned"}</span>
                                    : assignInfo?.linked_count ? <span className="text-xs text-warning font-medium">{assignInfo.linked_count}/{o.quantity} · {assignInfo.supplier_contact_name || "—"}</span>
                                    : <span className="text-muted-foreground/40 text-xs">NA</span>}
                                </TableCell>
                                <TableCell className="py-2">
                                  <Button size="sm" variant={assigned ? "ghost" : "outline"} className={`h-7 w-7 p-0 ${assigned ? "text-success" : ""}`}
                                    onClick={e => { e.stopPropagation(); setAssignOrder(o); }}>
                                    {assigned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                                  </Button>
                                </TableCell>
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-0.5">
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); setEditOrder(o); }}><Pencil className="h-3.5 w-3.5" /></Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={async e => {
                                        e.stopPropagation();
                                      if (!confirm("Delete this order?")) return;
                                        const { data: lines } = await supabase.from("order_lines").select("inventory_id").eq("order_id", o.id);
                                        if (lines?.length) await supabase.from("inventory").update({ status: "available" as any }).in("id", lines.map(l => l.inventory_id));
                                        await supabase.from("order_lines").delete().eq("order_id", o.id);
                                        await supabase.from("refunds").delete().eq("order_id", o.id);
                                        if ((o as any).contact_id) {
                                          await supabase.from("balance_payments").delete().ilike("notes", `Auto: Order ${o.id}`);
                                        }
                                        await supabase.from("orders").delete().eq("id", o.id);
                                        toast.success("Order deleted"); load();
                                      }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "finance" && (
          <div className="p-6 space-y-6">
            <p className="text-muted-foreground text-sm">Financial overview{countryFilter !== "all" ? ` — ${countryFilter.replace(/\b\w/g, c => c.toUpperCase())}` : " across all World Cup fixtures"}</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border bg-card p-5 text-center"><TrendingUp className="h-5 w-5 mx-auto mb-2 text-success" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p><p className="text-xl font-bold text-success">{fmt(totalRevenue)}</p></div>
              <div className="rounded-xl border bg-card p-5 text-center"><Package className="h-5 w-5 mx-auto mb-2 text-destructive" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Costs</p><p className="text-xl font-bold text-destructive">{fmt(totalCost)}</p></div>
              <div className="rounded-xl border bg-card p-5 text-center"><Percent className="h-5 w-5 mx-auto mb-2 text-primary" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Net Profit</p><p className={cn("text-xl font-bold", totalProfit >= 0 ? "text-success" : "text-destructive")}>{totalProfit >= 0 ? "" : "-"}{fmt(Math.abs(totalProfit))}</p></div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Per-Event Breakdown</h2>
              {eventBreakdown.length === 0 ? (
                <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground text-sm">No financial data yet</div>
              ) : eventBreakdown.map(({ ev, evPurchases, evOrders, cost, revenue, profit, ticketsBought, ticketsSold }) => (
                <div key={ev.id} className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-border">
                    <div><p className="font-bold">{formatEventTitle(ev.home_team, ev.away_team, ev.match_code)}</p><p className="text-xs text-muted-foreground">{format(new Date(ev.event_date), "EEE dd MMM yyyy, HH:mm")}{ev.venue && ` · ${ev.venue}`}</p></div>
                    <div className="flex items-center gap-4 text-right">
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</p><p className="text-sm font-bold text-success">{fmt(revenue)}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Costs</p><p className="text-sm font-bold text-destructive">{fmt(cost)}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p><p className={cn("text-sm font-bold", profit >= 0 ? "text-success" : "text-destructive")}>{profit >= 0 ? "" : "-"}{fmt(Math.abs(profit))}</p></div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                    <div className="p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Purchases ({ticketsBought} tickets)</h4>
                      {evPurchases.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                        <div className="space-y-1.5">
                          {evPurchases.map(p => (
                            <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2"><span>{p.quantity}x {p.category}</span><span className="text-muted-foreground">({supplierMap[p.supplier_id]?.name || "Unknown"})</span></div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium">{fmt(p.total_cost_gbp || (p.quantity * p.unit_cost))}</span>
                                <span className={cn("text-[10px]", p.supplier_paid ? "text-success" : "text-destructive")}>{p.supplier_paid ? "Paid" : "Unpaid"}</span>
                                <Switch checked={p.supplier_paid} onCheckedChange={() => toggleSupplierPaid(p.id, p.supplier_paid)} className="scale-75" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Sales ({ticketsSold} tickets)</h4>
                      {evOrders.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                        <div className="space-y-1.5">
                          {evOrders.map(o => (
                            <div key={o.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2"><span>{o.quantity}x {o.category}</span><span className="text-muted-foreground">({o.platform_id ? (platformMap[o.platform_id]?.name || "Unknown") : "Direct"})</span></div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium">{fmt(o.net_received || o.sale_price - o.fees)}</span>
                                <span className={cn("text-[10px]", (o as any).payment_received ? "text-success" : "text-warning")}>{(o as any).payment_received ? "Received" : "Pending"}</span>
                                <Switch checked={(o as any).payment_received || false} onCheckedChange={() => togglePaymentReceived(o.id, (o as any).payment_received || false)} className="scale-75" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "inventory" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{filteredInv.length} ticket{filteredInv.length !== 1 ? "s" : ""} across {groupedInv.length} event{groupedInv.length !== 1 ? "s" : ""}</p>
              <Button onClick={() => setShowAddInv(true)}><Plus className="h-4 w-4 mr-1" /> Add Inventory</Button>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>

            <div className="space-y-3">
              {groupedInv.length === 0 && <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No World Cup inventory found</div>}
              {groupedInv.map(group => {
                const total = group.items.length;
                const available = group.items.filter(i => i.status === "available").length;
                const sold = group.items.filter(i => i.status === "sold").length;
                const assigned = group.items.filter(i => assignedInvSet.has(i.id)).length;
                const isExpanded = expandedEvent === group.eventId;
                const eventDate = group.event?.event_date ? new Date(group.event.event_date) : null;

                const availableItems = group.items.filter(i => i.status === "available");
                const qtyGroups = groupByQuantity(availableItems);
                const singles = qtyGroups.filter(g => g.qty === 1).length;
                const pairs = qtyGroups.filter(g => g.qty === 2).length;

                return (
                  <div key={group.eventId} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                    <button onClick={() => setExpandedEvent(isExpanded ? null : group.eventId)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/40">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-primary/10 text-primary"><Ticket className="h-5 w-5" /></div>
                        <div>
                          <p className="font-bold text-base">{group.event ? `${group.event.home_team} vs ${group.event.away_team}` : "Unknown"}</p>
                          {eventDate && <span className="text-xs font-semibold text-foreground">{format(eventDate, "EEE dd MMM yyyy, HH:mm")}</span>}
                          {group.event?.venue && <span className="text-xs text-muted-foreground ml-2">• {group.event.venue}</span>}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {singles > 0 && <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground"><User className="h-2.5 w-2.5 mr-0.5" />{singles} single{singles !== 1 ? "s" : ""}</Badge>}
                            {pairs > 0 && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20"><Users className="h-2.5 w-2.5 mr-0.5" />{pairs} pair{pairs !== 1 ? "s" : ""}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="text-center px-3 py-1 rounded-md bg-muted/60"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p><p className="text-sm font-bold font-mono">{total}</p></div>
                          {available > 0 && <Badge variant="outline" className="text-[10px] font-bold uppercase bg-success/10 text-success border-success/20">{available} avail</Badge>}
                          {sold > 0 && <Badge variant="outline" className="text-[10px] font-bold uppercase bg-primary/10 text-primary border-primary/20">{sold} sold</Badge>}
                        </div>
                        {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </button>

                    {isExpanded && (() => {
                      const sectionMap: Record<string, InventoryItem[]> = {};
                      group.items.forEach(item => { const sec = item.section || item.category || "Unknown"; if (!sectionMap[sec]) sectionMap[sec] = []; sectionMap[sec].push(item); });
                      return (
                        <div className="border-t">
                          {Object.entries(sectionMap).map(([sectionName, sectionItems]) => {
                            const allGroups = groupByQuantity(sectionItems);
                            return (
                              <div key={sectionName} className="px-5 py-4 space-y-3">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-sm font-black uppercase tracking-wide">{sectionName}</h3>
                                  <Badge className="bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider">{sectionItems.length} Ticket{sectionItems.length !== 1 ? "s" : ""}</Badge>
                                </div>
                                <div className="space-y-3">
                                  {allGroups.map(qg => (
                                    <div key={qg.key} className="rounded-xl border bg-card overflow-hidden">
                                      <div className="px-5 py-3 flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                          {qg.items[0]?.email && <p className="text-sm font-medium text-primary">{qg.items[0].email}</p>}
                                          <p className="text-xs text-muted-foreground font-mono">
                                            {qg.items[0]?.block && <>Area <span className="text-foreground font-semibold">{qg.items[0].block}</span></>}
                                            {qg.items[0]?.row_name && <>{qg.items[0]?.block ? " · " : ""}Row <span className="text-foreground font-semibold">{qg.items[0].row_name}</span></>}
                                          </p>
                                        </div>
                                        <div className="text-right"><p className="text-xl font-bold text-destructive">{qg.qty}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ticket{qg.qty !== 1 ? "s" : ""}</p></div>
                                      </div>
                                      <div className="px-5 pb-4 flex flex-wrap gap-2">
                                        {qg.items.map((item, idx) => (
                                          <button key={item.id} onClick={() => toggleItemExpanded(item.id)}
                                            className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted/60 transition-colors text-left", expandedItems.has(item.id) ? "bg-muted/60 border-primary/30" : "bg-muted/30")}>
                                            <span className="flex items-center justify-center h-7 w-7 rounded bg-destructive/10 text-destructive text-xs font-bold font-mono">{item.seat || (idx + 1)}</span>
                                            <div className="text-xs">
                                              <p className="font-medium">{[item.first_name, item.last_name].filter(Boolean).join(" ") || "—"}</p>
                                              <p className="text-muted-foreground">Ticket {idx + 1}/{qg.qty}</p>
                                            </div>
                                            <Badge variant="outline" className={cn("text-[9px]", statusColor[item.status] || "")}>{item.status}</Badge>
                                          </button>
                                        ))}
                                      </div>
                                      {qg.items.filter(item => expandedItems.has(item.id)).map(item => (
                                        <div key={`detail-${item.id}`} className="border-t px-5 py-3 space-y-3 bg-muted/10">
                                          <p className="text-xs font-semibold text-muted-foreground">Seat {item.seat || "—"} · {[item.first_name, item.last_name].filter(Boolean).join(" ") || "Unknown"}</p>
                                          {(item.email || item.password || item.supporter_id) && (
                                            <div className="rounded-lg bg-muted/30 p-3">
                                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Login Details</p>
                                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                                {item.supporter_id && <div className="flex items-center gap-1"><div><span className="text-muted-foreground block">Supporter ID</span><span className="font-mono font-medium">{item.supporter_id}</span></div><CopyButton text={item.supporter_id} /></div>}
                                                {item.email && <div className="flex items-center gap-1"><div><span className="text-muted-foreground block">Email</span><span className="font-medium">{item.email}</span></div><CopyButton text={item.email} /></div>}
                                                {item.password && <div className="flex items-center gap-1"><div><span className="text-muted-foreground block">Password</span><span className="font-mono font-medium">{item.password}</span></div><CopyButton text={item.password} /></div>}
                                              </div>
                                            </div>
                                          )}
                                          {(item.iphone_pass_link || item.android_pass_link || item.pk_pass_url) && (
                                            <div className="rounded-lg bg-muted/30 p-3">
                                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Digital Passes</p>
                                              <div className="space-y-2">
                                                {item.iphone_pass_link && <div className="flex items-center gap-2 text-xs"><Apple className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><a href={item.iphone_pass_link} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1" onClick={e => e.stopPropagation()}>{item.iphone_pass_link}</a><CopyButton text={item.iphone_pass_link} /></div>}
                                                {item.android_pass_link && <div className="flex items-center gap-2 text-xs"><Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><a href={item.android_pass_link} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1" onClick={e => e.stopPropagation()}>{item.android_pass_link}</a><CopyButton text={item.android_pass_link} /></div>}
                                                {item.pk_pass_url && <div className="flex items-center gap-2 text-xs"><Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><a href={item.pk_pass_url} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1" onClick={e => e.stopPropagation()}>Download</a><CopyButton text={item.pk_pass_url} /></div>}
                                              </div>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2 pt-1">
                                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedInvId(item.id)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <OrderDetailSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} onUpdated={load} />
      {assignOrder && <AssignPurchaseDialog orderId={assignOrder.id} eventId={assignOrder.event_id} orderCategory={assignOrder.category} orderQuantity={assignOrder.quantity} onClose={() => setAssignOrder(null)} onAssigned={() => { setAssignOrder(null); load(); }} />}
      {editOrder && <EditOrderDialog order={editOrder} onClose={() => setEditOrder(null)} onUpdated={() => { setEditOrder(null); load(); }} />}
      {showAddInv && <AddInventoryDialog onClose={() => setShowAddInv(false)} onCreated={() => { setShowAddInv(false); load(); }} />}
      <InventoryDetailSheet inventoryId={selectedInvId} onClose={() => setSelectedInvId(null)} onUpdated={load} />
    </div>
  );
}
