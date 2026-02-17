import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";

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

  useEffect(() => {
    supabase
      .from("orders")
      .select("*, events(match_code, home_team, away_team), platforms(name)")
      .order("order_date", { ascending: false })
      .then(({ data }) => setOrders((data as any) || []));
  }, []);

  const filtered = orders.filter(
    (o) =>
      (o.order_ref || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.buyer_ref || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.events?.home_team || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.events?.away_team || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.platforms?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">All sales and customer orders</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.order_ref || "—"}</TableCell>
                <TableCell>{o.platforms?.name || "—"}</TableCell>
                <TableCell>{o.events ? `${o.events.match_code}` : "—"}</TableCell>
                <TableCell>{o.category}</TableCell>
                <TableCell className="text-right">{o.quantity}</TableCell>
                <TableCell className="text-right">£{Number(o.sale_price).toFixed(2)}</TableCell>
                <TableCell className="text-right">£{Number(o.fees).toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">£{Number(o.net_received).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColor[o.status] || ""}>{o.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(o.order_date), "dd MMM yy")}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No orders found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
