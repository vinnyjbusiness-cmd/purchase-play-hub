import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";
import FilterSelect from "@/components/FilterSelect";
import AddOrderDialog from "@/components/AddOrderDialog";

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
  order_date: string;
  currency: string;
  events: { match_code: string; home_team: string; away_team: string } | null;
  platforms: { name: string } | null;
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  fulfilled: "bg-primary/10 text-primary border-primary/20",
  delivered: "bg-success/10 text-success border-success/20",
  refunded: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground",
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(() => {
    supabase
      .from("orders")
      .select("*, events(match_code, home_team, away_team), platforms(name)")
      .order("order_date", { ascending: false })
      .then(({ data }) => setOrders((data as any) || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  const platformOptions = [...new Set(orders.map((o) => o.platforms?.name).filter(Boolean))].map((n) => ({ value: n!, label: n! }));
  const eventOptions = [...new Set(orders.map((o) => o.events?.match_code).filter(Boolean))].map((c) => ({ value: c!, label: c! }));

  const filtered = orders.filter((o) => {
    if (filterPlatform !== "all" && o.platforms?.name !== filterPlatform) return false;
    if (filterEvent !== "all" && o.events?.match_code !== filterEvent) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            {filtered.length} order{filtered.length !== 1 ? "s" : ""} · Revenue: £{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </p>
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
              <TableHead className="text-right">Sale Price</TableHead>
              <TableHead className="text-right">Fees</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.order_ref || "—"}</TableCell>
                <TableCell>{o.platforms?.name || "—"}</TableCell>
                <TableCell>{o.events?.match_code || "—"}</TableCell>
                <TableCell>{o.category}</TableCell>
                <TableCell className="text-right">{o.quantity}</TableCell>
                <TableCell className="text-right">£{Number(o.sale_price).toFixed(2)}</TableCell>
                <TableCell className="text-right">£{Number(o.fees).toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">£{Number(o.net_received).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColor[o.status] || ""}>{o.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">{o.delivery_type.replace("_", " ")}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(o.order_date), "dd MMM yy")}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No orders found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
