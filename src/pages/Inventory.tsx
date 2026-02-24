import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, Plus, ChevronDown, ChevronRight, Package, Ticket, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import FilterSelect from "@/components/FilterSelect";
import AddInventoryDialog from "@/components/AddInventoryDialog";
import InventoryDetailSheet from "@/components/InventoryDetailSheet";
import { cn } from "@/lib/utils";

interface InventoryItem {
  id: string;
  category: string;
  section: string | null;
  block: string | null;
  row_name: string | null;
  seat: string | null;
  face_value: number | null;
  status: string;
  created_at: string;
  event_id: string;
  purchase_id: string;
  events: { match_code: string; home_team: string; away_team: string; event_date: string } | null;
  purchases: { unit_cost: number; currency: string; supplier_order_id: string | null; suppliers: { name: string } | null } | null;
}

interface OrderLine {
  inventory_id: string;
  order_id: string;
}

const statusColor: Record<string, string> = {
  available: "bg-success/10 text-success border-success/20",
  reserved: "bg-warning/10 text-warning border-warning/20",
  sold: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [invRes, olRes] = await Promise.all([
      supabase
        .from("inventory")
        .select("*, events(match_code, home_team, away_team, event_date), purchases(unit_cost, currency, supplier_order_id, suppliers(name))")
        .order("created_at", { ascending: false }),
      supabase.from("order_lines").select("inventory_id, order_id"),
    ]);
    setItems((invRes.data as any) || []);
    setOrderLines((olRes.data as any) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const assignedSet = useMemo(() => new Set(orderLines.map(ol => ol.inventory_id)), [orderLines]);

  const filtered = items.filter((i) => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (i.category || "").toLowerCase().includes(q) ||
        (i.section || "").toLowerCase().includes(q) ||
        (i.block || "").toLowerCase().includes(q) ||
        (i.row_name || "").toLowerCase().includes(q) ||
        (i.seat || "").toLowerCase().includes(q) ||
        (i.events?.home_team || "").toLowerCase().includes(q) ||
        (i.events?.away_team || "").toLowerCase().includes(q) ||
        ((i.purchases as any)?.suppliers?.name || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by event
  const grouped = useMemo(() => {
    const map: Record<string, { event: InventoryItem["events"]; eventId: string; items: InventoryItem[] }> = {};
    filtered.forEach(i => {
      const key = i.event_id;
      if (!map[key]) map[key] = { event: i.events, eventId: key, items: [] };
      map[key].items.push(i);
    });
    return Object.values(map).sort((a, b) => {
      const da = a.event?.event_date || "";
      const db = b.event?.event_date || "";
      return da.localeCompare(db);
    });
  }, [filtered]);

  const handleDelete = async (e: React.MouseEvent, item: InventoryItem) => {
    e.stopPropagation();
    if (!confirm("Delete this inventory item?")) return;
    await supabase.from("order_lines").delete().eq("inventory_id", item.id);
    const { error } = await supabase.from("inventory").delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Inventory item deleted");
    load();
  };

  const sym = (c: string) => (c === "GBP" ? "£" : c === "USD" ? "$" : "€");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""} across {grouped.length} event{grouped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Inventory
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
        <FilterSelect label="Status" value={filterStatus} onValueChange={setFilterStatus} options={[
          { value: "available", label: "Available" },
          { value: "reserved", label: "Reserved" },
          { value: "sold", label: "Sold" },
          { value: "cancelled", label: "Cancelled" },
        ]} />
      </div>

      {/* Event Cards */}
      <div className="space-y-3">
        {grouped.length === 0 && (
          <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No inventory items found</div>
        )}
        {grouped.map(group => {
          const total = group.items.length;
          const available = group.items.filter(i => i.status === "available").length;
          const sold = group.items.filter(i => i.status === "sold").length;
          const reserved = group.items.filter(i => i.status === "reserved").length;
          const assigned = group.items.filter(i => assignedSet.has(i.id)).length;
          const unassigned = total - assigned;
          const isExpanded = expandedEvent === group.eventId;
          const eventDate = group.event?.event_date ? new Date(group.event.event_date) : null;
          const isPast = eventDate ? eventDate < new Date() : false;

          return (
            <div key={group.eventId} className="rounded-xl border bg-card overflow-hidden shadow-sm">
              {/* Collapsible header — the "credit card" style */}
              <button
                onClick={() => setExpandedEvent(isExpanded ? null : group.eventId)}
                className={cn(
                  "w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/40",
                  isPast && "opacity-70"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex items-center justify-center h-11 w-11 rounded-lg",
                    "bg-primary/10 text-primary"
                  )}>
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-base">
                      {group.event ? `${group.event.home_team} vs ${group.event.away_team}` : "Unknown Event"}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{group.event?.match_code}</span>
                      {eventDate && (
                        <span className="text-xs text-muted-foreground">
                          {format(eventDate, "EEE dd MMM yyyy, HH:mm")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Stats pills */}
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="text-center px-3 py-1 rounded-md bg-muted/60">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="text-sm font-bold font-mono">{total}</p>
                    </div>
                    {available > 0 && (
                      <Badge variant="outline" className="text-[10px] font-bold uppercase bg-success/10 text-success border-success/20">
                        {available} avail
                      </Badge>
                    )}
                    {sold > 0 && (
                      <Badge variant="outline" className="text-[10px] font-bold uppercase bg-primary/10 text-primary border-primary/20">
                        {sold} sold
                      </Badge>
                    )}
                    {reserved > 0 && (
                      <Badge variant="outline" className="text-[10px] font-bold uppercase bg-warning/10 text-warning border-warning/20">
                        {reserved} held
                      </Badge>
                    )}
                    <div className="text-center px-3 py-1 rounded-md bg-muted/60">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned</p>
                      <p className="text-sm font-bold font-mono">{assigned}/{total}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                </div>
              </button>

              {/* Mobile stats row */}
              {!isExpanded && (
                <div className="flex sm:hidden items-center gap-2 px-5 pb-3 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{total} total</Badge>
                  {available > 0 && <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">{available} avail</Badge>}
                  {sold > 0 && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">{sold} sold</Badge>}
                  <Badge variant="outline" className="text-[10px]">{assigned}/{total} assigned</Badge>
                </div>
              )}

              {/* Expanded detail table */}
              {isExpanded && (
                <div className="border-t overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] uppercase tracking-wider">Supplier</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Category</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Section</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Block</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Row</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Seat</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Face Value</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Cost</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Assigned</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-center">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => {
                        const purchase = item.purchases as any;
                        const isAssigned = assignedSet.has(item.id);
                        return (
                          <TableRow key={item.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedId(item.id)}>
                            <TableCell className="font-medium text-sm">{purchase?.suppliers?.name || "—"}</TableCell>
                            <TableCell className="text-sm">{item.category}</TableCell>
                            <TableCell className="text-sm">{item.section || "—"}</TableCell>
                            <TableCell className="text-sm">{item.block || "—"}</TableCell>
                            <TableCell className="text-sm">{item.row_name || "—"}</TableCell>
                            <TableCell className="text-sm">{item.seat || "—"}</TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {item.face_value != null ? `£${Number(item.face_value).toFixed(2)}` : "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {purchase ? `${sym(purchase.currency)}${Number(purchase.unit_cost).toFixed(2)}` : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusColor[item.status] || ""}>
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isAssigned ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>
                                {isAssigned ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => handleDelete(e, item)}
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

      {showAdd && <AddInventoryDialog onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}

      <InventoryDetailSheet
        inventoryId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={load}
      />
    </div>
  );
}
