import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Phone, Mail, Smartphone, Copy, Check, Download, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, subHours } from "date-fns";
import { toast } from "sonner";
import FilterSelect from "@/components/FilterSelect";
import AddOrderDialog from "@/components/AddOrderDialog";
import OrderDetailSheet from "@/components/OrderDetailSheet";
import AssignPurchaseDialog from "@/components/AssignPurchaseDialog";

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
  order_date: string;
  currency: string;
  event_id: string;
  platform_id: string | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string } | null;
  platforms: { name: string } | null;
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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*, events(match_code, home_team, away_team, event_date), platforms(name)")
      .order("order_date", { ascending: false });
    setOrders((ordersData as any) || []);
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
      if (o.events) seen.set(o.events.match_code, `${o.events.match_code} — ${o.events.home_team} vs ${o.events.away_team}`);
    });
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [orders]);

  const filtered = orders.filter((o) => {
    if (filterPlatform !== "all" && o.platforms?.name !== filterPlatform) return false;
    if (filterEvent !== "all" && o.events?.match_code !== filterEvent) return false;
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
    const map: Record<string, { event: Order["events"]; eventId: string; orders: Order[] }> = {};
    filtered.forEach(o => {
      const key = o.event_id;
      if (!map[key]) map[key] = { event: o.events, eventId: key, orders: [] };
      map[key].orders.push(o);
    });
    return Object.values(map).sort((a, b) => {
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} order{filtered.length !== 1 ? "s" : ""} across {grouped.length} game{grouped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportToCSV(filtered)} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <AddOrderDialog onCreated={load} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
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

          return (
            <div key={group.eventId} className="rounded-xl border bg-card overflow-hidden shadow-sm">
              {/* Game header */}
              <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/40">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-bold text-base">
                      {group.event ? `${group.event.home_team} vs ${group.event.away_team}` : "Unknown Event"}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{group.event?.match_code}</span>
                      <span className="text-xs text-muted-foreground">
                        {group.event?.event_date ? format(new Date(group.event.event_date), "EEE dd MMM yyyy, HH:mm") : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deadline</p>
                    <p className={`text-sm font-mono ${deadlineStatus.color}`}>
                      {deadline ? format(deadline, "dd MMM HH:mm") : "—"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Orders</p>
                    <p className="text-sm font-mono font-bold">{group.orders.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tickets</p>
                    <p className="text-sm font-mono font-bold">{totalQty}</p>
                  </div>
                  {pendingCount > 0 && (
                    <Badge variant="outline" className="text-[10px] font-bold uppercase bg-warning/10 text-warning border-warning/20">
                      {pendingCount} pending
                    </Badge>
                  )}
                </div>
              </div>

              {/* Orders table */}
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
                      <TableHead className="text-[10px] uppercase tracking-wider text-center w-[60px]">Device</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-center w-[30px]">📞</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider w-[80px]">Status</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider w-[75px]">Sold</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider w-[60px]">Assign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.orders.map(o => {
                      const flag = phoneToFlag(o.buyer_phone);
                      return (
                        <TableRow
                          key={o.id}
                          className="cursor-pointer hover:bg-muted/40 text-xs h-10"
                          onClick={() => setSelectedOrderId(o.id)}
                        >
                          <TableCell className="font-mono font-bold text-xs py-2">
                            {o.order_ref ? <CopyText text={o.order_ref} className="font-mono font-bold text-foreground text-xs" /> : "—"}
                          </TableCell>
                          <TableCell className="py-2 text-muted-foreground">{o.platforms?.name || "—"}</TableCell>
                          <TableCell className="text-center text-base py-2">{flag || "—"}</TableCell>
                          <TableCell className="py-2">
                            <span className="font-medium">{o.buyer_name || "—"}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            {o.buyer_phone ? (
                              <CopyText text={o.buyer_phone} className="text-muted-foreground text-xs" />
                            ) : <span className="text-muted-foreground/50">—</span>}
                          </TableCell>
                          <TableCell className="py-2">
                            {o.buyer_email ? (
                              <CopyText text={o.buyer_email} className="text-muted-foreground text-xs max-w-[140px]" />
                            ) : <span className="text-muted-foreground/50">—</span>}
                          </TableCell>
                          <TableCell className="py-2 text-muted-foreground">{o.category}</TableCell>
                          <TableCell className="text-center font-mono font-bold py-2">{o.quantity}</TableCell>
                          <TableCell className="text-right font-mono py-2">
                            £{Number(o.sale_price).toFixed(0)}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex gap-0.5 justify-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); updateField(o.id, 'device_type', o.device_type === 'ios' ? null : 'ios'); }}
                                className={`p-1 rounded transition-colors ${o.device_type === 'ios' ? 'bg-primary/10 text-primary' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
                                title="iOS"
                              >
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); updateField(o.id, 'device_type', o.device_type === 'android' ? null : 'android'); }}
                                className={`p-1 rounded transition-colors ${o.device_type === 'android' ? 'bg-success/10 text-success' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
                                title="Android"
                              >
                                <Smartphone className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <Checkbox
                              checked={o.contacted}
                              onCheckedChange={(checked) => updateField(o.id, 'contacted', !!checked)}
                              onClick={(e) => e.stopPropagation()}
                              className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                            />
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className={`text-[10px] py-0 ${deliveryColor[(o.delivery_status || "pending")] || ""}`}>
                              {(o.delivery_status || "pending").replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono py-2 text-[11px]">
                            {format(new Date(o.order_date), "dd MMM")}
                          </TableCell>
                          <TableCell className="py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Quick assign purchase"
                              onClick={(e) => { e.stopPropagation(); setAssignOrder(o); }}
                            >
                              <Zap className="h-3.5 w-3.5" />
                            </Button>
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
    </div>
  );
}
