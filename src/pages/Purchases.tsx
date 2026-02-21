import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Scissors, Phone } from "lucide-react";
import { format } from "date-fns";
import FilterSelect from "@/components/FilterSelect";
import AddPurchaseDialog from "@/components/AddPurchaseDialog";
import PurchaseDetailSheet from "@/components/PurchaseDetailSheet";
import SplitPurchaseDialog from "@/components/SplitPurchaseDialog";

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
  suppliers: { name: string; contact_name: string | null; contact_phone: string | null } | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string } | null;
}

/** Extract Name: X and Phone: X from pipe-delimited notes */
function parseNotesContact(notes: string | null): { name: string | null; phone: string | null } {
  if (!notes) return { name: null, phone: null };
  const parts = notes.split(" | ");
  let name: string | null = null;
  let phone: string | null = null;
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed.startsWith("Name: ")) name = trimmed.slice(6);
    else if (trimmed.startsWith("Website: ")) name = trimmed.slice(9);
    if (trimmed.startsWith("Phone: ")) phone = trimmed.slice(7);
  }
  return { name, phone };
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
  const [splitPurchase, setSplitPurchase] = useState<Purchase | null>(null);

  const load = useCallback(() => {
    supabase
      .from("purchases")
      .select("*, suppliers(name, contact_name, contact_phone), events(match_code, home_team, away_team, event_date)")
      .order("purchase_date", { ascending: false })
      .then(({ data }) => setPurchases((data as any) || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  const supplierOptions = useMemo(() => {
    const seen = new Map<string, string>();
    purchases.forEach(p => {
      if (p.suppliers?.name) seen.set(p.suppliers.name, p.suppliers.name);
    });
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [purchases]);

  const eventOptions = useMemo(() => {
    const seen = new Map<string, string>();
    purchases.forEach(p => {
      if (p.events) seen.set(p.events.match_code, `${p.events.match_code} — ${p.events.home_team} vs ${p.events.away_team}`);
    });
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [purchases]);

  const filtered = purchases.filter((p) => {
    if (filterSupplier !== "all" && p.suppliers?.name !== filterSupplier) return false;
    if (filterEvent !== "all" && p.events?.match_code !== filterEvent) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (p.supplier_order_id || "").toLowerCase().includes(q) ||
        (p.suppliers?.name || "").toLowerCase().includes(q) ||
        (p.suppliers?.contact_name || "").toLowerCase().includes(q) ||
        (p.events?.home_team || "").toLowerCase().includes(q) ||
        (p.events?.away_team || "").toLowerCase().includes(q) ||
        (p.notes || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by event
  const grouped = useMemo(() => {
    const map: Record<string, { event: Purchase["events"]; eventId: string; purchases: Purchase[] }> = {};
    filtered.forEach(p => {
      const key = p.event_id;
      if (!map[key]) map[key] = { event: p.events, eventId: key, purchases: [] };
      map[key].purchases.push(p);
    });
    return Object.values(map).sort((a, b) => {
      const da = a.event?.event_date || "";
      const db = b.event?.event_date || "";
      return da.localeCompare(db);
    });
  }, [filtered]);

  const totalCost = filtered.reduce((s, p) => s + Number(p.total_cost || 0), 0);
  const totalQtyAll = filtered.reduce((s, p) => s + p.quantity, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} purchase{filtered.length !== 1 ? "s" : ""} · {totalQtyAll} tickets across {grouped.length} game{grouped.length !== 1 ? "s" : ""} · Total: £{totalCost.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
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
        <FilterSelect label="Game" value={filterEvent} onValueChange={setFilterEvent} options={eventOptions} />
        <FilterSelect label="Status" value={filterStatus} onValueChange={setFilterStatus} options={[
          { value: "pending", label: "Pending" },
          { value: "confirmed", label: "Confirmed" },
          { value: "received", label: "Received" },
          { value: "cancelled", label: "Cancelled" },
        ]} />
      </div>

      {/* Grouped by game */}
      <div className="space-y-5">
        {grouped.length === 0 && (
          <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No purchases found</div>
        )}
        {grouped.map(group => {
          const groupTotal = group.purchases.reduce((s, p) => s + Number(p.total_cost || 0), 0);
          const groupQty = group.purchases.reduce((s, p) => s + p.quantity, 0);
          const unpaidCount = group.purchases.filter(p => !p.supplier_paid).length;
          const paidCount = group.purchases.filter(p => p.supplier_paid).length;

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
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Purchases</p>
                    <p className="text-sm font-mono font-bold">{group.purchases.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tickets</p>
                    <p className="text-sm font-mono font-bold">{groupQty}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cost</p>
                    <p className="text-sm font-mono font-bold">£{groupTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
                  </div>
                  {paidCount > 0 && (
                    <Badge variant="outline" className="text-[10px] font-bold uppercase bg-success/10 text-success border-success/20">
                      {paidCount} paid
                    </Badge>
                  )}
                  {unpaidCount > 0 && (
                    <Badge variant="outline" className="text-[10px] font-bold uppercase bg-warning/10 text-warning border-warning/20">
                      {unpaidCount} unpaid
                    </Badge>
                  )}
                </div>
              </div>

              {/* Purchases table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wider">Source</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Supplier Name</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-center w-[40px]"><Phone className="h-3.5 w-3.5 mx-auto" /></TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Order ID</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Category</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-right">Qty</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-right">Cost/Ticket</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-right">Total</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Paid</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Notes</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.purchases.map((p) => {
                      const contact = parseNotesContact(p.notes);
                      return (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedPurchaseId(p.id)}>
                        <TableCell className="font-medium">{p.suppliers?.name || "—"}</TableCell>
                        <TableCell>{contact.name || p.suppliers?.contact_name || "—"}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{contact.phone || p.suppliers?.contact_phone || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{p.supplier_order_id || "—"}</TableCell>
                        <TableCell>{p.category}</TableCell>
                        <TableCell className="text-right">{p.quantity}</TableCell>
                        <TableCell className="text-right">£{Number(p.unit_cost).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">£{Number(p.total_cost).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.supplier_paid ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}>
                            {p.supplier_paid ? "Paid" : "Unpaid"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate" title={p.notes || ""}>{p.notes || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{format(new Date(p.purchase_date), "dd MMM yy, HH:mm")}</TableCell>
                        <TableCell>
                          {p.quantity > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Split purchase"
                              onClick={(e) => { e.stopPropagation(); setSplitPurchase(p); }}
                            >
                              <Scissors className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
      </div>

      <PurchaseDetailSheet
        purchaseId={selectedPurchaseId}
        onClose={() => setSelectedPurchaseId(null)}
        onUpdated={load}
      />

      {splitPurchase && (
        <SplitPurchaseDialog
          purchaseId={splitPurchase.id}
          currentQuantity={splitPurchase.quantity}
          category={splitPurchase.category}
          section={splitPurchase.section}
          unitCost={splitPurchase.unit_cost}
          currency="GBP"
          supplierName={splitPurchase.suppliers?.name || "Unknown"}
          onClose={() => setSplitPurchase(null)}
          onSplit={() => { setSplitPurchase(null); load(); }}
        />
      )}
    </div>
  );
}
