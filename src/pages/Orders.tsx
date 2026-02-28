import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Smartphone, Copy, Check, Download, Zap, CheckCircle2, CalendarIcon, Trash2, Pencil, ChevronDown } from "lucide-react";
import { getEventKey } from "@/lib/eventDedup";
import { Checkbox } from "@/components/ui/checkbox";
import { format, subHours, addDays, addWeeks, addMonths } from "date-fns";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CLUBS } from "@/lib/seatingSections";
import FilterSelect from "@/components/FilterSelect";
import AddOrderDialog from "@/components/AddOrderDialog";
import OrderDetailSheet from "@/components/OrderDetailSheet";
import AssignPurchaseDialog from "@/components/AssignPurchaseDialog";
import EditOrderDialog from "@/components/EditOrderDialog";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Bold colour palette for full event card backgrounds ───
const EVENT_PALETTE = [
  "bg-emerald-800",
  "bg-violet-800",
  "bg-blue-800",
  "bg-amber-900",
  "bg-rose-800",
  "bg-cyan-800",
  "bg-indigo-800",
  "bg-orange-900",
  "bg-fuchsia-800",
  "bg-teal-800",
];

// ─── Consistent colour per source/contact name ───
const SOURCE_COLORS = [
  "border-l-emerald-400 bg-emerald-500/10",
  "border-l-violet-400 bg-violet-500/10",
  "border-l-blue-400 bg-blue-500/10",
  "border-l-amber-400 bg-amber-500/10",
  "border-l-rose-400 bg-rose-500/10",
  "border-l-cyan-400 bg-cyan-500/10",
  "border-l-indigo-400 bg-indigo-500/10",
  "border-l-orange-400 bg-orange-500/10",
  "border-l-fuchsia-400 bg-fuchsia-500/10",
  "border-l-teal-400 bg-teal-500/10",
  "border-l-pink-400 bg-pink-500/10",
  "border-l-lime-400 bg-lime-500/10",
];
const SOURCE_TEXT_COLORS = [
  "text-emerald-300", "text-violet-300", "text-blue-300", "text-amber-300",
  "text-rose-300", "text-cyan-300", "text-indigo-300", "text-orange-300",
  "text-fuchsia-300", "text-teal-300", "text-pink-300", "text-lime-300",
];
const sourceColorCache = new Map<string, number>();
let sourceColorNext = 0;
function getSourceColorIndex(name: string): number {
  if (!name) return 0;
  const key = name.toLowerCase();
  if (sourceColorCache.has(key)) return sourceColorCache.get(key)!;
  const idx = sourceColorNext % SOURCE_COLORS.length;
  sourceColorCache.set(key, idx);
  sourceColorNext++;
  return idx;
}

// ─── Competition badge config ───
const COMP_BADGES: Record<string, { label: string; color: string }> = {
  "Premier League": { label: "PL", color: "bg-purple-600 text-white" },
  "Champions League": { label: "UCL", color: "bg-blue-600 text-white" },
  "FA Cup": { label: "FAC", color: "bg-red-600 text-white" },
  "EFL Cup": { label: "EFL", color: "bg-emerald-600 text-white" },
  "Europa League": { label: "UEL", color: "bg-orange-600 text-white" },
  "World Cup 2026": { label: "WC", color: "bg-amber-500 text-black" },
  "Conference League": { label: "UECL", color: "bg-lime-600 text-white" },
  "Community Shield": { label: "CS", color: "bg-sky-600 text-white" },
};

// ─── Team logo fallback badge ───
function TeamLogo({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const gradients = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-amber-600",
    "from-rose-500 to-pink-600",
    "from-indigo-500 to-blue-600",
  ];
  const gradient = gradients[Math.abs(hash) % gradients.length];
  return (
    <div
      className={cn("rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shrink-0", gradient)}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

const CopyText = ({ text, className = "" }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className={`group inline-flex items-center gap-1 hover:text-foreground transition-colors ${className}`} title="Click to copy">
      <span className="truncate">{text}</span>
      {copied ? <Check className="h-3 w-3 text-success shrink-0" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />}
    </button>
  );
};

interface Order {
  id: string;
  order_ref: string | null;
  buyer_ref: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  category: string;
  quantity: number;
  sale_price: number;
  fees: number;
  net_received: number;
  status: string;
  delivery_type: string;
  delivery_status: string | null;
  device_type: string | null;
  contacted: boolean;
  notes: string | null;
  order_date: string;
  currency: string;
  event_id: string;
  platform_id: string | null;
  contact_id?: string | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string; venue: string | null; competition?: string } | null;
  platforms: { name: string } | null;
  contacts?: { name: string } | null;
}

interface AssignmentInfo {
  linked_count: number;
  supplier_contact_name: string | null;
}

const deliveryColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  awaiting_delivery: "bg-primary/10 text-primary border-primary/20",
  sent: "bg-primary/10 text-primary border-primary/20",
  delivered: "bg-success/10 text-success border-success/20",
  completed: "bg-success/10 text-success border-success/20",
};

// ─── Order status color map & cycling ───
const ORDER_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  outstanding: { label: "Outstanding", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  delivered: { label: "Delivered", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  partially_delivered: { label: "Partial", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  cancelled: { label: "Cancelled", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};
const ORDER_STATUS_CYCLE = ["outstanding", "partially_delivered", "delivered", "cancelled"];
function nextOrderStatus(current: string): string {
  const idx = ORDER_STATUS_CYCLE.indexOf(current);
  return ORDER_STATUS_CYCLE[(idx + 1) % ORDER_STATUS_CYCLE.length];
}

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
    "+380": "🇺🇦", "+36": "🇭🇺", "+420": "🇨🇿", "+385": "🇭🇷", "+381": "🇷🇸",
  };
  for (const prefix of Object.keys(prefixMap).sort((a, b) => b.length - a.length)) {
    if (clean.startsWith(prefix)) return prefixMap[prefix];
  }
  return null;
};

function exportToCSV(orders: Order[]) {
  const headers = [
    "Order Ref", "Platform", "Event", "Home Team", "Away Team", "Event Date",
    "Customer Name", "Phone", "Email", "Nationality", "Category", "Qty",
    "Price/Ticket", "Total", "Fees", "Net Received", "Currency", "Device", "Contacted",
    "Delivery Type", "Delivery Status", "Order Date",
  ];
  const rows = orders.map(o => [
    o.order_ref || "",
    o.platforms?.name || "",
    o.events?.match_code || "",
    o.events?.home_team || "",
    o.events?.away_team || "",
    o.events?.event_date ? format(new Date(o.events.event_date), "yyyy-MM-dd HH:mm") : "",
    o.buyer_name || "",
    o.buyer_phone || "",
    o.buyer_email || "",
    phoneToFlag(o.buyer_phone) || "",
    o.category,
    o.quantity,
    o.sale_price,
    (Number(o.sale_price) * o.quantity).toFixed(2),
    o.fees,
    o.net_received || "",
    o.currency,
    o.device_type || "",
    o.contacted ? "Yes" : "No",
    o.delivery_type,
    o.delivery_status || "pending",
    format(new Date(o.order_date), "yyyy-MM-dd"),
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `orders-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${orders.length} orders`);
}

// ─── Helper: get source display for an order ───
function getSourceDisplay(o: Order, assignments: Record<string, AssignmentInfo>) {
  const assignInfo = assignments[o.id];
  const contactName = assignInfo?.supplier_contact_name;
  // Contact-sourced order (sold via a contact, not a platform)
  if (o.contact_id) {
    const contactLabel = (o as any).contacts?.name || o.buyer_name || "Contact";
    const buyerLabel = o.buyer_name && o.buyer_name !== contactLabel ? o.buyer_name : null;
    return { primary: contactLabel, secondary: buyerLabel ? `→ ${buyerLabel}` : "Contact" };
  }
  // Platform-sourced order — always show platform as primary, even if a purchase supplier is assigned
  if (o.platform_id && o.platforms?.name) {
    return { primary: o.platforms.name, secondary: contactName ? `→ ${o.buyer_name || ""}` : o.buyer_name || null };
  }
  if (contactName) {
    return { primary: contactName, secondary: o.buyer_name ? `→ ${o.buyer_name}` : "" };
  }
  return { primary: "Direct", secondary: o.buyer_name || null };
}

export default function Orders() {
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterDelivery, setFilterDelivery] = useState("all");
  const [clubFilter, setClubFilter] = useState("all");
  const [filterTimeRange, setFilterTimeRange] = useState("upcoming");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [assignments, setAssignments] = useState<Record<string, AssignmentInfo>>({});
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [orderCosts, setOrderCosts] = useState<Record<string, number>>({});
  const [eventInventoryCounts, setEventInventoryCounts] = useState<Record<string, number>>({});

  const toggleEvent = (key: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const load = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*, events(match_code, home_team, away_team, event_date, venue, competition), platforms(name), contacts:suppliers!orders_contact_id_fkey(name)")
      .order("order_date", { ascending: false });
    const loadedOrders = (ordersData as any) || [];
    setOrders(loadedOrders);

    // Load assignment info for all orders
    if (loadedOrders.length > 0) {
      const orderIds = loadedOrders.map((o: Order) => o.id);
      const { data: orderLines } = await supabase
        .from("order_lines")
        .select("order_id, inventory_id")
        .in("order_id", orderIds);

      if (orderLines && orderLines.length > 0) {
        const invIds = orderLines.map(ol => ol.inventory_id);
        const { data: invData } = await supabase
          .from("inventory")
          .select("id, purchase_id")
          .in("id", invIds);

        const purchaseIds = [...new Set((invData || []).map(i => i.purchase_id).filter(Boolean))];
        const { data: purchaseData } = purchaseIds.length > 0
          ? await supabase
              .from("purchases")
              .select("id, unit_cost, suppliers(name, contact_name)")
              .in("id", purchaseIds)
          : { data: [] };

        const purchaseMap = new Map((purchaseData || []).map((p: any) => [p.id, p]));
        const invMap = new Map((invData || []).map(i => [i.id, i]));

        const assignMap: Record<string, AssignmentInfo> = {};
        const costMap: Record<string, number> = {};
        for (const ol of orderLines) {
          if (!assignMap[ol.order_id]) {
            assignMap[ol.order_id] = { linked_count: 0, supplier_contact_name: null };
          }
          assignMap[ol.order_id].linked_count++;
          if (!costMap[ol.order_id]) costMap[ol.order_id] = 0;
          const inv = invMap.get(ol.inventory_id);
          if (inv) {
            const purchase = purchaseMap.get(inv.purchase_id) as any;
            costMap[ol.order_id] += Number(purchase?.unit_cost || 0);
            if (!assignMap[ol.order_id].supplier_contact_name) {
              if (purchase?.suppliers?.contact_name) {
                assignMap[ol.order_id].supplier_contact_name = purchase.suppliers.contact_name;
              } else if (purchase?.suppliers?.name) {
                assignMap[ol.order_id].supplier_contact_name = purchase.suppliers.name;
              }
            }
          }
        }
        setAssignments(assignMap);
        setOrderCosts(costMap);
      } else {
        setAssignments({});
        setOrderCosts({});
      }
    }

    // Load inventory counts per event for sold/total display
    const eventIds = [...new Set(loadedOrders.map((o: Order) => o.event_id))] as string[];
    if (eventIds.length > 0) {
      const { data: invCounts } = await supabase
        .from("inventory")
        .select("event_id")
        .in("event_id", eventIds);
      const counts: Record<string, number> = {};
      (invCounts || []).forEach((i: any) => {
        counts[i.event_id] = (counts[i.event_id] || 0) + 1;
      });
      setEventInventoryCounts(counts);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateField = useCallback(async (orderId: string, field: string, value: any) => {
    await supabase.from("orders").update({ [field]: value }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
  }, []);

  const platformOptions = [...new Set(orders.map((o) => o.platforms?.name).filter(Boolean))].map((n) => ({ value: n!, label: n! }));
  const eventOptions = useMemo(() => {
    const seen = new Map<string, string>();
    orders.forEach(o => {
      if (o.events) {
        const key = getEventKey(o.events.home_team, o.events.away_team, o.events.event_date);
        if (!seen.has(key)) seen.set(key, `${o.events.home_team} vs ${o.events.away_team}`);
      }
    });
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [orders]);

  const filtered = orders.filter((o) => {
    const now = new Date();
    const eventDate = o.events?.event_date ? new Date(o.events.event_date) : null;
    
    if (filterTimeRange === "upcoming") {
      if (eventDate && eventDate < now) return false;
    } else if (filterTimeRange === "7days") {
      const limit = addDays(now, 7);
      if (!eventDate || eventDate < now || eventDate > limit) return false;
    } else if (filterTimeRange === "14days") {
      const limit = addWeeks(now, 2);
      if (!eventDate || eventDate < now || eventDate > limit) return false;
    } else if (filterTimeRange === "30days") {
      const limit = addMonths(now, 1);
      if (!eventDate || eventDate < now || eventDate > limit) return false;
    } else if (filterTimeRange === "custom") {
      if (customDateFrom && eventDate && eventDate < customDateFrom) return false;
      if (customDateTo && eventDate && eventDate > addDays(customDateTo, 1)) return false;
    }

    if (clubFilter !== "all") {
      const home = (o.events?.home_team || "").toLowerCase();
      const away = (o.events?.away_team || "").toLowerCase();
      const matchCode = (o.events?.match_code || "").toLowerCase();
      if (clubFilter === "world-cup") {
        const isWC = matchCode.includes("stadium") || home.includes("tbc") || away.includes("tbc");
        if (!isWC) return false;
      } else {
        const club = CLUBS.find(c => c.value === clubFilter);
        const clubLabel = club ? club.label.toLowerCase().split(" (")[0] : clubFilter.replace(/-/g, " ");
        if (!home.includes(clubLabel) && !away.includes(clubLabel)) return false;
      }
    }

    if (filterPlatform !== "all" && o.platforms?.name !== filterPlatform) return false;
    if (filterEvent !== "all") {
      const ev = o.events;
      if (!ev) return false;
      if (getEventKey(ev.home_team, ev.away_team, ev.event_date) !== filterEvent) return false;
    }
    if (filterDelivery !== "all" && (o.delivery_status || "pending") !== filterDelivery) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (o.order_ref || "").toLowerCase().includes(q) ||
        (o.buyer_name || "").toLowerCase().includes(q) ||
        (o.buyer_email || "").toLowerCase().includes(q) ||
        (o.buyer_phone || "").toLowerCase().includes(q) ||
        (o.events?.home_team || "").toLowerCase().includes(q) ||
        (o.events?.away_team || "").toLowerCase().includes(q) ||
        (o.platforms?.name || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by event
  const grouped = useMemo(() => {
    const map = new Map<string, { event: Order["events"]; eventIds: string[]; orders: Order[] }>();
    filtered.forEach(o => {
      const ev = o.events;
      if (!ev) {
        const fallback = o.event_id;
        if (!map.has(fallback)) map.set(fallback, { event: null, eventIds: [fallback], orders: [] });
        map.get(fallback)!.orders.push(o);
        return;
      }
      const key = getEventKey(ev.home_team, ev.away_team, ev.event_date);
      if (!map.has(key)) {
        map.set(key, { event: ev, eventIds: [o.event_id], orders: [] });
      } else {
        const group = map.get(key)!;
        if (!group.eventIds.includes(o.event_id)) group.eventIds.push(o.event_id);
        if (ev.venue && !group.event?.venue) group.event = ev;
      }
      map.get(key)!.orders.push(o);
    });
    return [...map.values()].sort((a, b) => {
      const da = a.event?.event_date || "";
      const db = b.event?.event_date || "";
      return da.localeCompare(db);
    });
  }, [filtered]);

  const isFullyAssigned = (order: Order) => {
    const info = assignments[order.id];
    return info && info.linked_count >= order.quantity;
  };

  const activeClubs = useMemo(() => {
    return CLUBS.filter(club => {
      const clubLabel = club.label.toLowerCase().split(" (")[0];
      return orders.some(o => {
        if (club.value === "world-cup") {
          return (o.events?.match_code || "").toLowerCase().includes("stadium") ||
            (o.events?.home_team || "").toLowerCase().includes("tbc");
        }
        const home = (o.events?.home_team || "").toLowerCase();
        const away = (o.events?.away_team || "").toLowerCase();
        return home.includes(clubLabel) || away.includes(clubLabel);
      });
    });
  }, [orders]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Sticky club filter bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4 overflow-x-auto scrollbar-hide shrink-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setClubFilter("all")}
          className={cn(
            "text-sm font-medium whitespace-nowrap transition-colors",
            clubFilter === "all" ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {activeClubs.map(club => (
          <button
            key={club.value}
            onClick={() => setClubFilter(club.value === clubFilter ? "all" : club.value)}
            className={cn(
              "text-sm font-medium whitespace-nowrap transition-colors",
              clubFilter === club.value ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {club.label.split(" (")[0]}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 space-y-4 md:space-y-6 flex-1 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Orders</h1>
            <p className="text-muted-foreground text-sm">
              {filtered.length} order{filtered.length !== 1 ? "s" : ""} across {grouped.length} game{grouped.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => exportToCSV(filtered)} disabled={filtered.length === 0} className="flex-1 md:flex-none">
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <AddOrderDialog onCreated={load} />
          </div>
        </div>

      <div className="flex flex-col md:flex-row flex-wrap items-stretch md:items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, email, phone, order..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
        <FilterSelect label="Platform" value={filterPlatform} onValueChange={setFilterPlatform} options={platformOptions} />
        <FilterSelect label="Game" value={filterEvent} onValueChange={setFilterEvent} options={eventOptions} />
        <FilterSelect label="Delivery" value={filterDelivery} onValueChange={setFilterDelivery} options={[
          { value: "pending", label: "Pending" },
          { value: "awaiting_delivery", label: "Awaiting" },
          { value: "sent", label: "Sent" },
          { value: "delivered", label: "Delivered" },
          { value: "completed", label: "Completed" },
        ]} />
        <FilterSelect label="Time Range" value={filterTimeRange} onValueChange={setFilterTimeRange} options={[
          { value: "upcoming", label: "Upcoming only" },
          { value: "7days", label: "Next 7 days" },
          { value: "14days", label: "Next 14 days" },
          { value: "30days", label: "Next 30 days" },
          { value: "all", label: "All (incl. past)" },
          { value: "custom", label: "Custom range" },
        ]} />
        {filterTimeRange === "custom" && (
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-9 w-[130px] justify-start text-left text-xs font-normal", !customDateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {customDateFrom ? format(customDateFrom, "dd MMM yy") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-9 w-[130px] justify-start text-left text-xs font-normal", !customDateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {customDateTo ? format(customDateTo, "dd MMM yy") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>

      {/* Grouped by game — collapsible */}
      <div className="space-y-3">
        {grouped.length === 0 && (
          <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No orders found</div>
        )}
        {grouped.map((group, groupIndex) => {
          const eventKey = group.eventIds[0];
          const isExpanded = expandedEvents.has(eventKey);
          const totalQty = group.orders.reduce((s, o) => s + o.quantity, 0);
          const totalValue = group.orders.reduce((s, o) => s + (Number(o.sale_price) * o.quantity), 0);
          const deliveredCount = group.orders.filter(o => o.status === "delivered").length;
          const totalCost = group.orders.reduce((s, o) => s + (orderCosts[o.id] || 0), 0);
          const eventPL = totalValue - totalCost;
          const totalInventory = group.eventIds.reduce((s, eid) => s + (eventInventoryCounts[eid] || 0), 0);
          const bgClass = EVENT_PALETTE[groupIndex % EVENT_PALETTE.length];

          return (
            <div key={eventKey} className="rounded-xl overflow-hidden shadow-lg">
              {/* Collapsible event header */}
              <div className={cn(bgClass, "rounded-t-xl")}>
              {/* Collapsible event header */}
              <button
                onClick={() => toggleEvent(eventKey)}
                className="w-full text-left px-4 md:px-6 py-4 md:py-5 hover:brightness-110 transition-all"
              >
                {/* Event title row */}
                <div className="flex items-center gap-3 mb-3 md:mb-4">
                  {group.event && (
                    <>
                      <TeamLogo name={group.event.home_team} size={isMobile ? 36 : 44} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-extrabold text-lg md:text-2xl text-white leading-tight">
                            {group.event.home_team} vs {group.event.away_team}
                          </h2>
                          {(() => {
                            const comp = group.event?.competition || "";
                            const badge = COMP_BADGES[comp];
                            if (!badge) return null;
                            return <span className={cn("text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded", badge.color)}>{badge.label}</span>;
                          })()}
                          <span className="text-white/50 text-xs md:text-sm">
                            — {group.event.event_date ? format(new Date(group.event.event_date), "EEE dd MMM yyyy, HH:mm") : ""}
                          </span>
                        </div>
                        {group.event.venue && (
                          <p className="text-white/40 text-[10px] md:text-xs mt-0.5">{group.event.venue}</p>
                        )}
                      </div>
                      <TeamLogo name={group.event.away_team} size={isMobile ? 36 : 44} />
                      <ChevronDown className={cn("h-5 w-5 text-white/50 transition-transform shrink-0 ml-1", isExpanded && "rotate-180")} />
                    </>
                  )}
                  {!group.event && (
                    <>
                      <h2 className="font-extrabold text-lg text-white flex-1">Unknown Event</h2>
                      <ChevronDown className={cn("h-5 w-5 text-white/50 transition-transform shrink-0", isExpanded && "rotate-180")} />
                    </>
                  )}
                </div>

                {/* Stats row — large and bold */}
                <div className="grid grid-cols-4 md:grid-cols-5 gap-2 md:gap-4">
                  <div>
                    <p className="text-white/50 text-[10px] md:text-xs uppercase tracking-wider font-medium">Sold</p>
                    <p className="text-white font-extrabold text-base md:text-2xl font-mono">{totalQty}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[10px] md:text-xs uppercase tracking-wider font-medium">Total</p>
                    <p className="text-white font-extrabold text-base md:text-2xl font-mono">£{totalValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[10px] md:text-xs uppercase tracking-wider font-medium">Delivered</p>
                    <p className="text-white font-extrabold text-base md:text-2xl font-mono">{deliveredCount}/{group.orders.length}</p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-white/50 text-[10px] md:text-xs uppercase tracking-wider font-medium">Orders</p>
                    <p className="text-white font-extrabold text-base md:text-2xl font-mono">{group.orders.length}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[10px] md:text-xs uppercase tracking-wider font-medium">P/L</p>
                    <p className={cn("font-extrabold text-base md:text-2xl font-mono", eventPL >= 0 ? "text-green-300" : "text-red-300")}>
                      {eventPL >= 0 ? "+" : "-"}£{Math.abs(eventPL).toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
              </div>

              {/* Expanded: full order details — dark background */}
              {isExpanded && (() => {
                // Group orders by source
                const sourceGroups = new Map<string, { sourceName: string; sourceIdx: number; orders: Order[] }>();
                group.orders.forEach(o => {
                  const src = getSourceDisplay(o, assignments);
                  const key = src.primary.toLowerCase();
                  if (!sourceGroups.has(key)) {
                    const srcIdx = getSourceColorIndex(src.primary);
                    sourceGroups.set(key, { sourceName: src.primary, sourceIdx: srcIdx, orders: [] });
                  }
                  sourceGroups.get(key)!.orders.push(o);
                });
                const sourceGroupList = [...sourceGroups.values()];

                return (
                <>
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-1 p-3">
                    {sourceGroupList.map(sg => {
                      const sgTotal = sg.orders.reduce((s, o) => s + Number(o.sale_price) * o.quantity, 0);
                      const sgQty = sg.orders.reduce((s, o) => s + o.quantity, 0);
                      return (
                        <div key={sg.sourceName}>
                          <div className="flex items-center justify-between px-3 py-2 rounded-t-lg mt-2 bg-white/5">
                            <span className={cn("font-extrabold text-base", SOURCE_TEXT_COLORS[sg.sourceIdx])}>{sg.sourceName}</span>
                            <span className="text-sm text-white/70 font-semibold">{sgQty} tickets · £{sgTotal.toLocaleString()}</span>
                          </div>
                          <div className="space-y-2 pb-1">
                          {sg.orders.map(o => {
                            const flag = phoneToFlag(o.buyer_phone);
                            const statusConf = ORDER_STATUS_CONFIG[o.status] || ORDER_STATUS_CONFIG.outstanding;
                            const src = getSourceDisplay(o, assignments);
                            const orderTotal = Number(o.sale_price) * o.quantity;
                            return (
                              <div
                                key={o.id}
                                onClick={() => setEditOrder(o)}
                                className={cn(
                                  "rounded-lg border p-3 space-y-2 cursor-pointer transition-colors",
                                  o.status === "delivered" ? "bg-green-500/10 ring-1 ring-success/30" : "bg-white/5"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    {src.secondary && <span className="text-muted-foreground text-sm">{src.secondary}</span>}
                                    {o.order_ref && <span className="text-muted-foreground text-xs ml-2 font-mono">#{o.order_ref}</span>}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[10px] cursor-pointer select-none", statusConf.className)}
                                    onClick={(e) => { e.stopPropagation(); updateField(o.id, 'status', nextOrderStatus(o.status)); }}
                                  >
                                    {statusConf.label.toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-base text-foreground">{o.quantity}× £{Number(o.sale_price).toFixed(0)} = £{orderTotal.toLocaleString()}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground font-medium">{o.category}</span>
                                    {flag && <span className="text-lg">{flag}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table view */}
                  <div className="overflow-x-auto hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] uppercase tracking-wider w-[90px]">Order #</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">Source</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider text-center w-[40px]">🏳️</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">Customer</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">Phone</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider w-[50px]">Cat</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider text-center w-[40px]">Qty</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider text-right w-[100px]">Price</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider text-center w-[90px]">Device</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider w-[90px]">Status</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider w-[100px]">Assigned From</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider w-[60px]">Assign</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sourceGroupList.flatMap(sg => {
                          const sgTotal = sg.orders.reduce((s, o) => s + Number(o.sale_price) * o.quantity, 0);
                          const sgQty = sg.orders.reduce((s, o) => s + o.quantity, 0);
                          const rows: React.ReactNode[] = [];
                          // Source sub-header row
                          if (sourceGroupList.length > 1) {
                            rows.push(
                              <TableRow key={`src-${sg.sourceName}`} className="border-0 hover:bg-transparent">
                                <TableCell colSpan={13} className="py-2 px-4">
                                  <div className="flex items-center gap-3">
                                    <span className={cn("font-extrabold text-base", SOURCE_TEXT_COLORS[sg.sourceIdx])}>{sg.sourceName}</span>
                                    <span className="text-sm text-white/70 font-semibold">({sg.orders.length} orders · {sgQty} tickets · £{sgTotal.toLocaleString()})</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }
                          sg.orders.forEach(o => {
                          const flag = phoneToFlag(o.buyer_phone);
                          const assigned = isFullyAssigned(o);
                          const assignInfo = assignments[o.id];
                          const src = getSourceDisplay(o, assignments);
                          const orderTotal = Number(o.sale_price) * o.quantity;
                          const srcIdx = getSourceColorIndex(src.primary);
                          rows.push(
                            <TableRow
                              key={o.id}
                              className={cn(
                                "cursor-pointer text-xs h-10 transition-colors",
                                o.status === "delivered" && "bg-green-500/10 ring-1 ring-inset ring-success/20"
                              )}
                              onClick={() => setSelectedOrderId(o.id)}
                            >
                              <TableCell className="font-mono font-bold text-xs py-2">
                                {o.order_ref ? <CopyText text={o.order_ref} className="font-mono font-bold text-foreground text-xs" /> : "—"}
                              </TableCell>
                              <TableCell className="py-2">
                                <div>
                                  <span className={cn("font-bold text-sm", SOURCE_TEXT_COLORS[srcIdx])}>{src.primary}</span>
                                  {src.secondary && <span className="block text-[10px] text-muted-foreground">{src.secondary}</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-base py-2">{flag || "NA"}</TableCell>
                              <TableCell className="py-2">
                                <span className="font-medium">{o.buyer_name || "NA"}</span>
                              </TableCell>
                              <TableCell className="py-2">
                                {o.buyer_phone ? (
                                  <CopyText text={o.buyer_phone} className="text-muted-foreground text-xs" />
                                ) : <span className="text-muted-foreground/40 text-xs">NA</span>}
                              </TableCell>
                              <TableCell className="py-2 text-muted-foreground">{o.category || "NA"}</TableCell>
                              <TableCell className="text-center font-mono font-extrabold text-sm py-2">{o.quantity}</TableCell>
                              <TableCell className="text-right font-mono py-2">
                                <div>
                                  <span className="font-extrabold text-sm">£{orderTotal.toLocaleString()}</span>
                                  {o.quantity > 1 && (
                                    <span className="block text-[10px] text-muted-foreground">{o.quantity}×£{Number(o.sale_price).toFixed(0)}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateField(o.id, 'device_type', o.device_type === 'ios' ? null : 'ios'); }}
                                    className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-md border transition-all ${
                                      o.device_type === 'ios'
                                        ? 'bg-primary/15 text-primary border-primary/30 shadow-sm'
                                        : 'text-muted-foreground/40 border-transparent hover:border-muted-foreground/20 hover:text-muted-foreground'
                                    }`}
                                    title="iOS"
                                  >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                                    <span className="text-[9px] font-bold uppercase">iOS</span>
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateField(o.id, 'device_type', o.device_type === 'android' ? null : 'android'); }}
                                    className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-md border transition-all ${
                                      o.device_type === 'android'
                                        ? 'bg-success/15 text-success border-success/30 shadow-sm'
                                        : 'text-muted-foreground/40 border-transparent hover:border-muted-foreground/20 hover:text-muted-foreground'
                                    }`}
                                    title="Android"
                                  >
                                    <Smartphone className="h-4 w-4" />
                                    <span className="text-[9px] font-bold uppercase">AND</span>
                                  </button>
                                </div>
                              </TableCell>
                              <TableCell className="py-2">
                                {(() => {
                                  const sc = ORDER_STATUS_CONFIG[o.status] || ORDER_STATUS_CONFIG.outstanding;
                                  return (
                                    <Badge
                                      variant="outline"
                                      className={cn("text-[10px] py-0 font-bold cursor-pointer select-none", sc.className)}
                                      onClick={(e) => { e.stopPropagation(); updateField(o.id, 'status', nextOrderStatus(o.status)); }}
                                    >
                                      {sc.label.toUpperCase()}
                                    </Badge>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="py-2">
                                {assigned ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {assignInfo?.supplier_contact_name || "Assigned"}
                                  </span>
                                ) : assignInfo?.linked_count ? (
                                  <span className="text-xs text-warning font-medium">
                                    {assignInfo.linked_count}/{o.quantity} · {assignInfo.supplier_contact_name || "—"}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40 text-xs">NA</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2">
                                <Button
                                  size="sm"
                                  variant={assigned ? "ghost" : "outline"}
                                  className={`h-7 w-7 p-0 ${assigned ? "text-success" : ""}`}
                                  title="Quick assign purchase"
                                  onClick={(e) => { e.stopPropagation(); setAssignOrder(o); }}
                                >
                                  {assigned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                                </Button>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-0.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                  title="Edit order"
                                  onClick={(e) => { e.stopPropagation(); setEditOrder(o); }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  title="Delete order"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!confirm("Delete this order? This will unlink any assigned inventory.")) return;
                                    const { data: lines } = await supabase.from("order_lines").select("inventory_id").eq("order_id", o.id);
                                    if (lines && lines.length > 0) {
                                      await supabase.from("inventory").update({ status: "available" as any }).in("id", lines.map(l => l.inventory_id));
                                    }
                                    await supabase.from("order_lines").delete().eq("order_id", o.id);
                                    await supabase.from("refunds").delete().eq("order_id", o.id);
                                    if ((o as any).contact_id) {
                                      await supabase.from("balance_payments").delete().ilike("notes", `Auto: Order ${o.id}`);
                                    }
                                    const { error } = await supabase.from("orders").delete().eq("id", o.id);
                                    if (error) { toast.error(error.message); return; }
                                    toast.success("Order deleted");
                                    load();
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                          });
                          return rows;
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
                );
              })()}
            </div>
          );
        })}
      </div>

      <OrderDetailSheet
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onUpdated={load}
      />

      {assignOrder && (
        <AssignPurchaseDialog
          orderId={assignOrder.id}
          eventId={assignOrder.event_id}
          orderCategory={assignOrder.category}
          orderQuantity={assignOrder.quantity}
          onClose={() => setAssignOrder(null)}
          onAssigned={() => { setAssignOrder(null); load(); }}
        />
      )}

      {editOrder && (
        <EditOrderDialog
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onUpdated={() => { setEditOrder(null); load(); }}
        />
      )}
      </div>
    </div>
  );
}
