import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, Plus, ChevronDown, ChevronRight, Ticket, Download, Apple, Smartphone } from "lucide-react";
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
  ticket_name: string | null;
  supporter_id: string | null;
  iphone_pass_link: string | null;
  android_pass_link: string | null;
  pk_pass_url: string | null;
  status: string;
  created_at: string;
  event_id: string;
  purchase_id: string | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string } | null;
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

function exportToCSV(items: InventoryItem[]) {
  const headers = ["Event", "Match Code", "Date", "Name", "Supporter ID", "Category", "Section", "Block", "Row", "Seat", "Face Value", "Status", "iPhone Pass", "Android Pass", "PK Pass"];
  const rows = items.map(i => [
    i.events ? `${i.events.home_team} vs ${i.events.away_team}` : "",
    i.events?.match_code || "",
    i.events?.event_date ? format(new Date(i.events.event_date), "dd/MM/yyyy HH:mm") : "",
    i.ticket_name || "",
    i.supporter_id || "",
    i.category || "",
    i.section || "",
    i.block || "",
    i.row_name || "",
    i.seat || "",
    i.face_value != null ? i.face_value.toFixed(2) : "",
    i.status || "",
    i.iphone_pass_link || "",
    i.android_pass_link || "",
    i.pk_pass_url || "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventory-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Exported to CSV (Google Sheets compatible)");
}

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
        .select("*, events(match_code, home_team, away_team, event_date)")
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
        (i.ticket_name || "").toLowerCase().includes(q) ||
        (i.supporter_id || "").toLowerCase().includes(q) ||
        (i.events?.home_team || "").toLowerCase().includes(q) ||
        (i.events?.away_team || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} ticket{filtered.length !== 1 ? "s" : ""} across {grouped.length} event{grouped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportToCSV(filtered)}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Inventory
          </Button>
        </div>
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
          const isExpanded = expandedEvent === group.eventId;
          const eventDate = group.event?.event_date ? new Date(group.event.event_date) : null;
          const isPast = eventDate ? eventDate < new Date() : false;

          return (
            <div key={group.eventId} className="rounded-xl border bg-card overflow-hidden shadow-sm">
              <button
                onClick={() => setExpandedEvent(isExpanded ? null : group.eventId)}
                className={cn(
                  "w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/40",
                  isPast && "opacity-70"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-primary/10 text-primary">
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

              {!isExpanded && (
                <div className="flex sm:hidden items-center gap-2 px-5 pb-3 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{total} total</Badge>
                  {available > 0 && <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">{available} avail</Badge>}
                  {sold > 0 && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">{sold} sold</Badge>}
                  <Badge variant="outline" className="text-[10px]">{assigned}/{total} assigned</Badge>
                </div>
              )}

              {isExpanded && (
                <div className="border-t overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] uppercase tracking-wider">Name</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Supporter ID</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Category</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Section</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Block</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Row</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Seat</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-right">Face Value</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Passes</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Assigned</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-center">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <TableRow key={item.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedId(item.id)}>
                          <TableCell className="font-medium text-sm">{item.ticket_name || "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{item.supporter_id || "—"}</TableCell>
                          <TableCell className="text-sm">{item.category}</TableCell>
                          <TableCell className="text-sm">{item.section || "—"}</TableCell>
                          <TableCell className="text-sm">{item.block || "—"}</TableCell>
                          <TableCell className="text-sm">{item.row_name || "—"}</TableCell>
                          <TableCell className="text-sm">{item.seat || "—"}</TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {item.face_value != null ? `£${Number(item.face_value).toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {item.iphone_pass_link && (
                                <a href={item.iphone_pass_link} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} title="iPhone Pass">
                                  <Apple className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </a>
                              )}
                              {item.android_pass_link && (
                                <a href={item.android_pass_link} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} title="Android Pass">
                                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </a>
                              )}
                              {item.pk_pass_url && (
                                <a href={item.pk_pass_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} title="Download PK Pass">
                                  <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </a>
                              )}
                              {!item.iphone_pass_link && !item.android_pass_link && !item.pk_pass_url && "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColor[item.status] || ""}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={assignedSet.has(item.id) ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>
                              {assignedSet.has(item.id) ? "Yes" : "No"}
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
                      ))}
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
