import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Trash2, Plus, ChevronDown, ChevronRight, Ticket, Download, Apple, Smartphone, Copy, Check, Users, User, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import FilterSelect from "@/components/FilterSelect";
import AddInventoryDialog from "@/components/AddInventoryDialog";
import InventoryDetailSheet from "@/components/InventoryDetailSheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  password: string | null;
  iphone_pass_link: string | null;
  android_pass_link: string | null;
  pk_pass_url: string | null;
  source: string | null;
  status: string;
  created_at: string;
  event_id: string;
  purchase_id: string | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string; venue: string | null } | null;
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
  const headers = ["Event", "Date", "First Name", "Last Name", "Supporter ID", "Email", "Category", "Section", "Block", "Row", "Seat", "Face Value", "Status", "iPhone Pass", "Android Pass", "PK Pass"];
  const rows = items.map(i => [
    i.events ? `${i.events.home_team} vs ${i.events.away_team}` : "",
    i.events?.event_date ? format(new Date(i.events.event_date), "dd/MM/yyyy HH:mm") : "",
    i.first_name || "",
    i.last_name || "",
    i.supporter_id || "",
    i.email || "",
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
  toast.success("Exported to CSV");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-0.5 rounded hover:bg-muted/60 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

/** Group items by matching seating info into quantity groups */
function groupByQuantity(items: InventoryItem[]): { key: string; items: InventoryItem[]; qty: number }[] {
  // Group by purchase_id if exists, otherwise by seating signature (section+block+row)
  const groups: Map<string, InventoryItem[]> = new Map();
  items.forEach(item => {
    let key: string;
    if (item.purchase_id) {
      key = `purchase_${item.purchase_id}`;
    } else {
      // Group by seating signature so adjacent seats pair up
      const sig = [item.section || item.category || "", item.block || "", item.row_name || ""].join("|");
      key = `seat_${item.event_id}_${sig}`;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    items: items.sort((a, b) => (a.seat || "").localeCompare(b.seat || "", undefined, { numeric: true })),
    qty: items.length,
  }));
}

function getQtyLabel(qty: number): string {
  if (qty === 1) return "Single";
  if (qty === 2) return "Pair";
  if (qty === 3) return "Triple";
  if (qty === 4) return "Quad";
  return `x${qty}`;
}

function getQtyColor(qty: number): string {
  if (qty === 1) return "bg-muted text-muted-foreground";
  if (qty === 2) return "bg-primary/10 text-primary border-primary/20";
  if (qty === 3) return "bg-warning/10 text-warning border-warning/20";
  if (qty >= 4) return "bg-success/10 text-success border-success/20";
  return "";
}

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [invRes, olRes] = await Promise.all([
      supabase
        .from("inventory")
        .select("*, events(match_code, home_team, away_team, event_date, venue)")
        .order("created_at", { ascending: false }),
      supabase.from("order_lines").select("inventory_id, order_id"),
    ]);
    setItems((invRes.data as any) || []);
    setOrderLines((olRes.data as any) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const assignedSet = useMemo(() => new Set(orderLines.map(ol => ol.inventory_id)), [orderLines]);

  const eventOptions = useMemo(() => {
    const seen = new Map<string, string>();
    items.forEach(i => {
      if (i.events) seen.set(i.events.match_code, `${i.events.home_team} vs ${i.events.away_team}`);
    });
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [items]);

  const filtered = items.filter((i) => {
    // Hide £0.00 entries
    if ((i.face_value === 0 || i.face_value === null) && !i.purchase_id) return false;
    if (filterEvent !== "all" && i.events?.match_code !== filterEvent) return false;
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
        (i.first_name || "").toLowerCase().includes(q) ||
        (i.last_name || "").toLowerCase().includes(q) ||
        (i.supporter_id || "").toLowerCase().includes(q) ||
        (i.email || "").toLowerCase().includes(q) ||
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

  const handleDeleteEvent = async (e: React.MouseEvent, eventId: string, eventLabel: string) => {
    e.stopPropagation();
    if (!confirm(`Delete "${eventLabel}" and ALL its inventory, orders, purchases, and related data? This cannot be undone.`)) return;
    // Delete order_lines for orders of this event
    const { data: eventOrders } = await supabase.from("orders").select("id").eq("event_id", eventId);
    const orderIds = (eventOrders || []).map(o => o.id);
    if (orderIds.length > 0) {
      await supabase.from("order_lines").delete().in("order_id", orderIds);
      await supabase.from("order_status_history").delete().in("order_id", orderIds);
      await supabase.from("refunds").delete().in("order_id", orderIds);
      await supabase.from("orders").delete().in("id", orderIds);
    }
    // Delete inventory order_lines
    const { data: eventInv } = await supabase.from("inventory").select("id").eq("event_id", eventId);
    const invIds = (eventInv || []).map(i => i.id);
    if (invIds.length > 0) {
      await supabase.from("order_lines").delete().in("inventory_id", invIds);
    }
    await supabase.from("inventory").delete().eq("event_id", eventId);
    await supabase.from("purchases").delete().eq("event_id", eventId);
    await supabase.from("events").delete().eq("id", eventId);
    toast.success("Event and all related data deleted");
    load();
  };

  const handleDeleteGroup = async (e: React.MouseEvent, groupItems: InventoryItem[]) => {
    e.stopPropagation();
    if (!confirm(`Delete ${groupItems.length} ticket${groupItems.length !== 1 ? "s" : ""} in this group?`)) return;
    const ids = groupItems.map(i => i.id);
    await supabase.from("order_lines").delete().in("inventory_id", ids);
    const { error } = await supabase.from("inventory").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${groupItems.length} ticket${groupItems.length !== 1 ? "s" : ""} deleted`);
    load();
  };

  const toggleItemExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
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
        <FilterSelect label="Game" value={filterEvent} onValueChange={setFilterEvent} options={eventOptions} />
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

          // Quantity grouping summary
          const availableItems = group.items.filter(i => i.status === "available");
          const qtyGroups = groupByQuantity(availableItems);
          const singles = qtyGroups.filter(g => g.qty === 1).length;
          const pairs = qtyGroups.filter(g => g.qty === 2).length;
          const triples = qtyGroups.filter(g => g.qty === 3).length;
          const quads = qtyGroups.filter(g => g.qty >= 4).length;

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
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-base">
                        {group.event ? `${group.event.home_team} vs ${group.event.away_team}` : "Unknown Event"}
                      </p>
                      {group.event?.venue && (
                        <span className="text-xs text-muted-foreground">• {group.event.venue}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {eventDate && (
                        <span className="text-xs font-semibold text-foreground">
                          {format(eventDate, "EEE dd MMM yyyy, HH:mm")}
                        </span>
                      )}
                    </div>
                    {/* Quantity summary badges */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {singles > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                          <User className="h-2.5 w-2.5 mr-0.5" />{singles} single{singles !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {pairs > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          <Users className="h-2.5 w-2.5 mr-0.5" />{pairs} pair{pairs !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {triples > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                          {triples} triple{triples !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {quads > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">
                          {quads} quad{quads !== 1 ? "s" : ""}+
                        </Badge>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => handleDeleteEvent(e, group.eventId, group.event ? `${group.event.home_team} vs ${group.event.away_team}` : "Unknown Event")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (() => {
                // Group items by section
                const sectionMap: Record<string, InventoryItem[]> = {};
                group.items.forEach(item => {
                  const sec = item.section || item.category || "Unknown";
                  if (!sectionMap[sec]) sectionMap[sec] = [];
                  sectionMap[sec].push(item);
                });
                const sectionEntries = Object.entries(sectionMap);
                const uniqueSections = sectionEntries.length;

                return (
                  <div className="border-t">
                    {/* Event hero header */}
                    <div className="px-6 py-6 bg-muted/20 text-center space-y-3">
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                        {group.event ? (
                          <>{group.event.home_team} <span className="text-destructive">v</span> {group.event.away_team}</>
                        ) : "Unknown Event"}
                      </h2>
                      {eventDate && (
                        <p className="text-xs tracking-widest text-muted-foreground uppercase font-mono">
                          {format(eventDate, "dd MMMM yyyy")} · {format(eventDate, "HH:mm")}
                          {group.event?.venue && <> · {group.event.venue}</>}
                        </p>
                      )}
                      {/* Stats bar */}
                      <div className="inline-flex items-center gap-6 border rounded-lg px-6 py-3 bg-card mt-2">
                        <div className="text-center">
                          <p className="text-lg font-bold text-primary font-mono">{total}</p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Tickets</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-primary font-mono">{assigned}</p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Assigned</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-primary font-mono">{uniqueSections}</p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sections</p>
                        </div>
                      </div>
                    </div>

                    {/* Sections */}
                    {sectionEntries.map(([sectionName, sectionItems]) => {
                      const allGroups = groupByQuantity(sectionItems);
                      return (
                        <div key={sectionName} className="px-5 py-4 space-y-3">
                          {/* Section title */}
                          <div className="flex items-center gap-3">
                            <h3 className="text-sm font-black uppercase tracking-wide">{sectionName}</h3>
                            <Badge className="bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider">
                              {sectionItems.length} Ticket{sectionItems.length !== 1 ? "s" : ""}
                            </Badge>
                          {(() => {
                              const src = sectionItems[0]?.source;
                              return src && src !== "IJK" && src !== "Manual Entry" ? (
                                <span className="text-[10px] text-muted-foreground font-medium">via {src}</span>
                              ) : null;
                            })()}
                          </div>

                          {/* Grouped ticket cards */}
                          <div className="space-y-3">
                            {allGroups.map(qg => {
                              const email = qg.items[0]?.email;
                              const area = qg.items[0]?.block;
                              const row = qg.items[0]?.row_name;
                              const seats = qg.items.map(i => i.seat).filter(Boolean).join(", ");

                              return (
                                <div key={qg.key} className="rounded-xl border bg-card overflow-hidden">
                                  {/* Group header: email + area/row/seats + ticket count */}
                                  <div className="px-5 py-3 flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                      {email && (
                                        <p className="text-sm font-medium text-primary">{email}</p>
                                      )}
                                      <p className="text-xs text-muted-foreground font-mono">
                                        {area && <>Area <span className="text-foreground font-semibold">{area}</span></>}
                                        {row && <>{area ? " · " : ""}Row <span className="text-foreground font-semibold">{row}</span></>}
                                        {seats && <>{(area || row) ? " · " : ""}Seats <span className="text-foreground font-semibold">{seats}</span></>}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={(e) => handleDeleteGroup(e, qg.items)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <div className="text-right">
                                        <p className="text-xl font-bold text-destructive">{qg.qty}</p>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ticket{qg.qty !== 1 ? "s" : ""}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Individual ticket chips */}
                                  <div className="px-5 pb-4 flex flex-wrap gap-2">
                                    {qg.items.map((item, idx) => (
                                      <button
                                        key={item.id}
                                        onClick={() => toggleItemExpanded(item.id)}
                                        className={cn(
                                          "flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted/60 transition-colors text-left",
                                          expandedItems.has(item.id) ? "bg-muted/60 border-primary/30" : "bg-muted/30"
                                        )}
                                      >
                                        <span className="flex items-center justify-center h-7 w-7 rounded bg-destructive/10 text-destructive text-xs font-bold font-mono">
                                          {item.seat || (idx + 1)}
                                        </span>
                                        <div className="text-xs">
                                          <p className="font-medium">{[item.first_name, item.last_name].filter(Boolean).join(" ") || "—"}</p>
                                          <p className="text-muted-foreground">Ticket {idx + 1}/{qg.qty}</p>
                                        </div>
                                        {item.row_name && (
                                          <Badge variant="outline" className="text-[9px] ml-1 font-mono">R{item.row_name}</Badge>
                                        )}
                                        <Badge variant="outline" className={cn("text-[9px]", statusColor[item.status] || "")}>
                                          {item.status}
                                        </Badge>
                                        {item.source && item.source !== "Own" && item.source !== "Manual Entry" && (
                                          <Badge variant="outline" className="text-[9px] bg-accent text-accent-foreground">
                                            {item.source}
                                          </Badge>
                                        )}
                                        {expandedItems.has(item.id) ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Expanded details for individual tickets */}
                                  {qg.items.filter(item => expandedItems.has(item.id)).map(item => {
                                    const hasPassLinks = item.iphone_pass_link || item.android_pass_link || item.pk_pass_url;
                                    const hasLoginDetails = item.first_name || item.last_name || item.email || item.password || item.supporter_id;
                                    return (
                                      <div key={`detail-${item.id}`} className="border-t px-5 py-3 space-y-3 bg-muted/10">
                                        <p className="text-xs font-semibold text-muted-foreground">
                                          Seat {item.seat || "—"} · {[item.first_name, item.last_name].filter(Boolean).join(" ") || "Unknown"}
                                        </p>
                                        {hasLoginDetails && (
                                          <div className="rounded-lg bg-muted/30 p-3">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Login Details</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                              {item.supporter_id && (
                                                <div className="flex items-center gap-1">
                                                  <div>
                                                    <span className="text-muted-foreground block">Supporter ID</span>
                                                    <span className="font-mono font-medium">{item.supporter_id}</span>
                                                  </div>
                                                  <CopyButton text={item.supporter_id} />
                                                </div>
                                              )}
                                              {item.email && (
                                                <div className="flex items-center gap-1">
                                                  <div>
                                                    <span className="text-muted-foreground block">Email</span>
                                                    <span className="font-medium">{item.email}</span>
                                                  </div>
                                                  <CopyButton text={item.email} />
                                                </div>
                                              )}
                                              {item.password && (
                                                <div className="flex items-center gap-1">
                                                  <div>
                                                    <span className="text-muted-foreground block">Password</span>
                                                    <span className="font-mono font-medium">{item.password}</span>
                                                  </div>
                                                  <CopyButton text={item.password} />
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {hasPassLinks && (
                                          <div className="rounded-lg bg-muted/30 p-3">
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Digital Passes</p>
                                            <div className="space-y-2">
                                              {item.iphone_pass_link && (
                                                <div className="flex items-center gap-2 text-xs">
                                                  <Apple className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                  <a href={item.iphone_pass_link} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1" onClick={e => e.stopPropagation()}>{item.iphone_pass_link}</a>
                                                  <CopyButton text={item.iphone_pass_link} />
                                                </div>
                                              )}
                                              {item.android_pass_link && (
                                                <div className="flex items-center gap-2 text-xs">
                                                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                  <a href={item.android_pass_link} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1" onClick={e => e.stopPropagation()}>{item.android_pass_link}</a>
                                                  <CopyButton text={item.android_pass_link} />
                                                </div>
                                              )}
                                              {item.pk_pass_url && (
                                                <div className="flex items-center gap-2 text-xs">
                                                  <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                  <a href={item.pk_pass_url} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1" onClick={e => e.stopPropagation()}>Download</a>
                                                  <CopyButton text={item.pk_pass_url} />
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2 pt-1">
                                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedId(item.id)}>
                                            <Pencil className="h-3 w-3 mr-1" /> Edit
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleDelete(e, item)}>
                                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
