import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";
import FilterSelect from "@/components/FilterSelect";
import AddOrderDialog from "@/components/AddOrderDialog";
import OrderDetailSheet from "@/components/OrderDetailSheet";

interface Order {
  id: string;
  order_ref: string | null;
  buyer_ref: string | null;
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
  events: { match_code: string; home_team: string; away_team: string } | null;
  platforms: { name: string } | null;
  // computed
  linkedCost?: number;
  linkedCount?: number;
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  fulfilled: "bg-primary/10 text-primary border-primary/20",
  delivered: "bg-success/10 text-success border-success/20",
  refunded: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground",
};

const deliveryColor: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  awaiting_delivery: "bg-warning/10 text-warning border-warning/20",
  delivered: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-success/10 text-success border-success/20",
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDelivery, setFilterDelivery] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*, events(match_code, home_team, away_team), platforms(name)")
      .order("order_date", { ascending: false });

    const rawOrders = (ordersData as any) || [];

    // Load all order_lines to compute cost per order
    const { data: allOrderLines } = await supabase.from("order_lines").select("order_id, inventory_id");
    const { data: allInventory } = await supabase.from("inventory").select("id, purchase_id");
    
    const inventoryIds = (allOrderLines || []).map((ol) => ol.inventory_id);
    const purchaseIds = [...new Set((allInventory || []).filter((i) => inventoryIds.includes(i.id)).map((i) => i.purchase_id))];
    
    const { data: allPurchases } = purchaseIds.length > 0
      ? await supabase.from("purchases").select("id, unit_cost").in("id", purchaseIds)
      : { data: [] };

    const purchaseMap = new Map((allPurchases || []).map((p) => [p.id, Number(p.unit_cost)]));
    const inventoryPurchaseMap = new Map((allInventory || []).map((i) => [i.id, i.purchase_id]));

    // Group order_lines by order
    const orderLineCosts = new Map<string, { cost: number; count: number }>();
    for (const ol of allOrderLines || []) {
      const purchaseId = inventoryPurchaseMap.get(ol.inventory_id);
      const unitCost = purchaseId ? (purchaseMap.get(purchaseId) || 0) : 0;
      const existing = orderLineCosts.get(ol.order_id) || { cost: 0, count: 0 };
      orderLineCosts.set(ol.order_id, { cost: existing.cost + unitCost, count: existing.count + 1 });
    }

    const enriched = rawOrders.map((o: any) => ({
      ...o,
      linkedCost: orderLineCosts.get(o.id)?.cost || 0,
      linkedCount: orderLineCosts.get(o.id)?.count || 0,
    }));

    setOrders(enriched);
  }, []);

  useEffect(() => { load(); }, [load]);

  const platformOptions = [...new Set(orders.map((o) => o.platforms?.name).filter(Boolean))].map((n) => ({ value: n!, label: n! }));
  const eventOptions = [...new Set(orders.map((o) => o.events?.match_code).filter(Boolean))].map((c) => ({ value: c!, label: c! }));

  const filtered = orders.filter((o) => {
    if (filterPlatform !== "all" && o.platforms?.name !== filterPlatform) return false;
    if (filterEvent !== "all" && o.events?.match_code !== filterEvent) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterDelivery !== "all" && (o.delivery_status || "pending") !== filterDelivery) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (o.order_ref || "").toLowerCase().includes(q) ||
        (o.buyer_ref || "").toLowerCase().includes(q) ||
        (o.events?.home_team || "").toLowerCase().includes(q) ||
        (o.events?.away_team || "").toLowerCase().includes(q) ||
        (o.platforms?.name || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalRevenue = filtered.reduce((s, o) => s + Number(o.sale_price || 0), 0);
  const totalProfit = filtered.reduce((s, o) => s + (Number(o.net_received || 0) - (o.linkedCost || 0)), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            {filtered.length} order{filtered.length !== 1 ? "s" : ""} ·
            Revenue: £{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })} ·
            Profit: <span className={totalProfit >= 0 ? "text-success" : "text-destructive"}>£{totalProfit.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
          </p>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
            <span>⏳ {filtered.filter(o => (o.delivery_status || "pending") === "pending").length} Pending</span>
            <span>📦 {filtered.filter(o => o.delivery_status === "awaiting_delivery").length} Awaiting</span>
            <span>🚚 {filtered.filter(o => o.delivery_status === "delivered").length} Delivered</span>
            <span>✅ {filtered.filter(o => o.delivery_status === "completed").length} Completed</span>
          </div>
        </div>
        <AddOrderDialog onCreated={load} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
        <FilterSelect label="Platform" value={filterPlatform} onValueChange={setFilterPlatform} options={platformOptions} />
        <FilterSelect label="Event" value={filterEvent} onValueChange={setFilterEvent} options={eventOptions} />
        <FilterSelect label="Status" value={filterStatus} onValueChange={setFilterStatus} options={[
          { value: "pending", label: "Pending" },
          { value: "fulfilled", label: "Fulfilled" },
          { value: "delivered", label: "Delivered" },
          { value: "refunded", label: "Refunded" },
          { value: "cancelled", label: "Cancelled" },
        ]} />
        <FilterSelect label="Delivery" value={filterDelivery} onValueChange={setFilterDelivery} options={[
          { value: "pending", label: "Pending" },
          { value: "awaiting_delivery", label: "Awaiting Delivery" },
          { value: "delivered", label: "Delivered" },
          { value: "completed", label: "Completed" },
        ]} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Ref</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Sale</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => {
              const profit = Number(o.net_received || 0) - (o.linkedCost || 0);
              return (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedOrderId(o.id)}
                >
                  <TableCell className="font-medium">{o.order_ref || "—"}</TableCell>
                  <TableCell>{o.platforms?.name || "—"}</TableCell>
                  <TableCell>{o.events?.match_code || "—"}</TableCell>
                  <TableCell>{o.category}</TableCell>
                  <TableCell className="text-right">{o.quantity}</TableCell>
                  <TableCell className="text-right">£{Number(o.sale_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {(o.linkedCount || 0) > 0 ? `£${(o.linkedCost || 0).toFixed(2)}` : 
                      <span className="text-xs text-warning">No cost</span>
                    }
                  </TableCell>
                  <TableCell className={`text-right font-medium ${(o.linkedCount || 0) > 0 ? (profit >= 0 ? "text-success" : "text-destructive") : "text-muted-foreground"}`}>
                    {(o.linkedCount || 0) > 0 ? `${profit >= 0 ? "+" : ""}£${profit.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[o.status] || ""}>{o.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={deliveryColor[(o.delivery_status || "pending")] || ""}>
                      {(o.delivery_status || "pending").replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(o.order_date), "dd MMM yy")}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No orders found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <OrderDetailSheet
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onUpdated={load}
      />
    </div>
  );
}
