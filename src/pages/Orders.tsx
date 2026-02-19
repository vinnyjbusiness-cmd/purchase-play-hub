import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Phone, Mail } from "lucide-react";
import { format, subHours } from "date-fns";
import FilterSelect from "@/components/FilterSelect";
import AddOrderDialog from "@/components/AddOrderDialog";
import OrderDetailSheet from "@/components/OrderDetailSheet";

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

// Map phone prefix to flag emoji
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
  // Try longest prefix first
  for (const prefix of Object.keys(prefixMap).sort((a, b) => b.length - a.length)) {
    if (clean.startsWith(prefix)) return prefixMap[prefix];
  }
  return null;
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterDelivery, setFilterDelivery] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*, events(match_code, home_team, away_team, event_date), platforms(name)")
      .order("order_date", { ascending: false });
    setOrders((ordersData as any) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

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
    // Sort by event date
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
          <p className="text-muted-foreground">
            {filtered.length} order{filtered.length !== 1 ? "s" : ""} across {grouped.length} game{grouped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <AddOrderDialog onCreated={load} />
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
          { value: "awaiting_delivery", label: "Awaiting Delivery" },
          { value: "sent", label: "Sent" },
          { value: "delivered", label: "Delivered" },
          { value: "completed", label: "Completed" },
        ]} />
      </div>

      {/* Grouped by game */}
      <div className="space-y-4">
        {grouped.length === 0 && (
          <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No orders found</div>
        )}
        {grouped.map(group => {
          const deadline = getDeadline(group.event?.event_date);
          const deadlineStatus = getDeadlineStatus(group.event?.event_date);
          const pendingCount = group.orders.filter(o => (o.delivery_status || "pending") !== "delivered" && o.delivery_status !== "completed").length;

          return (
            <div key={group.eventId} className="rounded-lg border bg-card overflow-hidden">
              {/* Game header */}
              <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <div>
                  <p className="font-semibold">
                    {group.event ? `${group.event.home_team} vs ${group.event.away_team}` : "Unknown Event"}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">{group.event?.match_code}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.event?.event_date ? format(new Date(group.event.event_date), "EEE dd MMM yyyy, HH:mm") : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deadline</p>
                    <p className={`text-sm font-mono ${deadlineStatus.color}`}>
                      {deadline ? format(deadline, "dd MMM, HH:mm") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Orders</p>
                    <p className="text-sm font-mono font-bold">{group.orders.length}</p>
                  </div>
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-warning/10 text-warning border border-warning/20">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
              </div>

              {/* Orders table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[10px] uppercase tracking-wider">
                      <TableHead className="text-[10px]">Ref</TableHead>
                      <TableHead className="text-[10px]">Platform</TableHead>
                      <TableHead className="text-[10px]">Customer</TableHead>
                      <TableHead className="text-[10px]">Contact</TableHead>
                      <TableHead className="text-[10px]">Cat</TableHead>
                      <TableHead className="text-[10px]">Qty</TableHead>
                      <TableHead className="text-[10px] text-right">Sale</TableHead>
                      <TableHead className="text-[10px]">Delivery</TableHead>
                      <TableHead className="text-[10px]">Date Sold</TableHead>
                      <TableHead className="text-[10px]">Deadline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.orders.map(o => {
                      const ds = getDeadlineStatus(o.events?.event_date);
                      const flag = phoneToFlag(o.buyer_phone);
                      return (
                        <TableRow
                          key={o.id}
                          className="cursor-pointer hover:bg-muted/50 text-xs"
                          onClick={() => setSelectedOrderId(o.id)}
                        >
                          <TableCell className="font-mono font-bold">{o.order_ref || "—"}</TableCell>
                          <TableCell>{o.platforms?.name || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {flag && <span className="text-base">{flag}</span>}
                              <span className="font-medium">{o.buyer_name || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {o.buyer_phone && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="h-3 w-3" />{o.buyer_phone}
                                </span>
                              )}
                              {o.buyer_email && (
                                <span className="flex items-center gap-1 text-muted-foreground truncate max-w-[180px]">
                                  <Mail className="h-3 w-3" />{o.buyer_email}
                                </span>
                              )}
                              {!o.buyer_phone && !o.buyer_email && <span className="text-muted-foreground">—</span>}
                            </div>
                          </TableCell>
                          <TableCell>{o.category}</TableCell>
                          <TableCell className="font-mono font-bold">{o.quantity}</TableCell>
                          <TableCell className="text-right font-mono">
                            £{Number(o.sale_price).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${deliveryColor[(o.delivery_status || "pending")] || ""}`}>
                              {(o.delivery_status || "pending").replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono">
                            {format(new Date(o.order_date), "dd MMM yy")}
                          </TableCell>
                          <TableCell>
                            <span className={`font-mono text-xs ${ds.color}`}>{ds.label}</span>
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
    </div>
  );
}
