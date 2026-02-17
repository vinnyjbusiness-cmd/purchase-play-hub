import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";

interface Purchase {
  id: string;
  supplier_order_id: string | null;
  category: string;
  section: string | null;
  quantity: number;
  unit_cost: number;
  fees: number;
  total_cost: number;
  currency: string;
  exchange_rate: number;
  status: string;
  purchase_date: string;
  suppliers: { name: string } | null;
  events: { match_code: string; home_team: string; away_team: string } | null;
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  received: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("purchases")
      .select("*, suppliers(name), events(match_code, home_team, away_team)")
      .order("purchase_date", { ascending: false })
      .then(({ data }) => setPurchases((data as any) || []));
  }, []);

  const filtered = purchases.filter(
    (p) =>
      (p.supplier_order_id || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.suppliers?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.events?.home_team || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.events?.away_team || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
        <p className="text-muted-foreground">All supplier buys</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search purchases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Supplier Order</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Fees</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.suppliers?.name || "—"}</TableCell>
                <TableCell>{p.supplier_order_id || "—"}</TableCell>
                <TableCell>{p.events?.match_code || "—"}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell className="text-right">{p.quantity}</TableCell>
                <TableCell className="text-right">{p.currency === "GBP" ? "£" : p.currency === "USD" ? "$" : "€"}{Number(p.unit_cost).toFixed(2)}</TableCell>
                <TableCell className="text-right">{p.currency === "GBP" ? "£" : p.currency === "USD" ? "$" : "€"}{Number(p.fees).toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">{p.currency === "GBP" ? "£" : p.currency === "USD" ? "$" : "€"}{Number(p.total_cost).toFixed(2)}</TableCell>
                <TableCell>{p.currency}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColor[p.status] || ""}>{p.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(p.purchase_date), "dd MMM yy")}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No purchases found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
