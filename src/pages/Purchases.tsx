import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Scissors, Phone, CheckCircle2, Link2, Trash2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { format } from "date-fns";
import FilterSelect from "@/components/FilterSelect";
import AddPurchaseDialog from "@/components/AddPurchaseDialog";
import EditPurchaseDialog from "@/components/EditPurchaseDialog";
import PurchaseDetailSheet from "@/components/PurchaseDetailSheet";
import SplitPurchaseDialog from "@/components/SplitPurchaseDialog";
import { deduplicateEvents, getEventKey } from "@/lib/eventDedup";
import { formatEventTitle, getMatchBadge } from "@/lib/eventDisplay";

interface Purchase {
  id: string;
  supplier_order_id: string | null;
  category: string;
  section: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  currency: string;
  status: string;
  supplier_paid: boolean;
  purchase_date: string;
  notes: string | null;
  event_id: string;
  split_type: string | null;
  suppliers: { name: string; contact_name: string | null; contact_phone: string | null } | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string; competition: string } | null;
}

const currSym = (c: string) => (c === "USD" ? "$" : c === "EUR" ? "€" : "£");

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
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [allocations, setAllocations] = useState<Record<string, { sold: number; total: number }>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("purchases")
      .select("*, suppliers(name, contact_name, contact_phone), events(match_code, home_team, away_team, event_date, competition)")
      .order("purchase_date", { ascending: false });
    const purchaseList = (data as any) || [];
    setPurchases(purchaseList);

    // Auto-sync: ensure every purchase has inventory records
    for (const p of purchaseList) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("id")
        .eq("purchase_id", p.id);
      const existingCount = (inv || []).length;
      if (existingCount < p.quantity) {
        const toCreate = Array.from({ length: p.quantity - existingCount }, () => ({
          event_id: p.event_id,
          purchase_id: p.id,
          category: p.category,
          section: p.section,
          face_value: p.unit_cost,
          source: p.suppliers?.name || "IJK",
          split_type: p.split_type || null,
          status: "available" as const,
        }));
        await supabase.from("inventory").insert(toCreate as any);
      }
    }

    // Re-fetch allocations after sync
    if (purchaseList.length > 0) {
      const { data: invData } = await supabase
        .from("inventory")
        .select("purchase_id, status")
        .in("purchase_id", purchaseList.map((p: any) => p.id));

      const allocs: Record<string, { sold: number; total: number }> = {};
      for (const inv of invData || []) {
        if (!allocs[inv.purchase_id]) allocs[inv.purchase_id] = { sold: 0, total: 0 };
        allocs[inv.purchase_id].total++;
        if (inv.status === "sold") allocs[inv.purchase_id].sold++;
      }
      setAllocations(allocs);
    }
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
    const eventsFromPurchases = purchases
      .filter(p => p.events)
      .map(p => ({
        id: p.event_id,
        home_team: p.events!.home_team,
        away_team: p.events!.away_team,
        event_date: p.events!.event_date,
        match_code: p.events!.match_code,
      }));
    
    const { unique } = deduplicateEvents(eventsFromPurchases);
    return unique
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .map(e => ({
        value: getEventKey(e.home_team, e.away_team, e.event_date),
        label: formatEventTitle(e.home_team, e.away_team, e.match_code) + ` (${format(new Date(e.event_date), "dd MMM")})`,
      }));
  }, [purchases]);

  const filtered = purchases.filter((p) => {
    if (Number(p.total_cost || 0) <= 0 && Number(p.unit_cost || 0) <= 0) return false;
    if (filterSupplier !== "all" && p.suppliers?.name !== filterSupplier) return false;
    if (filterEvent !== "all" && p.events) {
      const key = getEventKey(p.events.home_team, p.events.away_team, p.events.event_date);
      if (key !== filterEvent) return false;
    }
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

  const grouped = useMemo(() => {
    const map: Record<string, { event: Purchase["events"]; eventKey: string; purchases: Purchase[] }> = {};
    filtered.forEach(p => {
      const key = p.events
        ? getEventKey(p.events.home_team, p.events.away_team, p.events.event_date)
        : p.event_id;
      if (!map[key]) map[key] = { event: p.events, eventKey: key, purchases: [] };
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
    <div className="p-6 space-y-6 animate-fade-in">
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
        <FilterSelect label="Contact" value={filterSupplier} onValueChange={setFilterSupplier} options={supplierOptions} />
        <FilterSelect label="Game" value={filterEvent} onValueChange={setFilterEvent} options={eventOptions} />
        <FilterSelect label="Status" value={filterStatus} onValueChange={setFilterStatus} options={[
          { value: "pending", label: "Pending" },
          { value: "confirmed", label: "Confirmed" },
          { value: "received", label: "Received" },
          { value: "cancelled", label: "Cancelled" },
        ]} />
      </div>

      <div className="space-y-5">
        {grouped.length === 0 && (
          <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No purchases found</div>
        )}
        {grouped.map(group => {
          const groupTotal = group.purchases.reduce((s, p) => s + Number(p.total_cost || 0), 0);
          const groupQty = group.purchases.reduce((s, p) => s + p.quantity, 0);
          const unpaidCount = group.purchases.filter(p => !p.supplier_paid).length;
          const paidCount = group.purchases.filter(p => p.supplier_paid).length;
          const isCollapsed = collapsedGroups.has(group.eventKey);

          return (
            <div key={group.eventKey} className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <div
                className="flex items-center justify-between px-5 py-3 border-b bg-muted/40 cursor-pointer select-none"
                onClick={() => toggleGroup(group.eventKey)}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div>
                    <p className="font-bold text-base">
                      {group.event ? formatEventTitle(group.event.home_team, group.event.away_team, group.event.match_code) : "Unknown Event"}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {group.event?.event_date ? format(new Date(group.event.event_date), "EEE dd MMM yyyy, HH:mm") : ""}
                    </span>
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
                    <p className="text-sm font-mono font-bold">{currSym(group.purchases[0]?.currency || "GBP")}{groupTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
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

              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] uppercase tracking-wider">Source</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Contact Name</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-center w-[40px]"><Phone className="h-3.5 w-3.5 mx-auto" /></TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Category</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Qty</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Cost/Ticket</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Total</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Allocated</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Paid</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-center">Allocate</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-center">Edit</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-center">Split</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-center">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.purchases.map((p) => {
                        const contact = parseNotesContact(p.notes);
                        const alloc = allocations[p.id] || { sold: 0, total: 0 };
                        const allocated = alloc.sold;
                        const total = p.quantity;
                        const fullyAllocated = allocated >= total && total > 0;
                        const hasAny = allocated > 0;
                        return (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedPurchaseId(p.id)}>
                          <TableCell className="font-medium">{p.suppliers?.name || "—"}</TableCell>
                          <TableCell>{contact.name || p.suppliers?.contact_name || "—"}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{contact.phone || p.suppliers?.contact_phone || "—"}</TableCell>
                          <TableCell>{p.category}</TableCell>
                          <TableCell className="text-right">{p.quantity}</TableCell>
                          <TableCell className="text-right">{currSym(p.currency)}{Number(p.unit_cost).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">{currSym(p.currency)}{Number(p.total_cost).toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex gap-0.5">
                                {Array.from({ length: total }, (_, i) => (
                                  <div
                                    key={i}
                                    className={`w-3 h-3 rounded-sm text-[8px] flex items-center justify-center font-bold ${
                                      i < allocated
                                        ? "bg-success/30 text-success border border-success/40"
                                        : "bg-destructive/15 text-destructive/60 border border-destructive/20"
                                    }`}
                                  >
                                    {i < allocated ? "✓" : ""}
                                  </div>
                                ))}
                              </div>
                              <span className={`text-[10px] font-mono whitespace-nowrap ${fullyAllocated ? "text-success" : hasAny ? "text-warning" : "text-muted-foreground"}`}>
                                {allocated}/{total}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={p.supplier_paid ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}>
                              {p.supplier_paid ? "Paid" : "Unpaid"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{format(new Date(p.purchase_date), "dd MMM yy, HH:mm")}</TableCell>
                          <TableCell className="text-center">
                            {fullyAllocated ? (
                              <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-primary hover:text-primary"
                                title="Allocate tickets"
                                onClick={(e) => { e.stopPropagation(); setSelectedPurchaseId(p.id); }}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Edit purchase"
                              onClick={(e) => { e.stopPropagation(); setEditPurchase(p); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
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
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete purchase"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm("Delete this purchase? Any assigned inventory will be unlinked from orders.")) return;
                                const { data: inv } = await supabase.from("inventory").select("id").eq("purchase_id", p.id);
                                const invIds = (inv || []).map(i => i.id);
                                if (invIds.length > 0) {
                                  await supabase.from("order_lines").delete().in("inventory_id", invIds);
                                  await supabase.from("inventory").delete().eq("purchase_id", p.id);
                                }
                                await supabase.from("purchases").delete().eq("id", p.id);
                                load();
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PurchaseDetailSheet
        purchaseId={selectedPurchaseId}
        onClose={() => setSelectedPurchaseId(null)}
        onUpdated={load}
      />
      <EditPurchaseDialog
        purchase={editPurchase}
        open={!!editPurchase}
        onClose={() => setEditPurchase(null)}
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
          onSplit={load}
        />
      )}
    </div>
  );
}
