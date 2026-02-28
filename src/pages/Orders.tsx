import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Smartphone, Copy, Check, Download, Zap, CheckCircle2, CalendarIcon, Trash2, Pencil } from "lucide-react";
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
  events: { match_code: string; home_team: string; away_team: string; event_date: string; venue: string | null } | null;
  platforms: { name: string } | null;
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
    "Sale Price", "Fees", "Net Received", "Currency", "Device", "Contacted",
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

export default function Orders() {
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

  const load = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*, events(match_code, home_team, away_team, event_date, venue), platforms(name)")
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
        // Get inventory -> purchase -> supplier info
        const invIds = orderLines.map(ol => ol.inventory_id);
        const { data: invData } = await supabase
          .from("inventory")
          .select("id, purchase_id")
          .in("id", invIds);

        const purchaseIds = [...new Set((invData || []).map(i => i.purchase_id))];
        const { data: purchaseData } = purchaseIds.length > 0
          ? await supabase
              .from("purchases")
              .select("id, suppliers(name, contact_name)")
              .in("id", purchaseIds)
          : { data: [] };

        const purchaseMap = new Map((purchaseData || []).map((p: any) => [p.id, p]));
        const invMap = new Map((invData || []).map(i => [i.id, i]));

        // Build per-order assignment info
        const assignMap: Record<string, AssignmentInfo> = {};
        for (const ol of orderLines) {
          if (!assignMap[ol.order_id]) {
            assignMap[ol.order_id] = { linked_count: 0, supplier_contact_name: null };
          }
          assignMap[ol.order_id].linked_count++;

          // Get supplier contact name from first linked ticket
          if (!assignMap[ol.order_id].supplier_contact_name) {
            const inv = invMap.get(ol.inventory_id);
            if (inv) {
              const purchase = purchaseMap.get(inv.purchase_id) as any;
              if (purchase?.suppliers?.contact_name) {
                assignMap[ol.order_id].supplier_contact_name = purchase.suppliers.contact_name;
              } else if (purchase?.suppliers?.name) {
                assignMap[ol.order_id].supplier_contact_name = purchase.suppliers.name;
              }
            }
          }
        }
        setAssignments(assignMap);
      } else {
        setAssignments({});
      }
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
    // Filter out orders for past events by default
    const now = new Date();
    const eventDate = o.events?.event_date ? new Date(o.events.event_date) : null;
    
    // Time range filter
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
    // "all" shows everything including past

    // Club filter (in-page)
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

  const getDeadline = (eventDate: string | undefined) => {
    if (!eventDate) return null;
    return subHours(new Date(eventDate), 48);
  };

  const getDeadlineStatus = (eventDate: string | undefined) => {
    const deadline = getDeadline(eventDate);
    if (!deadline) return { label: "—", color: "" };
    const now = Date.now();
    const diff = deadline.getTime() - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff < 0) return { label: "OVERDUE", color: "text-destructive font-bold" };
    if (days === 0) return { label: `${hours}h left`, color: "text-destructive font-bold" };
    if (days <= 3) return { label: `${days}d ${hours}h`, color: "text-warning font-semibold" };
    return { label: `${days}d`, color: "text-muted-foreground" };
  };

  const isFullyAssigned = (order: Order) => {
    const info = assignments[order.id];
    return info && info.linked_count >= order.quantity;
  };

  // Filter CLUBS to only those with matching orders
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

      {/* Grouped by game */}
      <div className="space-y-5">
        {grouped.length === 0 && (
          <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No orders found</div>
        )}
        {grouped.map(group => {
          const deadline = getDeadline(group.event?.event_date);
          const deadlineStatus = getDeadlineStatus(group.event?.event_date);
          const pendingCount = group.orders.filter(o => (o.delivery_status || "pending") !== "delivered" && o.delivery_status !== "completed").length;
          const totalQty = group.orders.reduce((s, o) => s + o.quantity, 0);
          const assignedCount = group.orders.filter(o => isFullyAssigned(o)).length;

          return (
            <div key={group.eventIds[0]} className="rounded-xl border bg-card overflow-hidden shadow-sm">
              {/* Game header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-5 py-3 border-b bg-muted/40 gap-2">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-bold text-sm md:text-base">
                      {group.event ? `${group.event.home_team} vs ${group.event.away_team}` : "Unknown Event"}
                      {group.event?.venue && <span className="text-muted-foreground font-normal text-xs md:text-sm ml-2 hidden md:inline">— {group.event.venue}</span>}
                    </p>
                    <p className="text-xs md:text-sm font-bold text-foreground mt-0.5">
                      {group.event?.event_date ? format(new Date(group.event.event_date), "EEE dd MMM yyyy, HH:mm") : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:gap-5 flex-wrap">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Orders</p>
                    <p className="text-sm font-mono font-bold">{group.orders.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tickets</p>
                    <p className="text-sm font-mono font-bold">{totalQty}</p>
                  </div>
                  {assignedCount > 0 && (
                    <Badge variant="outline" className="text-[10px] font-bold uppercase bg-success/10 text-success border-success/20">
                      {assignedCount} assigned
                    </Badge>
                  )}
                  {(() => {
                    const deliveredCount = group.orders.filter(o => o.delivery_status === "delivered" || o.delivery_status === "completed").length;
                    const outstandingCount = group.orders.length - deliveredCount;
                    return (
                      <>
                        {deliveredCount > 0 && (
                          <Badge variant="outline" className="text-[10px] font-bold uppercase bg-success/10 text-success border-success/20">
                            {deliveredCount} delivered
                          </Badge>
                        )}
                        {outstandingCount > 0 && (
                          <Badge variant="outline" className="text-[10px] font-bold uppercase bg-warning/10 text-warning border-warning/20">
                            {outstandingCount} outstanding
                          </Badge>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Orders table */}
              {/* Mobile card view */}
              <div className="md:hidden space-y-2 p-3">
                {group.orders.map(o => {
                  const flag = phoneToFlag(o.buyer_phone);
                  const assigned = isFullyAssigned(o);
                  const isDelivered = o.delivery_status === "delivered" || o.delivery_status === "completed";
                  return (
                    <div
                      key={o.id}
                      onClick={() => setSelectedOrderId(o.id)}
                      className={cn(
                        "rounded-lg border p-3 space-y-2 cursor-pointer transition-colors",
                        isDelivered ? "bg-success/10 border-success/20" : assigned ? "bg-success/5 border-success/10" : "bg-card hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm">{o.order_ref || "—"}</span>
                        {isDelivered ? (
                          <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">DELIVERED</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">OUTSTANDING</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{o.buyer_name || "Unknown"} {flag}</span>
                        <span className="text-muted-foreground">{o.platforms?.name || "Direct"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{o.quantity}× {o.category} · £{Number(o.sale_price).toFixed(0)}</span>
                        <span>{o.order_date ? format(new Date(o.order_date), "dd MMM") : ""}</span>
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
                      <TableHead className="text-[10px] uppercase tracking-wider">Platform</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-center w-[40px]">🏳️</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Customer</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Phone</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Email</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider w-[50px]">Cat</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-center w-[40px]">Qty</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-right w-[70px]">Sale</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-center w-[90px]">Device</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-center w-[70px]">Delivered</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider w-[80px]">Status</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider w-[75px]">Sold</TableHead>
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
                        <TableRow
                          key={o.id}
                          className={`cursor-pointer text-xs h-10 transition-colors ${
                            o.delivery_status === "delivered" || o.delivery_status === "completed"
                              ? "bg-success/10 hover:bg-success/20 border-l-2 border-l-success"
                              : assigned
                                ? "bg-success/5 hover:bg-success/10 border-l-2 border-l-success/50"
                                : "hover:bg-muted/40"
                          }`}
                          onClick={() => setSelectedOrderId(o.id)}
                        >
                          <TableCell className="font-mono font-bold text-xs py-2">
                            {o.order_ref ? <CopyText text={o.order_ref} className="font-mono font-bold text-foreground text-xs" /> : "—"}
                          </TableCell>
                          <TableCell className="py-2">
                            {(() => {
                              const assignInfo = assignments[o.id];
                              const contactName = assignInfo?.supplier_contact_name;
                              const platformName = o.platforms?.name || "NA";
                              // Contact-sourced order
                              if ((o as any).contact_id) {
                                return (
                                  <div>
                                    <span className="font-medium text-foreground text-xs">{o.buyer_name || "Contact"}</span>
                                    <span className="block text-[10px] text-muted-foreground">Contact</span>
                                  </div>
                                );
                              }
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
                          <TableCell className="py-2">
                            <span className="font-medium">{o.buyer_name || "NA"}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            {o.buyer_phone ? (
                              <CopyText text={o.buyer_phone} className="text-muted-foreground text-xs" />
                            ) : <span className="text-muted-foreground/40 text-xs">NA</span>}
                          </TableCell>
                          <TableCell className="py-2">
                            {o.buyer_email ? (
                              <CopyText text={o.buyer_email} className="text-muted-foreground text-xs max-w-[140px]" />
                            ) : <span className="text-muted-foreground/40 text-xs">NA</span>}
                          </TableCell>
                          <TableCell className="py-2 text-muted-foreground">{o.category || "NA"}</TableCell>
                          <TableCell className="text-center font-mono font-bold py-2">{o.quantity}</TableCell>
                          <TableCell className="text-right font-mono py-2">
                            {(() => {
                              const isTixstock = (o.platforms?.name || "").toLowerCase().includes("tixstock");
                              const price = isTixstock ? Number(o.sale_price) * 0.97 : Number(o.sale_price);
                              return `£${price.toFixed(0)}`;
                            })()}
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
                          <TableCell className="text-center py-2">
                            <Checkbox
                              checked={o.delivery_status === "delivered" || o.delivery_status === "completed"}
                              onCheckedChange={(checked) => {
                                const newStatus = checked ? "delivered" : "pending";
                                updateField(o.id, 'delivery_status', newStatus);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-5 w-5 data-[state=checked]:bg-success data-[state=checked]:border-success"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            {o.delivery_status === "delivered" || o.delivery_status === "completed" ? (
                              <Badge variant="outline" className="text-[10px] py-0 bg-success/10 text-success border-success/20 font-bold">
                                DELIVERED
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] py-0 bg-warning/10 text-warning border-warning/20 font-bold">
                                OUTSTANDING
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono py-2 text-[11px]">
                            {o.order_date ? format(new Date(o.order_date), "dd MMM") : "NA"}
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
                                // Get linked inventory first
                                const { data: lines } = await supabase.from("order_lines").select("inventory_id").eq("order_id", o.id);
                                // Reset inventory status back to available
                                if (lines && lines.length > 0) {
                                  await supabase.from("inventory").update({ status: "available" as any }).in("id", lines.map(l => l.inventory_id));
                                }
                                // Delete order_lines
                                await supabase.from("order_lines").delete().eq("order_id", o.id);
                                // Delete refunds
                                await supabase.from("refunds").delete().eq("order_id", o.id);
                                // Delete auto balance entry if contact-sourced
                                if ((o as any).contact_id) {
                                  await supabase.from("balance_payments").delete().ilike("notes", `Auto: Order ${o.id}`);
                                }
                                // Delete the order
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
                    })}
                  </TableBody>
                </Table>
              </div>
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
