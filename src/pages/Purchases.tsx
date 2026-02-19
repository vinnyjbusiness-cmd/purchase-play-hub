import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";
import FilterSelect from "@/components/FilterSelect";
import AddPurchaseDialog from "@/components/AddPurchaseDialog";
import PurchaseDetailSheet from "@/components/PurchaseDetailSheet";

interface Purchase {
  id: string;
  supplier_order_id: string | null;
  category: string;
  section: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  status: string;
  supplier_paid: boolean;
  purchase_date: string;
  notes: string | null;
  event_id: string;
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
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);

  const load = useCallback(() => {
    supabase
      .from("purchases")
      .select("*, suppliers(name), events(match_code, home_team, away_team)")
      .order("purchase_date", { ascending: false })
      .then(({ data }) => setPurchases((data as any) || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  const supplierOptions = [...new Set(purchases.map((p) => p.suppliers?.name).filter(Boolean))].map((n) => ({ value: n!, label: n! }));
  const eventOptions = [...new Set(purchases.map((p) => p.events?.match_code).filter(Boolean))].map((c) => ({ value: c!, label: c! }));

  const filtered = purchases.filter((p) => {
    if (filterSupplier !== "all" && p.suppliers?.name !== filterSupplier) return false;
    if (filterEvent !== "all" && p.events?.match_code !== filterEvent) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (p.supplier_order_id || "").toLowerCase().includes(q) ||
        (p.suppliers?.name || "").toLowerCase().includes(q) ||
        (p.events?.home_team || "").toLowerCase().includes(q) ||
        (p.events?.away_team || "").toLowerCase().includes(q) ||
        (p.notes || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalCost = filtered.reduce((s, p) => s + Number(p.total_cost || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
          <p className="text-muted-foreground">
            {filtered.length} purchase{filtered.length !== 1 ? "s" : ""} · Total: £{totalCost.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <AddPurchaseDialog onCreated={load} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search purchases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
        <FilterSelect label="Source" value={filterSupplier} onValueChange={setFilterSupplier} options={supplierOptions} />
        <FilterSelect label="Event" value={filterEvent} onValueChange={setFilterEvent} options={eventOptions} />
        <FilterSelect label="Status" value={filterStatus} onValueChange={setFilterStatus} options={[
          { value: "pending", label: "Pending" },
          { value: "confirmed", label: "Confirmed" },
          { value: "received", label: "Received" },
          { value: "cancelled", label: "Cancelled" },
        ]} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Cost/Ticket</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelectedPurchaseId(p.id)}>
                <TableCell className="font-medium">{p.suppliers?.name || "—"}</TableCell>
                <TableCell>{p.supplier_order_id || "—"}</TableCell>
                <TableCell>{p.events?.match_code || "—"}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell className="text-right">{p.quantity}</TableCell>
                <TableCell className="text-right">£{Number(p.unit_cost).toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">£{Number(p.total_cost).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={p.supplier_paid ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}>
                    {p.supplier_paid ? "Paid" : "Unpaid"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(p.purchase_date), "dd MMM yy")}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No purchases found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PurchaseDetailSheet
        purchaseId={selectedPurchaseId}
        onClose={() => setSelectedPurchaseId(null)}
        onUpdated={load}
      />
    </div>
  );
}
